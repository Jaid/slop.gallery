import type {Group, Mesh} from 'three/webgpu'

import {useFrame} from '@react-three/fiber'
import useDisposable from 'disposable-lifetime/react'
import {useMemo, useRef} from 'react'
import {useGraphicsModeValue} from 'use-graphics-mode'

import Orbitable from '#component/Orbitable'
import {useAmbienceEmitter} from '#src/lib/audio/ambience/ambienceEmitters.ts'
import MoonfallOrbitAmbience from '#src/lib/audio/ambience/MoonfallOrbit.ts'
import {AnimationClock} from '#src/lib/frozenTime.ts'
import armillaryBandGeometry from '#src/lib/gallery/moonfall/ArmillaryBandGeometry.ts'
import meteoriteGeometry from '#src/lib/gallery/moonfall/MeteoriteGeometry.ts'
import ArmillaryRingMaterial from '#src/lib/materials/ArmillaryRingMaterial.ts'
import MeteoriteMaterial from '#src/lib/materials/MeteoriteMaterial.ts'
import {getGraphicsProfile} from '#src/lib/rendering/graphicsMode.ts'
import slopGallery from '#src/worlds/gallery/index.ts'

const room = slopGallery.room('moonfall')
// Below the ceiling’s beams, so orbiting never rises out of the room.
const sculptureOrbit = {
  radius: 1.85,
  ceilingY: room.floorY + 5.3,
  // The dark room melts away around the glowing rings.
  blur: 2,
}
/** Each ring: its tilt, how fast it precesses round the vertical (radians per second, the middle one against the others), how far it nods, and how fast its bead runs round it, the inner ones faster like planets. */
const rings = [0, 1, 2].map(i => ({
  radius: 1.25 + i * 0.26,
  tilt: [0.65 + i * 0.7, i * Math.PI / 3, i * 0.35] as const,
  precession: [0.12, -0.085, 0.06][i],
  nod: 0.06 + i * 0.02,
  revolution: [0.95, 0.62, 0.41][i],
  hue: i === 1 ? '#d5ad73' : '#62b6b1',
}))
/** how large the meteorite at the sculpture’s middle is round */
const coreRadius = 0.7
/** how fast the meteorite spins round its own vertical and, slower, tumbles over round the horizontal, in radians per second */
const coreSpin = {
  x: 0.07,
  y: 0.2,
}
/** The Moonfall’s orbital sculpture: a slowly tumbling iron meteorite under three engraved bronze bands, each precessing and nodding on its own while its bead runs round it, trailing light through the band’s inlay. */
export default function MoonfallOrbit() {
  const meteorite = useRef<Mesh>(null)
  const turns = useRef<Array<Group | null>>([])
  const beads = useRef<Array<Mesh | null>>([])
  const clock = useMemo(() => new AnimationClock(0.05), [])
  const {curveDetail} = useGraphicsModeValue(getGraphicsProfile)
  useAmbienceEmitter(MoonfallOrbitAmbience, slopGallery.ambienceRooms('moonfall', 'moonfall-orbital_sculpture'))
  const materials = useDisposable(useMemo(() => {
    const list = rings.map(ring => new ArmillaryRingMaterial(ring.radius, ring.hue, () => clock.time * ring.revolution / (Math.PI * 2) % 1))
    return {
      list,
      dispose: () => {
        for (const material of list) {
          material.dispose()
        }
      },
    }
  }, [clock]))
  const bands = useDisposable(useMemo(() => {
    const list = rings.map(ring => armillaryBandGeometry(ring.radius, 128 * curveDetail))
    return {
      list,
      dispose: () => {
        for (const geometry of list) {
          geometry.dispose()
        }
      },
    }
  }, [curveDetail]))
  // About 4500 triangles at the base detail; the thumbprints are shaded, not modeled.
  const core = useDisposable(useMemo(() => meteoriteGeometry(coreRadius, 14 * curveDetail), [curveDetail]))
  const iron = useDisposable(useMemo(() => new MeteoriteMaterial(coreRadius), []))
  useFrame((_, delta) => {
    const t = clock.advance(delta)
    // Euler order XYZ: it spins round its own axis while that axis tips over.
    meteorite.current?.rotation.set(t * coreSpin.x, t * coreSpin.y, 0)
    for (const [i, ring] of rings.entries()) {
      const turn = turns.current[i]
      if (turn) {
        turn.rotation.y = t * ring.precession
        turn.rotation.x = Math.sin(t * 0.23 + i * 2.1) * ring.nod
      }
      const angle = t * ring.revolution
      beads.current[i]?.position.set(Math.cos(angle) * ring.radius, Math.sin(angle) * ring.radius, 0)
    }
  })
  return <Orbitable id='moonfall-orbital-sculpture' name='moonfall-orbital-sculpture' orbit={sculptureOrbit} position={[0, 2.5, 0]} title='Orbital sculpture'>
    <mesh castShadow geometry={core} material={iron} name='moonfall-meteorite' ref={meteorite} />
    {rings.map((ring, i) => <group
      key={i} ref={group => {
        turns.current[i] = group
      }}
    >
      <group rotation={ring.tilt}>
        <mesh geometry={bands.list[i]} material={materials.list[i]} name='moonfall-armillary-band' />
        <mesh
          position={[ring.radius, 0, 0]} ref={mesh => {
            beads.current[i] = mesh
          }}
        ><sphereGeometry args={[0.065, 16 * curveDetail, 12 * curveDetail]} /><meshBasicNodeMaterial color='#e4e7d5' toneMapped={false} /></mesh>
      </group>
    </group>)}
  </Orbitable>
}
