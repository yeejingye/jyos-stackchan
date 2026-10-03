import { randomUUID, timingSafeEqual } from 'node:crypto'
import { createServer } from 'node:http'
import { ResearchState } from '../../mods/research_companion/research-status.js'

export function createCompanionServer({ token, serviceId = randomUUID(), onRobotPoll = () => {}, detectFace, speech }) {
  if (typeof token !== 'string' || !/^[a-zA-Z0-9_-]{16,128}$/.test(token)) {
    throw new Error('STACKCHAN_COMPANION_TOKEN must be 16–128 letters, digits, underscores or hyphens')
  }
  const expected = Buffer.from(`Bearer ${token}`)
  const state = new ResearchState(serviceId)
  let detecting = false
  let diagnostic = null
  return createServer(async (req, res) => {
    const reply = (status, body) => {
      if (res.destroyed) return
      res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
      res.end(JSON.stringify(body))
    }
    const supplied = Buffer.from(req.headers.authorization ?? '')
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
      req.resume()
      reply(401, { error: 'Unauthorized' })
      return
    }
    if (req.method === 'GET' && req.url === '/v1/state') {
      if (req.headers['x-stackchan-client'] === 'robot') onRobotPoll()
      reply(200, state.snapshot)
      return
    }
    if (req.method === 'GET' && req.url.startsWith('/v1/diagnostics')) {
      const url = new URL(req.url, 'http://localhost')
      const stage = url.searchParams.get('stage')
      if (stage) {
        if (
          ![
            'face-start',
            'frame-captured',
            'face-found',
            'motion-start',
            'speech-fetch',
            'speech-start',
            'speech-finished',
            'cleanup',
            'cleared',
          ].includes(stage)
        ) {
          reply(400, { error: 'Invalid diagnostic stage' })
          return
        }
        diagnostic = { stage, at: Date.now() }
        console.log(`Robot completion: ${stage}`)
      }
      reply(200, diagnostic)
      return
    }
    if (req.method === 'GET' && req.url === '/v1/completion.wav') {
      if (!speech) {
        reply(503, { error: 'Speech unavailable; run research:prepare' })
        return
      }
      res.writeHead(200, { 'Content-Type': 'audio/wav', 'Content-Length': speech.length, 'Cache-Control': 'no-store' })
      res.end(speech)
      return
    }
    if (req.method === 'POST' && req.url === '/v1/face') {
      if (!detectFace || detecting) {
        req.resume()
        reply(503, { error: 'Detector unavailable or busy' })
        return
      }
      if (req.headers['content-type'] !== 'application/octet-stream') {
        req.resume()
        reply(415, { error: 'Expected RGB565 frame' })
        return
      }
      detecting = true
      try {
        const chunks = []
        let size = 0
        for await (const chunk of req) {
          size += chunk.length
          if (size > 176 * 144 * 2) {
            req.resume()
            reply(413, { error: 'Frame too large' })
            return
          }
          chunks.push(chunk)
        }
        if (size !== 176 * 144 * 2) {
          reply(400, { error: 'Invalid frame size' })
          return
        }
        reply(200, await detectFace(Buffer.concat(chunks)))
      } catch {
        reply(503, { error: 'Face detection unavailable' })
      } finally {
        detecting = false
      }
      return
    }
    if (req.method !== 'POST' || req.url !== '/v1/events') {
      req.resume()
      reply(404, { error: 'Not found' })
      return
    }
    if (req.headers['content-type']?.split(';')[0].trim() !== 'application/json') {
      req.resume()
      reply(415, { error: 'Use application/json' })
      return
    }
    try {
      let size = 0
      const chunks = []
      for await (const chunk of req) {
        size += chunk.length
        if (size > 4096) {
          reply(413, { error: 'Event exceeds 4096 bytes' })
          req.resume()
          return
        }
        chunks.push(chunk)
      }
      let event
      try {
        event = JSON.parse(Buffer.concat(chunks).toString('utf8'))
      } catch {
        reply(400, { error: 'Invalid JSON' })
        return
      }
      const { status, ...result } = state.accept(event)
      reply(status, result)
    } catch {
      reply(400, { error: 'Request interrupted' })
    }
  })
}
