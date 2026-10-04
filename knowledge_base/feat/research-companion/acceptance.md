# Acceptance record

Updated 2026-10-04. Device: Kickstarter complete CoreS3, opt-in local-completion host and production research MOD. Review remains on the stacked PRs; this record does not claim merge or human confirmation from diagnostics alone.

| Check | Evidence |
| --- | --- |
| Firmware helper regression suite | 405 Node unit tests passed |
| Companion behavior suite | 36 tests passed: validation, ordering, replay gates, registry ownership, hooks, outages and persistence |
| GitHub CI | Push and PR runs passed for checkpoint ad6bed26 |
| Native face smoke | Known face detected; blank/invalid inputs and detector lifecycle checked |
| Controlled real face | Upright face about 60 cm away detected in normal and mirrored views |
| Off-center alignment | x≈0.65 moved through bounded yaw corrections to x≈0.52; audio finished and card cleared |
| Real dedicated Claude launcher | Public-source note saved and validated; robot reported face-found, motion-start, speech-finished and cleared |
| No-face/offline helper fallback | Earlier local completion tests reached audio completion and clearing with Mac vision/audio helper unreachable |
| Modular timer flow | Live active/ready timer, service restart preserved serviceId/revision/task; exact completion retry reported duplicate; robot reported cleared |
| Human observations | User confirmed turning toward them, speech once, neutral return, translucent-card clearing and reboot to normal face without repeated speech |
| Digital-twin presentation | Compact 272×46 translucent phase strip with short labels and markers; phase-specific thoughtful, attentive/blinking, inquisitive and focused eye poses, followed by the happy completion face. Latest MOD flashed and digest verified; awaiting user's visual impression before merge. |
| Real interactive hooks | Exact research-agent delegation saved a new valid note; hook reached ready; robot reported face-found, motion-start, speech-finished and cleared. Invalid metadata/missing output runs reached failed, without success speech. |
| Robot reboot replay | USB_UART_CHIP_RESET → SPI_FAST_FLASH_BOOT → network connected; no face search/speech replay. User confirmed normal face and no repeated announcement. |
| Integration checks | 79 architecture checks and manifest preflight for six standard targets passed; companion Biome checks passed. |

## Review and merge

Agreed engineering and physical acceptance checks are complete. PR #3 contains the local-completion host, adapters, recovery and final documentation; it is stacked on the baseline PR #2. Merge #3 into codex/research-status first, then #2 into jyos-stackchan. Both remain unmerged until that review/merge action. Do not merge #2 first: its baseline uses Mac-assisted completion.

Latest live note paths are private machine artifacts, not committed research content. Tests confirm metadata/lifecycle behavior, not factual research verification.

## Deliberate limits

Trusted-LAN HTTP; awake reachable Mac for research/status; fixed local sentence; location detection without identity; tested desk geometry rather than general face accuracy. Service capacity is 128 task IDs; robot replay history is 16 IDs. Interrupted or offline completion can be skipped rather than replayed. Metadata checks do not establish factual correctness. The optional host avoids changing normal firmware defaults.
