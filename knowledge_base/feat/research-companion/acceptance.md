# Acceptance record

Updated 2026-10-04. Device: Kickstarter complete CoreS3, opt-in local-completion host and production research MOD. The stacked PRs merged into jyos-stackchan; this record separates human observations from device diagnostics.

| Check | Evidence |
| --- | --- |
| Firmware helper regression suite | 405 Node unit tests passed |
| Companion behavior suite | 36 tests passed: validation, ordering, replay gates, registry ownership, hooks, outages and persistence |
| GitHub CI | Earlier checkpoint ad6bed26 passed; both validation runs also passed on integrated PR #2 head 3639b76c before merging |
| Native face smoke | Known face detected; blank/invalid inputs and detector lifecycle checked |
| Controlled real face | Upright face about 60 cm away detected in normal and mirrored views |
| Off-center alignment | x≈0.65 moved through bounded yaw corrections to x≈0.52; audio finished and card cleared |
| Real dedicated Claude launcher | Public-source note saved and validated; robot reported face-found, motion-start, speech-finished and cleared |
| No-face/offline helper fallback | Earlier local completion tests reached audio completion and clearing with Mac vision/audio helper unreachable |
| Modular timer flow | Live active/ready timer, service restart preserved serviceId/revision/task; exact completion retry reported duplicate; robot reported cleared |
| Human observations | User confirmed turning toward them, speech once, neutral return, translucent-card clearing and reboot to normal face without repeated speech |
| Digital-twin presentation | Compact 272×46 translucent phase strip with short labels and markers; phase-specific thoughtful, attentive/blinking, inquisitive and focused eye poses, followed by the happy completion face. Latest MOD flashed and digest verified; the final synthetic sequence reported cleared. This does not independently confirm each expression or positive face alignment. The owner subsequently authorised merging. |
| Real interactive hooks | Exact research-agent delegation saved a new valid note; hook reached ready; robot reported face-found, motion-start, speech-finished and cleared. Invalid metadata/missing output runs reached failed, without success speech. |
| Robot reboot replay | USB_UART_CHIP_RESET → SPI_FAST_FLASH_BOOT → network connected; no face search/speech replay. User confirmed normal face and no repeated announcement. |
| Integration checks | 79 architecture checks and manifest preflight for six standard targets passed; companion Biome checks passed. |

## Review and merge

Requirement IDs are defined in the [canonical specification](feature.md). The mapping below connects them to the evidence above; it does not claim additional test runs.

| Requirement | Supporting evidence | Coverage limit |
| --- | --- | --- |
| RC01 Trigger scope | Dedicated launcher and exact delegated research-agent hooks; unrelated work excluded by adapter tests | Public-source research profile only |
| RC02 Progress | Real source/write activity drove live research stages | Tool success does not prove complete source reading |
| RC03 Ready gate | Valid new notes reached ready; invalid metadata and missing outputs reached failed | Structural/provenance checks do not prove factual correctness |
| RC04 Attention | Native smoke, controlled face and off-centre alignment; human direction confirmation | Tested desk geometry, not general tracking accuracy |
| RC05 Announcement | Speech-finished diagnostics, human cue-once observation and reboot replay checks | Bounded at-most-once attempts can skip interrupted cues |
| RC06 Cleanup | Cleared diagnostics; human neutral-return/card-expiry observations | Final visual run confirmed cleanup reporting, not every expression |
| RC07 Recovery | Service restart, failure paths, no-face/helper fallback and local expiry records | No claim of exhaustive outage or hardware-failure coverage |
| RC08 Ownership | Flow ownership/deduplication tests and modular timer retry | Timer scheduling remains outside the demonstration |

Agreed engineering and physical acceptance checks are complete. PR #3 merged into codex/research-status as 3639b76c on 2026-10-04; PR #2 then merged into jyos-stackchan as de40965e after both integrated validation runs passed. Issue #1 is closed. The local checkout was fast-forwarded to the merged baseline. These publication facts supersede pending-merge entries in the historical progress record.

Latest live note paths are private machine artifacts, not committed research content. Tests confirm metadata/lifecycle behavior, not factual research verification.

## Deliberate limits

Trusted-LAN HTTP; awake reachable Mac for research/status; fixed local sentence; location detection without identity; tested desk geometry rather than general face accuracy. Service capacity is 128 task IDs; robot replay history is 16 IDs. Interrupted or offline completion can be skipped rather than replayed. Metadata checks do not establish factual correctness. The optional host avoids changing normal firmware defaults.
