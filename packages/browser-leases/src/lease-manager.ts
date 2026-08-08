import {
  SurfaceCapacityError,
  SurfaceLeaseNotFoundError,
  SurfaceTransitionError,
  SurfaceValidationError,
} from "./errors.ts";
import { assertLeaseOwner, validateLeaseOwner } from "./ownership.ts";
import { assertSurfaceTransition } from "./transitions.ts";
import {
  LEASABLE_SURFACE_KINDS,
  RELEASE_DISPOSITIONS,
  SURFACE_STATUSES,
} from "./types.ts";
import type {
  BrowserSurfaceLease,
  LeaseIdFactory,
  LeaseOwner,
  ReleaseDisposition,
  SurfaceLeaseFilter,
  SurfaceLeaseManagerOptions,
  SurfaceLeasePatch,
  SurfaceLeaseRequest,
  SurfaceLeaseSnapshot,
  SurfaceStatus,
} from "./types.ts";

interface InternalLease {
  schemaVersion: 1;
  leaseId: string;
  surfaceId: string;
  tabId: string;
  kind: BrowserSurfaceLease["kind"];
  owner: LeaseOwner;
  traceId?: string;
  persistentKey?: string;
  status: SurfaceStatus;
  createdAt: string;
  updatedAt: string;
  lastHeartbeatAt: string;
  url: string;
  title?: string;
  releaseDisposition?: ReleaseDisposition;
  terminalReason?: string;
}

const DEFAULT_MAX_ACTIVE = 5;
const DEFAULT_TOMBSTONE_LIMIT = 100;
const SAFE_ID = /^[A-Za-z0-9_-]{8,200}$/;

function defaultIds(): LeaseIdFactory {
  const create = (prefix: string) => `${prefix}_${globalThis.crypto.randomUUID().replaceAll("-", "")}`;
  return {
    leaseId: () => create("lease"),
    surfaceId: () => create("surface"),
    tabId: () => create("tab"),
  };
}

function cloneLease(lease: InternalLease | BrowserSurfaceLease): BrowserSurfaceLease {
  return {
    ...lease,
    owner: { ...lease.owner },
  };
}

function toSnapshot(lease: InternalLease | BrowserSurfaceLease): SurfaceLeaseSnapshot {
  return {
    leaseId: lease.leaseId,
    surfaceId: lease.surfaceId,
    tabId: lease.tabId,
    kind: lease.kind,
    ownerPid: lease.owner.pid,
    ownerInstanceId: lease.owner.instanceId,
    ...(lease.traceId === undefined ? {} : { traceId: lease.traceId }),
    ...(lease.persistentKey === undefined ? {} : { persistentKey: lease.persistentKey }),
    status: lease.status,
    createdAt: lease.createdAt,
    updatedAt: lease.updatedAt,
    lastHeartbeatAt: lease.lastHeartbeatAt,
    url: lease.url,
    ...(lease.title === undefined ? {} : { title: lease.title }),
    ...(lease.releaseDisposition === undefined
      ? {}
      : { releaseDisposition: lease.releaseDisposition }),
    ...(lease.terminalReason === undefined ? {} : { terminalReason: lease.terminalReason }),
  };
}

function matchesFilter(lease: InternalLease | BrowserSurfaceLease, filter: SurfaceLeaseFilter): boolean {
  return (filter.kind === undefined || lease.kind === filter.kind)
    && (filter.ownerInstanceId === undefined || lease.owner.instanceId === filter.ownerInstanceId)
    && (filter.status === undefined || lease.status === filter.status)
    && (filter.traceId === undefined || lease.traceId === filter.traceId)
    && (filter.persistentKey === undefined || lease.persistentKey === filter.persistentKey);
}

export class SurfaceLeaseManager {
  readonly maxActive: number;

  private readonly releasedTombstoneLimit: number;
  private readonly now: () => Date;
  private readonly ids: LeaseIdFactory;
  private readonly isProcessAlive: ((pid: number) => boolean) | undefined;
  private readonly active = new Map<string, InternalLease>();
  private readonly released = new Map<string, InternalLease>();
  private readonly releasedOrder: string[] = [];

  constructor(options: SurfaceLeaseManagerOptions = {}) {
    this.maxActive = options.maxActive ?? DEFAULT_MAX_ACTIVE;
    this.releasedTombstoneLimit = options.releasedTombstoneLimit ?? DEFAULT_TOMBSTONE_LIMIT;
    this.now = options.now ?? (() => new Date());
    this.ids = options.ids ?? defaultIds();
    this.isProcessAlive = options.isProcessAlive;

    if (!Number.isSafeInteger(this.maxActive) || this.maxActive < 1) {
      throw new SurfaceValidationError("maxActive must be a positive safe integer.", {
        maxActive: this.maxActive,
      });
    }
    if (!Number.isSafeInteger(this.releasedTombstoneLimit) || this.releasedTombstoneLimit < 0) {
      throw new SurfaceValidationError(
        "releasedTombstoneLimit must be a non-negative safe integer.",
        { releasedTombstoneLimit: this.releasedTombstoneLimit },
      );
    }
  }

