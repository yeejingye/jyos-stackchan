# Acceptance matrix

| Requirements | Observable check | Evidence |
| --- | --- | --- |
| PM-01, PM-08 | Wake followed by valid command starts once; unrelated speech does not start | Not run; recognition thresholds TBD |
| PM-02, PM-06 | Measure real 20-minute focus and 5-minute rest, including delayed UI updates | Not run |
| PM-03, PM-11 | Pause both phases; frozen countdown stays visible; resume continues the retained phase/time without restart | Not run |
| PM-12 | Completed rest clears countdown and restores normal mode; no further cycle starts | Not run |
| PM-04, PM-07 | Repeating Pomodoro during either phase or pause preserves phase/time/state; cancel removes countdown and repeating controls is safe | Not run |
| PM-05 | Owner reviews face visibility, countdown readability and phase/paused distinction on robot | Not run |
| PM-09 | Exercise competing research flow under agreed ownership policy | Logic implemented: Pomodoro has display priority; live check pending |
| PM-10 | Reboot during focus, rest and pause: normal mode, no restored countdown; exercise mute and recognition failure | Implemented: mute and manual fallback; live reboot/mute checks pending |
| PM-13 | Complete research during focus, rest and pause; no completion speech occurs before Pomodoro ends; normal completion or cancellation returns to normal mode before releasing waiting speech once under the agreed queue policy | Queue tests pass: latest admitted notice retained until session ends; no reboot replay. Live check pending |
| PM-14 | Focus/rest completion each plays its gentle chime once; refreshes and repeated commands do not replay cues | Not run; sound/volume to review |

Spec `9a5e6950` and timer `e88e0fa1` committed and pushed. Twelve Pomodoro behavior tests, 36 research tests, 407 broader unit tests, 79 architecture checks and six-target manifest preflight pass. Opt-in voice host and companion MOD built, uploaded and flash digests verified. Owner observed restarts with the first listener; voice-disabled recovery was confirmed stable. Worker-based listener validation, layout and full-duration acceptance are pending; compilation and flash verification do not establish product acceptance.

