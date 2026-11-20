import type {Attributes, VictoriaClientOptions} from 'victoria-browser-client'

/** Telemetry only needs selected gallery state, without artwork, keys or prompts. */
export type GalleryState = {
  ai: boolean
  held: string | null
  inspecting: string | null
  locked: boolean
  narration: {
    source: string | null
    status: string
  } | null
  portraits: ReadonlyArray<{
    fusing?: boolean
    hung: boolean
    imported?: boolean
    pending?: boolean
  }>
  ready: boolean
  revision: number
  room: string
}
export type GalleryStore = {
  getState: () => GalleryState
  subscribe: (listener: (state: GalleryState, previous: GalleryState) => void) => () => void
}
/** Telemetry only needs the fences the player’s place is in and how it came into them. */
export type GeofenceState = {
  /** where the player’s place was right after crossing into the fences, in world meters, and how fast the player moved, in m/s, or null for the fences the player started in */
  crossing: {
    position: readonly [x: number, y: number, z: number]
    velocity: readonly [x: number, y: number, z: number]
  } | null
  fences: ReadonlyArray<string>
}
export type GeofenceStore = {
  subscribe: (listener: (state: GeofenceState, previous: GeofenceState) => void) => () => void
}
/** Telemetry only needs how the player caught sight of the Sloperator, at the sights not left since, and what became of entering the fences of his sights the player is in. */
export type SloperatorState = {
  sighted: ReadonlyArray<{
    /** how far from the eye he was, in meters */
    distance: number
    /** how he sat on his seat or stood where it stood */
    pose: string
    /** where the eye was, in world meters */
    position: readonly [x: number, y: number, z: number]
    /** the id of the sight he was at */
    sight: string
  }>
  /** by the id of the sight: whether he turned up there, how the physics found his seat and, where he turned up, how he sits or stands and where, the point on the floor under him in world meters and his turn around y in radians */
  spawns: Partial<Record<string, {
    detection: string
    placement?: {
      pose: string
      position: readonly [x: number, y: number, z: number]
      yaw: number
    }
    result: string
  }>>
}
export type SloperatorStore = {
  subscribe: (listener: (state: SloperatorState, previous: SloperatorState) => void) => () => void
}
export type SlopGalleryTelemetryOptions = Omit<VictoriaClientOptions, 'endpoint' | 'endpoints' | 'resource' | 'serviceName'> & {
  /** full ingestion URLs of VictoriaLogs JSON lines, VictoriaMetrics JSON import and VictoriaTraces OTLP JSON; a missing signal is not sent */
  endpoints?: Partial<Record<'logs' | 'metrics' | 'traces', string>>
  environment?: string
  resource?: Attributes
  sampleIntervalMs?: number
  sessionId?: string
  version?: string
}
