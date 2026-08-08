# Codex ChatGPT Web Control

Standalone shared-browser runtime combining:

- ChatGPT Web models in the native Codex task lifecycle; and
- visible ChatGPT Chat/Work workflows with threads, files, steering, response
  capture, and artifacts.

The central safety rule is **one browser process and login, but never one
working page**. Every active operation receives an exclusive host-owned page
lease. Model turns continue to use fresh Temporary Chats; visible Chat and Work
identity is stored independently of renderer lifetime.

This project intentionally has no dependency on `Aerox912/agent-system`.
Orchestration policy and agent-system integration are deferred until that
system is redesigned.

## Current status

The first implementation package, `@codex-chatgpt-web-control/browser-leases`,
is complete and validated locally:

- 18/18 tests pass;
- strict TypeScript passes;
- JavaScript and declaration build passes;
- built-package smoke and npm package dry run pass.

See:

- [Implementation status](IMPLEMENTATION_STATUS.md)
- [Shared-browser control architecture](docs/control-architecture.md)
- [Editable architecture diagrams](docs/architecture-diagrams.md)
- [Linear project](https://linear.app/aerox912/project/codex-chatgpt-web-control-0c9cc0e4a337)

The diagram set covers the runtime topology, surface-lease lifecycle,
concurrent Web/control execution, shared scheduler, durable Chat/Work identity,
and the Linear delivery dependency graph.

## Upstreams

- `miuuyy/codex-chatgpt-web` pinned at
  `8ae34eb598b0973890ee743cde915be64b9297ca`.
- `adamallcock/codex-chatgpt-control` pinned at
  `73c5737f222709e324a1c7ba1637cef9966000ce` / package `0.5.1-alpha.1`.

The intended next repository step is to import the Web upstream history, then
wire the pure lease manager into the existing Electron `BrowserHost` behind
its current `beginTurn`/`endTurn` protocol.
