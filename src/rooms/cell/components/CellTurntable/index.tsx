import type {TurntablePose} from '#src/lib/diagnostics.ts'
import type {Vec3} from '#src/lib/gallery/types.ts'
import type {SandboxTurntable} from '#src/worlds/sandbox/Sandbox.ts'
import type {Group} from 'three/webgpu'

import {useFrame} from '@react-three/fiber'
import useDisposable from 'disposable-lifetime/react'
import {useEffect, useMemo, useRef} from 'react'
import {PlaneGeometry} from 'three/webgpu'

import DynamicImageMaterial from '#component/DynamicImageMaterial'
import {frameBack} from '#src/frames/base/PortraitFrame.ts'
import {portraitFrame} from '#src/frames/index.ts'
import {AnimationClock} from '#src/lib/frozenTime.ts'
import {environmentSeed} from '#src/lib/gameSeed.ts'
import {frameSize} from '#src/lib/placement/portraitSlots.ts'
import useArtworkTexture from '#src/lib/useArtworkTexture.ts'
import sandbox from '#src/worlds/sandbox/index.ts'

/** seconds the work takes to turn round once */
const turnSeconds = 12
/** how far the work rises and sinks as it floats, twice every turn */
const bob = 0.02
/** how far the work floats out from where it would hang at least */
const offWall = 1.2
/** how much room the turning frame leaves the wall at least, and its bottom the floor */
const clearance = 0.3
const slot = sandbox.turntableSlot()
const floorY = sandbox.room('cell').floorY
/** the way the slot’s work faces, out of its wall into the room */
const facing: Vec3 = [Math.sin(slot.rotation), 0, Math.cos(slot.rotation)]

/**
 * The work `?turntable` asks for, floating in front of the Cell’s east wall where the wall’s middle work would hang, and turning round once every 12 s, so its frame shows from every side, its back included.
 * Its image covers the work, cropped evenly where their aspects differ. `slopGallery.holdTurntable` holds it at an angle instead, for films that turn it frame by frame.
 */
export default function CellTurntable({turntable}: {turntable: SandboxTurntable}) {
  const turning = useRef<Group>(null)
  const held = useRef<number | undefined>(undefined)
  const clock = useMemo(() => new AnimationClock, [])
  const {texture} = useArtworkTexture(turntable.source)
  const image = texture?.image
  const imageAspect = image ? image.width / image.height : 1
  const aspect = turntable.aspect ?? imageAspect
  const {width, height} = frameSize(aspect, turntable.area)
  const frame = portraitFrame(sandbox.frameAt(slot.position, environmentSeed, turntable.id))
  const geometry = useDisposable(useMemo(() => frame.createGeometry(width, height), [frame, width, height]))
  const plane = useDisposable(useMemo(() => {
    const surface = new PlaneGeometry(width, height)
    const shown = aspect / imageAspect
    const [u, v] = shown < 1 ? [shown, 1] : [1, 1 / shown]
    const uv = surface.getAttribute('uv')
    for (let index = 0; index < uv.count; index++) {
      uv.setXY(index, 0.5 + (uv.getX(index) - 0.5) * u, 0.5 + (uv.getY(index) - 0.5) * v)
    }
    return surface
  }, [aspect, imageAspect, width, height]))
  const pose = useMemo((): TurntablePose => {
    const size: Vec3 = [width + frame.reach * 2, height + frame.reach * 2, frame.depth]
    // Far enough out for its corners to turn clear of the wall, and high enough for its bottom to clear the floor.
    const out = Math.max(offWall, Math.hypot(size[0], size[2]) / 2 + clearance)
    return {
      center: [slot.position[0] + facing[0] * out, Math.max(slot.position[1], floorY + size[1] / 2 + clearance), slot.position[2] + facing[2] * out],
      facing,
      size,
    }
  }, [frame, width, height])
  useEffect(() => {
    globalThis.slopGallery ??= {}
    const gallery = globalThis.slopGallery
    const hold = (angle?: number) => {
      held.current = angle
      return pose
    }
    gallery.holdTurntable = hold
    return () => {
      if (gallery.holdTurntable === hold) {
        delete gallery.holdTurntable
      }
    }
  }, [pose])
  useFrame((_, delta) => {
    const angle = held.current ?? clock.advance(delta) / turnSeconds * Math.PI * 2
    turning.current?.rotation.set(0, angle, 0)
    turning.current?.position.set(0, Math.sin(angle * 2) * bob, 0)
  })
  // It turns round the middle of the frame’s depth, so it stays where it is as it turns.
  return <group name='cell-turntable' position={pose.center} rotation={[0, slot.rotation, 0]}>
    <group ref={turning}>
      <group position={[0, 0, -(frame.front + frameBack) / 2]}>
        <mesh castShadow geometry={geometry} material={frame.materials} name='cell-turntable-frame' receiveShadow />
        {/* Shadows draw back faces only, like a hung work’s, so the backing board blocks the lights in front and the image those behind. */}
        <mesh castShadow geometry={plane} name='cell-turntable-image' position={[0, 0, frame.imageDepth]}><DynamicImageMaterial source={turntable.source} toneMapped={false} /></mesh>
      </group>
    </group>
  </group>
}
