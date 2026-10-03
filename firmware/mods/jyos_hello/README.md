# StackChan: tiny developer guide

For your complete M5StackChan CoreS3 running community firmware v1.1.0.

## 1. What you program

The **host firmware** provides hardware, face, and motion APIs. A **MOD** is your JavaScript application. Installing a MOD replaces the host's default behavior and the previously installed MOD.

Your starting files:

- `mod.js`: behavior you edit.
- `manifest.json`: tells the build system which modules to include.

The host calls `onContextCreated(robot)` when your MOD starts. Use `robot` to control it. This is Moddable JavaScript, not Node.js; use `timer` rather than Node timers.

## 2. Edit → upload → observe

Open `mod.js`, change one thing, save, then run these commands in Mac Terminal:

```sh
cd /Users/yeejingye/workspace/personal/stack-chan/firmware
source ~/.local/share/xs-dev-export.sh
source ~/.espressif/python_env/idf6.1_py3.14_env/bin/activate
npm run mod -- mods/jyos_hello/manifest.json --port /dev/cu.usbmodem101
```

The `source` commands load your SDK tools and Python environment. `npm run mod` builds, installs, verifies, and reboots the robot. You only need to load the environments once per fresh terminal session.

If the USB port changes, find it with `ls /dev/cu.*` and update `--port`.

## 3. Terminal command reference

### Start a development session

```sh
cd /Users/yeejingye/workspace/personal/stack-chan/firmware
source ~/.local/share/xs-dev-export.sh
source ~/.espressif/python_env/idf6.1_py3.14_env/bin/activate
```

Run the commands below from this directory. StackChan runs its installed MOD automatically when powered on or rebooted; there is no `npm start` command.

| Task | Command |
| --- | --- |
| Check SDK and tool versions | `npm run doctor` |
| List connected devices | `npm run scan` |
| List macOS serial ports | `ls /dev/cu.*` |
| Build host without flashing | `npm run build:m5stackchan_cores3` |
| Build and flash host firmware | `npm run deploy:m5stackchan_cores3 -- --port /dev/cu.usbmodem101` |
| Build your MOD without installing | `npm run mod:build -- mods/jyos_hello/manifest.json` |
| Install your MOD | `npm run mod -- mods/jyos_hello/manifest.json --port /dev/cu.usbmodem101` |
| Check your MOD's code and formatting | `npm exec -- biome check mods/jyos_hello` |
| Format your MOD | `npm exec -- biome format --write mods/jyos_hello` |
| Run repository unit tests on your Mac | `npm run test:unit` |
| Remove generated build files | `npm run clean` |
| See local changes | `git status --short` |

Use **MOD installation** for everyday behavior changes. Host flashing writes the base firmware; it is only needed when you change the host or need to reinstall it. Unit tests check repository logic, not physical motor behavior.

### Test the motors and head LEDs

Install the repository's hardware smoke MOD:

```sh
npm run mod -- mods/examples/m5stackchan_smoke/manifest.json --port /dev/cu.usbmodem101
```

Watch for small head movements and red, blinking green, then rainbow LEDs. This replaces your greeting MOD. Restore it afterward:

```sh
npm run mod -- mods/jyos_hello/manifest.json --port /dev/cu.usbmodem101
```

### Debugging with traces

```sh
npm run debug:m5stackchan_cores3 -- --port /dev/cu.usbmodem101
```

This builds and flashes a debug host for use with `xsbug`. `trace()` messages use the debugger protocol. Debug mode reserves USB Serial/JTAG for debugging, so use the release `deploy` command again before experimenting with JYOS USB communication.

Useful terminal basics: `pwd` shows your directory, `ls` lists files, `cd ..` goes up one directory, and `cat mods/jyos_hello/mod.js` prints your code. `Ctrl+C` stops a running command; let flash writes finish before stopping them.

## 4. Change the face and greeting

Your MOD already imports `Emotion` and creates a speech balloon.

```js
robot.face.setEmotion(Emotion.HAPPY)
showStatus('Hello JYOS!')
```

Other expressions include `Emotion.SAD`, `Emotion.ANGRY`, and `Emotion.SLEEPY`. `showStatus` is a helper defined in your MOD, not a built-in API. The balloon displays text; it does not speak.

## 5. Move the head

Inside an async function, enable the motors and command a pose:

```js
await robot.motion.setTorque(true)
await robot.motion.setPose({ rotation: { y: 0.15, p: 0, r: 0 } }, 1)
await delay(4000)
await robot.motion.setTorque(false)
```

- `y`: yaw, turning left/right.
- `p`: pitch, looking up/down.
- `r`: roll; leave it at zero for this robot.
- Angles are **radians**: `0.15` ≈ 9°, `0.25` ≈ 14°.
- The final `1` requests a one-second movement. Allow time for physical movement before the next command; the API's completion is not a guarantee the head has arrived.
- `delay` is your MOD's helper; its argument is milliseconds.

Your sequence `[0.15, -0.15, 0]` turns both ways, then returns forward. For a slightly larger demonstration, try `[0.25, -0.25, 0]`. Keep changes small and leave space around the head. Retain the `finally` block that releases torque after errors.

`lookAt([x, y, z])` targets a point, but moves the head only beyond a 30° gaze threshold. Use `setPose()` for small deliberate motions.

## 6. Timing and controls

```js
Timer.set(() => showStatus('Ready!'), 2000) // once, after 2 seconds
Timer.repeat(() => showStatus('Hello!'), 5000) // every 5 seconds
```

This target disables virtual A/B/C buttons. Examples that assume `robot.input.button.a` exists need adapting before use.

## 7. Three first experiments

1. Change the greeting and expression.
2. Change the yaw sequence to `[0.25, -0.25, 0]`.
3. Change the startup delay from `4000` to `6000`.

Upload after each change so you can connect the code to what the robot does.

For more: [MOD overview](../README.md), [face example](../examples/face/mod.js), and [hardware smoke example](../examples/m5stackchan_smoke/mod.js).
