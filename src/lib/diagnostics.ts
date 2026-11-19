import type {PartyEffectId, PartyOptions, PartyPlacement} from '#src/party_effects/index.ts'
import type {WorldReachMode} from '#src/worlds/base/WorldReach.ts'
import type {Placement, Portrait, Vec3} from './gallery/types.ts'
import type {PlayerDumpSnapshot} from './telemetry/recordPlayerDump.ts'
import type {EulerTuple} from 'three/webgpu'
import type {PauseMenuStage} from 'use-pause-menu/core'
import type {CaptureFrameApi} from 'webgpu-capture-bridge'

/** what a camera shows, which is the player’s: there is no camera apart from the player */
export type CameraView = {
  /** vertical field of view in degrees */
  fov: number
  position: Vec3
  /** [pitch, yaw, roll] in radians, applied in YXZ order like the player camera */
  rotation: Vec3
}
export type GalleryDiagnostics = {
  active: string | null
  activeLabel: string | null
  camera: Vec3
  /** whether the world stands still under the pause menu of the Escape key: no frames, physics, animations or sound until the player resumes */
  frozen: boolean
  held: string | null
  /** the IDs of everything still loading that would leave something out of the next frame; a new view can bring more */
  loadingItems: Array<string>
  locked: boolean
  menuStage: PauseMenuStage
  /** the ids of the rooms that streamed in and mounted so far, in that order; worlds that bring their rooms with the page, like the Sandbox, stream none */
  mountedRooms: ReadonlyArray<string>
  placement: Placement | null
  portraits: Array<Pick<Portrait, 'fusing' | 'height' | 'hung' | 'id' | 'pending' | 'position' | 'reserved' | 'title' | 'wallId' | 'width'> & {physical?: {
    x: number
    y: number
    z: number
  }}>
  props: Array<{
    bodyType: number
    collidersEnabled: Array<boolean>
    id: string
    /** its mass in kg, which its throws go by */
    mass: number
    /** whether it still passes through the player’s capsule after leaving the player’s hands */
    passing: boolean
    position: {
      x: number
      y: number
      z: number
    }
    sleeping: boolean
    velocity: {
      x: number
      y: number
      z: number
    }
    visualPosition: Vec3
  }>
  ready: boolean
  registered: number
  room: string
  rotation: EulerTuple
  /** the environment seed in effect, after the `?seed` override */
  seed: number
  /** the id of the work the pause menu shows up close in place of its map, or null while it shows the map; playing on puts the view away */
  spectating: string | null
  webGPU: boolean
  /** how much of the world this page mounts by its `?world_reach`, with the id of the room it reaches out from and the ids of the rooms that are there */
  worldReach: {
    mode: WorldReachMode
    origin: string
    rooms: ReadonlyArray<string>
  }
}
/** where the Sandbox’s turntable floats its work and how large the work is in its frame */
export type TurntablePose = {
  /** the middle of the frame, round which it turns, in world meters */
  center: Vec3
  /** the direction the frame’s front faces while it isn’t turned, away from the wall into the room */
  facing: Vec3
  /** the frame’s outer width and height, its reach on every side included, and its depth, in meters */
  size: Vec3
}
type GalleryDebugApi = Partial<CaptureFrameApi> & {
  /** the X dump snapshot of the current view, without logging, copying or sound; null before the player is ready */
  dump?: () => PlayerDumpSnapshot | null
  /** test mode only: makes the player fly, like `?flying`, with its eyes at the view’s position, looking the way its rotation turns them, a YXZ Euler in radians, through its field of view, each as it is unless given, and returns the view from there; the room the eyes are in is the player’s. `teleport` lands again */
  fly?: (view?: Partial<CameraView>) => {
    fov: number | null
    position: Vec3
    rotation: Vec3
  }
  fuse?: (first: string, second: string) => void
  /** Sandbox only, with `?turntable`: holds the turntable’s work turned `angle` radians round from facing the room, rising and sinking with the angle as it does while turning, or lets it turn on its own again without one, and tells where it floats */
  holdTurntable?: (angle?: number) => TurntablePose
  player?: {
    enabled: boolean
    grounded: boolean
    keys: Record<string, boolean>
    position: {
      x: number
      y: number
      z: number
    }
  }
  snapshot?: () => GalleryDiagnostics
  /** plays the party effect with the id, like `blood`, anywhere in the world: bursting out of the placement’s position, facing the way its rotation turns it around y, right away or after the options’ delay */
  spawnPartyEffect?: (id: PartyEffectId, placement: PartyPlacement, options?: PartyOptions) => void
  /** test mode only: puts the player on its feet below the eye position, on the floor at the lowest, looking the way the quaternion turns it, and ends a flight */
  teleport?: (position: Vec3, rotation: Array<number>) => void
}

declare global {
  var slopGallery: GalleryDebugApi | undefined
  interface Window {
    slopGallery?: GalleryDebugApi
  }
}
