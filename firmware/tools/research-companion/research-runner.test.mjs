import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import YAML from 'yaml'
import { newNotePath, ResearchRun, validateResearchNote } from './research-runner.mjs'

function note(change = () => {}) {
  const meta = {
    type: 'ResearchNote',
    title: 'Evidence',
    jyos: {
      schema: '0.1',
      id: 'jyos-test',
      maturity: 'working',
      sensitivity: 'normal',
      ai_access: 'explicit',
      wiki: { ingest: false },
    },
    generated: { by: 'agent:research-agent', at: new Date().toISOString() },
    sources: [
      {
        id: 'source-1',
        resource: 'https://docs.m5stack.com/example',
        title: 'Example',
        retrieved_at: new Date().toISOString(),
      },
    ],
  }
  change(meta)
  return `---\n${YAML.stringify(meta)}---\n## Summary in plain English\nDraft.\n## Claim status\n| Claim | Source | Status |\n## Still to check\n- [ ] Review.\n`
}

test('saved note validation gates success on metadata, provenance, scope and review layout', () => {
  assert.equal(
    validateResearchNote(note(), { startedAt: Date.now(), sourceHosts: ['docs.m5stack.com'] }).title,
    'Evidence',
  )
  for (const change of [
    (m) => {
      m.verified = {}
    },
    (m) => {
      m.jyos.wiki.ingest = true
    },
    (m) => {
      m.generated.at = '2020-01-01'
    },
    (m) => {
      m.sources.push(m.sources[0])
    },
    (m) => {
      m.sources[0].resource = 'https://unapproved.test'
    },
    (m) => {
      m.sources[0].url = 'legacy'
    },
    (m) => {
      m.generated.by = 'human'
    },
  ])
    assert.throws(() =>
      validateResearchNote(note(change), { startedAt: Date.now(), sourceHosts: ['docs.m5stack.com'] }),
    )
  assert.throws(() => validateResearchNote(note().replace('## Still to check', '## Missing')))
})

test('new note path rejects existing files, symlinks and destinations outside Workbench', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'research-path-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  const root = join(dir, 'Workbench')
  await mkdir(root)
  assert.ok((await newNotePath(join(root, 'new.md'), root)).endsWith('new.md'))
  await writeFile(join(root, 'old.md'), 'existing')
  await assert.rejects(newNotePath(join(root, 'old.md'), root), /overwrite/)
  await symlink(dir, join(root, 'escape'))
  await assert.rejects(newNotePath(join(root, 'escape', 'new.md'), root), /Workbench/)
  await symlink(join(dir, 'absent.md'), join(root, 'dangling.md'))
  await assert.rejects(newNotePath(join(root, 'dangling.md'), root), /overwrite/)
})

async function activity(run, output) {
  await run.phase('confirming', 'Starting')
  await run.observe({
    message: {
      content: [
        { type: 'tool_use', id: 'web', name: 'WebFetch' },
        { type: 'tool_use', id: 'write', name: 'Write', input: { file_path: output } },
      ],
    },
  })
  await run.observe({
    message: {
      content: [
        { type: 'tool_result', tool_use_id: 'web' },
        { type: 'tool_result', tool_use_id: 'write' },
      ],
    },
  })
  await run.observe({ type: 'result', subtype: 'success', is_error: false })
}

test('research lifecycle emits one ready only after successful agent and validated output', async () => {
  const events = []
  const run = new ResearchRun({ taskId: 'run', send: async (e) => events.push(e) })
  await activity(run, '/tmp/note.md')
  await run.finish({ exitCode: 0, output: '/tmp/note.md', text: note(), startedAt: Date.now() })
  assert.deepEqual(
    events.map((e) => e.phase),
    ['confirming', 'gathering', 'drafting', 'ready'],
  )
  assert.deepEqual(
    events.map((e) => e.sequence),
    [1, 2, 3, 4],
  )
  for (const invalid of [
    { exitCode: 1 },
    {
      text: note((m) => {
        m.verified = {}
      }),
    },
    { output: '/tmp/different.md' },
  ]) {
    const sent = []
    const failed = new ResearchRun({ send: async (e) => sent.push(e) })
    await activity(failed, '/tmp/note.md')
    await assert.rejects(failed.finish({ exitCode: 0, output: '/tmp/note.md', text: note(), ...invalid }))
    assert.equal(sent.at(-1).phase, 'failed')
    assert.ok(!sent.some((e) => e.phase === 'ready'))
  }
})

test('failed tools and permission denials cannot masquerade as successful research', async () => {
  const run = new ResearchRun()
  await run.observe({
    message: {
      content: [
        { type: 'tool_use', id: 'web', name: 'WebFetch' },
        { type: 'tool_result', tool_use_id: 'web', is_error: true },
      ],
    },
  })
  assert.equal(run.webResults, 0)
  await activity(run, '/tmp/note.md')
  run.result.permission_denials = [{ tool: 'Write' }]
  await assert.rejects(run.finish({ exitCode: 0, output: '/tmp/note.md', text: note() }), /successfully/)
})

test('notification failure leaves a successful research run successful', async () => {
  const warnings = []
  const run = new ResearchRun({
    send: async () => {
      throw new Error('offline')
    },
    warn: (w) => warnings.push(w),
  })
  await activity(run, '/tmp/note.md')
  const meta = await run.finish({ exitCode: 0, output: '/tmp/note.md', text: note() })
  assert.equal(meta.type, 'ResearchNote')
  assert.ok(warnings.length)
})
