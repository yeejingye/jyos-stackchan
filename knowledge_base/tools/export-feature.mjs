import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const [input, flag, runtime] = process.argv.slice(2)
if (!input || flag !== '--runtime-root' || !runtime) {
  throw new Error('Usage: <bundled-node> export-feature.mjs <feature.md> --runtime-root <dependencies-root>')
}
const source = path.resolve(input)
if (path.basename(source) !== 'feature.md') throw new Error('Choose the canonical feature.md file')
const require = createRequire(path.join(path.resolve(runtime), 'node/node_modules/runtime.cjs'))
const { marked } = require('marked')
const { instance } = require('@viz-js/viz')
const sharp = require('sharp')
const text = await readFile(source, 'utf8')
const hash = createHash('sha256').update(text).digest('hex')
const generated = new Date().toISOString()
const tokens = marked.lexer(text)
const title = tokens.find((token) => token.type === 'heading' && token.depth === 1)?.text
if (!title) throw new Error('The feature must start with a descriptive title')
const output = path.join(path.dirname(source), 'exports')
const build = path.join(output, '.build')
await mkdir(build, { recursive: true })
const escape = (value) => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')
const quote = (value) => JSON.stringify(value)
const wrap = (label) => label.match(/.{1,23}(?:\s|$)|\S{1,23}/g)?.map((part) => part.trim()).join('\n') ?? label
const viz = await instance()

// A deliberately small supported Mermaid subset, also used by the feature template.
// Fail on unsupported syntax instead of silently drawing an inaccurate projection.
function graph(sourceText) {
  const lines = sourceText.split('\n').map((line) => line.trim()).filter(Boolean)
  const direction = lines.shift()?.match(/^flowchart (LR|TD)$/)?.[1]
  if (!direction) throw new Error('Exports support flowchart LR or TD with explicit quoted node definitions')
  const nodes = new Map()
  const edges = []
  for (const line of lines) {
    if (line.startsWith('%%')) continue
    const node = line.match(/^([A-Za-z][\w]*)\["([^"\n]+)"\]$/)
    const edge = line.match(/^([A-Za-z][\w]*) -->\s*(?:\|([^|]+)\|\s*)?([A-Za-z][\w]*)$/)
    if (node) nodes.set(node[1], node[2])
    else if (edge) edges.push(edge)
    else throw new Error(`Unsupported diagram line: ${line}`)
  }
  const statements = [...nodes].map(([id, label]) => `${id} [label=${quote(wrap(label))}]`)
  for (const [, from, label, to] of edges) {
    if (!nodes.has(from) || !nodes.has(to)) throw new Error(`Undefined diagram node: ${from} or ${to}`)
    statements.push(`${from} -> ${to}${label ? ` [label=${quote(wrap(label))}]` : ''}`)
  }
  return `digraph feature { graph [rankdir=${direction === 'TD' ? 'TB' : 'LR'}, bgcolor="transparent", nodesep=0.28, ranksep=0.36, pad=0.12]; node [shape=box, style="rounded,filled", fillcolor="#eef4f6", color="#a8bdc4", fontname="Arial", fontsize=14, margin="0.14,0.1"]; edge [color="#446875", fontname="Arial", fontsize=10, arrowsize=0.7]; ${statements.join(';\n')} }`
}

