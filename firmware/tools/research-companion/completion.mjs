import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const directory = fileURLToPath(new URL('../../dist/companion/', import.meta.url))
export const detectorPath = `${directory}detect-face`
export const speechPath = `${directory}research-ready.wav`
export function run(command, args, input, timeout = 30000) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['pipe', 'pipe', 'pipe'] })
    const chunks = []
    let bytes = 0
    const timer = setTimeout(() => child.kill('SIGKILL'), timeout)
    child.on('error', (error) => {
      clearTimeout(timer)
      reject(error)
    })
    child.stdout.on('data', (chunk) => {
      bytes += chunk.length
      if (bytes > 65536) child.kill('SIGKILL')
      else chunks.push(chunk)
    })
    child.stderr.resume()
    child.stdin.on('error', () => {})
    child.stdin.end(input)
    child.on('close', (code) => {
      clearTimeout(timer)
      if (code !== 0) reject(new Error('Completion helper failed or timed out'))
      else resolve(Buffer.concat(chunks))
    })
  })
}
// Speaker.play expects a canonical 44-byte PCM WAV header.
export function canonicalWav(buffer) {
  if (buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WAVE')
    throw new Error('Expected WAV')
  let format
  let pcm
  for (let offset = 12; offset + 8 <= buffer.length; ) {
    const size = buffer.readUInt32LE(offset + 4)
    if (offset + 8 + size > buffer.length) throw new Error('Truncated WAV chunk')
    const name = buffer.toString('ascii', offset, offset + 4)
    if (name === 'fmt ') format = buffer.subarray(offset + 8, offset + 8 + size)
    if (name === 'data') pcm = buffer.subarray(offset + 8, offset + 8 + size)
    offset += 8 + size + (size & 1)
  }
  if (
    !format ||
    format.length < 16 ||
    format.readUInt16LE(0) !== 1 ||
    format.readUInt16LE(2) !== 1 ||
    format.readUInt32LE(4) !== 8000 ||
    format.readUInt16LE(14) !== 16 ||
    !pcm ||
    pcm.length > 100000
  )
    throw new Error('Expected bounded mono 8kHz 16-bit PCM')
  const header = Buffer.alloc(44)
  header.write('RIFF', 0)
  header.writeUInt32LE(36 + pcm.length, 4)
  header.write('WAVEfmt ', 8)
  header.writeUInt32LE(16, 16)
  format.copy(header, 20, 0, 16)
  header.write('data', 36)
  header.writeUInt32LE(pcm.length, 40)
  return Buffer.concat([header, pcm])
}
export async function prepareCompletion() {
  mkdirSync(directory, { recursive: true })
  await run(
    '/usr/bin/xcrun',
    ['swiftc', fileURLToPath(new URL('./detect-face.swift', import.meta.url)), '-o', detectorPath],
    undefined,
    60000,
  )
  await run('/usr/bin/say', [
    '-v',
    'Samantha',
    '-r',
    '175',
    '-o',
    `${directory}ready.aiff`,
    'JY, your research note is ready for review.',
  ])
  await run('/usr/bin/afconvert', [
    '-f',
    'WAVE',
    '-d',
    'LEI16@8000',
    '-c',
    '1',
    `${directory}ready.aiff`,
    `${directory}ready-raw.wav`,
  ])
  writeFileSync(speechPath, canonicalWav(readFileSync(`${directory}ready-raw.wav`)))
}
export async function detectFace(frame) {
  if (!existsSync(detectorPath)) throw new Error('Run npm run research:prepare first')
  return JSON.parse((await run(detectorPath, [], frame, 2500)).toString())
}
if (process.argv[2] === 'prepare') {
  await prepareCompletion()
  console.log('Local face detector and completion speech prepared under dist/companion')
}
