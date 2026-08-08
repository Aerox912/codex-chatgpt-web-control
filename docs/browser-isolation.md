# Browser isolation contract

## Shared resources

The browser process, persistent partition, cookies, and account quota are
shared. An individual page is never shared.

## Ownership proof

A controller must present the exact tuple:

- `leaseId`
- `surfaceId`
- `owner.pid`
- `owner.instanceId`

URL, title, selected tab, or ChatGPT host matching are insufficient.

Every page receives an immutable marker:

```ts
interface SurfaceOwnershipMarker {
  schemaVersion: 1;
  leaseId: string;
  surfaceId: string;
  kind: SurfaceKind;
  ownerInstanceId: string;
}
```

## Surface classes

- `model-turn`
- `control-chat`
- `control-work`
- `control-artifact`

`home` is a host-owned surface and cannot be allocated as a task lease.

## Capacity

The initial hard cap is five active task surfaces across all classes. The
future scheduler adds a lower soft cap for simultaneous server-side
generations and reserves capacity for model continuations.

## Release

Release is idempotent only for the same proven owner while its tombstone is
retained. A different owner receives a fail-closed ownership error. Releasing
one lease never closes another page or the shared browser context.
