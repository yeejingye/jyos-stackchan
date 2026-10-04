import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { parseArgs } from 'node:util'
import { runResearch } from './research-runner.mjs'

const { values } = parseArgs({
  options: {
    config: { type: 'string' },
    project: { type: 'string' },
    output: { type: 'string' },
    question: { type: 'string' },
    workbench: { type: 'string', default: `${homedir()}/JYOS/Workbench` },
    'source-host': { type: 'string', multiple: true },
    url: { type: 'string', default: 'http://127.0.0.1:8787' },
    claude: { type: 'string', default: 'claude' },
  },
})
try {
  const local = values.config ? JSON.parse(readFileSync(values.config, 'utf8')).config?.researchCompanion : undefined
  const token = process.env.STACKCHAN_COMPANION_TOKEN ?? local?.token
  const url = new URL('/v1/events', values.url)
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Use HTTP(S) companion URL')
  const abort = new AbortController()
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => abort.abort())
  const result = await runResearch({
    ...values,
    sourceHosts: values['source-host'] ?? [],
    signal: abort.signal,
    send: async (event) => {
      if (!token) throw new Error('No companion token')
      const response = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(event),
        signal: AbortSignal.timeout(1500),
      })
      if (!response.ok) throw new Error(`Companion HTTP ${response.status}`)
      console.log(`StackChan: ${event.phase}`)
    },
  })
  console.log(`Research note ready for review: ${result.output}`)
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
}
