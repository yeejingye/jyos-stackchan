import { createHash } from 'node:crypto'

// Independently decode the generated ESP-SR resource before it enters native code.
export function validateVoiceModels(buffer, catalog) {
  let cursor = 0
  const integer = () => {
    if (cursor + 4 > buffer.length) throw new Error('Truncated model header')
    const result = buffer.readUInt32LE(cursor)
    cursor += 4
    return result
  }
  const name = () => {
    if (cursor + 32 > buffer.length) throw new Error('Truncated model name')
    const field = buffer.subarray(cursor, cursor + 32)
    cursor += 32
    const end = field.indexOf(0)
    if (end < 1) throw new Error('Invalid model name')
    return field.subarray(0, end).toString('ascii')
  }
  const count = integer()
  if (count !== catalog.models.length) throw new Error('Incomplete model catalog')
  const entries = []
  const seen = new Set()
  for (let i = 0; i < count; i++) {
    const modelName = name()
    const model = catalog.models.find((item) => item.name === modelName)
    if (!model || seen.has(modelName)) throw new Error('Unknown or duplicate model')
    seen.add(modelName)
    const files = integer()
    if (files !== model.files.length) throw new Error('Incomplete model files')
    const seenFiles = new Set()
    for (let j = 0; j < files; j++) {
      const fileName = name()
      const file = model.files.find((item) => item.name === fileName)
      if (!file || seenFiles.has(fileName)) throw new Error('Unknown or duplicate model file')
      seenFiles.add(fileName)
      entries.push({ file, offset: integer(), length: integer() })
    }
  }
  let expectedOffset = cursor
  for (const { file, offset, length } of entries) {
    if (offset !== expectedOffset || length < 1 || offset + length > buffer.length)
      throw new Error('Invalid model payload bounds')
    const hash = createHash('sha256')
      .update(buffer.subarray(offset, offset + length))
      .digest('hex')
    if (hash !== file.sha256) throw new Error('Corrupt model payload')
    expectedOffset += length
  }
  if (expectedOffset !== buffer.length) throw new Error('Unexpected trailing model data')
  return true
}
