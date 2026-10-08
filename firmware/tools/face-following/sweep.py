#!/usr/bin/env python3
"""Flash once, collect an eight-stage live sweep, and rank measured tracking tradeoffs."""
import argparse
import datetime
import json
import math
from pathlib import Path
import statistics
import subprocess
import time

FIRMWARE = Path(__file__).resolve().parents[2]


def mean(values):
    return statistics.fmean(values) if values else None


def phase(elapsed_ms):
    local = (elapsed_ms % 20000) / 1000
    return 'hold' if local < 5 or local >= 15 else 'move'


def summarize(events):
    stages = {e['stage']: e for e in events if e.get('event') == 'stage'}
    complete = any(e.get('event') == 'end' and e.get('completed') for e in events)
    groups = {}
    for index, stage in stages.items():
        groups.setdefault(stage['profile']['name'], []).append(index)
    results = []
    for name, indexes in groups.items():
        samples = [e for e in events if e.get('event') == 'sample' and e['stage'] in indexes]
        # Exclude transition settling from scoring, but retain it in raw telemetry.
        samples = [s for s in samples if 2 <= s['elapsedMs'] % 20000 / 1000 < 5
                   or 6 <= s['elapsedMs'] % 20000 / 1000 < 15
                   or 17 <= s['elapsedMs'] % 20000 / 1000 < 20]
        visible = [s for s in samples if s.get('face') and s['face']['confidence'] >= .5]
        moving = [s for s in visible if phase(s['elapsedMs']) == 'move']
        holding = [s for s in visible if phase(s['elapsedMs']) == 'hold']
        error = mean([math.hypot(s['face']['x'] - .5, s['face']['y'] - .5) for s in moving])
        speeds, gaps = [], []
        for index in indexes:
            commands = [s for s in samples if s['stage'] == index and s['commanded']]
            for a, b in zip(commands, commands[1:]):
                dt = (b['elapsedMs'] - a['elapsedMs']) / 1000
                if dt <= 0 or phase(a['elapsedMs']) != phase(b['elapsedMs']):
                    continue
                if phase(b['elapsedMs']) == 'hold':
                    speeds.append(math.hypot(b['rotation']['y'] - a['rotation']['y'],
                                             b['rotation']['p'] - a['rotation']['p']) / dt)
                elif dt < 1:
                    gaps.append(max(0, dt - a['duration']) / dt)
        # Zero corrections during a visible still phase are desirable; missing faces are not.
        hold_speed = mean(speeds) if speeds else (0 if holding else None)
        retries = sum(e.get('event') == 'retry' and e.get('stage') in indexes for e in events)
        errors = sum(e.get('event') == 'error' and e.get('stage') in indexes for e in events)
        coverage = len(visible) / max(1, len(samples))
        move_samples = [s for s in samples if phase(s['elapsedMs']) == 'move']
        move_coverage = len(moving) / max(1, len(move_samples))
        eligible = (complete and len(indexes) == 2 and len(samples) >= 40 and len(moving) >= 10
                    and len(holding) >= 8 and coverage >= .5 and move_coverage >= .5 and errors == 0)
        gap = mean(gaps) or 0
        score = (0.6 * error / .15 + .2 * hold_speed / .1 + .1 * gap
                 + .1 * (retries / max(1, len(samples))) / .05) if eligible else None
        results.append(dict(name=name, parameters=stages[indexes[0]]['profile'], score=score,
                            eligible=eligible, samples=len(samples), faceCoverage=coverage,
                            movingFaceCoverage=move_coverage, movingCenterError=error,
                            holdCommandSpeedRadiansPerSecond=hold_speed, movementGapFraction=gap,
                            retries=retries, errors=errors,
                            meanInferenceMs=mean([s['inferenceMs'] for s in samples]),
                            meanCommandMs=mean([s['commandMs'] for s in samples if s['commanded']])))
    eligible = sorted((r for r in results if r['eligible']), key=lambda r: r['score'])
    # Every candidate must have comparable visibility. Do not select a default from an unfair run.
    fair = (len(eligible) == 4 and max(r['movingFaceCoverage'] for r in eligible)
            - min(r['movingFaceCoverage'] for r in eligible) <= .2)
    winner = eligible[0] if fair else None
    baseline = next((r for r in eligible if r['name'] == 'baseline'), None)
    reason = 'Insufficient or unequal visibility; repeat the sweep before changing defaults.'
    if winner:
        reason = 'Lowest weighted score across repeated live stages; physical smoothness still needs observation.'
        if baseline and winner['score'] >= baseline['score'] * .9:
            winner = baseline
            reason = 'Improvement was below 10%; retain the baseline rather than overfit this run.'
    return dict(completed=complete, recommendedProfile=winner['name'] if winner else None,
                reason=reason, results=results,
                limitations='Image-space error and commanded movement are proxies. No encoder or acceleration measurements; human motion and framing can confound results.')


