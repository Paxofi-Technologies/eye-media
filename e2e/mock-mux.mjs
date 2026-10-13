/**
 * A small stand-in for the Mux API used by the end-to-end suite, so tests never need real credentials
 * or network access. It implements only the calls Eye TV makes, keeps everything in memory, and can
 * deliver correctly signed webhooks to the app like Mux does.
 */
import { createHmac, randomBytes } from 'node:crypto'
import { createServer } from 'node:http'

const id = (n = 12) => randomBytes(n).toString('hex')

export function startMockMux({ port, appUrl, tokenId, tokenSecret, webhookSecret }) {
  const uploads = new Map()
  const assets = new Map()
  const streams = new Map()
  const webhooks = []
  const self = `http://localhost:${port}`

  async function sendWebhook(type, data) {
    const body = JSON.stringify({ id: id(), type, data, created_at: new Date().toISOString() })
    const t = Math.floor(Date.now() / 1000)
    const v1 = createHmac('sha256', webhookSecret).update(`${t}.${body}`).digest('hex')
    const res = await fetch(`${appUrl}/api/webhooks/mux`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Mux-Signature': `t=${t},v1=${v1}` },
      body,
    })
    webhooks.push({ type, status: res.status })
    return res.status
  }

  const newAsset = (extra = {}) => {
    const a = { id: id(), status: 'preparing', duration: 42.5, playback_ids: [{ id: id(8), policy: 'signed' }], ...extra }
    assets.set(a.id, a)
    return a
  }

  const send = (res, status, body, headers = {}) => {
    res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', ...headers })
    res.end(body === undefined ? '' : JSON.stringify(body))
  }
  const readBody = (req) =>
    new Promise((resolve) => {
      const chunks = []
      req.on('data', (c) => chunks.push(c))
      req.on('end', () => resolve(Buffer.concat(chunks)))
    })

  const server = createServer(async (req, res) => {
    const url = new URL(req.url, self)
    const path = url.pathname
    const m = req.method

    if (m === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,PUT,POST,OPTIONS',
        'Access-Control-Allow-Headers': '*',
        'Access-Control-Expose-Headers': 'Range',
      })
      return res.end()
    }

    // ---- the upload target (what Mux gives the browser) ----
    let match = path.match(/^\/upload\/([0-9a-f]+)$/)
    if (match && m === 'PUT') {
      const up = uploads.get(match[1])
      if (!up) return send(res, 404, { error: 'unknown upload' })
      const body = await readBody(req)
      up.received += body.length
      const range = /bytes (\d+)-(\d+)\/(\d+)/.exec(req.headers['content-range'] ?? '')
      const total = range ? Number(range[3]) : up.received
      if (up.received >= total) {
        up.status = 'asset_created'
        up.asset_id = newAsset({ passthrough: up.passthrough }).id
        // Mux finishes processing a moment later and tells the app.
        setTimeout(() => {
          const a = assets.get(up.asset_id)
          a.status = 'ready'
          void sendWebhook('video.asset.ready', { id: a.id })
        }, 700)
        return send(res, 200, {})
      }
      return send(res, 308, undefined)
    }

    // ---- control endpoints used by the tests ----
    if (path === '/__mock/state') {
      return send(res, 200, { uploads: [...uploads.values()], assets: [...assets.values()], streams: [...streams.values()], webhooks })
    }
    match = path.match(/^\/__mock\/live\/([0-9a-f]+)\/(active|idle)$/)
    if (match && m === 'POST') {
      const s = streams.get(match[1])
      if (!s) return send(res, 404, {})
      s.status = match[2]
      const status = await sendWebhook(`video.live_stream.${match[2]}`, { id: s.id })
      if (match[2] === 'idle') {
        const a = newAsset({ status: 'ready', live_stream_id: s.id })
        s.recent_asset_ids = [a.id]
        await sendWebhook('video.asset.live_stream_completed', { id: a.id, live_stream_id: s.id })
      }
      return send(res, 200, { webhookStatus: status })
    }
    if (path === '/__mock/bad-webhook' && m === 'POST') {
      const res2 = await fetch(`${appUrl}/api/webhooks/mux`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Mux-Signature': 't=1,v1=00' },
        body: '{"id":"x","type":"video.asset.ready","data":{"id":"y"}}',
      })
      return send(res, 200, { status: res2.status })
    }

    // ---- the Mux REST API ----
    if (!path.startsWith('/video/v1/')) return send(res, 404, {})
    const auth = req.headers.authorization ?? ''
    if (auth !== `Basic ${Buffer.from(`${tokenId}:${tokenSecret}`).toString('base64')}`) {
      return send(res, 401, { error: { type: 'unauthorized', messages: ['Unauthorized request'] } })
    }
    const raw = await readBody(req)
    const body = raw.length ? JSON.parse(raw.toString()) : {}
    const data = (d, status = 200) => send(res, status, { data: d })
    const notFound = () => send(res, 404, { error: { type: 'not_found', messages: ['Not found'] } })

    if (path === '/video/v1/uploads' && m === 'POST') {
      const uid = id()
      const up = { id: uid, url: `${self}/upload/${uid}`, status: 'waiting', received: 0, passthrough: body.new_asset_settings?.passthrough }
      uploads.set(uid, up)
      return data({ id: uid, url: up.url, status: up.status }, 201)
    }
    match = path.match(/^\/video\/v1\/uploads\/([0-9a-f]+)(\/cancel)?$/)
    if (match) {
      const up = uploads.get(match[1])
      if (!up) return notFound()
      if (match[2]) {
        up.status = 'cancelled'
        return data({})
      }
      return data({ id: up.id, url: up.url, status: up.status, asset_id: up.asset_id })
    }

    match = path.match(/^\/video\/v1\/assets\/([0-9a-f]+)(?:\/playback-ids(?:\/([0-9a-f]+))?)?$/)
    if (match) {
      const a = assets.get(match[1])
      if (!a) return notFound()
      const isPb = path.includes('/playback-ids')
      if (isPb && m === 'POST') {
        const pb = { id: id(8), policy: body.policy }
        a.playback_ids.push(pb)
        return data(pb, 201)
      }
      if (isPb && m === 'DELETE') {
        a.playback_ids = a.playback_ids.filter((p) => p.id !== match[2])
        return data({}, 204)
      }
      if (m === 'DELETE') {
        assets.delete(a.id)
        return data({}, 204)
      }
      return data(a)
    }

    if (path === '/video/v1/live-streams' && m === 'POST') {
      const s = {
        id: id(),
        stream_key: `sk-${id(6)}`,
        status: 'idle',
        playback_ids: [{ id: id(8), policy: 'signed' }],
        simulcast_targets: [],
        recent_asset_ids: [],
      }
      streams.set(s.id, s)
      return data(s, 201)
    }
    match = path.match(/^\/video\/v1\/live-streams\/([0-9a-f]+)(\/[a-z-]+)?(?:\/([0-9a-f]+))?$/)
    if (match) {
      const s = streams.get(match[1])
      if (!s) return notFound()
      const sub = match[2]
      if (!sub && m === 'GET') return data(s)
      if (!sub && m === 'DELETE') {
        streams.delete(s.id)
        return data({}, 204)
      }
      if (sub === '/complete' && m === 'PUT') return data({})
      if (sub === '/reset-stream-key' && m === 'POST') {
        s.stream_key = `sk-${id(6)}`
        return data(s)
      }
      if (sub === '/playback-ids' && m === 'POST') {
        const pb = { id: id(8), policy: body.policy }
        s.playback_ids.push(pb)
        return data(pb, 201)
      }
      if (sub === '/playback-ids' && m === 'DELETE') {
        s.playback_ids = s.playback_ids.filter((p) => p.id !== match[3])
        return data({}, 204)
      }
      if (sub === '/simulcast-targets' && m === 'POST') {
        const t = { id: id(8), url: body.url, status: 'idle', passthrough: body.passthrough }
        s.simulcast_targets.push(t) // the key is deliberately not kept, like Mux's responses
        return data(t, 201)
      }
      if (sub === '/simulcast-targets' && m === 'DELETE') {
        s.simulcast_targets = s.simulcast_targets.filter((t) => t.id !== match[3])
        return data({}, 204)
      }
    }
    return notFound()
  })

  return new Promise((resolve) => server.listen(port, () => resolve({ server, url: self, close: () => server.close() })))
}
