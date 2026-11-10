import type AmbienceEmitter from 'ambience-emitter'
import type {Group, Mesh, MeshBasicNodeMaterial} from 'three/webgpu'

import {useFrame} from '@react-three/fiber'
import {useRef} from 'react'
import {Color, Vector3} from 'three/webgpu'

import {useAmbienceEmitters} from '#src/lib/audio/ambience/ambienceEmitters.ts'
import {useGallery} from '#src/lib/gallery.ts'

/** marker radius in meters, like the light markers */
const radius = 0.12
/** the dark rim around each ball, as a share of its radius */
const rim = 1.45
/** the width of each bar of the cross over a disabled emitter, as a share of its radius, like the light markers */
const crossWidth = 0.22
const barScale = [radius * rim * 2, radius * crossWidth, radius * crossWidth] as const
const full = new Color('#ffffff')
const silent = new Color('#c8c8c8')
const camera = new Vector3

/** White at full strength, light gray when silent, and between them a heat gradient from blue (1%) to red (99%). */
export function strengthColor(strength: number, target: Color) {
  if (strength >= 1) {
    return target.copy(full)
  }
  if (strength <= 0) {
    return target.copy(silent)
  }
  return target.setHSL((1 - (strength - 0.01) / 0.98) * 2 / 3, 1, 0.5)
}

/**
 * `?show_ambience_emitters`: a dark-rimmed ball at every ambience emitter, seen through walls, colored by how strongly it reaches the camera right now and crossed out while the camera’s room disables it.
 */
export default function AmbienceEmitterMarkers() {
  const emitters = useAmbienceEmitters(state => state.emitters)
  return <group name='ambience-emitter-markers'>
    {emitters.map(emitter => <Marker key={emitter.id} emitter={emitter} />)}
  </group>
}

function Marker({emitter}: {emitter: AmbienceEmitter}) {
  const ball = useRef<Mesh<never, MeshBasicNodeMaterial>>(null)
  const cross = useRef<Group>(null)
  useFrame(state => {
    const {x, y, z} = state.camera.getWorldPosition(camera)
    const {room} = useGallery.getState()
    strengthColor(emitter.strengthAt([x, y, z], room), ball.current!.material.color)
    // The cross lies in the view, like the light markers’.
    cross.current!.visible = !emitter.isInside(room)
    state.camera.getWorldQuaternion(cross.current!.quaternion)
  })
  return <group name={emitter.id} position={emitter.position}>
    <mesh name='ambience-emitter-rim' raycast={() => {}} renderOrder={10} scale={radius * rim}>
      <sphereGeometry args={[1, 12, 8]} />
      <meshBasicNodeMaterial color='#000000' depthTest={false} depthWrite={false} opacity={0.75} transparent />
    </mesh>
    <mesh name='ambience-emitter' raycast={() => {}} renderOrder={11} scale={radius} ref={ball}>
      <sphereGeometry args={[1, 12, 8]} />
      <meshBasicNodeMaterial depthTest={false} depthWrite={false} toneMapped={false} />
    </mesh>
    <group name='ambience-emitter-cross' visible={false} ref={cross}>
      {[Math.PI / 4, -Math.PI / 4].map(angle => <mesh key={angle} raycast={() => {}} renderOrder={12} rotation-z={angle} scale={barScale}>
        <boxGeometry />
        <meshBasicNodeMaterial color='#000000' depthTest={false} depthWrite={false} opacity={0.75} transparent />
      </mesh>)}
    </group>
  </group>
}
