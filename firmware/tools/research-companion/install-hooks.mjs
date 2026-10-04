import { readFile, realpath, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'

const quote = (value) => `'${value.replaceAll("'", "'\\''")}'`
const { values } = parseArgs({ options: { project: { type: 'string' }, config: { type: 'string' } } })
try {
  const project = await realpath(values.project)
  const config = await realpath(values.config)
  const node = await realpath(process.execPath)
  const script = fileURLToPath(new URL('./claude-hook.mjs', import.meta.url))
  const command = [node, script, '--config', config].map(quote).join(' ')
  const file = resolve(project, '.claude/settings.local.json')
  let settings = {}
  try {
    settings = JSON.parse(await readFile(file, 'utf8'))
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
  }
  settings.hooks ??= {}
  for (const [event, matcher] of [
    ['SubagentStart', '^research-agent$'],
    ['SubagentStop', '^research-agent$'],
    ['PreToolUse', '^Write$'],
    ['PostToolUse', '^(Write|WebFetch|WebSearch)$'],
  ]) {
    settings.hooks[event] ??= []
    if (!settings.hooks[event].some((entry) => entry.hooks?.some((hook) => hook.command === command)))
      settings.hooks[event].push({ matcher, hooks: [{ type: 'command', command, timeout: 5 }] })
  }
  await writeFile(file, `${JSON.stringify(settings, null, 2)}\n`, { mode: 0o600 })
  console.log(`Research-scoped hooks installed: ${file}`)
  console.log('Existing hooks/settings preserved. Start a trusted Claude project session to load them.')
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
}
