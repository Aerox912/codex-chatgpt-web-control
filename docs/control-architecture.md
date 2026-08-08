# Shared-browser control architecture

## Boundary

The combined repository remains standalone. It does not import or configure
`agent-system`.

## Runtime shape

```text
Codex Desktop / CLI
        |
        +-- native Responses route -----------------------------+
        |                                                       |
        |                                            native Codex upstream
        |
        +-- chatgpt-web/* route --> Web model adapter ---------+
        |                              |                        |
        |                              +--> leased Temporary Chat page
        |
        +-- visible control API --> control worker ------------+
                                       |
                                       +--> leased Chat or Work page

One Electron browser host
One authenticated persistent partition
One host-owned lease registry
Different page for every active operation
```

The existing Web bridge remains the primary code ancestor. It continues to own
model catalogue augmentation, native passthrough, Responses/SSE translation,
compaction, browser workers, and the launcher. `codex-chatgpt-control` is
consumed through its public Node contracts before considering vendored source.

## Persistence

- A Web-model page is transient. Codex owns the task history.
- A visible Chat or Work page is also normally transient. A durable registry
  owns the exact conversation/task URL and state.
- Browser renderer lifetime is never used as the persistence mechanism.

## Rollback seams

1. Lease manager can be disabled and the current model-only `turnTabs` path
   restored.
2. Visible control can be disabled while retaining Web models.
3. Control can use an isolated profile when shared account state interferes.
4. The control plugin can be removed without changing Codex model routing.
