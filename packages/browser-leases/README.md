# @codex-chatgpt-web-control/browser-leases

Pure TypeScript contracts and a deterministic in-memory lease manager for the
shared Electron browser host. It intentionally has no Electron, Playwright,
ChatGPT, filesystem, or network dependency.

```ts
const manager = new SurfaceLeaseManager({
  maxActive: 5,
  isProcessAlive: pid => processRunning(pid)
});

const lease = manager.allocate({
  kind: "model-turn",
  owner: { pid: 1234, instanceId: "helper_01HXYZABCD" },
  traceId: "trace_abc"
});

manager.transition(lease.leaseId, lease.owner, "navigating");
manager.heartbeat(lease.leaseId, lease.owner);
manager.release(lease.leaseId, lease.owner, "close", "completed");
```
