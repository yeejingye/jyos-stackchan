import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { lstat, readFile, realpath } from 'node:fs/promises'
import { isAbsolute, relative, resolve, sep } from 'node:path'
import { createInterface } from 'node:readline'
import YAML from 'yaml'

export async function newNotePath(output, root) {
  if (!isAbsolute(output) || !output.endsWith('.md')) throw new Error('Output must be an absolute Markdown path')
  const parent = await realpath(resolve(output, '..'))
  const allowed = await realpath(root)
  const within = relative(allowed, parent)
  if (within === '..' || within.startsWith(`..${sep}`) || isAbsolute(within))
    throw new Error('Output must be inside Workbench')
  try {
    await lstat(output)
  } catch (error) {
    if (error.code === 'ENOENT') return resolve(parent, relative(resolve(output, '..'), output))
    throw error
  }
  throw new Error('Refusing to overwrite an existing note')
}

export function validateResearchNote(text, { startedAt, sourceHosts = [] } = {}) {
  const header = text.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)
  if (!header || text.length > 250000) throw new Error('Missing or oversized ResearchNote frontmatter')
  const meta = YAML.parse(header[1])
  if (meta?.type !== 'ResearchNote' || typeof meta.title !== 'string' || !meta.title.trim())
    throw new Error('Invalid ResearchNote identity')
  if (String(meta.jyos?.schema) !== '0.1' || typeof meta.jyos?.id !== 'string' || !meta.jyos.id.trim())
    throw new Error('Invalid JYOS identity')
  if (
    meta.jyos.maturity !== 'working' ||
    meta.jyos.sensitivity !== 'normal' ||
    meta.jyos.ai_access !== 'explicit' ||
    meta.jyos.wiki?.ingest !== false ||
    Object.hasOwn(meta, 'verified')
  )
    throw new Error('Invalid review/access metadata')
  const generated = Date.parse(meta.generated?.at)
  if (
    meta.generated?.by !== 'agent:research-agent' ||
    !Number.isFinite(generated) ||
    (startedAt && generated < startedAt - 60000) ||
    generated > Date.now() + 60000
  )
    throw new Error('Invalid generation provenance')
  if (!Array.isArray(meta.sources) || !meta.sources.length) throw new Error('Missing sources')
  const ids = new Set()
  for (const source of meta.sources) {
    if (
      typeof source.id !== 'string' ||
      !source.id ||
      ids.has(source.id) ||
      typeof source.title !== 'string' ||
      !source.title.trim() ||
      !Number.isFinite(Date.parse(source.retrieved_at))
    )
      throw new Error('Invalid source provenance')
    ids.add(source.id)
    const url = new URL(source.resource)
    if (url.protocol !== 'https:' || (sourceHosts.length && !sourceHosts.includes(url.hostname)))
      throw new Error('Source outside approved HTTPS host scope')
    if (['url', 'retrieved', 'date', 'actor'].some((key) => Object.hasOwn(source, key)))
      throw new Error('Legacy source provenance fields')
  }
  if (['actor', 'date'].some((key) => Object.hasOwn(meta.generated, key))) throw new Error('Legacy generation fields')
  const body = text.slice(header[0].length)
  for (const section of ['Summary in plain English', 'Claim status', 'Still to check']) {
    if (!new RegExp(`^## ${section}\\s*$`, 'm').test(body)) throw new Error(`Missing review section: ${section}`)
  }
  return meta
}

export class ResearchRun {
  constructor({ send = async () => {}, taskId = `research-${randomUUID()}`, warn = () => {} } = {}) {
    Object.assign(this, { send, taskId, warn })
    this.sequence = 0
    this.tools = new Map()
    this.webResults = 0
    this.written = new Set()
  }
  async phase(phase, text) {
    if (phase === this.lastPhase) return
    this.lastPhase = phase
    try {
      await this.send({ version: 1, taskId: this.taskId, sequence: ++this.sequence, phase, text })
    } catch {
      this.warn('StackChan unavailable; research continues')
    }
  }
  async observe(message) {
    for (const block of message.message?.content ?? []) {
      if (block.type === 'tool_use') {
        this.tools.set(block.id, { name: block.name, path: block.input?.file_path })
        if (['WebSearch', 'WebFetch'].includes(block.name)) await this.phase('gathering', 'Reading public sources')
        if (block.name === 'Write') await this.phase('drafting', 'Writing the research note')
      }
      if (block.type === 'tool_result') {
        const tool = this.tools.get(block.tool_use_id)
        this.tools.delete(block.tool_use_id)
        if (!block.is_error && tool) {
          if (['WebSearch', 'WebFetch'].includes(tool.name)) this.webResults++
          if (tool.name === 'Write' && tool.path) this.written.add(resolve(tool.path))
        }
      }
    }
    if (message.type === 'result') this.result = message
  }
  async finish({ exitCode, output, text, startedAt, sourceHosts }) {
    try {
      if (
        exitCode !== 0 ||
        !this.result ||
        this.result.is_error ||
        this.result.subtype !== 'success' ||
        this.result.permission_denials?.length
      )
        throw new Error('Research agent did not finish successfully')
      if (!this.webResults || !this.written.has(resolve(output)))
        throw new Error('Missing successful source activity or output write')
      const meta = validateResearchNote(text, { startedAt, sourceHosts })
      await this.phase('ready', 'Research note ready for review')
      return meta
    } catch (error) {
      await this.phase('failed', 'Research needs review')
      throw error
    }
  }
}

