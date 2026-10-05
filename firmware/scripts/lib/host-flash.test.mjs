import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { verifyHostFlash } from './host-flash.mjs'

test('verifies all images at the offsets emitted by IDF and propagates mismatch failures', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'joy-host-flash-'))
  const options = {
    outputDirectory: root,
    deviceName: 'fixture',
    mode: 'release',
    applicationName: 'host',
    chip: 'esp32s3',
    port: '/dev/test',
    baud: 115200,
  }
  const build = path.join(root, 'tmp/esp32/fixture/release/host/xsProj-esp32s3/build')
  mkdirSync(build, { recursive: true })
  try {
    const images = { '0x0': 'boot.bin', '0x9000': 'table.bin', '0x20000': 'app.bin' }
    for (const file of Object.values(images)) writeFileSync(path.join(build, file), 'fixture')
    writeFileSync(path.join(build, 'flasher_args.json'), JSON.stringify({ flash_files: images }))
    const calls = []
    assert.equal(verifyHostFlash({ ...options, runCommand: (...args) => calls.push(args) }), 3)
    assert.equal(calls.length, 1)
    assert.equal(calls[0][0], 'esptool')
    const args = calls[0][1]
    assert.deepEqual(
      args.slice(args.indexOf('verify-flash') + 1),
      Object.entries(images).flatMap(([offset, file]) => [offset, path.join(build, file)]),
    )
    assert.ok(args.includes('115200'))
    assert.ok(args.includes('/dev/test'))
    assert.throws(
      () =>
        verifyHostFlash({
          ...options,
          runCommand: () => {
            throw new Error('digest mismatch')
          },
        }),
      /digest mismatch/,
    )
    writeFileSync(path.join(build, 'flasher_args.json'), JSON.stringify({ flash_files: {} }))
    assert.throws(() => verifyHostFlash({ ...options, runCommand: () => assert.fail('must not connect') }), /no images/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
