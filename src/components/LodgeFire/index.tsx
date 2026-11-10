import type {Mesh} from 'three/webgpu'

import {useFrame} from '@react-three/fiber'
import {RigidBody} from '@react-three/rapier'
import Branch from 'branch-component'
import useDisposable from 'disposable-lifetime/react'
import {useMemo, useRef} from 'react'
import useGraphicsMode from 'use-graphics-mode'

import {useAmbienceEmitter} from '#src/ambience_emitters/lib/ambienceEmitters.ts'
import {AnimationClock} from '#src/lib/frozenTime.ts'
import Coals from '#src/lib/gallery/fireplace/Coals.ts'
import fire from '#src/lib/gallery/fireplace/config.ts'
import FireSparks from '#src/lib/gallery/fireplace/FireSparks.ts'
import FlameGeometry from '#src/lib/gallery/fireplace/FlameGeometry.ts'
import fireFlicker from '#src/lib/gallery/fireplace/flicker.ts'
import LogGeometry from '#src/lib/gallery/fireplace/LogGeometry.ts'
import {createCharredLogMaterial} from '#src/lib/materials/CharredLogMaterial.ts'
import EmberBedMaterial from '#src/lib/materials/EmberBedMaterial.ts'
import FlameMaterial from '#src/lib/materials/FlameMaterial.ts'
import {useLamp} from '#src/lib/rendering/lamps.ts'
import lodgeLamps from '#src/rooms/lodge/lamps.ts'
import slopGallery from '#src/worlds/gallery/index.ts'

const {logs, embers, light} = fire
const emberRotation = [-Math.PI / 2, 0, 0] as const
const logRotation = [0, 0, Math.PI / 2] as const

/** The lodge’s log fire inside the `lodge-fireplace` group, whose flames light the Lodge’s fire lamp. Heavy graphics burn charred firewood on a pulsing ember bed with coals and sparks; fast graphics burn a plain log pair on a static glow. */
export default function LodgeFire() {
  const isHeavy = useGraphicsMode()
  useAmbienceEmitter(slopGallery.ambience('lodge', 'fire'))
  return <group name='lodge-fire' position={fire.position}>
    <Branch if={isHeavy} then={BurningPile} else={GlowingEmbers} />
    <Flames soft={isHeavy} />
  </group>
}

/** The flames and the flickering firelight they cast. Only heavy graphics soften them where they meet the wood, which costs a depth copy every frame. */
function Flames({soft}: {soft: boolean}) {
  const geometry = useDisposable(useMemo(() => new FlameGeometry, []))
  const material = useDisposable(useMemo(() => new FlameMaterial({soft}), [soft]))
  const flames = useRef<Mesh>(null)
  const lamp = useLamp('lodge-fire')
  const clock = useMemo(() => new AnimationClock(0.1), [])
  useFrame((_, delta) => {
    const firelight = lamp()
    if (!firelight || !flames.current) {
      return
    }
    const t = clock.advance(delta)
    firelight.intensity = lodgeLamps.fire.strength * fireFlicker(t)
    // The flames’ center of brightness wanders as tongues flare up and die down.
    flames.current.localToWorld(firelight.position.set(light.position[0] + Math.sin(t * 2.3) * 0.09 + Math.sin(t * 5.9) * 0.04, light.position[1] + Math.sin(t * 4.1 + 1) * 0.045, light.position[2]))
  })
  return <mesh geometry={geometry} material={material} name='lodge-flames' renderOrder={1} ref={flames} />
}
function GlowingEmbers() {
  return <>
    <RigidBody colliders='cuboid' type='fixed'>
      {logs.offsets.map(z => <mesh key={z} castShadow name='lodge-log' position={[0, logs.y, z]} rotation={logRotation}>
        <cylinderGeometry args={[logs.radiusTop, logs.radiusBottom, logs.length, 12]} /><meshStandardNodeMaterial color='#352015' roughness={1} />
      </mesh>)}
    </RigidBody>
    <mesh name='lodge-embers' position={[0, embers.y, 0]} rotation={emberRotation}>
      <planeGeometry args={embers.glowSize} /><meshStandardNodeMaterial color='#9b2609' emissive='#f85b12' emissiveIntensity={2} />
    </mesh>
  </>
}
function BurningPile() {
  const pile = useDisposable(useMemo(() => {
    const parts = fire.pile.map(({shape, inward}) => ({
      geometry: new LogGeometry(shape),
      material: createCharredLogMaterial(inward, shape.length / 2, shape.radiusBottom),
    }))
    return {
      parts,
      dispose: () => {
        for (const {geometry, material} of parts) {
          geometry.dispose()
          material.dispose()
        }
      },
    }
  }, []))
  const emberMaterial = useDisposable(useMemo(() => new EmberBedMaterial(embers.size), []))
  const sparks = useDisposable(useMemo(() => new FireSparks, []))
  const coals = useDisposable(useMemo(() => new Coals, []))
  return <>
    <RigidBody colliders='cuboid' type='fixed'>
      {fire.pile.map(({position, yaw, pitch}, i) => <mesh key={i} castShadow geometry={pile.parts[i].geometry} material={pile.parts[i].material} name='lodge-log' position={position} receiveShadow rotation={[0, yaw, Math.PI / 2 + pitch]} />)}
    </RigidBody>
    <mesh material={emberMaterial} name='lodge-embers' position={[0, embers.y, 0]} receiveShadow rotation={emberRotation}>
      <planeGeometry args={embers.size} />
    </mesh>
    <primitive object={coals} />
    <primitive object={sparks} />
  </>
}