export async function runResearch({
  project,
  output,
  workbench,
  question,
  sourceHosts = [],
  send,
  claude = 'claude',
  warn = console.error,
  signal,
}) {
  if (signal?.aborted) throw new Error('Research cancelled before launch')
  if (!question?.trim()) throw new Error('A research question is required')
  output = await newNotePath(output, workbench)
  project = await realpath(project)
  await lstat(resolve(project, '.claude/agents/research-agent.md'))
  const startedAt = Date.now()
  const run = new ResearchRun({ send, warn })
  const prompt = [
    `Research question: ${question}`,
    'Permission and scope: public external sources only. Prefer primary sources. Read only your role, shared agent instructions, governance and schema specifications in this project; do not read private Workbench notes or entity context. Do not disclose private context to web tools. Do not execute shell commands or change configuration.',
    sourceHosts.length
      ? `Fetch and cite only these exact HTTPS hosts: ${sourceHosts.join(', ')}.`
      : 'Use public HTTPS sources and disclose coverage limits.',
    `Write exactly one NEW ResearchNote at ${output}. Never overwrite an existing file. No other files may be written.`,
    `Follow the ResearchNote review-ready layout. Set jyos.schema: "0.1", a new immutable ID, maturity: working, sensitivity: normal, ai_access: explicit, wiki.ingest: false. Include top-level sources with unique id, resource, title, retrieved_at; generated.by: agent:research-agent and generated.at with the actual timestamp (run started ${new Date(startedAt).toISOString()}). Omit verified. Distinguish directly read evidence, summaries and inference.`,
    'Keep the note concise, around 500–800 words. Report failed reads and uncertainty. A saved note is a draft for human review, not verified truth.',
  ].join('\n\n')
  const args = [
    '-p',
    '--agent',
    'research-agent',
    '--output-format',
    'stream-json',
    '--verbose',
    '--no-session-persistence',
    '--setting-sources',
    'project',
    '--tools',
    'Read,Write,WebSearch,WebFetch',
    '--allowedTools',
    `Read,WebSearch,WebFetch,Edit(/${output})`,
    '--add-dir',
    resolve(output, '..'),
    '--',
    prompt,
  ]
  await run.phase('confirming', 'Starting research')
  const child = spawn(claude, args, {
    cwd: project,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, STACKCHAN_RESEARCH_LAUNCHER: '1' },
  })
  const abort = () => child.kill('SIGTERM')
  signal?.addEventListener('abort', abort, { once: true })
  const timer = setTimeout(abort, 15 * 60 * 1000)
  let stderr = ''
  child.stderr.on('data', (chunk) => {
    stderr = (stderr + chunk.toString()).slice(-4000)
  })
  const exited = new Promise((resolve, reject) => {
    child.on('error', reject)
    child.on('close', resolve)
  })
  // Attach a rejection handler immediately while stdout is consumed.
  exited.catch(() => {})
  try {
    for await (const line of createInterface({ input: child.stdout })) {
      let message
      try {
        message = JSON.parse(line)
      } catch {
        continue
      }
      await run.observe(message)
    }
    const exitCode = await exited
    if (run.result?.permission_denials?.length)
      throw new Error(
        `Claude permission denied: ${run.result.permission_denials.map((item) => item.tool_name ?? 'tool').join(', ')}`,
      )
    if (exitCode !== 0 || run.result?.is_error || run.result?.subtype !== 'success')
      throw new Error('Claude did not complete successfully')
    if (exitCode !== 0 && stderr) warn('Claude exited unsuccessfully; check Claude authentication/permissions')
    const info = await lstat(output)
    if (!info.isFile() || info.isSymbolicLink() || info.size > 250000) throw new Error('Invalid output file')
    const text = await readFile(output, 'utf8')
    await run.finish({ exitCode, output, text, startedAt, sourceHosts })
    return { taskId: run.taskId, output }
  } catch (error) {
    abort()
    await run.phase('failed', signal?.aborted ? 'Research cancelled' : 'Research needs review')
    throw error
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', abort)
  }
}
