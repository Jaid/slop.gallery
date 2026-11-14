import type {Portrait as PortraitData, Quat, Vec3} from '#src/lib/gallery.ts'
import type {RapierRigidBody} from '@react-three/rapier'
import type {Group} from 'three/webgpu'

import {useFrame} from '@react-three/fiber'
import {CuboidCollider, RigidBody} from '@react-three/rapier'
import Branch from 'branch-component'
import {useEffect, useRef} from 'react'
import {Quaternion, Vector3} from 'three/webgpu'

import PortraitLabel from '#component/PortraitLabel'
import PortraitModel from '#component/PortraitModel'
import {frameBack} from '#src/frames/base/PortraitFrame.ts'
import {portraitFrame} from '#src/frames/index.ts'
import {impactSounds} from '#src/lib/audio/impactSounds.ts'
import {requestFusion, useGallery} from '#src/lib/gallery.ts'
import {impactOf} from '#src/lib/gallery/fusion/impact/strike.ts'
import portraitObjects from '#src/lib/gallery/portraitObjects.ts'
import world from '#src/worlds/current.ts'

import useHanging from './useHanging.ts'

export default function Portrait({portrait: p}: {portrait: PortraitData}) {
  const body = useRef<RapierRigidBody>(null)
  const group = useRef<Group>(null)
  const art = useRef<Group>(null)
  const placard = useRef<Group>(null)
  const held = useGallery(s => s.held === p.id)
  const w = p.width
  const h = p.height
  const frame = portraitFrame(p.frame)
  useHanging(p, frame, held, art, placard)
  useEffect(() => {
    if (body.current && group.current) {
      portraitObjects.set(p.id, {
        body: body.current,
        group: group.current,
      })
    }
    return () => {
      portraitObjects.delete(p.id)
    }
  }, [p.id])
  // Hung, held or flown around by a fusion, the body is fixed or disabled, so only a loose work strikes anything.
  useEffect(() => {
    if (body.current) {
      return impactSounds.register(body.current, {
        kind: 'frame',
        sound: frame.impactSound,
      })
    }
  }, [frame])
  // A fusion flies the work around by its group meanwhile, so its body neither stands in the way nor falls.
  useEffect(() => {
    body.current?.setEnabled(!held && !p.reserved && !p.fusing)
  }, [held, p.reserved, p.fusing])
  useEffect(() => {
    if (!body.current) {
      return
    }
    body.current.setTranslation({
      x: p.position[0],
      y: p.position[1],
      z: p.position[2],
    }, false)
    const yawRotation = new Quaternion
    const q = p.orientation ? new Quaternion(...p.orientation) : yawRotation.setFromAxisAngle(new Vector3(0, 1, 0), p.rotation)
    body.current.setRotation(q, false)
  }, [p.position, p.rotation, p.orientation])
  useEffect(() => {
    if (!p.hung && p.velocity && body.current) {
      body.current.setLinvel({
        x: p.velocity[0],
        y: p.velocity[1],
        z: p.velocity[2],
      }, true)
      const [x, y, z] = p.spin ?? [2.2, 0.7, 2.8]
      body.current.setAngvel({
        x,
        y,
        z,
      }, true)
    }
  }, [p.hung, p.velocity, p.spin])
  useFrame(() => {
    const position = body.current?.translation()
    if (body.current && position && !p.hung && position.y < world.placement.floorHeight([position.x, position.y, position.z]) - 4) {
      const [x, y, z] = world.placement.recoveryPosition
      body.current.setTranslation({
        x,
        y,
        z,
      }, true)
      body.current.setLinvel({
        x: 0,
        y: 0,
        z: 0,
      }, true)
    }
  })
  return <RigidBody
    angularDamping={0.7} ccd colliders={false} friction={0.75} linearDamping={0.22} position={p.position} restitution={0.32} rotation={[0, p.rotation, 0]} type={p.hung ? 'fixed' : 'dynamic'} userData={{portraitId: p.id}} ref={body}
    onCollisionEnter={event => {
      if (p.hung || p.reserved || held) {
        return
      }
      const other: unknown = event.other.rigidBodyObject?.userData.portraitId
      const target = useGallery.getState().portraits.find(a => a.id === other)
      if (target?.hung && body.current) {
        requestFusion(target.id, p.id, impactOf(body.current))
      }
    }}
    onSleep={() => {
      if (!body.current || p.hung || held || p.reserved) {
        return
      }
      const pos = body.current.translation()
      const q = body.current.rotation()
      useGallery.getState().update(p.id, {
        position: [pos.x, pos.y, pos.z] as Vec3,
        orientation: [q.x, q.y, q.z, q.w] as Quat,
        velocity: undefined,
        spin: undefined,
      })
    }}
  >
    <CuboidCollider args={[w / 2 + frame.reach, h / 2 + frame.reach, frame.depth / 2]} mass={2} position={[0, 0, frameBack + frame.depth / 2]} />
    <group
      userData={{
        pickup: true,
        portraitId: p.id,
      }} ref={group}
    >
      {/* The frame and its image, which move on their own while the work arrives on its wall. */}
      <group ref={art}>
        <PortraitModel held={held} portrait={p} />
      </group>
      {/* The placard hides while the work orbits a fusion’s portal. */}
      <group ref={placard}>
        <Branch if={p.hung && !p.fusing}><PortraitLabel above={p.labelAbove} creator={p.creator} height={h} pending={p.pending} title={p.title} width={w} /></Branch>
      </group>
    </group>
  </RigidBody>
}