  get activeCount(): number {
    return this.active.size;
  }

  get availableCapacity(): number {
    return this.maxActive - this.active.size;
  }

  allocate(request: SurfaceLeaseRequest): BrowserSurfaceLease {
    if (!(LEASABLE_SURFACE_KINDS as readonly string[]).includes(request.kind)) {
      throw new SurfaceValidationError("Surface kind is not leasable.", {
        kind: request.kind,
      });
    }
    validateLeaseOwner(request.owner);
    this.validateOptionalText("traceId", request.traceId, 300);
    this.validateOptionalText("persistentKey", request.persistentKey, 300);
    this.validateOptionalText("title", request.title, 500);
    this.validateUrl(request.initialUrl ?? "about:blank");

    if (this.active.size >= this.maxActive) {
      throw new SurfaceCapacityError(this.maxActive);
    }

    const leaseId = this.ids.leaseId();
    const surfaceId = this.ids.surfaceId();
    const tabId = this.ids.tabId();
    this.assertNewId("leaseId", leaseId);
    this.assertNewId("surfaceId", surfaceId);
    this.assertNewId("tabId", tabId);
    if (new Set([leaseId, surfaceId, tabId]).size !== 3) {
      throw new SurfaceValidationError(
        "leaseId, surfaceId, and tabId must be distinct.",
        { leaseId, surfaceId, tabId },
      );
    }

    const timestamp = this.timestamp();
    const lease: InternalLease = {
      schemaVersion: 1,
      leaseId,
      surfaceId,
      tabId,
      kind: request.kind,
      owner: { ...request.owner },
      ...(request.traceId === undefined ? {} : { traceId: request.traceId }),
      ...(request.persistentKey === undefined ? {} : { persistentKey: request.persistentKey }),
      status: "allocating",
      createdAt: timestamp,
      updatedAt: timestamp,
      lastHeartbeatAt: timestamp,
      url: request.initialUrl ?? "about:blank",
      ...(request.title === undefined ? {} : { title: request.title }),
    };
    this.active.set(leaseId, lease);
    return cloneLease(lease);
  }

  get(leaseId: string): BrowserSurfaceLease {
    return cloneLease(this.requireActive(leaseId));
  }

  getReleased(leaseId: string): BrowserSurfaceLease {
    const lease = this.released.get(leaseId);
    if (!lease) throw new SurfaceLeaseNotFoundError(leaseId);
    return cloneLease(lease);
  }

  list(filter: SurfaceLeaseFilter = {}): BrowserSurfaceLease[] {
    return [...this.active.values()]
      .filter(lease => matchesFilter(lease, filter))
      .map(cloneLease);
  }

  listSnapshots(filter: SurfaceLeaseFilter = {}): SurfaceLeaseSnapshot[] {
    return [...this.active.values()]
      .filter(lease => matchesFilter(lease, filter))
      .map(toSnapshot);
  }

  transition(
    leaseId: string,
    owner: LeaseOwner,
    nextStatus: Exclude<SurfaceStatus, "released">,
    patch: SurfaceLeasePatch = {},
  ): BrowserSurfaceLease {
    const lease = this.requireActive(leaseId);
    assertLeaseOwner(lease, owner);
    const candidateStatus = nextStatus as string;
    if (
      candidateStatus === "released"
      || !(SURFACE_STATUSES as readonly string[]).includes(candidateStatus)
    ) {
      throw new SurfaceValidationError(
        "transition() cannot set an unknown or released surface status.",
        { leaseId, nextStatus: candidateStatus },
      );
    }
    assertSurfaceTransition(leaseId, lease.status, nextStatus);
    this.validatePatch(patch);
    const timestamp = this.timestamp();
    this.applyPatch(lease, patch);
    lease.status = nextStatus;
    lease.updatedAt = timestamp;
    return cloneLease(lease);
  }

  update(
    leaseId: string,
    owner: LeaseOwner,
    patch: SurfaceLeasePatch,
  ): BrowserSurfaceLease {
    const lease = this.requireActive(leaseId);
    assertLeaseOwner(lease, owner);
    this.validatePatch(patch);
    const timestamp = this.timestamp();
    this.applyPatch(lease, patch);
    lease.updatedAt = timestamp;
    return cloneLease(lease);
  }

