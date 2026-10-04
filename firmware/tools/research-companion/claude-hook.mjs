import { createHash } from 'node:crypto'
import { lstat, mkdir, readFile, realpath, rm, stat, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { newNotePath, validateResearchNote } from './research-runner.mjs'

export async function handleResearchHook(payload, options) {
  if (!payload.session_id || !payload.agent_id || (payload.agent_type && payload.agent_type !== 'research-agent'))
    return null
  const identity = createHash('sha256').update(`${payload.session_id}\0${payload.agent_id}`).digest('hex')
  await mkdir(options.stateDir, { recursive: true, mode: 0o700 })
  const lock = resolve(options.stateDir, `${identity}.lock`)
  let acquired = false
  for (let i = 0; i < 60; i++) {
    try {
      await mkdir(lock)
      acquired = true
      break
    } catch (error) {
      if (error.code !== 'EEXIST') throw error
      try {
        if (Date.now() - (await stat(lock)).mtimeMs > 10000) await rm(lock, { recursive: true, force: true })
      } catch {}
      await new Promise((resolve) => setTimeout(resolve, 25))
    }
  }
  if (!acquired) throw new Error('Hook state busy')
  try {
    return await processResearchHook(payload, options)
  } finally {
    await rm(lock, { recursive: true, force: true })
  }
}

async function processResearchHook(payload, { stateDir, workbench, send = async () => {}, now = Date.now() }) {
  if (!payload.session_id || !payload.agent_id) return null
  if (payload.agent_type && payload.agent_type !== 'research-agent') return null
  const identity = createHash('sha256').update(`${payload.session_id}\0${payload.agent_id}`).digest('hex')
  const file = resolve(stateDir, `${identity}.json`)
  let state
  if (payload.hook_event_name === 'SubagentStart') {
    if (payload.agent_type !== 'research-agent') return null
    await mkdir(stateDir, { recursive: true, mode: 0o700 })
    try {
      state = JSON.parse(await readFile(file, 'utf8'))
    } catch {}
    if (state) return null
    state = {
      taskId: `research-${identity.slice(0, 32)}`,
      startedAt: now,
      sequence: 0,
      candidates: [],
      written: [],
      webResults: 0,
    }
  } else {
    try {
      state = JSON.parse(await readFile(file, 'utf8'))
    } catch {
      return null
    }
    if (state.finished) return null
  }
  const emit = async (phase, text) => {
    if (phase === state.phase) return
    state.phase = phase
    const event = { version: 1, taskId: state.taskId, sequence: ++state.sequence, phase, text }
    try {
      await send(event)
    } catch {
      /* Notifications never gate Claude. */
    }
  }
  let result = null
  if (payload.hook_event_name === 'SubagentStart') {
    await emit('confirming', 'Starting research')
    result = {
      hookSpecificOutput: {
        hookEventName: 'SubagentStart',
        additionalContext: `The StackChan companion tracks this research run, started at ${new Date(state.startedAt).toISOString()}. Use this timestamp for generated.at if no more precise current timestamp is available. Readiness currently supports the explicitly authorised public-source ResearchNote profile: jyos.schema "0.1", new id, maturity working, sensitivity normal, ai_access explicit, wiki.ingest false, generated.by agent:research-agent, sources with id/resource/title/retrieved_at, and Summary in plain English, Claim status, Still to check sections. Do not infer public-source permission or change a private-context task to fit this profile. At the end, after a successful new ResearchNote save, append one line: JYOS_RESEARCH_RESULT: {"status":"success","output":"/absolute/path/to/new-note.md"}. If no successful save occurred, use status "failed" or "needs-input" instead. This marker reports output status, never human verification. Keep your existing source, scope and file-write permissions.`,
      },
    }
  } else if (payload.hook_event_name === 'PreToolUse' && payload.tool_name === 'Write') {
    try {
      const output = await newNotePath(payload.tool_input?.file_path, workbench)
      if (!state.candidates.includes(output)) state.candidates.push(output)
    } catch {
      /* Existing/out-of-scope output cannot qualify for readiness. */
    }
  } else if (payload.hook_event_name === 'PostToolUse') {
    if (['WebFetch', 'WebSearch'].includes(payload.tool_name)) {
      state.webResults++
      await emit('gathering', 'Reading public sources')
    }
    if (payload.tool_name === 'Write') {
      let output
      try {
        output = await realpath(payload.tool_input?.file_path)
      } catch {}
      if (output && state.candidates.includes(output) && !state.written.includes(output)) state.written.push(output)
      await emit('drafting', 'Writing the research note')
    }
  } else if (payload.hook_event_name === 'SubagentStop' && payload.agent_type === 'research-agent') {
    let phase = 'failed'
    try {
      const marker = payload.last_assistant_message?.match(/^JYOS_RESEARCH_RESULT:\s*(\{[^\n]+\})\s*$/m)
      const outcome = JSON.parse(marker?.[1] ?? '{}')
      if (outcome.status === 'needs-input') phase = 'failed'
      else {
        if (outcome.status !== 'success' || !state.webResults || state.written.length !== 1)
          throw new Error('No validated successful output')
        const info = await lstat(outcome.output)
        if (!info.isFile() || info.isSymbolicLink() || info.size > 250000) throw new Error('Invalid note file')
        const output = await realpath(outcome.output)
        if (output !== state.written[0]) throw new Error('Different output')
        validateResearchNote(await readFile(output, 'utf8'), { startedAt: state.startedAt })
        phase = 'ready'
      }
    } catch {
      /* Agent stopping alone never proves success. */
    }
    await emit(
      phase,
      phase === 'ready'
        ? 'Research note ready for review'
        : phase === 'needs-input'
          ? 'Research needs your input'
          : 'Research needs review',
    )
    // A stopped subagent cannot resume this run; a retry gets a new identity.
    state.finished = true
  }
  await writeFile(file, JSON.stringify(state), { mode: 0o600 })
  return result
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  if (process.env.STACKCHAN_RESEARCH_LAUNCHER !== '1') {
    try {
      const { values } = parseArgs({
        options: {
          config: { type: 'string' },
          'state-dir': { type: 'string' },
          workbench: { type: 'string', default: `${homedir()}/JYOS/Workbench` },
        },
      })
      const config = JSON.parse(await readFile(values.config, 'utf8')).config.researchCompanion
      let input = ''
      for await (const chunk of process.stdin) {
        input += chunk
        if (input.length > 1000000) throw new Error('Oversized hook input')
      }
      const result = await handleResearchHook(JSON.parse(input), {
        stateDir: values['state-dir'] ?? resolve(dirname(values.config), '.hook-state'),
        workbench: values.workbench,
        send: async (event) => {
          const response = await fetch(`http://127.0.0.1:${config.port}/v1/events`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${config.token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(event),
            signal: AbortSignal.timeout(1500),
          })
          if (!response.ok) throw new Error('Companion unavailable')
        },
      })
      if (result) console.log(JSON.stringify(result))
    } catch {
      console.error('StackChan notification unavailable; research continues')
    }
  }
}
