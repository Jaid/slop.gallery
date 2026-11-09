import type {PropHandle} from '#src/components/Scene/GrabbableProp.tsx'
import type {Vec3} from '#src/lib/gallery/types.ts'
import type {Camera} from 'three/webgpu'

import {Vector3} from 'three/webgpu'

import {propObjects} from '#src/components/Scene/GrabbableProp.tsx'
import {useGallery} from '#src/lib/gallery/store.ts'
import {aimThrow} from '#src/lib/physics/aimThrow.ts'
import {throwSpeed} from '#src/lib/physics/GrabbableBody.ts'

/** how far below the middle of the view and how far from the eye a carried orb floats, where a throw leaves from by default: 15° and 0.55 m */
const holdTilt = 15 * Math.PI / 180
const holdDistance = 0.55
export type PropThrowInput = {
  /** where it leaves from, in world meters; by default where a carried orb floats in front of the camera */
  from?: Vec3
  /** the portrait whose middle it flies at */
  portrait?: string
  prop: string
  /** how fast it leaves toward its target, in m/s */
  speed?: number
  /** the point in the world it flies through */
  target?: Vec3
  /** how it leaves, in m/s, instead of flying at a target */
  velocity?: Vec3
}
export type PropThrow = {
  from: Vec3
  prop: string
  /** seconds until it reaches its target, if it has one */
  seconds?: number
  velocity: Vec3
}

/** Throws a prop like the player does, from in front of `camera` unless `from` says otherwise, at a portrait, through a point or with a velocity of its own; see the `throw_prop` tool. */
export default function throwProp(camera: Camera, {from, portrait, prop, speed = throwSpeed, target, velocity}: PropThrowInput): PropThrow {
  const handle = propObjects.get(prop)
  if (!handle) {
    throw new Error(`There is no prop “${prop}” in the world. Props: ${propObjects.keys().toArray().join(', ')}.`)
  }
  const start = from ?? holdPoint(camera)
  if (velocity) {
    return fling(prop, handle, start, {velocity})
  }
  const aim = aimThrow(start, targetPoint(portrait, target), speed)
  if (!aim) {
    throw new Error(`A throw at ${speed} m/s falls short of ${portrait === undefined ? 'the target' : `“${portrait}”`}.`)
  }
  return fling(prop, handle, start, aim)
}

/** Throws the prop `prop` of `handle` from `start` as its aim says. */
function fling(prop: string, handle: PropHandle, start: Vec3, {seconds, velocity}: {
  seconds?: number
  velocity: Vec3
}): PropThrow {
  if (!handle.fling(start, velocity)) {
    throw new Error(`“${handle.title}” can’t be thrown while it is carried or a fusion holds it.`)
  }
  return {
    prop,
    from: start,
    velocity,
    ...seconds === undefined ? {} : {seconds},
  }
}
/** The point a throw flies at: the middle of the portrait with the id `portrait`, or else `target`. */
function targetPoint(portrait: string | undefined, target: Vec3 | undefined): Vec3 {
  if (portrait === undefined) {
    return target!
  }
  const work = useGallery.getState().portraits.find(candidate => candidate.id === portrait)
  if (!work) {
    throw new Error(`There is no portrait “${portrait}” in the world.`)
  }
  return work.position
}
const eye = new Vector3
const look = new Vector3
const up = new Vector3
/** Where a carried orb floats in front of `camera`. */
function holdPoint(camera: Camera): Vec3 {
  camera.getWorldPosition(eye)
  camera.getWorldDirection(look)
  up.setFromMatrixColumn(camera.matrixWorld, 1)
  return eye.addScaledVector(look, Math.cos(holdTilt) * holdDistance).addScaledVector(up, -Math.sin(holdTilt) * holdDistance).toArray()
}