  heartbeat(leaseId: string, owner: LeaseOwner): BrowserSurfaceLease {
    const lease = this.requireActive(leaseId);
    assertLeaseOwner(lease, owner);
    const timestamp = this.timestamp();
    lease.lastHeartbeatAt = timestamp;
    lease.updatedAt = timestamp;
    return cloneLease(lease);
  }

  release(
    leaseId: string,
    owner: LeaseOwner,
    disposition: ReleaseDisposition = "close",
    terminalReason?: string,
  ): BrowserSurfaceLease {
    if (!(RELEASE_DISPOSITIONS as readonly string[]).includes(disposition)) {
      throw new SurfaceValidationError("Release disposition must be close or park.", {
        leaseId,
        disposition,
      });
    }
    this.validateOptionalText("terminalReason", terminalReason, 1_000);

    const active = this.active.get(leaseId);
    if (!active) {
      const tombstone = this.released.get(leaseId);
      if (!tombstone) throw new SurfaceLeaseNotFoundError(leaseId);
      assertLeaseOwner(tombstone, owner);
      return cloneLease(tombstone);
    }

    assertLeaseOwner(active, owner);
    const timestamp = this.timestamp();

    if (active.status !== "releasing") {
      assertSurfaceTransition(leaseId, active.status, "releasing");
      active.status = "releasing";
    }
    assertSurfaceTransition(leaseId, active.status, "released");

    active.status = "released";
    active.releaseDisposition = disposition;
    if (terminalReason !== undefined) active.terminalReason = terminalReason;
    active.updatedAt = timestamp;

    this.active.delete(leaseId);
    this.rememberReleased(active);
    return cloneLease(active);
  }

  reclaimDeadOwners(reason = "owner process is no longer running"): BrowserSurfaceLease[] {
    if (!this.isProcessAlive) {
      throw new SurfaceValidationError(
        "Dead-owner reclamation requires an isProcessAlive callback.",
      );
    }

    const reclaimed: BrowserSurfaceLease[] = [];
    for (const lease of [...this.active.values()]) {
      if (this.isProcessAlive(lease.owner.pid)) continue;
      reclaimed.push(this.release(lease.leaseId, lease.owner, "close", reason));
    }
    return reclaimed;
  }

  private requireActive(leaseId: string): InternalLease {
    const lease = this.active.get(leaseId);
    if (!lease) throw new SurfaceLeaseNotFoundError(leaseId);
    return lease;
  }

  private validatePatch(patch: SurfaceLeasePatch): void {
    if (patch.url !== undefined) this.validateUrl(patch.url);
    if (patch.title !== undefined) this.validateOptionalText("title", patch.title, 500);
  }

  private applyPatch(lease: InternalLease, patch: SurfaceLeasePatch): void {
    if (patch.url !== undefined) lease.url = patch.url;
    if (patch.title !== undefined) lease.title = patch.title;
  }

  private timestamp(): string {
    const value = this.now();
    if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
      throw new SurfaceValidationError("now() must return a valid Date.");
    }
    return value.toISOString();
  }

  private validateUrl(url: string): void {
    if (typeof url !== "string" || url.length < 1 || url.length > 20_000) {
      throw new SurfaceValidationError("Surface URL must contain 1-20,000 characters.");
    }
    try {
      const parsed = new URL(url);
      if (!["https:", "http:", "about:"].includes(parsed.protocol)) {
        throw new Error("unsupported protocol");
      }
    } catch {
      throw new SurfaceValidationError("Surface URL must be a valid HTTP(S) or about URL.", {
        url,
      });
    }
  }

  private validateOptionalText(name: string, value: string | undefined, max: number): void {
    if (value === undefined) return;
    if (typeof value !== "string" || value.length < 1 || value.length > max) {
      throw new SurfaceValidationError(`${name} must contain 1-${max} characters.`, {
        [name]: value,
      });
    }
  }

  private assertNewId(name: string, value: string): void {
    if (!SAFE_ID.test(value)) {
      throw new SurfaceValidationError(`${name} must contain 8-200 URL-safe characters.`, {
        [name]: value,
      });
    }
    const collision = [...this.active.values(), ...this.released.values()].some(lease =>
      lease.leaseId === value || lease.surfaceId === value || lease.tabId === value
    );
    if (collision) {
      throw new SurfaceValidationError(`${name} collided with an existing browser surface id.`, {
        [name]: value,
      });
    }
  }

  private rememberReleased(lease: InternalLease): void {
    if (this.releasedTombstoneLimit === 0) return;
    this.released.set(lease.leaseId, { ...lease, owner: { ...lease.owner } });
    this.releasedOrder.push(lease.leaseId);
    while (this.releasedOrder.length > this.releasedTombstoneLimit) {
      const oldest = this.releasedOrder.shift();
      if (oldest !== undefined) this.released.delete(oldest);
    }
  }
}
