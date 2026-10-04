// Experimental ESP-DL binding; owns its model until close().
export default class extends Native('xs_local_face_destructor') {
  constructor() {
    super()
    native('xs_local_face_constructor').call(this)
  }
  detect(buffer, width, height) {
    return native('xs_local_face_detect').call(this, buffer, width, height)
  }
  close() {
    native('xs_local_face_close').call(this)
  }
}
