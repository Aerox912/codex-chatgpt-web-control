# Upstream synchronization

## Pinned sources

See `upstream-lock.json`.

## Initial history import

If this repository was initialized before the Web upstream history was
available, fetch the pinned revision and join both histories explicitly:

```bash
git remote add upstream-web https://github.com/miuuyy/codex-chatgpt-web.git
git fetch upstream-web 8ae34eb598b0973890ee743cde915be64b9297ca
git merge --allow-unrelated-histories --no-ff \
  8ae34eb598b0973890ee743cde915be64b9297ca
```

Resolve root README and package-manifest overlap deliberately. Do not replace
the upstream history with a copied source snapshot.

## Web upstream procedure

1. Record old and candidate SHAs.
2. Run the candidate's unchanged tests.
3. Review browser-host, descriptor, model catalogue, Responses bridge, and
   selector changes.
4. Integrate on an `upstream/web-YYYYMMDD` branch.
5. Resolve local browser-host patches in small commits.
6. Run model-only baselines.
7. Run mixed isolation tests.
8. Update the lock, notices, evidence, and rollback notes.

## Control dependency procedure

1. Keep the supported release pinned exactly.
2. Test the newest prerelease in a non-blocking compatibility job.
3. Compare public browser, runner, Work, artifact, and blocker contracts.
4. Upgrade only when the launcher adapter tests pass.
5. Never float `@next` in release builds.
