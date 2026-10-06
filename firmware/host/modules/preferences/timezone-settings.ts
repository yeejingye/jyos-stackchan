import Time from 'time'
import { getTimezonePreset, type TimezoneId, timezoneDstSeconds } from 'timezone-model'

export type { TimezoneId, TimezonePreset } from 'timezone-model'
export {
  DEFAULT_TIMEZONE_ID,
  formatUtcOffset,
  getTimezonePreset,
  normalizeTimezoneId,
  TIMEZONE_PRESETS,
} from 'timezone-model'

export function applyTimezone(value: unknown, utcMs = Date.now()): TimezoneId {
  const preset = getTimezonePreset(value)
  Time.timezone = preset.offsetMinutes * 60
  Time.dst = timezoneDstSeconds(preset.id, utcMs)
  return preset.id
}
