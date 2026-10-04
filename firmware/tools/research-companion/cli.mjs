import { existsSync, readFileSync } from 'node:fs'
import { parseArgs } from 'node:util'
import { detectFace, speechPath } from './completion.mjs'
import { createCompanionServer } from './service.mjs'

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    host: { type: 'string', default: '127.0.0.1' },
    port: { type: 'string', default: '8787' },
    url: { type: 'string', default: 'http://127.0.0.1:8787' },
    task: { type: 'string' },
    flow: { type: 'string', default: 'research' },
    sequence: { type: 'string' },
    phase: { type: 'string' },
    text: { type: 'string' },
    config: { type: 'string' },
  },
})

try {
  const local = values.config ? JSON.parse(readFileSync(values.config, 'utf8')).config?.researchCompanion : undefined
  const token = process.env.STACKCHAN_COMPANION_TOKEN ?? local?.token
  if (!token || !/^[a-zA-Z0-9_-]{16,128}$/.test(token)) throw new Error('Set STACKCHAN_COMPANION_TOKEN first')
  if (positionals[0] === 'serve') {
    const port = Number(values.port)
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid port')
    let robotSeen = false
    const server = createCompanionServer({
      token,
      detectFace,
      speech: existsSync(speechPath) ? readFileSync(speechPath) : undefined,
      onRobotPoll: () => {
        if (!robotSeen) console.log('Robot connected: authenticated Wi-Fi status poll received')
        robotSeen = true
      },
    })
    server.requestTimeout = 5000
    server.headersTimeout = 5000
    server.on('error', (error) => {
      console.error(error.message)
      process.exitCode = 1
    })
    server.listen(port, values.host, () => console.log(`Companion listening on ${values.host}:${port}`))
    for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close())
  } else if (positionals[0] === 'event' || positionals[0] === 'state') {
    const event = positionals[0] === 'event'
    const url = new URL(event ? '/v1/events' : '/v1/state', values.url)
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Use an HTTP(S) service URL')
    const response = await fetch(url, {
      method: event ? 'POST' : 'GET',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: event
        ? JSON.stringify({
            version: 1,
            taskId: values.task,
            flowId: values.flow,
            sequence: Number(values.sequence),
            phase: values.phase,
            ...(values.text !== undefined && { text: values.text }),
          })
        : undefined,
      signal: AbortSignal.timeout(5000),
    })
    console.log(await response.text())
    if (!response.ok) process.exitCode = 1
  } else {
    throw new Error('Usage: cli.mjs serve [--host IP] | event --task ID --sequence N --phase PHASE | state')
  }
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
}
