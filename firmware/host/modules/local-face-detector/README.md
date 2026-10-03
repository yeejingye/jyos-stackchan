# Experimental local face detector

CoreS3-only Moddable host binding for Espressif `human_face_detect` 0.5.0 and ESP-DL 3.3.13. The default MSR/MNP model is embedded in flash; no camera frames leave the robot. This detects face location, not identity. It is enabled only by `host/app/manifest_m5stackchan_cores3_local_completion.json`.

```js
const FaceDetector = Modules.importNow('local-face-detector')
const detector = new FaceDetector()
try {
  const face = detector.detect(frame.buffer, 176, 144)
  // null, or { x, y, confidence }; normalized camera coordinates.
} finally {
  detector.close()
}
```

Input is exactly 176×144 RGB565LE. The caller owns the frame and closes it after synchronous inference. The detector owns its model and releases it on `close()` or garbage collection. Repeated close is safe; inference after close throws. `inferenceMs` records the last model call. The binding selects the largest face with confidence ≥0.5.

The make fragment retains Moddable's build rules and applies C++20 only to this binding. Explicit IDF header inclusion is required because XS native modules compile outside the IDF component compilation path.

## Device smoke

After deploying the experimental host, from `firmware/`:

```sh
npm run mod -- host/modules/local-face-detector/__tests__/smoke/manifest.json --port /dev/cu.usbmodem101
```

The smoke exercises invalid dimensions/length, a blank frame, timing, repeated close, and rejection after close. It temporarily replaces the research MOD. Restore with:

```sh
npm run mod -- mods/research_companion/manifest.local.json --port /dev/cu.usbmodem101
```

Source: [Espressif HumanFaceDetect](https://github.com/espressif/esp-dl/tree/master/models/human_face_detect).
