import type {FrameChoice} from '#src/frames/lib/frameChoice.ts'
import type {PortraitFrameId} from '#src/frames/lib/frameParameter.ts'
import type {Orb} from '#src/orbs/index.ts'
import type {PlacementIssue} from '../placement/wallGeometry.ts'
import type {ItemIngredient} from './fusion/FusionRecipe.ts'
import type {Quat as MathQuat, Vec3 as MathVec3} from 'math'
import type {NarrationTiming} from 'use-narrator/core'

export type {Quat, Vec3} from 'math'
/** a recording of a work’s title and description, as `PortraitNarration` reads them, with when its words are spoken */
export type Narration = {
  audio: string
  timing?: NarrationTiming
}
export type Portrait = {
  creator: string
  description: string
  flavorJob?: symbol
  /** the frame the work wears for good, the default frame if left out: a default work’s that of the room whose slot it was hung in, any other work’s that of the room it arrived in */
  frame?: PortraitFrameId
  fusing?: boolean
  fusionJob?: symbol
  height: number
  hung: boolean
  id: string
  imported?: boolean
  /** whether the player has interacted with it in this session: listened to it, grabbed it or viewed it with V, on the work itself or on its name plate */
  interacted?: boolean
  /** whether the placard hangs above the frame instead of below it, as in a low slot */
  labelAbove?: boolean
  narration?: Narration
  orientation?: MathQuat
  pending?: boolean
  position: MathVec3
  reserved?: boolean
  rotation: number
  source: Blob | string
  /** the angular velocity a loose work takes off with, in radians per second around the world axes, along with `velocity` */
  spin?: MathVec3
  title: string
  velocity?: MathVec3
  wallId?: string
  width: number
  year?: number
}
/** a grabbable object thrown into a hung portrait, which it then fuses with as an ingredient */
export type ThrownItem = {
  /** whether a success uses it up, like an orb, instead of the portal spitting it back out */
  consumable?: boolean
  id: string
  /** The item as an ingredient, with what it contributes to the fusion, by default a studio photograph of it as it is now. Called once, after the portrait is reserved for the fusion. */
  ingredient: () => ItemIngredient
  /** the kind of orb it is, if it is one */
  orb?: Orb
  /** the orb a success that uses it up leaves of it, which flips out of the portal after the result, like the clear glass of a themed orb */
  remains?: Orb
  title: string
}
/** what a fusion leaves of an item it uses up, an orb of its own, like the clear glass of a themed orb: it enters the world hidden in the portal’s middle as the portal opens, flips out after the result and leaves the world again if the fusion didn’t use the item up after all */
export type FusionRemains = {
  /** its prop’s id, unique in the world */
  id: string
  orb: Orb
  /** where it enters the world, in the portal’s middle */
  position: MathVec3
}
/** the aspect ratios of default works and their slots, as width:height */
export type PortraitRatio = '1:1' | '2:3' | '3:2' | '9:16' | '16:9'
/** a default work of the world, before it hangs in a portrait slot */
export type Artwork = Pick<Portrait, 'creator' | 'description' | 'id' | 'narration' | 'title' | 'year'> & {
  ratio: PortraitRatio
  source: string
}
/** a spot on a wall reserved for one default work of matching ratio; players rehang works by wall collisions instead */
export type PortraitSlot = {
  /** the frames of the slot’s room, of which its work wears its own roll, the default frame if left out */
  frame?: FrameChoice
  height: number
  id: string
  /** whether the slot hangs low and its work’s placard goes above the frame */
  labelAbove?: boolean
  /** center of the frame, hanging in front of its wall */
  position: MathVec3
  /** Default works fill free slots of higher priority first, and slots of equal priority in random order. */
  priority: number
  ratio: PortraitRatio
  rotation: number
  wallId: string
  width: number
}
export type Placement = {
  inReach: boolean
  /** whether the placard goes above the frame, because below it would block the spot */
  labelAbove?: boolean
  position: MathVec3
  /** why the artwork cannot hang here, or an empty string if it can */
  reason: PlacementIssue | ''
  rotation: number
  valid: boolean
  wallId: string
}
export type {NarrationState} from 'use-narrator/core'
export type PlayerPose = {
  pitch: number
  /** World-space feet position, independent of head bob and inspection cameras. */
  position: MathVec3
  yaw: number
}

/** named player pose that `?spawn` starts at and T cycles through in `?development` */
export type SpawnBookmark = PlayerPose & {
  /** snake_case name that `?spawn` refers to */
  id: string
}

/** named camera view for `?spawn`, which holds the camera there, detached from the player until the next teleport (with `?development`, flies from there instead), and for `scripts/snap.ts --bookmark` */
export type CameraBookmark = {
  /** camera angle in radians, Euler order YXZ like the player’s look: yaw 0 looks toward −z, positive pitch looks up */
  aim: {
    pitch: number
    yaw: number
  }
  /** vertical field of view in degrees */
  fov: number
  /** engine time in seconds that every animation stands still at, like `?frozen_time` */
  frozenTime?: number
  /** snake_case name that `?spawn` refers to */
  id: string
  /** camera (eye) position in meters */
  position: MathVec3
  /** frame width divided by height, which snaps render at */
  ratio: number
  /** environment seed like `?seed`, for views that depend on random details; not applied yet */
  seed?: number
}