const toc = []
const body = []
let number = 0
for (const token of tokens) {
  if (token.type === 'heading') {
    if (token.depth === 1) continue
    token.anchor = token.text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    if (token.depth === 2) toc.push(`<a href="#${token.anchor}">${escape(token.text)}</a>`)
    body.push(`<h${token.depth} id="${token.anchor}">${escape(token.text)}</h${token.depth}>`)
  } else if (token.type === 'code' && token.lang === 'mermaid') {
    const svg = viz.renderString(graph(token.text), { format: 'svg', engine: 'dot' })
    const png = path.join(build, `diagram-${++number}.png`)
    await sharp(Buffer.from(svg), { density: 200 }).png().toFile(png)
    token.diagramPath = png
    const inlineSvg = svg.replace(/<\?xml[^>]*>\s*/g, '').replace(/<!DOCTYPE[\s\S]*?>\s*/g, '')
    body.push(`<figure class="diagram" role="img" aria-label="${escape(`Feature diagram ${number}`)}">${inlineSvg}</figure><details><summary>Mermaid source</summary><pre><code>${escape(token.text)}</code></pre></details>`)
  } else if (token.type === 'code') {
    body.push(`<div class="code-block"><button class="copy" type="button">Copy commands</button><pre><code>${escape(token.text)}</code></pre></div>`)
  } else {
    body.push(marked.parser([token]))
  }
}
const content = body.join('\n').replace(/href="(?![a-z]+:|#|\/)([^"\s]+)"/g, (_match, link) => `href="../${link}"`)
const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escape(title)}</title>
<style>
:root{--ink:#172f3a;--muted:#566976;--accent:#216b68;--line:#dce5e8;--paper:#fff;--bg:#f3f6f6}*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.65 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}header{padding:46px max(6vw,24px) 32px;background:#e9f1f1}header .eyebrow{color:var(--accent);font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase}h1{max-width:930px;font-size:clamp(30px,4vw,46px);line-height:1.13;margin:12px 0 20px;font-weight:750}header p{margin:6px 0;color:var(--muted);font-size:13px}.layout{max-width:1320px;margin:auto;display:grid;grid-template-columns:235px minmax(0,1fr);gap:44px;padding:36px 28px 70px}nav{position:sticky;top:25px;align-self:start;font-size:13px;max-height:85vh;overflow:auto}nav a{display:block;padding:7px 12px;border-left:2px solid transparent;text-decoration:none;color:var(--muted)}nav a:hover,nav a.active{color:var(--accent);border-color:var(--accent);background:#e9f1f1}article{min-width:0;max-width:930px;background:var(--paper);padding:34px 44px;border:1px solid var(--line);border-radius:14px}article>p:first-child{font-size:20px;line-height:1.55}h2{font-size:25px;line-height:1.3;margin:40px 0 16px;scroll-margin-top:28px}h3{font-size:19px}a{color:var(--accent);text-underline-offset:3px}p,ul,ol{margin:14px 0 20px}li{margin:8px 0}table{border-collapse:collapse;width:100%;font-size:14px;margin:18px 0 26px;overflow-wrap:anywhere}th,td{border:1px solid var(--line);padding:12px 14px;text-align:left;vertical-align:top}th{background:#eaf1f3;font-weight:650}tbody tr:nth-child(even){background:#fafcfc}td:first-child{width:25%}code{font:0.88em/1.55 ui-monospace,SFMono-Regular,Menlo,monospace}p code,li code{background:#eef2f4;padding:2px 5px;border-radius:4px}pre{margin:0;padding:20px;overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere;background:#f1f4f6;border-radius:8px}.code-block{position:relative;margin:20px 0}.code-block pre{padding-top:43px}.copy{position:absolute;top:9px;right:10px;border:1px solid #bccdd2;background:#fff;border-radius:5px;padding:4px 9px;color:var(--muted);cursor:pointer}.diagram{margin:24px 0;padding:15px;background:#fcfdfd;border:1px solid var(--line);border-radius:8px;overflow:auto}.diagram svg{display:block;max-width:100%;height:auto;margin:auto}.diagram svg[height]{max-height:670px}details{font-size:12px;color:var(--muted);margin-bottom:25px}summary{cursor:pointer;margin-bottom:8px}footer{margin-top:40px;border-top:1px solid var(--line);padding-top:18px;font-size:12px;color:var(--muted);overflow-wrap:anywhere}.toolbar{display:inline-flex;gap:10px;margin-top:12px}.toolbar a,.toolbar button{font:13px system-ui;border:1px solid #a8bec2;border-radius:6px;padding:7px 12px;background:white;color:var(--ink);text-decoration:none;cursor:pointer}@media(max-width:850px){.layout{display:block;padding:20px 14px}nav{position:static;max-height:none;display:flex;flex-wrap:wrap;margin-bottom:18px}nav a{padding:5px 8px}article{padding:24px 20px}table{font-size:12px}th,td{padding:8px}.diagram{padding:5px}}@media print{body{background:white;font-size:10pt}header{padding:0;background:white}.layout{display:block;padding:0}nav,.toolbar,.copy,details{display:none}article{padding:0;border:0;max-width:none}h1{font-size:25pt}h2{font-size:16pt;break-after:avoid}p,li{orphans:3;widows:3}table,figure,.code-block{break-inside:avoid}table{font-size:9pt}.diagram{border:0}footer{font-size:8pt}a{color:inherit}}
</style></head><body><header><div class="eyebrow">JYOS StackChan · Feature documentation</div><h1>${escape(title)}</h1><p>Generated view of feature.md · Source SHA256 ${hash.slice(0,12)} · ${escape(generated.slice(0,10))}</p><div class="toolbar"><a href="../feature.md">Canonical Markdown</a><a href="feature.docx">Word document</a><button type="button" onclick="window.print()">Print</button></div></header><div class="layout"><nav aria-label="Document sections">${toc.join('')}</nav><article>${content}<footer>Canonical source: ../feature.md<br>Source SHA256: ${hash}<br>Generated: ${generated}. Regenerate this view after changing the Markdown.</footer></article></div><script>
document.querySelectorAll('.copy').forEach(button=>button.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(button.nextElementSibling.textContent);button.textContent='Copied'}catch{button.textContent='Select commands to copy'}setTimeout(()=>button.textContent='Copy commands',1800)}));const links=[...document.querySelectorAll('nav a')];new IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting){links.forEach(link=>link.classList.toggle('active',link.hash==='#'+entry.target.id))}},{rootMargin:'-10% 0px -75% 0px'}).observe(document.querySelector('h2'));document.querySelectorAll('h2').forEach(h=>{new IntersectionObserver(entries=>{if(entries[0].isIntersecting)links.forEach(link=>link.classList.toggle('active',link.hash==='#'+h.id))},{rootMargin:'-10% 0px -75% 0px'}).observe(h)});
</script></body></html>`
await writeFile(path.join(output, 'feature.html'), html)
const payload = path.join(build, 'document.json')
await writeFile(payload, JSON.stringify({ title, source, hash, generated, tokens }))
const builder = path.join(path.dirname(fileURLToPath(import.meta.url)), 'export-feature-docx.py')
const result = spawnSync(path.join(path.resolve(runtime), 'python/bin/python3'), [builder, payload, path.join(output, 'feature.docx')], { encoding: 'utf8' })
if (result.status !== 0) throw new Error(result.stderr || result.stdout || 'DOCX generation failed')
console.log(`Generated ${path.join(output, 'feature.html')}\nGenerated ${path.join(output, 'feature.docx')}\nSource SHA256 ${hash}`)
