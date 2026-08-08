import assert from "node:assert/strict";
import test from "node:test";

import {
  SurfaceCapacityError,
  SurfaceLeaseManager,
  SurfaceLeaseNotFoundError,
  SurfaceOwnershipError,
  SurfaceTransitionError,
  SurfaceValidationError,
  assertOwnershipMarker,
  canTransitionSurface,
  ownershipMarkerFor,
  type LeaseIdFactory,
  type LeaseOwner,
} from "../src/index.ts";

function fixture(options: { maxActive?: number; alive?: Set<number>; tombstones?: number } = {}) {
  let time = Date.parse("2026-08-08T08:00:00.000Z");
  const counters = { lease: 0, surface: 0, tab: 0 };
  const ids: LeaseIdFactory = {
    leaseId: () => `lease_test_${String(++counters.lease).padStart(4, "0")}`,
    surfaceId: () => `surface_test_${String(++counters.surface).padStart(4, "0")}`,
    tabId: () => `tab_test_${String(++counters.tab).padStart(4, "0")}`,
  };
  const alive = options.alive ?? new Set<number>();
  const manager = new SurfaceLeaseManager({
    maxActive: options.maxActive ?? 5,
    releasedTombstoneLimit: options.tombstones ?? 100,
    ids,
    now: () => {
      const value = new Date(time);
      time += 1_000;
      return value;
    },
    isProcessAlive: pid => alive.has(pid),
  });
  return { manager, alive };
}

const ownerA: LeaseOwner = { pid: 1001, instanceId: "worker_alpha_01" };
const ownerB: LeaseOwner = { pid: 1002, instanceId: "worker_beta_02" };

test("allocates an immutable task lease with stable ownership identifiers", () => {
  const { manager } = fixture();
  const lease = manager.allocate({
    kind: "model-turn",
    owner: ownerA,
    traceId: "trace_alpha",
    initialUrl: "about:blank#initial",
  });

  assert.equal(lease.status, "allocating");
  assert.equal(manager.activeCount, 1);
  assert.equal(manager.availableCapacity, 4);
  assert.deepEqual(lease.owner, ownerA);
  assert.notEqual(lease.owner, ownerA);
  assert.match(lease.leaseId, /^lease_test_/);
  assert.match(lease.surfaceId, /^surface_test_/);
  assert.match(lease.tabId, /^tab_test_/);
});

test("enforces one global hard capacity across surface kinds", () => {
  const { manager } = fixture({ maxActive: 2 });
  manager.allocate({ kind: "model-turn", owner: ownerA });
  manager.allocate({ kind: "control-work", owner: ownerB });

  assert.throws(
    () => manager.allocate({
      kind: "control-chat",
      owner: { pid: 1003, instanceId: "worker_gamma_03" },
    }),
    (error: unknown) => error instanceof SurfaceCapacityError
      && error.code === "surface_capacity_exceeded",
  );
  assert.equal(manager.activeCount, 2);
});

test("rejects invalid owner identity and non-leasable runtime input", () => {
  const { manager } = fixture();
  assert.throws(
    () => manager.allocate({
      kind: "model-turn",
      owner: { pid: 0, instanceId: "worker_alpha_01" },
    }),
    SurfaceValidationError,
  );
  assert.throws(
    () => manager.allocate({
      kind: "home" as never,
      owner: ownerA,
    }),
    SurfaceValidationError,
  );
});

test("supports only explicit state-machine transitions", () => {
  const { manager } = fixture();
  const lease = manager.allocate({ kind: "model-turn", owner: ownerA });

  manager.transition(lease.leaseId, ownerA, "navigating");
  manager.transition(lease.leaseId, ownerA, "submitting");
  manager.transition(lease.leaseId, ownerA, "generating");
  const ready = manager.transition(lease.leaseId, ownerA, "ready", {
    url: "https://chatgpt.com/?temporary-chat=true",
    title: "ChatGPT",
  });

  assert.equal(ready.status, "ready");
  assert.equal(ready.title, "ChatGPT");
  assert.throws(
    () => manager.transition(lease.leaseId, ownerA, "allocating"),
    SurfaceTransitionError,
  );
  assert.equal(canTransitionSurface("ready", "submitting"), true);
  assert.equal(canTransitionSurface("released", "idle"), false);
});

test("requires the complete owner tuple for heartbeat, transition, update, and release", () => {
  const { manager } = fixture();
  const lease = manager.allocate({ kind: "control-chat", owner: ownerA });
  const wrongInstance = { pid: ownerA.pid, instanceId: ownerB.instanceId };

  for (const action of [
    () => manager.heartbeat(lease.leaseId, wrongInstance),
    () => manager.update(lease.leaseId, wrongInstance, { title: "wrong" }),
    () => manager.transition(lease.leaseId, wrongInstance, "idle"),
    () => manager.release(lease.leaseId, wrongInstance),
  ]) {
    assert.throws(action, SurfaceOwnershipError);
  }
  assert.equal(manager.activeCount, 1);
});

