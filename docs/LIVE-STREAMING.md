# Eye TV live streaming — operator guide

Eye TV can show **any number of live broadcasts at the same time**, for example Ajah, the Lagos Assembly and Abuja.
Each one is a **live event** in the admin with its own time, city, category and YouTube Live video. Viewers see every
stream that's on air on `/tv/live`, each event has its own page (`/tv/live/…`), and the day-by-day **Live Schedule** is at `/tv/schedule`.

## How it works

1. **Source:** a phone (YouTube app, or an RTMP app such as Larix Broadcaster), a camera through a laptop running OBS Studio or a hardware encoder, or a studio switcher (vMix, ATEM Mini …).
2. **YouTube Live:** one broadcast per event, each with its own stream key.
3. **Eye TV:** embeds each broadcast on the public site.

YouTube receives, transcodes and delivers the video for free. Eye TV stores only the **public video link** of each
broadcast. Stream keys never go into Eye TV.

## One-time: get the Eye TV YouTube channel ready

1. Use the official Eye TV YouTube channel. Live streaming must be enabled: YouTube Studio → **Create → Go live**. The first activation can take up to 24 hours, and the channel must be verified by phone.
2. Decide who can stream. Field reporters should be added as channel **Managers/Editors** in YouTube Studio → Settings → Permissions, not given the channel password.
3. Mobile streaming directly from the **YouTube app** has a subscriber requirement that YouTube sets and may change. Streaming from an **encoder app** (Larix Broadcaster, Streamlabs, OBS) works for any channel with live streaming enabled.

## For every broadcast

1. **In YouTube Studio:** Create → Go live → **Stream** → *Schedule stream*. Give it a title and time, and set visibility to **Public** (or *Unlisted* to keep it off the YouTube channel page).
   Choose **Create new stream key** for this event, so each location has its own key and two broadcasts never collide.
2. Copy the broadcast's **watch link** (`https://youtube.com/live/…`).
3. **In Eye TV admin → Live & Schedule → Schedule a live event:** fill in title, start time (Lagos), city, venue, category, and paste the YouTube link. Tick *Feature on the homepage* for the main story.
   The event now appears on the public **Live Schedule**.
4. **At the location:** the reporter starts streaming to that event's key:
   - **Phone:** Larix Broadcaster → Settings → Connections → new connection, URL `rtmp://a.rtmp.youtube.com/live2/<stream key>`, then tap record.
   - **Camera:** camera → laptop running OBS (Settings → Stream → YouTube, paste the key), or a hardware encoder.
5. When YouTube shows the stream as live, press **Go live** on the event in Eye TV. It appears on the homepage, `/tv/live` and the schedule.
6. Afterwards, press **End stream** in Eye TV (and end it in YouTube Studio). Then **Create replay**: this makes a draft archive video from the recording, which an editor publishes through the normal review.

Several reporters can do steps 4–5 at the same time on different events. Eye TV shows every event that's live.

> Keep stream keys private: anyone with a key can broadcast on the channel. Rotate a key in YouTube Studio if it leaks.

## Limits of the YouTube approach

| | YouTube Live (current) | Paid live-video platform (later option) |
|---|---|---|
| Cost | Free | Pay per minute streamed and watched |
| Simultaneous streams | Several per channel | As many as you pay for |
| Branding | YouTube player, logo and suggested videos | Fully Eye TV-branded player, no YouTube |
| Go live from a phone **browser** (no app) | No | Yes (WebRTC/WHIP) |
| Recordings | Stay on YouTube | Stored with the provider; Eye TV can host the archive |
| Setup per event | Manual in YouTube Studio | Fully automatic via API (keys created per reporter) |

Examples of such platforms: **Mux**, **Cloudflare Stream**, **Amazon IVS**, **api.video**. Eye TV's live events already
carry a `provider` field, so one of these can be added alongside YouTube without changing the public pages. The streaming
itself always runs on the provider's servers: cPanel shared hosting can't receive or transcode video.

### Possible next step: automation through the YouTube Live Streaming API

Eye TV could create the YouTube broadcast and stream key automatically when an editor schedules an event, and show
the key to the assigned reporter in the admin. Eye TV could also detect when the stream actually starts and ends, so
nobody has to press Go live. This needs a Google Cloud project with the *YouTube Data API v3* enabled, OAuth consent
for the Eye TV channel, and staying within the API's daily quota.
