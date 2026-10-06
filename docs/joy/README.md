# Joy documentation

Updated 2026-10-06. This directory consolidates the current personal StackChan deployment and the lessons learned while programming it. Older `knowledge_base/` records retain their original dates and experimental branch names.

Start with the [HTML overview](../stackchan.html) or the [current status](status/current.md).

| Document | Purpose |
| --- | --- |
| [Current status](status/current.md) | Implemented features, deployed configuration, evidence and open acceptance |
| [Architecture and MODs](programming/architecture.md) | Host/component boundaries and composing behavior |
| [Runtime practices](programming/runtime.md) | Motion, cancellation, input, UI, clock and resource ownership |
| [Build and verification](programming/build-and-test.md) | Environment, commands, tests and verified flashing |
| [Operating Joy](operations/runbook.md) | Sidebar, service, diagnosis and recovery |

Maintain these summaries with behavior changes. Distinguish source implementation, successful build/flash, live telemetry and human observation. Test counts describe the last recorded run, not an automatic current CI guarantee. Do not include private manifests, tokens, Wi-Fi passwords, research notes or microphone recordings.

The HTML photograph is copied unchanged from [the repository's community case photo](../../case/docs/images/dynamixel_front.jpg). It depicts a community Dynamixel build, not the owner's CoreS3 Joy. Its original source is [case/docs/images/dynamixel_front.jpg](../../case/docs/images/dynamixel_front.jpg); repository licensing is recorded in [LICENSE](../../LICENSE).
