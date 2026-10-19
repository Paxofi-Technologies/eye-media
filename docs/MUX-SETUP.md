# Connecting Eye TV to Mux — step by step

Eye TV stores, converts and delivers all video through **Mux**: uploads from Eye Media staff and reporters, the archive, and live streams.
Unpublished videos are **private** on Mux. A public link is created only when a story is published or a live event goes on air, and removed again when it is unpublished or ends.

You do this once per environment. Use **two separate Mux environments**: *Eye TV Staging* and *Eye TV Production*, so test videos never mix with real ones and each has its own keys.

> **Never send Mux keys in chat, email or tickets.** Put them only in cPanel (step 5). If a key is ever exposed, delete it in Mux and create a new one.

## 1. Create the Mux environment
1. Sign in at **dashboard.mux.com**. Top-left, open the environment menu → **Create environment** → name it `Eye TV Staging`, type **Video**.

## 2. API access token  →  `MUX_TOKEN_ID` and `MUX_TOKEN_SECRET`
1. **Settings → API Access Tokens → Generate new token**.
2. Permissions: **Mux Video: Read and Write**. Nothing else is needed (no Data, no System).
3. Mux shows an **Access Token ID** and **Secret Key** once. Copy both now.
   - Access Token ID → `MUX_TOKEN_ID`
   - Secret Key → `MUX_TOKEN_SECRET`

## 3. Signing key (private playback)  →  `MUX_SIGNING_KEY_ID` and `MUX_SIGNING_KEY_PRIVATE`
1. **Settings → Signing Keys → Generate new key** (region: any).
2. Copy the **Signing Key ID** → `MUX_SIGNING_KEY_ID`.
3. Copy the **Private key** (a long base64 text) → `MUX_SIGNING_KEY_PRIVATE`. Paste it exactly as shown, as one line.

## 4. Webhook  →  `MUX_WEBHOOK_SECRET`
Webhooks tell Eye TV when a video has finished processing and when an encoder starts or stops.
1. **Settings → Webhooks → Create new webhook**.
2. URL: `https://eyetv.paxofi.com/api/webhooks/mux` (production: your real domain). Environment: the one you are setting up.
3. Save, then copy the **Signing secret** → `MUX_WEBHOOK_SECRET`.
4. If Cloudflare blocks the webhook (Mux shows failed deliveries with 403): Cloudflare → *Security → WAF → Custom rules* → create a rule *URI Path equals `/api/webhooks/mux`* → action **Skip** (all managed rules and bot protection). The endpoint verifies a signature on every call, so this is safe.

## 5. Put the values in cPanel
cPanel → **Setup Node.js App** → edit the Eye TV app → **Add Variable** for each, then **Save** and **Restart**:

| Name | Value | Required |
|---|---|---|
| `MUX_TOKEN_ID` | Access Token ID (step 2) | yes |
| `MUX_TOKEN_SECRET` | Secret Key (step 2) | yes |
| `MUX_SIGNING_KEY_ID` | Signing Key ID (step 3) | yes |
| `MUX_SIGNING_KEY_PRIVATE` | Private key (step 3) | yes |
| `MUX_WEBHOOK_SECRET` | Webhook signing secret (step 4) | yes (without it videos stay "processing") |
| `MUX_VIDEO_QUALITY` | `basic` (cheapest), `plus` or `premium` | optional |
| `MUX_RECONNECT_WINDOW` | seconds, e.g. `60`: how long a dropped encoder may reconnect before the broadcast counts as ended | optional |
| `MUX_DATA_ENABLED` | `true` to send viewer analytics to Mux. Leave unset until the privacy policy mentions it | optional |

## 6. Check it works
1. Sign in to `/admin` → **Videos → New video** → upload a short clip → **Create draft**. After a minute the status reads *ready*.
2. **Live → schedule an event.** The event page shows the server address and a *Show key* button. If it says "Mux is not connected", re-check the variables and restart.
3. In Mux → Webhooks, the endpoint should show recent deliveries with status 200.

## Using it for live events (election day)
1. Schedule the event ahead of time. Open it and copy the **server** address and **stream key** into the encoder (OBS, vMix, or a phone app such as Larix Broadcaster). Use the RTMPS address.
2. Start the encoder, check the *Encoder* badge says *receiving video*, then press **Go live**. (Or tick *Go live automatically when the encoder connects* when scheduling.)
3. **Optional extra reach:** under *Also stream to*, add YouTube or Facebook with their stream key. Mux sends them a copy. Eye TV never stores or shows those keys again.
4. When the encoder stops for longer than the reconnect window, the event ends by itself, the public link is removed and the recording is kept privately. Press **Create replay** to turn it into a draft video.
5. Each location needs its own event (its own key). Several events can be on air at once. **Test every location's encoder and mobile network before election day.**

## Costs and limits (check Mux's pricing page; figures change)
- Mux charges for: **encoding** (per minute uploaded or streamed live), **storage** (per minute stored, per month) and **delivery** (per minute watched, with a monthly free allowance).
- The free plan is for trying things out: it does **not** include live streaming and limits stored video. Add a payment method before relying on it. Set a **spend alert** in Mux billing.
- Rough planning figures (verify before budgeting): live encoding about **$0.03 per minute per stream** at 720p; delivery about **$0.0008 per viewer-minute**; storage about **$0.0024 per minute per month**.
  Example: 20 locations streaming 10 hours each (12,000 stream-minutes) ≈ $360 for encoding; 200,000 viewers watching 30 minutes each (6M viewer-minutes, minus the free allowance) ≈ $4,700 for delivery. Delivery dominates, so the viewer number decides the bill.
- Uploads are limited to 500MB per file in the Eye TV form.

## Troubleshooting
| Problem | Cause / fix |
|---|---|
| "Video upload is not set up on this server yet" | One of the first four `MUX_` variables is missing, or the app was not restarted |
| Video stays on *processing* | Webhook not delivered: check step 4 (secret, URL, Cloudflare rule) |
| "Mux said … token lacks permission" | The token was not created with Mux Video read/write |
| "plan does not include this feature" on live | The Mux plan does not include live streaming: upgrade in Mux billing |
| Upload bar fails at 0% | Ad-blocker or the site `SITE_URL` does not match the address in the browser |
| Player shows "unavailable" | Signing key wrong; re-create it (step 3) |
