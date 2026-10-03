import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { promisify } from 'node:util'
import { createCompanionServer } from './service.mjs'

const exec = promisify(execFile)

test('CLI loads private config and emits/reads state; conflicting events return a failing exit code', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'stackchan-cli-'))
  const config = join(directory, 'config.json')
  const token = 'cli-test-token-private-config'
  await writeFile(config, JSON.stringify({ config: { researchCompanion: { token } } }), { mode: 0o600 })
  t.after(() => rm(directory, { recursive: true, force: true }))
  const server = createCompanionServer({ token, serviceId: 'cli-test' })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  t.after(
    () =>
      new Promise((resolve) => {
        server.close(resolve)
        server.closeAllConnections()
      }),
  )
  const url = `http://127.0.0.1:${server.address().port}`
  const environment = { ...process.env }
  delete environment.STACKCHAN_COMPANION_TOKEN
  const run = (...args) =>
    exec(
      process.execPath,
      [new URL('./cli.mjs', import.meta.url).pathname, ...args, '--config', config, '--url', url],
      { env: environment },
    )
  const response = await run('event', '--task', 'demo', '--sequence', '1', '--phase', 'gathering')
  assert.equal(JSON.parse(response.stdout).snapshot.phase, 'gathering')
  assert.equal(response.stdout.includes(token), false)
  assert.equal(JSON.parse((await run('state')).stdout).taskId, 'demo')
  await assert.rejects(
    run('event', '--task', 'other', '--sequence', '1', '--phase', 'gathering'),
    (error) => error.code === 1 && JSON.parse(error.stdout).error.includes('active'),
  )
})
