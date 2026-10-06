# Build, deploy and verify

Follow [AGENTS.md](../../../AGENTS.md). Run npm commands from `firmware/`. Use the release lockfile with `npm ci`; avoid an opportunistic `npm audit fix` that changes a pinned SDK dependency graph while diagnosing hardware.

## Environment

The development machine is Apple Silicon macOS with fnm-managed Node 22, Moddable SDK and ESP-IDF. SDK export and the ESP-IDF Python environment must be active; missing `MODDABLE` or `pyserial` are environment issues. FreeType must be available for font generation (`brew install freetype` resolved the previously missing dylib). Exact IDF/Python directory names are machine-specific.

```sh
cd firmware
npm ci
source ~/.local/share/xs-dev-export.sh
# Current machine's ESP-IDF Python environment:
export PATH="$HOME/.espressif/python_env/idf6.1_py3.14_env/bin:$PATH"
npm run doctor
```

On a fresh setup, use `npm run setup` and `npm run setup -- --device=esp32` before building. Confirm connected hardware and port using `npm run scan`; do not assume a remembered port remains valid.

## Joy host and combined MOD

```sh
npm run voice:prepare
npm run build:joy-voice
npm run flash:joy-voice -- --port /dev/cu.usbmodem101
npm run mod -- mods/research_companion/manifest.local.json --port /dev/cu.usbmodem101
```

Prepare the ignored manifest from `mods/research_companion/manifest.example.json` if needed; configure only private machine/service settings and `config.time.timezone: "berlin"`. The example includes `manifest.json`, which supplies the combined components. Use the tracked `manifest.json` if no research connection is configured. Timer and desk controls remain available.

Change a MOD controller/UI adapter with `npm run mod` for fast iteration. Shared host UI, input recognition, native C, platform configuration or embedded resources require a host rebuild/flash too. The wrapper builds before deployment and independently verifies host images; wait for those verification results and the MOD digest before saying it is installed. A verified flash does not prove all runtime behaviors.

## Output and target rules

Use repository npm wrappers; do not invoke `mcconfig`, `mcrun` or `mcpack` directly. Do not add `-o`, `--target` or `npm_config_target`. Named target scripts select matching platform/application manifests. Generated programs go in `firmware/dist/bin`, intermediates in `firmware/dist/tmp`; never edit or commit them. The host name is `stack-chan-host`. `npm run clean` removes generated `dist` files; rebuild required assets afterwards. Installing a MOD writes the live device's XS partition and reboots it. Avoid erase-flash as routine troubleshooting because it destroys stored state.

## Meaningful verification

```sh
npm run test:unit
npm run test:desk
npm run test:pomodoro
npm run test:research
npm run test:drawer:build
npm run lint
npm run format
```

The drawer build command compiles its test application; execute that application in the native simulator to confirm its assertions and rendering. Prefer XS tests for Piu, Timer, drivers and platform behavior; Node tests for pure state/helper behavior. Verify observable results, ordering, relational invariants, cancellation and failure paths. Do not read source merely to assert constant strings or mirror implementation literals. A legitimate literal change should not fail a test unless behavior or a maintained contract changes.

Follow passing targeted tests with build/flash checks appropriate to the changed layer, then physical observation when hardware behavior matters. Preserve evidence: commit/profile, digest results, actual target, telemetry and human observations. Keep pending acceptance explicit. Git hooks check staged source formatting; they do not replace device tests. `main` has no Actions workflows, so every claim of testing must refer to a manual recorded run.
