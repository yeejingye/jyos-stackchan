// Camera frames are native HostBuffers, not ArrayBuffers with a slice method.
export function copyFrameFragment(buffer, offset, end) {
  return new Uint8Array(buffer).slice(offset, end).buffer
}
