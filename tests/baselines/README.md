# Baseline evidence

Store unchanged upstream evidence here before shared-browser integration.

Recommended layout:

```text
tests/baselines/
  web-model/windows-x64/2026-08-08.json
  visible-control/windows-x64/2026-08-08.json
```

Every evidence file must validate against `schema.json` and record exact
upstream revisions, platform/runtime versions, scenario status, and concise
evidence references. Prompt and response bodies are omitted by default.
