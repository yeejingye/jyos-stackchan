# JYOS StackChan knowledge base

Repository documentation, design decisions, and development evidence. Start here before planning or changing a feature.

| Document | Purpose |
| --- | --- |
| [Repository context](repository.md) | Hardware, tools, Git workflow, and boundaries |
| [Architecture](architecture.md) | Current system and proposed JYOS integration |
| [Development log](development-log.md) | Important repository-wide milestones |
| [Feature index](feat/README.md) | Feature status and links to designs |
| [Developer guide](../firmware/mods/jyos_hello/README.md) | Terminal commands and MOD programming |
| [System model](../firmware/mods/jyos_hello/SYSTEM_MODEL.md) | CONSENS-inspired views and Mermaid diagrams |

## Maintenance

- Create `feat/<feature-name>/` from `_template` when planning a feature.
- Update its status, design, decisions, and evidence in the same PR as related code.
- Record significant milestones, blockers, and scope changes; omit routine command transcripts.
- Keep planned behavior separate from implemented and observed behavior.
- Record commit IDs, branch names, and PR links when they exist. Never invent verification or mark a feature pushed/merged without confirming it.
- Store credentials and private research content elsewhere; link to local specifications when needed.

Feature documentation becomes the current design; `progress.md` preserves the important history. Repository-wide guidance remains in [AGENTS.md](../AGENTS.md).