test("creates and verifies an immutable page ownership marker", () => {
  const { manager } = fixture();
  const lease = manager.allocate({ kind: "control-work", owner: ownerA });
  const marker = ownershipMarkerFor(lease);

  assert.doesNotThrow(() => assertOwnershipMarker(lease, marker));
  assert.throws(
    () => assertOwnershipMarker(lease, { ...marker, surfaceId: "surface_other_9999" }),
    SurfaceOwnershipError,
  );
  assert.throws(
    () => assertOwnershipMarker(lease, { ...marker, ownerInstanceId: ownerB.instanceId }),
    SurfaceOwnershipError,
  );
});

test("releases exactly one lease and is idempotent for the same proven owner", () => {
  const { manager } = fixture();
  const first = manager.allocate({ kind: "model-turn", owner: ownerA });
  const second = manager.allocate({ kind: "control-chat", owner: ownerB });
  manager.transition(first.leaseId, ownerA, "navigating");

  const released = manager.release(first.leaseId, ownerA, "close", "completed");
  assert.equal(released.status, "released");
  assert.equal(released.releaseDisposition, "close");
  assert.equal(released.terminalReason, "completed");
  assert.equal(manager.activeCount, 1);
  assert.equal(manager.get(second.leaseId).status, "allocating");

  const repeated = manager.release(first.leaseId, ownerA, "close", "ignored duplicate");
  assert.deepEqual(repeated, released);
  assert.throws(() => manager.release(first.leaseId, ownerB), SurfaceOwnershipError);
});

test("reclaims only dead owners using host-provided liveness evidence", () => {
  const { manager, alive } = fixture();
  alive.add(ownerA.pid);
  const live = manager.allocate({ kind: "model-turn", owner: ownerA });
  const dead = manager.allocate({ kind: "control-work", owner: ownerB });

  const reclaimed = manager.reclaimDeadOwners();
  assert.equal(reclaimed.length, 1);
  assert.equal(reclaimed[0]?.leaseId, dead.leaseId);
  assert.equal(reclaimed[0]?.terminalReason, "owner process is no longer running");
  assert.equal(manager.get(live.leaseId).owner.pid, ownerA.pid);
  assert.throws(() => manager.get(dead.leaseId), SurfaceLeaseNotFoundError);
});

test("requires a liveness callback before dead-owner reclamation", () => {
  const manager = new SurfaceLeaseManager({ maxActive: 1 });
  manager.allocate({ kind: "model-turn", owner: ownerA });
  assert.throws(() => manager.reclaimDeadOwners(), SurfaceValidationError);
});

test("returns copies so callers cannot mutate manager state", () => {
  const { manager } = fixture();
  const lease = manager.allocate({ kind: "model-turn", owner: ownerA });
  const exposed = manager.get(lease.leaseId) as {
    status: string;
    owner: { instanceId: string };
  };
  exposed.status = "released";
  exposed.owner.instanceId = ownerB.instanceId;

  const stored = manager.get(lease.leaseId);
  assert.equal(stored.status, "allocating");
  assert.equal(stored.owner.instanceId, ownerA.instanceId);
});

test("rejects direct released transitions and invalid release dispositions at runtime", () => {
  const { manager } = fixture();
  const lease = manager.allocate({ kind: "model-turn", owner: ownerA });
  manager.transition(lease.leaseId, ownerA, "navigating");

  assert.throws(
    () => manager.transition(lease.leaseId, ownerA, "released" as never),
    SurfaceValidationError,
  );
  assert.throws(
    () => manager.release(lease.leaseId, ownerA, "archive" as never),
    SurfaceValidationError,
  );
  assert.equal(manager.get(lease.leaseId).status, "navigating");
});

test("rejects duplicate generated identifiers before storing a lease", () => {
  const manager = new SurfaceLeaseManager({
    ids: {
      leaseId: () => "duplicate_id_0001",
      surfaceId: () => "duplicate_id_0001",
      tabId: () => "tab_unique_0001",
    },
  });

  assert.throws(
    () => manager.allocate({ kind: "control-chat", owner: ownerA }),
    SurfaceValidationError,
  );
  assert.equal(manager.activeCount, 0);
});

test("validates a complete metadata patch before mutating lease state", () => {
  const { manager } = fixture();
  const lease = manager.allocate({
    kind: "control-work",
    owner: ownerA,
    initialUrl: "about:blank#before",
    title: "Before",
  });

  assert.throws(
    () => manager.update(lease.leaseId, ownerA, {
      url: "https://chatgpt.com/c/valid",
      title: "",
    }),
    SurfaceValidationError,
  );
  const stored = manager.get(lease.leaseId);
  assert.equal(stored.url, "about:blank#before");
  assert.equal(stored.title, "Before");
});

test("bounds released tombstones while preserving same-owner idempotency within the window", () => {
  const { manager } = fixture({ tombstones: 1 });
  const first = manager.allocate({ kind: "model-turn", owner: ownerA });
  manager.release(first.leaseId, ownerA);
  const second = manager.allocate({ kind: "control-chat", owner: ownerB });
  manager.release(second.leaseId, ownerB);

  assert.throws(() => manager.getReleased(first.leaseId), SurfaceLeaseNotFoundError);
  assert.equal(manager.getReleased(second.leaseId).status, "released");
});
