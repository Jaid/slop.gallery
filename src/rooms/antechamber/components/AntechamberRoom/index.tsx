import type {FloorRectangle} from '#src/lib/gallery/floors.ts'
import type {Material, Texture} from 'three/webgpu'

import {CuboidCollider, RigidBody} from '@react-three/rapier'
import useDisposable from 'disposable-lifetime/react'
import {useMemo} from 'react'
import {CircleGeometry, ExtrudeGeometry, Path, Shape, TorusGeometry} from 'three/webgpu'

import AntechamberDome from '#component/AntechamberDome'
import RoomFloor from '#component/RoomFloor'
import Box from '#src/components/Scene/primitives.tsx'
import StaticBatch from '#src/components/Scene/StaticBatch.tsx'
import {antechamberCeilingThickness, antechamberCeilingUnderside, antechamberGallery, antechamberLanding, antechamberLandingCeiling, antechamberOculi, antechamberStairs, antechamberWings} from '#src/lib/gallery/antechamber.ts'
import {stairHeadroom, stairThickness} from '#src/lib/gallery/stairs/StairFlight.ts'
import StainedGlassMaterial from '#src/lib/materials/StainedGlassMaterial.ts'
import slopGallery from '#src/worlds/gallery/index.ts'

const room = slopGallery.room('antechamber')
const [width, depth] = room.size
const [originX, originZ] = room.center
/** the palettes of the oculi’s glass, the dome’s lower ring first, then the gallery’s two in turn */
const palettes = [
  {
    border: '#2f9e5a',
    center: '#ffb43c',
    petals: ['#d8233a', '#2b4fd8'],
  },
  {
    border: '#2b4fd8',
    center: '#fff0b0',
    petals: ['#ffb43c', '#2f9e5a'],
  },
  {
    border: '#7a2bb8',
    center: '#ffb43c',
    petals: ['#2b4fd8', '#d8233a'],
  },
] as const
/** the brass of the dome’s ring and lattice */
const brass = {
  color: '#b8925a',
  metalness: 0.8,
  roughness: 0.35,
}
/** the stone of the floor, which the flight’s treads are cut from too */
const treadColor = '#e9e2d0'
/** the plaster of the ceilings, like the middle’s */
const plaster = '#e1dccc'
/** the parts beyond the middle with a ceiling of their own, relative to the room’s origin */
const annexes = [antechamberWings.west, antechamberWings.east, antechamberGallery].map(part => ({
  ...part,
  center: [part.center[0] - originX, part.center[1] - originZ] as const,
}))

/** Opens up into a windowed dome instead of a flat ceiling, so the sun reaches inside; its wings, gallery and landing take it in through round stained-glass oculi. */
export default function AntechamberRoom({glass, stone, wood}: {
  glass: Material
  stone: Texture
  wood: Texture
}) {
  return <group name='antechamber-room' position={[originX, 0, originZ]}>
    <RigidBody colliders={false} type='fixed'>
      <CuboidCollider args={[width / 2, 0.15, depth / 2]} position={[0, room.height + 0.1, 0]} />
    </RigidBody>
    <AntechamberDome height={room.height} size={room.size} />
    <RoomFloor glass={glass} room={room} stone={stone} wood={wood} />
    {annexes.map(part => <group key={part.center.join()} position={[part.center[0], 0, part.center[1]]}>
      <RoomFloor
        glass={glass} room={{
          ...part,
          id: room.id,
          floorY: 0,
        }} stone={stone} wood={wood}
      />
      <RigidBody colliders={false} type='fixed'>
        <CuboidCollider args={[part.size[0] / 2, 0.15, part.size[1] / 2]} position={[0, part.height + 0.1, 0]} />
      </RigidBody>
    </group>)}
    <Ceilings />
    <Oculi />
    <Flight stone={stone} />
  </group>
}

