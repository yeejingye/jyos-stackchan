import Resource from 'Resource'

export default class extends Native('xs_joy_voice_destructor') {
  constructor(diagnostics = false) {
    super()
    this.models = new Resource('joy-voice-models.bin')
    this.reference = diagnostics ? new Resource('joy-reference-command.pcm') : undefined
    native('xs_joy_voice_constructor').call(this, this.models, this.reference)
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
