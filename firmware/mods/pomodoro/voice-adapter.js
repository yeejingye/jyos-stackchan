import Modules from 'modules'
import Timer from 'timer'

// Bounded PCM frame accumulator. No recordings or transcripts leave the device.
export function attachLocalVoice(robot, controller, { diagnostics = false } = {}) {
  if (!Modules.has('local-voice')) {
    trace('[joy-voice] Native voice host unavailable; drawer controls remain available\n')
    return undefined
  }
  const Engine = Modules.importNow('local-voice')
  let engine
  let diagnosticTimer
  const microphone = robot.audio.microphone
  if (!microphone || microphone.recording) {
    trace('[joy-voice] Microphone unavailable; drawer controls remain available\n')
    return undefined
  }
  try {
    engine = new Engine()
    const frame = new Uint8Array(engine.chunkSamples * 2)
    let offset = 0
    let suspended = false
    let muted = false
    let commandMode = false
    let peak = 0
    const commands = ['', 'pomodoro', 'pause', 'resume', 'cancel']
    const window = controller.window
    const reset = () => {
      offset = 0
      peak = 0
      commandMode = false
      engine?.reset()
    }
    microphone.onReadable = function (size) {
      // Drain input even while muted to avoid backlog and replay of old audio.
      const chunk = this.read(size)
      if (!chunk || muted || suspended || window.suspended) {
        offset = 0
        return
      }
      const bytes = new Uint8Array(chunk)
      let cursor = 0
      while (cursor < bytes.length) {
        const count = Math.min(frame.length - offset, bytes.length - cursor)
        frame.set(bytes.subarray(cursor, cursor + count), offset)
        offset += count
        cursor += count
        if (offset !== frame.length) continue
        offset = 0
        if (diagnostics) {
          const view = new DataView(frame.buffer)
          for (let i = 0; i < frame.length; i += 2) peak = Math.max(peak, Math.abs(view.getInt16(i, true)))
        }
        if (commandMode !== window.listening) {
          engine.reset()
          commandMode = window.listening
          trace(`[joy-voice] command-window=${commandMode ? 'open' : 'closed'}\n`)
        }
        const result = engine.detect(frame, commandMode)
        if (result === -2) {
          trace('[joy-voice] Wake engine unavailable; muting recognition\n')
          controller.setMuted(true)
          break
        } else if (result === -1) {
          trace('[joy-voice] wake\n')
          window.wake()
          engine.reset()
          commandMode = true
        } else if (result > 0) {
          const accepted = window.command(commands[result])
          trace(`[joy-voice] candidate=${commands[result]} accepted=${accepted}\n`)
          if (accepted) reset()
        }
        // The acknowledgement chime suspends input synchronously.
        if (suspended || window.suspended) break
      }
    }
    microphone.start()
    trace(`[joy-voice] Listening locally; ${engine.chunkSamples} samples/frame\n`)
    if (diagnostics)
      diagnosticTimer = Timer.repeat(() => {
        if (engine && window.listening) {
          trace(`[joy-voice] input-peak=${peak} stats=${JSON.stringify(engine.stats)}\n`)
          peak = 0
        }
      }, 1000)
    const adapter = {
      mute(value) {
        muted = !!value
        reset()
      },
      suspend(value) {
        suspended = !!value
        reset()
        // CoreS3 microphone/speaker share clock routing. Reopen capture after playback
        // so the command engine receives a fresh 16 kHz stream rather than a stale clock.
        if (suspended) microphone.stop()
        else if (engine && !microphone.recording && !window.suspended) {
          try {
            microphone.start()
            trace('[joy-voice] microphone resumed after cue\n')
          } catch (error) {
            controller.setMuted(true)
            trace(`[joy-voice] Capture could not resume; manual controls remain available: ${error}\n`)
          }
        }
      },
      releaseForCompletion(value) {
        if (value) {
          microphone.stop()
          engine?.close()
          engine = undefined
          offset = 0
        } else {
          try {
            engine = new Engine()
            reset()
            microphone.start()
          } catch (error) {
            engine?.close()
            engine = undefined
            trace(`[joy-voice] Could not restore listening: ${error}\n`)
          }
        }
      },
      close() {
        if (diagnosticTimer) Timer.clear(diagnosticTimer)
        microphone.stop()
        microphone.onReadable = undefined
        engine?.close()
      },
    }
    controller.attachVoice(adapter)
    return adapter
  } catch (error) {
    if (diagnosticTimer) Timer.clear(diagnosticTimer)
    microphone.onReadable = undefined
    engine?.close()
    trace(`[joy-voice] Disabled after initialization failure: ${error}\n`)
    return undefined
  }
}
