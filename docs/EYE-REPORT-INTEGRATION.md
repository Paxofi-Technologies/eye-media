# EyeReport → Eye TV hand-off (for the EyeReport team)

When an EyeReport moderator **approves a report that contains a video**, EyeReport sends it to Eye TV automatically.
Eye TV puts it in its **review queue** (status *pending*, shown as “From EyeReport”). An Eye TV editor then reviews and publishes it.
Nothing is published on Eye TV automatically, and **no personal details of the citizen are ever sent**.

## 1. One-time setup
1. Create a **shared secret**: **64 characters of random letters and numbers** (32 random bytes written as hex). Minimum 40 characters, no spaces, never reused from another system. How to make one:
   - Terminal: `openssl rand -hex 32`
   - or a password generator set to 64 characters, letters and numbers only.
   Use a **different secret for staging and for production**. Share it with the EyeReport team through a password manager, never by chat or email, and never put it in source code.
2. **Eye TV (cPanel → Setup Node.js App → Add Variable):**
   | Name | Value |
   |---|---|
   | `EYE_REPORT_WEBHOOK_SECRET` | the shared secret |
   | `EYE_REPORT_CALLBACK_URL` | the https address on EyeReport that receives Eye TV's decisions (section 5) |
   Then **Save** and **Restart**. Without the secret the hand-off answers 503; without the callback address, decisions are kept and sent once the address is added.
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
5. Eye TV tells EyeReport about the decision (section 5).

## 5. Eye TV → EyeReport: decision callback
When an Eye TV editor **publishes**, **rejects** or later **unpublishes** a video that came from EyeReport, Eye TV calls EyeReport.
EyeReport provides a URL for this (`EYE_REPORT_CALLBACK_URL`) and verifies the signature, exactly like the other direction but with the header **`X-EyeTV-Signature`** (same secret, same `t=…,v1=…` format, HMAC of `<t>.<raw body>`).

```json
{ "event": "video.published", "externalId": "ER-1042", "videoId": "…",
  "eyeTvUrl": "https://webtv.eyemedia.ng/tv/pothole-on-ojota-flyover-ab12c",
  "occurredAt": "2026-10-19T17:02:11.000Z" }
```
- `event` is `video.published`, `video.rejected` or `video.unpublished`. `eyeTvUrl` is only set for `video.published`.
- `externalId` is the id EyeReport used in the hand-over. Use `occurredAt` to order events if several arrive for one report.
- **Rejection reasons are internal and are never sent.** EyeReport should show the citizen a neutral status.
- Answer with any `2xx` status to confirm. Anything else (or no answer within 10 seconds) is retried automatically: after 1, 2, 4, 8 … minutes up to 6 hours, 12 attempts in all. Make your receiver safe to call twice with the same event.
- Rejected or unpublished videos are not deleted on EyeReport's side by Eye TV; EyeReport decides what to show.
