import { SurfaceTransitionError } from "./errors.ts";
import type { SurfaceStatus } from "./types.ts";

export const SURFACE_TRANSITIONS: Readonly<Record<SurfaceStatus, readonly SurfaceStatus[]>> = {
  allocating: ["idle", "navigating", "blocked", "error", "releasing"],
  idle: ["navigating", "submitting", "ready", "blocked", "error", "releasing"],
  navigating: ["idle", "submitting", "generating", "ready", "blocked", "error", "releasing"],
  submitting: ["generating", "ready", "blocked", "error", "releasing"],
  generating: ["ready", "blocked", "error", "releasing"],
  ready: ["idle", "navigating", "submitting", "generating", "blocked", "error", "releasing"],
  blocked: ["idle", "navigating", "submitting", "ready", "error", "releasing"],
  error: ["releasing"],
  releasing: ["released"],
  released: [],
};

export function canTransitionSurface(from: SurfaceStatus, to: SurfaceStatus): boolean {
  return SURFACE_TRANSITIONS[from].includes(to);
}

export function assertSurfaceTransition(
  leaseId: string,
  from: SurfaceStatus,
  to: SurfaceStatus,
): void {
  if (!canTransitionSurface(from, to)) {
    throw new SurfaceTransitionError(leaseId, from, to);
  }
}

export function isTerminalSurfaceStatus(status: SurfaceStatus): boolean {
  return status === "released";
}
