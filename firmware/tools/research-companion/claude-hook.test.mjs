import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import YAML from 'yaml'
import { handleResearchHook } from './claude-hook.mjs'

async function fixture(t) {
  const dir = await mkdtemp(join(tmpdir(), 'research-hook-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  const workbench = join(dir, 'Workbench')
  await mkdir(workbench)
  const events = []
  const options = { stateDir: join(dir, 'state'), workbench, send: async (e) => events.push(e) }
  const base = { session_id: 'session', agent_id: 'agent', agent_type: 'research-agent' }
  const hook = (hook_event_name, extra = {}) => handleResearchHook({ ...base, hook_event_name, ...extra }, options)
  return { hook, options, events, workbench }
}
const note = () =>
  `---\n${YAML.stringify({ type: 'ResearchNote', title: 'Draft', jyos: { schema: '0.1', id: 'id', maturity: 'working', sensitivity: 'normal', ai_access: 'explicit', wiki: { ingest: false } }, generated: { by: 'agent:research-agent', at: new Date().toISOString() }, sources: [{ id: 'source', title: 'Official', resource: 'https://docs.m5stack.com/example', retrieved_at: new Date().toISOString() }] })}---\n## Summary in plain English\nDraft\n## Claim status\nTable\n## Still to check\nReview\n`

test('interactive hooks track only research identity and require explicit success plus new validated output', async (t) => {
  const f = await fixture(t)
  assert.equal(await f.hook('SubagentStart', { agent_type: 'Explore' }), null)
  assert.equal(f.events.length, 0)
  const context = await f.hook('SubagentStart')
  assert.ok(context.hookSpecificOutput.additionalContext.includes('JYOS_RESEARCH_RESULT'))
  await f.hook('PostToolUse', { agent_id: 'untracked', tool_name: 'WebSearch' })
  assert.equal(f.events.length, 1)
  const output = join(f.workbench, 'note.md')
  await f.hook('PreToolUse', { tool_name: 'Write', tool_input: { file_path: output } })
  await f.hook('PostToolUse', { tool_name: 'WebSearch' })
  await writeFile(output, note())
  await f.hook('PostToolUse', { tool_name: 'Write', tool_input: { file_path: output } })
  await f.hook('SubagentStop', {
    last_assistant_message: `Done.\nJYOS_RESEARCH_RESULT: ${JSON.stringify({ status: 'success', output })}`,
  })
  assert.deepEqual(
    f.events.map((e) => e.phase),
    ['confirming', 'gathering', 'drafting', 'ready'],
  )
  await f.hook('SubagentStop', { last_assistant_message: 'Done again' })
  assert.equal(f.events.length, 4)
})

test('agent stop without explicit outcome and existing output cannot announce success', async (t) => {
  for (const existing of [false, true]) {
    const f = await fixture(t)
    const output = join(f.workbench, 'note.md')
    if (existing) await writeFile(output, note())
    await f.hook('SubagentStart')
    await f.hook('PreToolUse', { tool_name: 'Write', tool_input: { file_path: output } })
    await f.hook('PostToolUse', { tool_name: 'WebSearch' })
    await writeFile(output, note())
    await f.hook('PostToolUse', { tool_name: 'Write', tool_input: { file_path: output } })
    await f.hook('SubagentStop', {
      last_assistant_message: existing
        ? `JYOS_RESEARCH_RESULT: ${JSON.stringify({ status: 'success', output })}`
        : 'Stopped',
    })
    assert.equal(f.events.at(-1).phase, 'failed')
    assert.ok(!f.events.some((e) => e.phase === 'ready'))
  }
})

test('notification outage does not block agent context or stop handling', async (t) => {
  const f = await fixture(t)
  f.options.send = async () => {
    throw new Error('offline')
  }
  assert.ok(await f.hook('SubagentStart'))
  await f.hook('SubagentStop', { last_assistant_message: 'No output' })
})
