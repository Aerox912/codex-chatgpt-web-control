# codex-chatgpt-web-control bootstrap overlay

This repository contains the first standalone implementation slice for
`Aerox912/codex-chatgpt-web-control`.

## Upstream-history step

The repository now exists and the validated overlay can be published. The
remaining bootstrap task is to import `miuuyy/codex-chatgpt-web` at commit
`8ae34eb598b0973890ee743cde915be64b9297ca` while preserving its Git history.

Because the overlay uses new package and documentation paths, the histories can
be joined with an explicit unrelated-history merge if the repository was
initialized before importing upstream:

```bash
git remote add upstream-web https://github.com/miuuyy/codex-chatgpt-web.git
git fetch upstream-web 8ae34eb598b0973890ee743cde915be64b9297ca
git merge --allow-unrelated-histories --no-ff \
  8ae34eb598b0973890ee743cde915be64b9297ca
```

Resolve the root README and any package-manifest overlap intentionally; do not
squash or copy the upstream tree if preserving ancestry is still required.

## Validate the first package

```bash
npm --prefix packages/browser-leases test
npm --prefix packages/browser-leases run typecheck
npm --prefix packages/browser-leases run build
```

The package is browser-independent and does not require ChatGPT login.

## Current implemented scope

- Exact surface and owner contracts.
- Allowed transition table.
- Typed fail-closed errors.
- Immutable ownership markers.
- Host-owned lease allocation.
- Global hard capacity.
- Heartbeats and atomic metadata updates.
- Idempotent same-owner release.
- Dead-owner reclamation using a host-provided liveness check.
- Deterministic unit tests and package smoke validation.

## Explicitly deferred

- Wiring into Electron `BrowserHost`.
- Adapting `beginTurn`/`endTurn`.
- `codex-chatgpt-control` Playwright adapters.
- Durable Chat/Work registry.
- Scheduler and local service.
- Launcher UI and Codex plugin.
- Any `agent-system` integration.
