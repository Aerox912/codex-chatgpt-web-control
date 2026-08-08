export type SurfaceLeaseErrorCode =
  | "surface_capacity_exceeded"
  | "surface_lease_not_found"
  | "surface_ownership_mismatch"
  | "surface_transition_invalid"
  | "surface_validation_failed";

export class SurfaceLeaseError extends Error {
  readonly code: SurfaceLeaseErrorCode;
  readonly details: Readonly<Record<string, unknown>>;

  constructor(
    code: SurfaceLeaseErrorCode,
    message: string,
    details: Readonly<Record<string, unknown>> = {},
  ) {
    super(message);
    this.name = new.target.name;
    this.code = code;
    this.details = details;
  }
}

export class SurfaceCapacityError extends SurfaceLeaseError {
  constructor(maxActive: number) {
    super(
      "surface_capacity_exceeded",
      `Browser surface capacity is exhausted (${maxActive}/${maxActive}).`,
      { maxActive },
    );
  }
}

export class SurfaceLeaseNotFoundError extends SurfaceLeaseError {
  constructor(leaseId: string) {
    super(
      "surface_lease_not_found",
      `Browser surface lease was not found: ${leaseId}.`,
      { leaseId },
    );
  }
}

export class SurfaceOwnershipError extends SurfaceLeaseError {
  constructor(
    leaseId: string,
    expected: { readonly pid: number; readonly instanceId: string },
    actual: { readonly pid: number; readonly instanceId: string },
  ) {
    super(
      "surface_ownership_mismatch",
      `Browser surface lease ${leaseId} is owned by another worker.`,
      {
        leaseId,
        expectedPid: expected.pid,
        expectedInstanceId: expected.instanceId,
        actualPid: actual.pid,
        actualInstanceId: actual.instanceId,
      },
    );
  }
}

export class SurfaceTransitionError extends SurfaceLeaseError {
  constructor(leaseId: string, from: string, to: string) {
    super(
      "surface_transition_invalid",
      `Browser surface lease ${leaseId} cannot transition from ${from} to ${to}.`,
      { leaseId, from, to },
    );
  }
}

export class SurfaceValidationError extends SurfaceLeaseError {
  constructor(message: string, details: Readonly<Record<string, unknown>> = {}) {
    super("surface_validation_failed", message, details);
  }
}
