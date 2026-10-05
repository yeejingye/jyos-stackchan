import Resource from 'Resource'

export default class extends Native('xs_joy_voice_destructor') {
  constructor(diagnostics = false) {
    super()
    this.models = new Resource('joy-voice-models.bin')
    this.reference = diagnostics ? new Resource('joy-reference-command.pcm') : undefined
    this.pomodoroReference = diagnostics ? new Resource('joy-reference-pomodoro.pcm') : undefined
    this.pauseReference = diagnostics ? new Resource('joy-reference-pause.pcm') : undefined
    this.startPhraseReference = diagnostics ? new Resource('joy-reference-start-phrase.pcm') : undefined
    this.pausePhraseReference = diagnostics ? new Resource('joy-reference-pause-phrase.pcm') : undefined
    this.controlReference = diagnostics ? new Resource('joy-reference-control.pcm') : undefined
    this.resumeReference = diagnostics ? new Resource('joy-reference-resume.pcm') : undefined
    this.cancelReference = diagnostics ? new Resource('joy-reference-cancel.pcm') : undefined
    this.negativeReference = diagnostics ? new Resource('joy-reference-negative.pcm') : undefined
    native('xs_joy_voice_constructor').call(
      this,
      this.models,
      this.reference,
      this.pomodoroReference,
      this.pauseReference,
      this.startPhraseReference,
      this.pausePhraseReference,
      this.controlReference,
      this.resumeReference,
      this.cancelReference,
      this.negativeReference,
    )
  }
  get chunkSamples() {
    return native('xs_joy_voice_chunk').call(this)
  }
  get stats() {
    return native('xs_joy_voice_stats').call(this)
  }
  detect(buffer, commandMode) {
    return native('xs_joy_voice_detect').call(this, buffer, commandMode)
  }
  reset() {
    native('xs_joy_voice_reset').call(this)
  }
  close() {
    native('xs_joy_voice_close').call(this)
  }
}
