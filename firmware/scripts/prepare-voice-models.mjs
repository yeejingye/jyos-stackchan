import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { validateVoiceModels } from './lib/voice-models.mjs'

const root = fileURLToPath(new URL('../', import.meta.url))
const lock = JSON.parse(await readFile(path.join(root, 'host/modules/local-voice/models.lock.json'), 'utf8'))
const output = path.join(root, 'dist/voice-models')
await mkdir(output, { recursive: true })
const models = []
for (const model of lock.models) {
  const files = []
  for (const file of model.files) {
    const cache = path.join(output, `${model.name}-${file.name}`)
    let data
    try {
      data = await readFile(cache)
    } catch {}
    const digest = (buffer) => createHash('sha256').update(buffer).digest('hex')
    if (!data || digest(data) !== file.sha256) {
      const response = await fetch(`https://raw.githubusercontent.com/espressif/esp-sr/${lock.commit}/${file.source}`)
      if (!response.ok) throw new Error(`Model download failed: ${response.status}`)
      data = Buffer.from(await response.arrayBuffer())
      if (digest(data) !== file.sha256) throw new Error(`Model checksum mismatch: ${file.name}`)
      await writeFile(cache, data)
    }
    files.push({ name: file.name, data })
  }
  models.push({ name: model.name, files })
}
// ESP-SR model_path.h binary format, little-endian indexes into the packed resource.
const headerSize = 4 + models.reduce((n, model) => n + 36 + model.files.length * 40, 0)
const header = Buffer.alloc(headerSize)
header.writeUInt32LE(models.length)
let cursor = 4
let offset = headerSize
const payload = []
for (const model of models) {
  header.write(model.name, cursor, 32, 'ascii')
  cursor += 32
  header.writeUInt32LE(model.files.length, cursor)
  cursor += 4
  for (const file of model.files) {
    header.write(file.name, cursor, 32, 'ascii')
    cursor += 32
    header.writeUInt32LE(offset, cursor)
    cursor += 4
    header.writeUInt32LE(file.data.length, cursor)
    cursor += 4
    payload.push(file.data)
    offset += file.data.length
  }
}
const packed = Buffer.concat([header, ...payload])
validateVoiceModels(packed, lock)
await writeFile(path.join(output, 'joy-voice-models.bin'), packed)
console.log(`[stack-chan] Prepared verified voice models (${offset} bytes); source ${lock.commit}`)
