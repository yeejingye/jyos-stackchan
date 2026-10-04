import Modules from 'modules'
import { amplifyPCM } from 'pomodoro-pcm-gain'
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
    engine = new Engine(diagnostics)
    const frame = new Uint8Array(engine.chunkSamples * 2)
    let offset = 0
    let suspended = false
    let muted = false
    let commandMode = false
    let peak = 0
    let processedPeak = 0
    let awaitingCommand = false
    let windowStats
    const debug = (message, detail = '') => {
      if (diagnostics) controller.voiceDebug(message, detail)
    }
    const commands = ['', 'pomodoro', 'pause', 'resume', 'cancel']
    const window = controller.window
    let waitingForReference = diagnostics
    const reset = () => {
      offset = 0
      peak = 0
      processedPeak = 0
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
          if (diagnostics && commandMode) windowStats = engine.stats
          trace(`[joy-voice] command-window=${commandMode ? 'open' : 'closed'}\n`)
        }
        if (diagnostics && commandMode) processedPeak = Math.max(processedPeak, amplifyPCM(frame.buffer, 4))
        const result = engine.detect(frame, commandMode)
        if (result === -2) {
          trace('[joy-voice] Wake engine unavailable; muting recognition\n')
          debug('Voice unavailable')
          controller.setMuted(true)
          break
        } else if (result === -1) {
          trace('[joy-voice] wake\n')
          debug('Heard: Hi Joy', 'Greeting…')
          window.wake()
          engine.reset()
          commandMode = true
        } else if (result > 0) {
          const accepted = window.command(commands[result])
          awaitingCommand = false
          debug(`Heard: ${commands[result] ?? 'unknown'}`, accepted ? 'Command accepted' : 'Command not accepted')
          trace(`[joy-voice] candidate=${commands[result]} accepted=${accepted}\n`)
          if (accepted) reset()
        }
        // The acknowledgement chime suspends input synchronously.
        if (suspended || window.suspended) break
      }
    }
    const startCapture = () => {
      microphone.start()
      trace(`[joy-voice] Listening locally; ${engine.chunkSamples} samples/frame\n`)
    }
    if (!waitingForReference) startCapture()
    if (diagnostics)
      diagnosticTimer = Timer.repeat(() => {
        if (engine && waitingForReference) {
          const result = engine.stats.selfTestResult
          if (!result) {
            debug('Testing command model…', 'Reference audio, no microphone')
            return
          }
          waitingForReference = false
          debug(
            result > 0 ? 'Model reference test passed' : 'Model reference test failed',
            'Now say Hi Joy, then a command',
          )
          startCapture()
        }
        if (engine && window.listening) {
          awaitingCommand = true
          const stats = engine.stats
          if (!windowStats) windowStats = stats
          debug(
            'Listening for a command…',
            `L ${peak}/${processedPeak} · lost ${stats.droppedFrames - windowStats.droppedFrames}`,
          )
          trace(`[joy-voice] input-peak=${peak} boosted-peak=${processedPeak} gain=4 stats=${JSON.stringify(stats)}\n`)
          peak = 0
          processedPeak = 0
        } else if (awaitingCommand) {
          awaitingCommand = false
          windowStats = undefined
          debug(window.muted || window.suspended ? 'Listening interrupted' : 'No command detected')
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
    debug(waitingForReference ? 'Testing command model…' : 'Voice debug ready', 'Say Hi Joy after the test')
    return adapter
  } catch (error) {
    if (diagnosticTimer) Timer.clear(diagnosticTimer)
    microphone.onReadable = undefined
    engine?.close()
    trace(`[joy-voice] Disabled after initialization failure: ${error}\n`)
    return undefined
  }
}
