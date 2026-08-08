import { SurfaceOwnershipError, SurfaceValidationError } from "./errors.ts";
import type {
  BrowserSurfaceLease,
  LeaseOwner,
  SurfaceOwnershipMarker,
} from "./types.ts";

const INSTANCE_ID = /^[A-Za-z0-9_-]{8,160}$/;

export function validateLeaseOwner(owner: LeaseOwner): void {
  if (!Number.isSafeInteger(owner.pid) || owner.pid <= 0) {
    throw new SurfaceValidationError("Lease owner pid must be a positive safe integer.", {
      pid: owner.pid,
    });
  }
  if (!INSTANCE_ID.test(owner.instanceId)) {
    throw new SurfaceValidationError(
      "Lease owner instanceId must contain 8-160 URL-safe characters.",
      { instanceId: owner.instanceId },
    );
  }
}

export function sameLeaseOwner(left: LeaseOwner, right: LeaseOwner): boolean {
  return left.pid === right.pid && left.instanceId === right.instanceId;
}

export function assertLeaseOwner(lease: BrowserSurfaceLease, owner: LeaseOwner): void {
  validateLeaseOwner(owner);
  if (!sameLeaseOwner(lease.owner, owner)) {
    throw new SurfaceOwnershipError(lease.leaseId, lease.owner, owner);
  }
}

export function ownershipMarkerFor(lease: BrowserSurfaceLease): SurfaceOwnershipMarker {
  return {
    schemaVersion: 1,
    leaseId: lease.leaseId,
    surfaceId: lease.surfaceId,
    kind: lease.kind,
    ownerInstanceId: lease.owner.instanceId,
  };
}

export function assertOwnershipMarker(
  lease: BrowserSurfaceLease,
  marker: SurfaceOwnershipMarker,
): void {
  if (
    marker.schemaVersion !== 1
    || marker.leaseId !== lease.leaseId
    || marker.surfaceId !== lease.surfaceId
    || marker.kind !== lease.kind
    || marker.ownerInstanceId !== lease.owner.instanceId
  ) {
    throw new SurfaceOwnershipError(
      lease.leaseId,
      lease.owner,
      { pid: lease.owner.pid, instanceId: marker.ownerInstanceId },
    );
  }
}
