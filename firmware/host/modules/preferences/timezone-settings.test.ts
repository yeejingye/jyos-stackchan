import assert from 'node:assert/strict'
import { dirname, resolve } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

import Time from '../testing/fakes/time.js'
import { writeAliasPackage } from '../testing/node-alias-package.js'

const modulesRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
writeAliasPackage(modulesRoot, 'time', resolve(modulesRoot, 'testing/fakes/time.js'), {
  hasDefaultExport: true,
})
writeAliasPackage(modulesRoot, 'timezone-model', resolve(modulesRoot, 'preferences/timezone-model.js'))

const {
  DEFAULT_TIMEZONE_ID,
  TIMEZONE_PRESETS,
  applyTimezone,
  formatUtcOffset,
  getTimezonePreset,
  normalizeTimezoneId,
} = await import('./timezone-settings.js')

type FakeTime = typeof Time & {
  reset(): void
}

test('time zone presets expose the agreed fixed UTC offsets', () => {
  assert.deepEqual(
    TIMEZONE_PRESETS.map(({ id, offsetMinutes }) => [id, offsetMinutes]),
    [
      ['honolulu', -600],
      ['los-angeles', -480],
      ['denver', -420],
      ['chicago', -360],
      ['new-york', -300],
      ['sao-paulo', -180],
      ['london', 0],
      ['berlin', 60],
      ['paris', 60],
      ['cairo', 120],
      ['moscow', 180],
      ['dubai', 240],
      ['delhi', 330],
      ['bangkok', 420],
      ['beijing', 480],
      ['tokyo', 540],
      ['sydney', 600],
      ['auckland', 720],
    ],
  )
})

test('invalid or missing time zones fall back to Tokyo', () => {
  assert.equal(normalizeTimezoneId(undefined), DEFAULT_TIMEZONE_ID)
  assert.equal(normalizeTimezoneId('invalid'), DEFAULT_TIMEZONE_ID)
  const fallback = getTimezonePreset(null)
  assert.equal(fallback.id, DEFAULT_TIMEZONE_ID)
  assert.equal(fallback.offsetMinutes, 540)
})

test('applying a preset configures local offset and disables automatic DST', () => {
  const fakeTime = Time as FakeTime
  fakeTime.reset()
  fakeTime.dst = 3600

  assert.equal(applyTimezone('delhi'), 'delhi')
  assert.equal(fakeTime.timezone, 330 * 60)
  assert.equal(fakeTime.dst, 0)
})

test('UTC offsets are formatted with an explicit sign and minute component', () => {
  assert.equal(formatUtcOffset(-480), 'UTC-08:00')
  assert.equal(formatUtcOffset(0), 'UTC+00:00')
  assert.equal(formatUtcOffset(330), 'UTC+05:30')
})

test('Berlin follows independent IANA offsets including the daylight-saving boundaries', () => {
  const formatter = new Intl.DateTimeFormat('en', { timeZone: 'Europe/Berlin', timeZoneName: 'shortOffset' })
  for (const iso of [
    '2026-01-01T12:00:00Z',
    '2026-03-29T00:59:59Z',
    '2026-03-29T01:00:00Z',
    '2026-10-06T12:00:00Z',
    '2026-10-25T00:59:59Z',
    '2026-10-25T01:00:00Z',
  ]) {
    const date = new Date(iso)
    applyTimezone('berlin', date.getTime())
    const zone = formatter.formatToParts(date).find((part) => part.type === 'timeZoneName')?.value
    const offsetHours = Number(zone?.replace('GMT', ''))
    assert.equal((Time.timezone + Time.dst) / 3600, offsetHours)
  }
})