def write_report(events, output):
    report = summarize(events)
    output.mkdir(parents=True, exist_ok=True)
    (output / 'report.json').write_text(json.dumps(report, indent=2) + '\n')
    lines = ['# Face-following sweep', '', report['reason'], '',
             '| Profile | Score ↓ | Face seen | Moving center error ↓ | Hold command speed ↓ | Retries |',
             '|---|---:|---:|---:|---:|---:|']
    for r in report['results']:
        fmt = lambda value: f'{value:.3f}' if value is not None else 'insufficient data'
        lines.append(f"| {r['name']} | {fmt(r['score'])} | {r['faceCoverage']:.0%} | {fmt(r['movingCenterError'])} | {fmt(r['holdCommandSpeedRadiansPerSecond'])} | {r['retries']} |")
    lines += ['', f"Recommended: **{report['recommendedProfile'] or 'repeat required'}**.", '',
              'Score weights: 60% moving centering error, 20% still-phase command speed, 10% movement gaps, 10% retry rate. Lower is better. Units and normalization are recorded in the script.', '', report['limitations']]
    (output / 'report.md').write_text('\n'.join(lines) + '\n')
    selected_manifest = output / 'manifest.selected.json'
    selected_manifest.unlink(missing_ok=True)
    if report['recommendedProfile']:
        winner = next(r for r in report['results'] if r['name'] == report['recommendedProfile'])
        parameters = {k: v for k, v in winner['parameters'].items() if k != 'name'}
        (output / 'manifest.selected.json').write_text(json.dumps({
            'include': [str(FIRMWARE / 'host/app/manifest_m5stackchan_cores3.json')],
            'config': {'faceFollowing': {'sweep': False, 'parameters': parameters}},
        }, indent=2) + '\n')
    print(json.dumps(report, indent=2), flush=True)
    print(f'Report: {output / "report.md"}', flush=True)
    return report


def collect(port, output, timeout):
    import serial  # Available in the ESP-IDF Python environment; analysis needs only stdlib.
    events = []
    output.mkdir(parents=True, exist_ok=True)
    print('READY: select Follow my Face. Each stage: HOLD 5s, MOVE left/right 10s, HOLD 5s. Stop cancels.', flush=True)
    with serial.Serial(port, 115200, timeout=.1) as device, (output / 'serial.log').open('w') as raw, (output / 'events.jsonl').open('w') as structured:
        deadline = time.monotonic() + timeout
        pending = ''
        stage_started = None
        last_phase = None
        try:
            while time.monotonic() < deadline:
                data = device.read(4096).decode('utf-8', errors='replace')
                raw.write(data)
                raw.flush()
                pending += data
                while '\n' in pending:
                    line, pending = pending.split('\n', 1)
                    if '[FaceSweep] ' not in line:
                        continue
                    try:
                        event = json.loads(line.split('[FaceSweep] ', 1)[1].strip())
                    except json.JSONDecodeError:
                        continue
                    event['hostTime'] = datetime.datetime.now(datetime.timezone.utc).isoformat()
                    events.append(event)
                    structured.write(json.dumps(event) + '\n')
                    structured.flush()
                    if event['event'] == 'stage':
                        stage_started = time.monotonic()
                        last_phase = 'hold'
                        print(f"Stage {event['stage'] + 1}/8: {event['profile']['name']} — HOLD still", flush=True)
                    if event['event'] == 'end':
                        return events
                if stage_started is not None:
                    elapsed = time.monotonic() - stage_started
                    current = 'move' if 5 <= elapsed < 15 else 'hold'
                    if current != last_phase:
                        print('MOVE slowly left/right' if current == 'move' else 'HOLD still', flush=True)
                        last_phase = current
        except KeyboardInterrupt:
            print('Recording interrupted. Press Stop on the robot to end motion.', flush=True)
    print('No completed sweep received. Press Stop if the robot is still in test mode.', flush=True)
    return events


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port', default='/dev/cu.usbmodem1101')
    parser.add_argument('--flash', action='store_true', help='Build/flash diagnostic firmware before recording')
    parser.add_argument('--analyze', type=Path, help='Re-analyze saved events.jsonl without hardware')
    parser.add_argument('--output', type=Path, default=FIRMWARE / 'dist/face-following-sweeps' / datetime.datetime.now().strftime('%Y%m%d-%H%M%S'))
    parser.add_argument('--timeout', type=float, default=300)
    args = parser.parse_args()
    if args.flash:
        args.output.mkdir(parents=True, exist_ok=True)
        with (args.output / 'flash.log').open('w') as log:
            subprocess.run(['npm', 'run', 'deploy', '--', '--port', args.port,
                            '--manifest', 'host/app/manifest_face_following_sweep.json'], cwd=FIRMWARE,
                           stdout=log, stderr=subprocess.STDOUT, check=True)
    events = ([json.loads(line) for line in args.analyze.read_text().splitlines() if line.strip()]
              if args.analyze else collect(args.port, args.output, args.timeout))
    report = write_report(events, args.output)
    return 0 if report['recommendedProfile'] else 2


if __name__ == '__main__':
    raise SystemExit(main())
