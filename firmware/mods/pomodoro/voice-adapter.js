import Modules from 'modules'

// Bounded PCM frame accumulator. No recordings or transcripts leave the device.
export function attachLocalVoice(robot, controller) {
  if (!Modules.has('local-voice')) {
    trace('[joy-voice] Native voice host unavailable; drawer controls remain available\n')
    return undefined
  }
  const Engine = Modules.importNow('local-voice')
  let engine
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
    const commands = ['', 'pomodoro', 'pause', 'resume', 'cancel']
    const window = controller.window
    const reset = () => {
      offset = 0
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
        if (commandMode !== window.listening) {
          engine.reset()
          commandMode = window.listening
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
        } else if (result > 0 && window.command(commands[result])) {
          trace(`[joy-voice] command=${commands[result]}\n`)
          reset()
        }
        // The acknowledgement chime suspends input synchronously.
        if (suspended || window.suspended) break
      }
    }
    microphone.start()
    trace(`[joy-voice] Listening locally; ${engine.chunkSamples} samples/frame\n`)
    const adapter = {
      mute(value) {
        muted = !!value
        reset()
      },
      suspend(value) {
        suspended = !!value
        reset()
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
        microphone.stop()
        microphone.onReadable = undefined
        engine?.close()
      },
    }
    controller.attachVoice(adapter)
    return adapter
  } catch (error) {
    microphone.onReadable = undefined
    engine?.close()
    trace(`[joy-voice] Disabled after initialization failure: ${error}\n`)
    return undefined
  }
}
