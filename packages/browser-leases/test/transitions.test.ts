import assert from "node:assert/strict";
import test from "node:test";

import {
  SURFACE_STATUSES,
  SURFACE_TRANSITIONS,
  canTransitionSurface,
  isTerminalSurfaceStatus,
  type SurfaceStatus,
} from "../src/index.ts";

test("transition table covers every declared status exactly once", () => {
  assert.deepEqual(Object.keys(SURFACE_TRANSITIONS).sort(), [...SURFACE_STATUSES].sort());
});

test("every transition target is a declared surface status", () => {
  const statuses = new Set<string>(SURFACE_STATUSES);
  for (const [from, targets] of Object.entries(SURFACE_TRANSITIONS)) {
    for (const to of targets) {
      assert.equal(statuses.has(to), true, `${from} -> ${to} must target a declared status`);
    }
  }
});

test("released is terminal and release requires the releasing state", () => {
  for (const status of SURFACE_STATUSES) {
    assert.equal(
      canTransitionSurface(status, "released"),
      status === "releasing",
      `${status} -> released`,
    );
  }
  assert.equal(isTerminalSurfaceStatus("released"), true);
  assert.equal(isTerminalSurfaceStatus("error"), false);
});

test("same-state transitions are intentionally rejected", () => {
  for (const status of SURFACE_STATUSES as readonly SurfaceStatus[]) {
    assert.equal(canTransitionSurface(status, status), false, status);
  }
});
