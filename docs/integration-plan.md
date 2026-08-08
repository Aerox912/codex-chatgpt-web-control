# Implementation plan

## M0 — Bootstrap and baseline evidence

- Create the repository from the pinned Web upstream.
- Add upstream lock and licence notices.
- Capture model-only and control-only baseline evidence.

## M1 — Shared browser host

- Define pure lease contracts and state transitions.
- Implement capacity, liveness, ownership, heartbeat, release, and snapshots.
- Adapt existing model `beginTurn` and `endTurn` through a compatibility facade.
- Add model and placeholder mixed-surface isolation tests.

## M2 — Visible control runtime

- Adapt `BrowserLike`, `PageLike`, and `LocatorLike` to exact launcher pages.
- Create a new control SDK client per operation.
- Persist exact Chat/Work task identity atomically.
- Deliver Chat, Work, file, artifact, and restart workflows.

## M3 — Scheduler and local service

- Coordinate page and generation quotas.
- Track remote Work/Deep Research activity after page closure.
- Add account-wide cooldown and exclusive session operations.
- Expose a bearer-authenticated loopback API.
- Run control automation outside Electron's main process.

## M4 — Launcher and release

- Add Models, Control, Browser, Sessions, Activity, and Settings views.
- Bundle Codex plugin and Node/Python clients.
- Add an isolated-control fallback.
- Validate Windows, Linux, and macOS release packages.
