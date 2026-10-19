# EyeReport → Eye TV hand-off (for the EyeReport team)

When an EyeReport moderator **approves a report that contains a video**, EyeReport sends it to Eye TV automatically.
Eye TV puts it in its **review queue** (status *pending*, shown as “From EyeReport”). An Eye TV editor then reviews and publishes it.
Nothing is published on Eye TV automatically, and **no personal details of the citizen are ever sent**.

## 1. One-time setup
1. Agree a long random **shared secret** (40+ characters). Never put it in source code or chat.
2. **Eye TV (cPanel → Setup Node.js App):** add the variable `EYE_REPORT_WEBHOOK_SECRET` = the secret → Save → Restart.
3. **EyeReport:** store the same secret in its own secret store / environment.
4. Endpoint: `POST https://webtv.eyemedia.ng/api/integrations/eye-report` (use the staging address while testing).
5. Eye TV must also have Mux connected (see the Mux setup guide), because Eye TV hands the video link to Mux.

## 2. The request
`Content-Type: application/json`, plus a signature header so Eye TV knows the call really comes from EyeReport:

`X-EyeReport-Signature: t=<unix seconds>,v1=<hex HMAC-SHA256>`

- `t` is the current time in seconds. Requests older or newer than **5 minutes** are refused.
- `v1` is the HMAC-SHA256, keyed with the shared secret, of the text `<t>.<raw request body>` (the exact bytes you send), written as lowercase hex.

### Body
| Field | Required | Notes |
|---|---|---|
| `externalId` | yes | EyeReport's own id for the report (letters, numbers, `. _ : -`, up to 100). Sending the same id again never creates a second video. |
| `title` | yes | 3–200 characters |
| `videoUrl` | yes | An **https** link to the video file that stays valid for at least a few hours (a time-limited signed storage link is ideal). Mux downloads it; Eye TV does not keep it. |
| `description` | no | up to 4000 characters |
| `category` | no | Eye TV category slug, e.g. `public-safety`, `traffic-transport`. Unknown or missing: the editor chooses. |
| `location` | no | up to 160 characters |

**No other field is accepted.** A request that includes a name, email, phone number or anything else is rejected with `400`. This is on purpose: the citizen's contact details stay in EyeReport.

### Example (Node.js)
```js
import { createHmac } from 'node:crypto'
const body = JSON.stringify({ externalId: 'ER-1042', title: 'Pothole on Ojota flyover',
  description: 'Large pothole during rush hour.', category: 'traffic-transport', location: 'Ojota, Lagos',
  videoUrl: 'https://files.example.com/er/1042.mp4?signature=…' })
const t = Math.floor(Date.now() / 1000)
const v1 = createHmac('sha256', process.env.EYE_REPORT_WEBHOOK_SECRET).update(`${t}.${body}`).digest('hex')
const res = await fetch('https://webtv.eyemedia.ng/api/integrations/eye-report', {
  method: 'POST', headers: { 'Content-Type': 'application/json', 'X-EyeReport-Signature': `t=${t},v1=${v1}` }, body })
```

### Example (PHP, for the PCF backend)
```php
$body = json_encode(['externalId' => 'ER-1042', 'title' => 'Pothole on Ojota flyover', 'videoUrl' => $signedUrl]);
$t = time();
$v1 = hash_hmac('sha256', $t . '.' . $body, getenv('EYE_REPORT_WEBHOOK_SECRET'));
// POST $body with header:  X-EyeReport-Signature: t=$t,v1=$v1
```

## 3. Responses
| Status | Meaning | What EyeReport should do |
|---|---|---|
| `201` | Created. Body: `{ "id", "status": "pending", "duplicate": false }` | Mark the report as handed over |
| `200` | Already received (`duplicate: true`) | Same as 201 |
| `400` | Invalid payload, or an extra field. Body lists the problems | Fix the data; do not retry unchanged |
| `401` | Bad or expired signature | Check the secret and the clock |
| `422` | Mux could not use the video link | Check the link/file, then resend |
| `429` | Too many requests | Retry later |
| `502` / `503` | Eye TV or Mux is temporarily unavailable | **Retry** with the same body (safe: it is idempotent), e.g. after 1, 5, 15 minutes |

## 4. What happens on Eye TV
1. The video appears in the **Moderation Queue** as “From EyeReport”, and is **private** on Mux.
2. It is ready to review after Mux finishes processing (usually a few minutes). The editor completes the checklist and approves or rejects.
3. Only when an editor approves does the video get a public link and appear on Eye TV.
4. The audit log records the hand-over (“Received video from EyeReport”).
5. Eye TV does not tell EyeReport when an editor publishes or rejects. If EyeReport needs that, we will add a callback (not in this version).
