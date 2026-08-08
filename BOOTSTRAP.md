# codex-chatgpt-web-control bootstrap overlay

This repository contains the first standalone implementation slice for combining
`miuuyy/codex-chatgpt-web` with `adamallcock/codex-chatgpt-control`.

## Upstream base

The intended primary ancestor is `miuuyy/codex-chatgpt-web` at commit
`8ae34eb598b0973890ee743cde915be64b9297ca`. Import that history before wiring
the overlay into the existing launcher. The overlay uses new paths so the
upstream history can be merged without moving its source tree.

## Current implemented scope

- Exact browser-surface and worker-owner contracts.
- Explicit lifecycle transition table.
- Typed fail-closed errors.
- Immutable page ownership markers.
- Host-owned lease allocation and global hard capacity.
- Heartbeats and validated metadata updates.
- Idempotent same-owner release with bounded tombstones.
- Dead-owner reclamation using a host-provided liveness check.
- Deterministic unit tests, strict typecheck, build and package smoke evidence.

## Validation

```bash
npm --prefix packages/browser-leases test
npm --prefix packages/browser-leases run typecheck
npm --prefix packages/browser-leases run build
```

The package is browser-independent and does not require ChatGPT login.

## Deferred

- Electron `BrowserHost` wiring.
- Existing `beginTurn`/`endTurn` adaptation.
- `codex-chatgpt-control` Playwright adapters.
- Durable Chat/Work registry.
- Shared scheduler and local service.
- Launcher UI and Codex plugin.
- Any `agent-system` integration.
