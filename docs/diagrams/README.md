# Rendered architecture assets

These SVGs complement the editable Mermaid source in
[`docs/architecture-diagrams.md`](../architecture-diagrams.md). They are
versioned with the project so GitHub, Notion, release notes, and design reviews
can reuse the same visual artifacts.

| Diagram | Rendered asset | Editable source |
| --- | --- | --- |
| Shared runtime architecture | [runtime-architecture.svg](runtime-architecture.svg) | Runtime architecture section |
| Exclusive surface lease lifecycle | [surface-lease-lifecycle.svg](surface-lease-lifecycle.svg) | Lease lifecycle section |
| Shared browser/account scheduler | [shared-scheduler.svg](shared-scheduler.svg) | Scheduler section |
| Linear milestone dependency path | [delivery-dependency-path.svg](delivery-dependency-path.svg) | Delivery graph section |

## Maintenance contract

- Keep the Mermaid source authoritative for topology and issue relationships.
- Update rendered assets in the same pull request as an architectural change.
- Do not encode credentials, prompts, response content, or browser-session
  identifiers in diagrams.
- Keep `agent-system` outside these visuals until its redesign and a separate
  integration decision are complete.