/** The flat ceilings of the wings, the gallery and the landing, each pierced by its oculi, their slabs’ undersides as far under the walls’ tops as the middle’s. */
function Ceilings() {
  const geometries = useDisposable(useMemo(() => {
    /** the slab over the part whose underside hangs at the height, laid flat from it up */
    const slab = ({center: [x, z], size: [partWidth, partDepth]}: FloorRectangle, underside: number) => {
      const outline = new Shape
      outline.moveTo(-partWidth / 2, -partDepth / 2)
      outline.lineTo(partWidth / 2, -partDepth / 2)
      outline.lineTo(partWidth / 2, partDepth / 2)
      outline.lineTo(-partWidth / 2, partDepth / 2)
      outline.closePath()
      const pierced = antechamberOculi.filter(value => value.underside === underside && Math.abs(value.center[0] - x) < partWidth / 2 && Math.abs(value.center[1] - z) < partDepth / 2)
      for (const oculus of pierced) {
        const hole = new Path
        // Turned flat, the shape’s y runs north, against the museum’s z.
        hole.absarc(oculus.center[0] - x, z - oculus.center[1], oculus.radius, 0, Math.PI * 2, true)
        outline.holes.push(hole)
      }
      const geometry = new ExtrudeGeometry(outline, {
        bevelEnabled: false,
        curveSegments: 64,
        depth: antechamberCeilingThickness,
      })
      return geometry.rotateX(-Math.PI / 2).translate(x - originX, underside, z - originZ)
    }
    const parts = [
      ...[antechamberWings.west, antechamberWings.east, antechamberGallery].map(part => slab(part, antechamberCeilingUnderside(part))),
      slab(antechamberLanding, antechamberLandingCeiling),
    ]
    return {
      parts,
      dispose() {
        for (const geometry of parts) {
          geometry.dispose()
        }
      },
    }
  }, []))
  return <StaticBatch name='antechamber-ceilings'>
    {geometries.parts.map((geometry, index) => <mesh key={index} castShadow geometry={geometry} name='antechamber-flat-ceiling' receiveShadow><meshStandardNodeMaterial color={plaster} roughness={0.7} /></mesh>)}
  </StaticBatch>
}
/** Every oculus: a stained-glass rosette set into its hole in the slab and a brass ring round its rim under the ceiling. */
function Oculi() {
  const resources = useDisposable(useMemo(() => {
    const glass = palettes.map(palette => new StainedGlassMaterial(palette))
    const pane = new CircleGeometry(1, 64)
    const rings = new Map(antechamberOculi.map(({radius}) => radius).map(radius => [radius, new TorusGeometry(radius, 0.05, 12, Math.round(radius * 96))]))
    return {
      glass,
      pane,
      rings,
      dispose() {
        for (const material of glass) {
          material.dispose()
        }
        pane.dispose()
        for (const ring of rings.values()) {
          ring.dispose()
        }
      },
    }
  }, []))
  return <group name='antechamber-oculi'>
    {antechamberOculi.map(({center: [x, z], palette, radius, underside}) => <group key={`${x} ${z} ${underside}`} position={[x - originX, 0, z - originZ]}>
      <mesh castShadow geometry={resources.pane} material={resources.glass[palette]} name='antechamber-oculus-glass' position-y={underside + 0.01} rotation-x={Math.PI / 2} scale={radius} />
      <mesh castShadow geometry={resources.rings.get(radius)} name='antechamber-oculus-ring' position-y={underside} receiveShadow rotation-x={Math.PI / 2}><meshStandardNodeMaterial {...brass} /></mesh>
    </group>)}
  </group>
}
/** how far the handrails stay clear of the doorway at the flight’s foot */
const railClearance = 0.35
/** A handrail along the flight `across` meters right of its center line, 92 cm over its grade, from its head at the landing to just inside the doorway at its foot. */
function handrail(across: number) {
  const {grade, heading: [hx, hz], length, slope, start} = antechamberStairs
  const run = length - railClearance
  const middle = run / 2
  return {
    position: [start[0] + hx * middle - hz * across, start[1] + grade * middle + 0.92, start[2] + hz * middle + hx * across] as [number, number, number],
    rotation: [0, 0, Math.atan(slope)] as [number, number, number],
    size: [Math.hypot(run, grade * run), 0.065, 0.065] as [number, number, number],
  }
}
/** The flight climbing east out of the east wing: its stone treads with brass nosings, the landing at its head, its ceiling and a brass handrail along either wall. */
function Flight({stone}: {stone: Texture}) {
  const {blocks, direction} = antechamberStairs
  const [landingX, landingZ] = antechamberLanding.center
  const [landingWidth, landingDepth] = antechamberLanding.size
  const roof = antechamberStairs.beam(stairHeadroom, antechamberCeilingThickness, antechamberStairs.width)
  const rails = [-1, 1].map(side => handrail(side * (antechamberStairs.width / 2 - 0.22)))
  return <StaticBatch name='antechamber-flight' position={[-originX, 0, -originZ]}>
    {/* StaticBatch hides the originals before automatic colliders would see them, so every part states its collider. */}
    <RigidBody colliders={false} type='fixed'>
      {blocks.map(({position, size}, i) => <group key={i}>
        <CuboidCollider args={[size[0] / 2, size[1] / 2, size[2] / 2]} position={position} />
        <Box color={treadColor} map={stone} name='antechamber-stair-block' position={position} roughness={0.6} size={size} />
      </group>)}
      <CuboidCollider args={[landingWidth / 2, stairThickness / 2, landingDepth / 2]} position={[landingX, antechamberLanding.floorY - stairThickness / 2, landingZ]} />
      <Box color={treadColor} map={stone} name='antechamber-landing' position={[landingX, antechamberLanding.floorY - stairThickness / 2, landingZ]} roughness={0.6} size={[landingWidth, stairThickness, landingDepth]} />
      <CuboidCollider args={[roof.size[0] / 2, roof.size[1] / 2, roof.size[2] / 2]} position={roof.position} rotation={roof.rotation} />
      <Box color={plaster} name='antechamber-flight-ceiling' {...roof} />
      {rails.map((rail, i) => <group key={i}>
        <CuboidCollider args={[rail.size[0] / 2, rail.size[1] / 2, rail.size[2] / 2]} position={rail.position} rotation={rail.rotation} />
        <Box {...brass} name='antechamber-handrail' {...rail} />
      </group>)}
    </RigidBody>
    {/* A brass nosing along the front edge of every tread, over the riser down from it. */}
    {blocks.filter(({top}) => top > antechamberStairs.end[1]).map(({position, size, top}, i) => <Box key={i} {...brass} name='antechamber-stair-nosing' position={[position[0] + direction * (size[0] / 2 - 0.02), top + 0.002, position[2]]} size={[0.04, 0.004, size[2] - 0.21]} />)}
  </StaticBatch>
}
