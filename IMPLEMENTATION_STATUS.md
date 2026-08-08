# Implementation status — 2026-08-08

## Completed in this bootstrap slice

- Created the standalone GitHub repository and began publishing the validated
  bootstrap overlay.
- Pinned both upstream repositories and the control package version.
- Added standalone architecture, isolation, security, implementation, and
  upstream-sync documentation.
- Implemented `@codex-chatgpt-web-control/browser-leases`, a browser-independent
  TypeScript package containing:
  - leasable surface and lifecycle contracts;
  - complete owner-tuple validation;
  - immutable page ownership markers;
  - explicit transition validation;
  - global hard capacity;
  - atomic metadata updates and heartbeats;
  - same-owner idempotent release with bounded tombstones;
  - host-provided dead-owner reclamation;
  - runtime validation for non-leasable kinds, direct terminal transitions,
    release disposition, generated identifier uniqueness, URLs, and metadata.

## Validation performed

From `packages/browser-leases`:

```bash
npm test
npx tsc --noEmit -p tsconfig.json
npx tsc -p tsconfig.build.json
node --input-type=module <dist import smoke>
npm pack --dry-run --json
```

Result:

- 18/18 tests passed.
- Strict TypeScript typecheck passed.
- Declaration and JavaScript build passed.
- Built package import and allocate/transition/release smoke passed.
- npm package dry run passed.

The tests require no browser, ChatGPT login, network, Electron, or Playwright.

## Remaining bootstrap dependency

The destination repository now exists. Its current overlay history still needs
to be joined with the pinned `miuuyy/codex-chatgpt-web` history. Preserve both
histories with an explicit merge rather than copying or squashing the upstream
snapshot.

## Next implementation slice

After the upstream-history merge, wire the pure lease package into the existing
Electron browser host behind the current `beginTurn`/`endTurn` protocol while
preserving all model-only behavior.
