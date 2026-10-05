import { readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { esptoolConnectionArguments } from './mod-flash.mjs'

/** Verify every image in IDF's generated flash plan independently of mcconfig's exit status. */
export function verifyHostFlash({ outputDirectory, deviceName, mode, applicationName, chip, port, baud, runCommand }) {
  const directory = path.join(
    outputDirectory,
    'tmp',
    'esp32',
    deviceName,
    mode,
    applicationName,
    `xsProj-${chip}`,
    'build',
  )
  const plan = JSON.parse(readFileSync(path.join(directory, 'flasher_args.json'), 'utf8'))
  const files = Object.entries(plan.flash_files ?? {})
  if (!files.length) throw new Error('Host flash plan contains no images')
  const imageArgs = files.flatMap(([offset, file]) => {
    if (!/^0x[\da-f]+$/i.test(offset) || typeof file !== 'string') throw new Error('Invalid host flash image')
    const absolute = path.resolve(directory, file)
    const relative = path.relative(directory, absolute)
    if (relative.startsWith('..') || path.isAbsolute(relative) || !statSync(absolute).isFile()) {
      throw new Error('Host flash image is outside the build directory or missing')
    }
    return [offset, absolute]
  })
  runCommand('esptool', [
    ...esptoolConnectionArguments({ chip, port, baud }),
    '--after',
    'hard-reset',
    'verify-flash',
    ...imageArgs,
  ])
  return files.length
}
