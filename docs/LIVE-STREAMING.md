# Eye TV live streaming — operator guide

Eye TV can show **any number of live broadcasts at the same time**, for example one per polling location on election day.
Each one is a **live event** in the admin with its own time, city, category and its own Mux stream (server address + stream key).
Viewers see every stream that is on air on `/tv/live`, each event has its own page (`/tv/live/…`), and the day-by-day
**Live Schedule** is at `/tv/schedule`. Connect Mux first: see [MUX-SETUP.md](MUX-SETUP.md).

## How it works

1. **Source:** a phone (an RTMP app such as Larix Broadcaster), a camera through a laptop running OBS Studio, a hardware encoder, or a studio switcher (vMix, ATEM Mini …).
2. **Mux:** receives the stream, converts it for every phone and connection speed, delivers it to viewers and records it.
3. **Eye TV:** shows the stream in its own player. The public link exists only while the event is on air.

Stream keys are held by Mux. Eye TV never stores them; editors can reveal a key on the event page, and each reveal or reset is written to the audit log.

## For every broadcast

1. **Admin → Live & Schedule → Schedule a live event:** title, start time (Lagos), city, venue, category. Tick *Feature on the homepage* for the main story. Tick *Go live automatically* if the stream should appear as soon as the encoder connects.
2. Open the event. Under **Stream** copy the **RTMPS server** and press **Show key** to copy the **stream key**.
3. **At the location:** enter both in the encoder.
   - **Phone:** Larix Broadcaster → Settings → Connections → new connection → URL = the server address with `/` and the key appended (or the separate key field), then record.
   - **Camera/laptop:** OBS → Settings → Stream → *Custom…* → Server and Stream key.
4. When *Encoder* shows **receiving video**, press **Go live** (skip if automatic). The event appears on the homepage, `/tv/live` and the schedule.
5. **Optional extra reach:** under *Also stream to*, add a YouTube or Facebook stream key. Mux forwards a copy. The key is sent to Mux and never shown again. Add it before going live.
6. **Ending:** press **End stream** in Eye TV, or just stop the encoder: after the reconnect window the event ends by itself. The public link is removed and the recording stays private.
7. A few minutes later press **Create replay** to make a draft archive video from the recording. An editor publishes it through the normal review.

## Election-day checklist
- One event per location, each with its own key. Do not share keys between locations.
- Test every encoder **on the real mobile network** the day before. Prefer a wired or good 4G/5G connection and a spare SIM from another network.
- Set `MUX_RECONNECT_WINDOW` (e.g. 60 seconds) so short drops do not end the event.
- Ask the host to keep the admin on a laptop that stays charged and online; one editor per few locations.
- Put Eye TV behind Cloudflare caching for public pages and consider moving to a VPS before the election (see ARCHITECTURE.md): shared hosting is not sized for hundreds of thousands of visitors.
- Set a spend alert in Mux billing and make sure the plan includes live streaming.

> Keep stream keys private: anyone with a key can broadcast on that event. Use **Reset key** (only while the event is not live) if one leaks.
