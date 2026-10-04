# Feature acceptance

No implementation or hardware checks have run.

| Requirements | Proposed observable check | Result |
| --- | --- | --- |
| HJ-01, HJ-02 | Repeated spoken activations at agreed distances; measure detections and acknowledgement delay | Not run; thresholds TBD |
| HJ-03 | No follow-up returns to standby within agreed interval | Not run |
| HJ-04, HJ-07 | Mute stops feature capture; standby sends/saves no audio; verify boot policy | Not run |
| HJ-05 | Playback and similar phrases do not cause activation loops; count false activations | Not run; thresholds TBD |
| HJ-06, HJ-08 | Activation coexists with research lifecycle and hands off once to an independent consumer | Not run |
| HJ-09 | Inject detector/audio failures and observe defined recovery | Not run |

Specification acceptance requires owner review of scope, open decisions and measurable targets. That is separate from later product acceptance.

No commits, pushes or PRs for this feature yet.

## Final conversation adapter checks — proposed

VC-01–VC-06 require configuration validation, capability negotiation, cancellation, independent speech-provider selection, and explicit failure when a local provider is unavailable. Each named provider needs revision/model-specific validation; shared HTTP syntax alone is insufficient. No integration checks have run.
