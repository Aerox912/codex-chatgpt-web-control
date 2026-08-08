export const SURFACE_KINDS = [
  "home",
  "model-turn",
  "control-chat",
  "control-work",
  "control-artifact",
] as const;

export type SurfaceKind = (typeof SURFACE_KINDS)[number];

export const LEASABLE_SURFACE_KINDS = [
  "model-turn",
  "control-chat",
  "control-work",
  "control-artifact",
] as const;

export type LeasableSurfaceKind = (typeof LEASABLE_SURFACE_KINDS)[number];

export const SURFACE_STATUSES = [
  "allocating",
  "idle",
  "navigating",
  "submitting",
  "generating",
  "ready",
  "blocked",
  "error",
  "releasing",
  "released",
] as const;

export type SurfaceStatus = (typeof SURFACE_STATUSES)[number];

export const RELEASE_DISPOSITIONS = ["close", "park"] as const;

export type ReleaseDisposition = (typeof RELEASE_DISPOSITIONS)[number];

export interface LeaseOwner {
  readonly pid: number;
  readonly instanceId: string;
}

export interface SurfaceLeaseRequest {
  readonly kind: LeasableSurfaceKind;
  readonly owner: LeaseOwner;
  readonly traceId?: string;
  readonly persistentKey?: string;
  readonly initialUrl?: string;
  readonly title?: string;
}

export interface BrowserSurfaceLease {
  readonly schemaVersion: 1;
  readonly leaseId: string;
  readonly surfaceId: string;
  readonly tabId: string;
  readonly kind: LeasableSurfaceKind;
  readonly owner: LeaseOwner;
  readonly traceId?: string;
  readonly persistentKey?: string;
  readonly status: SurfaceStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly lastHeartbeatAt: string;
  readonly url: string;
  readonly title?: string;
  readonly releaseDisposition?: ReleaseDisposition;
  readonly terminalReason?: string;
}

export interface SurfaceOwnershipMarker {
  readonly schemaVersion: 1;
  readonly leaseId: string;
  readonly surfaceId: string;
  readonly kind: LeasableSurfaceKind;
  readonly ownerInstanceId: string;
}

export interface SurfaceLeasePatch {
  readonly url?: string;
  readonly title?: string;
}

export interface SurfaceLeaseFilter {
  readonly kind?: LeasableSurfaceKind;
  readonly ownerInstanceId?: string;
  readonly status?: SurfaceStatus;
  readonly traceId?: string;
  readonly persistentKey?: string;
}

export interface SurfaceLeaseSnapshot {
  readonly leaseId: string;
  readonly surfaceId: string;
  readonly tabId: string;
  readonly kind: LeasableSurfaceKind;
  readonly ownerPid: number;
  readonly ownerInstanceId: string;
  readonly traceId?: string;
  readonly persistentKey?: string;
  readonly status: SurfaceStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly lastHeartbeatAt: string;
  readonly url: string;
  readonly title?: string;
  readonly releaseDisposition?: ReleaseDisposition;
  readonly terminalReason?: string;
}

export interface LeaseIdFactory {
  leaseId(): string;
  surfaceId(): string;
  tabId(): string;
}

export interface SurfaceLeaseManagerOptions {
  readonly maxActive?: number;
  readonly releasedTombstoneLimit?: number;
  readonly now?: () => Date;
  readonly ids?: LeaseIdFactory;
  readonly isProcessAlive?: (pid: number) => boolean;
}
