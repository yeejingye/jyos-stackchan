# Live face-following parameter sweep

Run from `firmware/`, with the Moddable SDK environment and ESP-IDF Python environment active (`python` must provide `serial`):

```sh
python tools/face-following/sweep.py --flash --port /dev/cu.usbmodem1101
```

This builds and flashes the diagnostic manifest with the repository deployment wrapper, records USB serial output, and writes a comparison report in `firmware/dist/face-following-sweeps/<timestamp>/`. Select **Follow my Face** after the script prints READY. Keep the face at roughly 60 cm and follow the robot's balloon prompts for each 20-second stage:

1. Hold still for 5 seconds.
2. Move slowly left/right for 10 seconds, keeping the same distance and approximate speed.
3. Hold still for 5 seconds.

Four profiles run forward, then in reverse order, for 160 seconds total. Detection continues at full speed even when motor correction frequency is reduced. Stop cancels the sweep through the ordinary camera/model/torque cleanup. Completion also releases resources automatically. Reopening Follow my Face on this diagnostic firmware starts another sweep. Flash normal firmware after testing.

| Profile | Minimum correction interval | New-coordinate weight | Gain | Max step | Movement interval multiplier |
|---|---:|---:|---:|---:|---:|
| baseline | 0 ms | 0.70 | 0.45 | 5° | 1.10 |
| balanced | 200 ms | 0.50 | 0.40 | 3.44° | 1.30 |
| smooth | 300 ms | 0.40 | 0.30 | 2.86° | 1.50 |
| responsive | 150 ms | 0.65 | 0.50 | 4.01° | 1.15 |

Outputs:

- `flash.log`: build and deployment output (when `--flash` is used).
- `serial.log`: raw serial output.
- `events.jsonl`: per-frame detections, command positions/durations, inference/command timing, retries, stages, and completion, with host timestamps.
- `report.json` and `report.md`: metrics, eligibility, score, recommendation, and limitations.
- `manifest.selected.json`: generated only for a sufficiently complete, comparable run; builds normal firmware using the recommended parameters and disables the diagnostic sweep.

The score weights moving centering error (60%), still-phase commanded speed (20%), movement gaps (10%), and servo retry rate (10%). Transition settling is excluded. Every profile needs two stages, enough visible samples in both motion and still phases, no fatal errors, and comparable face visibility. A result under 10% better than baseline retains baseline. Insufficient or unequal visibility returns exit code 2 and requires another run; it does not pick a winner. These are image and command metrics, not measured head acceleration or encoder feedback. Human motion and framing can confound comparisons, and the weighting is a tuning preference rather than a universal optimum.

Re-analyze existing telemetry without hardware:

```sh
python3 tools/face-following/sweep.py --analyze dist/face-following-sweeps/RUN/events.jsonl --output dist/face-following-sweeps/RUN/reanalysis
```

Apply a supported recommendation, leaving sweep mode:

```sh
npm run deploy -- --port /dev/cu.usbmodem1101 --manifest /absolute/path/to/manifest.selected.json
```

Or restore the normal defaults with `npm run deploy -- --port /dev/cu.usbmodem1101`. Analysis tests use only the Python standard library:

```sh
python3 -m unittest discover -s tools/face-following -p 'test_*.py'
```

The current normal-firmware default is **smooth**, selected after the live eight-stage trial and the user's physical observation. The sweep's **baseline** intentionally preserves the settings from before that trial. The automatic comparison was inconclusive because visibility differed; the physical preference chose smooth while accepting its greater measured following lag. Re-running the sweep never changes defaults by itself.
