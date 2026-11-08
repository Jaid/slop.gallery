import type {Placement, Portrait, Vec3} from './gallery/types.ts'
import type {PlayerDumpSnapshot} from './telemetry/recordPlayerDump.ts'
import type {EulerTuple} from 'three/webgpu'
import type {PauseMenuStage} from 'use-pause-menu/core'
import type {CaptureFrameApi} from 'webgpu-capture-bridge'

export type CameraPose = {
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
  held: string | null
  /** the IDs of everything still loading that would leave something out of the next frame; a fresh pose can bring more */
  loadingItems: Array<string>
  locked: boolean
  menuStage: PauseMenuStage
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
    position: {
      x: number
      y: number
      z: number
    }
    sleeping: boolean
    visualPosition: Vec3
  }>
  ready: boolean
  registered: number
  room: string
  rotation: EulerTuple
  /** the environment seed in effect, after the `?seed` override */
  seed: number
  webGPU: boolean
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
  /** test mode only: detach the camera from the player and frame it exactly, rotation is a YXZ Euler in radians */
  pose?: (pose?: Partial<CameraPose>) => {
    fov: number | null
    position: Vec3
    rotation: Vec3
  }
  /** Knottingham only: turns every showcased Knot back to the start of its revolution, so films begin at the same angles */
  resetKnotRotation?: () => void
  snapshot?: () => GalleryDiagnostics
  teleport?: (position: Vec3, rotation: Array<number>) => void
}

declare global {
  var slopGallery: GalleryDebugApi | undefined
  interface Window {
    slopGallery?: GalleryDebugApi
  }
}
