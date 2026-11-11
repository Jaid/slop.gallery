import type {Rooflight as RooflightLayout} from '#src/lib/gallery/forge.ts'
import type {Material, Texture} from 'three/webgpu'

import {CuboidCollider, CylinderCollider, RigidBody, TrimeshCollider} from '@react-three/rapier'
import useDisposable from 'disposable-lifetime/react'
import {useMemo} from 'react'
import {CircleGeometry, ExtrudeGeometry, MeshStandardNodeMaterial, Path, Shape} from 'three/webgpu'
import useGraphicsMode, {useGraphicsModeValue} from 'use-graphics-mode'

import ForgeTable from '#component/ForgeTable'
import RoomFloor from '#component/RoomFloor'
import Box from '#src/components/Scene/primitives.tsx'
import StaticBatch from '#src/components/Scene/StaticBatch.tsx'
import {colliderGeometry} from '#src/lib/gallery/architecture.ts'
import {floorThickness} from '#src/lib/gallery/floors.ts'
import {forgeRooflight, forgeTable, forgeTableCenter, forgeVestibule} from '#src/lib/gallery/forge.ts'
import {forgeRoundVestibule, vestibuleArches} from '#src/lib/gallery/forgeVestibule.ts'
import roundRevealGeometry from '#src/lib/gallery/roundRevealGeometry.ts'
import {roundVestibuleFloorShape, vestibuleArchOpening} from '#src/lib/gallery/roundVestibule.ts'
import {salonCeiling} from '#src/lib/gallery/salon.ts'
import gold from '#src/lib/materials/gold.ts'
import VaultGlassMaterial from '#src/lib/materials/VaultGlassMaterial.ts'
import {getGraphicsProfile} from '#src/lib/rendering/graphicsMode.ts'
import AlchemyMachine from '#src/rooms/forge/components/AlchemyMachine/index.tsx'
import slopGallery from '#src/worlds/gallery/index.ts'

const room = slopGallery.room('forge')
const vestibuleWall = slopGallery.walls.find(wall => wall.id === 'forge-vestibule')!
const circleSegments = 96
/** how far in from the vestibule’s wall its brass ring lies, on the line of the room’s inlays */
const vestibuleInlay = 1.25

/** The Forge: a workshop with plain walls and floors for now, under a plaster ceiling pierced by a round rooflight, with the alchemy machine against its south wall, whose cannon shoots orbs across it into its round vestibule north of it, alike on a smaller scale, and on through the window in its north wall into the Bastion’s cistern, and a painter’s table against its west wall. */
export default function ForgeRoom({glass, masonry, stone, wood}: {
  glass: Material
  /** the Bastion’s stone, which lines the vestibule’s arch onto its approach */
  masonry: Material
  stone: Texture
  wood: Texture
}) {
  const plaster = useDisposable(useMemo(() => new MeshStandardNodeMaterial({
    color: '#e6decb',
    roughness: 0.9,
  }), []))
  const {floorReflections} = useGraphicsModeValue(getGraphicsProfile)
  const ceiling = useDisposable(useMemo(() => {
    const [width, depth] = room.size
    const outline = new Shape
    outline.moveTo(-width / 2, -depth / 2)
    outline.lineTo(width / 2, -depth / 2)
    outline.lineTo(width / 2, depth / 2)
    outline.lineTo(-width / 2, depth / 2)
    outline.closePath()
    return pierced(outline, forgeRooflight.radius)
  }, []))
  return <group name='forge'>
    <group position={[room.center[0], 0, room.center[1]]}>
      <RigidBody colliders={false} type='fixed'>
        <CuboidCollider args={[room.size[0] / 2, 0.15, room.size[1] / 2]} position={[0, 5.9, 0]} />
      </RigidBody>
      <RoomFloor glass={glass} room={room} stone={stone} wood={wood} />
      <mesh castShadow geometry={ceiling} material={plaster} name='forge-ceiling' receiveShadow />
      <Rooflight gilt={gold} layout={forgeRooflight} name='forge-rooflight' plaster={plaster} />
    </group>
    <Vestibule floorReflections={floorReflections} masonry={masonry} plaster={plaster} />
    <AlchemyMachine />
    <group position={[forgeTableCenter[0], 0, forgeTableCenter[1]]}>
      <ForgeTable name='forge-table' table={forgeTable} />
    </group>
  </group>
}

/** A flat ring lying in the x/z plane with its underside at y = 0, from `inner` to `outer` radius, `depth` thick. */
function ring(inner: number, outer: number, depth: number) {
  const shape = new Shape
  shape.absarc(0, 0, outer, 0, Math.PI * 2, false)
  const hole = new Path
  hole.absarc(0, 0, inner, 0, Math.PI * 2, true)
  shape.holes.push(hole)
  const geometry = new ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: false,
    curveSegments: circleSegments,
  })
  return geometry.rotateX(-Math.PI / 2)
}
/** The ceiling slab over a floor plan, given as a shape in x and −z, cut round the opening of a rooflight in its middle. */
function pierced(outline: Shape, radius: number) {
  const hole = new Path
  hole.absarc(0, 0, radius, 0, Math.PI * 2, true)
  outline.holes.push(hole)
  const slab = new ExtrudeGeometry(outline, {
    depth: salonCeiling.thickness,
    bevelEnabled: false,
    curveSegments: circleSegments,
  })
  return slab.rotateX(-Math.PI / 2).translate(0, salonCeiling.y - salonCeiling.thickness / 2, 0)
}
/** The ring of plaster round a rooflight’s opening, hanging below the slab with a gilt bead along its lower inner edge, the glazing bars in a square grid and the disc of cast glass over them. */
function Rooflight({gilt, layout, name, plaster}: {
  gilt: Material
  layout: RooflightLayout
  name: string
  plaster: Material
}) {
  const {barDepth, barWidth, bead, depth, frame, glassY, pane, radius} = layout
  const isHeavy = useGraphicsMode()
  // Painted cast iron, as old rooflight glazing bars are.
  const ironwork = useDisposable(useMemo(() => new MeshStandardNodeMaterial({
    color: '#4c463c',
    metalness: 0.2,
    roughness: 0.7,
  }), []))
  // The Lobby vault’s cast glass, divided into the same panes as the bars below it.
  const glass = useDisposable(useMemo(() => new VaultGlassMaterial({
    heavy: isHeavy,
    paneSize: [pane, pane],
  }), [isHeavy, pane]))
  const frameGeometry = useDisposable(useMemo(() => ring(radius, radius + frame, depth), [depth, frame, radius]))
  const beadGeometry = useDisposable(useMemo(() => ring(radius - bead, radius + bead, bead), [bead, radius]))
  // Metric UVs from the disc’s south-west corner, so the glass’s panes line up with the bars.
  const glassGeometry = useDisposable(useMemo(() => {
    const disc = new CircleGeometry(radius, circleSegments)
    const uv = disc.getAttribute('uv')
    for (let i = 0; i < uv.count; i++) {
      uv.setXY(i, uv.getX(i) * radius * 2, uv.getY(i) * radius * 2)
    }
    return disc
  }, [radius]))
  const barY = glassY - 0.005 - barDepth / 2
  // The bars on the joints between the panes, laid across the disc from edge to edge, each as long as its chord.
  const bars = Array.from({length: Math.round(radius * 2 / pane) - 1}, (_, i) => -radius + (i + 1) * pane).map(offset => ({
    offset,
    length: 2 * Math.sqrt(radius ** 2 - offset ** 2),
  }))
  return <StaticBatch name={name}>
    <mesh castShadow geometry={frameGeometry} material={plaster} name={`${name}-frame`} position={[0, salonCeiling.underside - depth, 0]} receiveShadow />
    <mesh castShadow geometry={beadGeometry} material={gilt} name={`${name}-bead`} position={[0, salonCeiling.underside - depth - bead, 0]} receiveShadow />
    {bars.map(({offset, length}) => <Box key={`x${offset}`} material={ironwork} position={[offset, barY, 0]} size={[barWidth, barDepth, length]} />)}
    {bars.map(({offset, length}) => <Box key={`z${offset}`} material={ironwork} position={[0, barY, offset]} size={[length, barDepth, barWidth]} />)}
    <mesh geometry={glassGeometry} material={glass} name={`${name}-glass`} position={[0, glassY, 0]} rotation={[Math.PI / 2, 0, 0]} />
  </StaticBatch>
}
/**
 * The round vestibule north of the room: its floor, out under its arches, with a brass ring like the room’s inlays, its ceiling and rooflight like the room’s, and the reveals that line its arches out to the planes touching its wall there:
 * plaster through to the room’s north wall, and the Bastion’s stone on from the end of its approach.
 */
function Vestibule({floorReflections, masonry, plaster}: {
  floorReflections: boolean
  masonry: Material
  plaster: Material
}) {
  const {center, radius, rooflight} = forgeVestibule
  // Plain stone and plaster, like the room’s floor and walls.
  const paving = useDisposable(useMemo(() => new MeshStandardNodeMaterial({
    color: '#f3eddf',
    envMapIntensity: floorReflections ? 1 : 0,
    roughness: floorReflections ? 0.36 : 0.8,
  }), [floorReflections]))
  const lining = useDisposable(useMemo(() => new MeshStandardNodeMaterial({
    color: '#eee7d7',
    roughness: 0.9,
  }), []))
  const brass = useDisposable(useMemo(() => new MeshStandardNodeMaterial({
    color: '#9d8354',
    metalness: 0.45,
    envMapIntensity: floorReflections ? 1 : 0,
  }), [floorReflections]))
  const linings = {
    forge: lining,
    bastion: masonry,
  }
  const parts = useDisposable(useMemo(() => {
    const slab = new ExtrudeGeometry(roundVestibuleFloorShape(forgeRoundVestibule), {
      depth: floorThickness,
      bevelEnabled: false,
      curveSegments: circleSegments,
    })
    slab.rotateX(-Math.PI / 2).translate(0, -floorThickness, 0)
    const inlay = ring(radius - vestibuleInlay - 0.013, radius - vestibuleInlay + 0.013, 0.012).translate(0, 0.009, 0)
    const reveals = vestibuleArches.map(arch => ({
      name: arch.name,
      geometry: roundRevealGeometry(vestibuleWall, vestibuleWall.holes!.find(hole => hole.name === arch.name)!, vestibuleArchOpening(forgeRoundVestibule, arch)),
    }))
    const outline = new Shape
    outline.absarc(0, 0, radius, 0, Math.PI * 2, false)
    const ceiling = pierced(outline, rooflight.radius)
    return {
      slab,
      inlay,
      reveals,
      ceiling,
      floorCollision: colliderGeometry(slab),
      revealCollision: reveals.map(({geometry}) => colliderGeometry(geometry)),
      dispose() {
        for (const geometry of [slab, inlay, ceiling, ...reveals.map(reveal => reveal.geometry)]) {
          geometry.dispose()
        }
      },
    }
  }, [radius, rooflight]))
  return <>
    <group name='forge-vestibule' position={[center[0], 0, center[1]]}>
      <RigidBody colliders={false} type='fixed'>
        <TrimeshCollider args={parts.floorCollision} />
        <CylinderCollider args={[0.15, radius]} position={[0, 5.9, 0]} />
        <mesh geometry={parts.slab} material={paving} name='forge-vestibule-floor' receiveShadow />
        <mesh geometry={parts.inlay} material={brass} name='forge-vestibule-inlay' receiveShadow />
      </RigidBody>
      <mesh castShadow geometry={parts.ceiling} material={plaster} name='forge-vestibule-ceiling' receiveShadow />
      <Rooflight gilt={gold} layout={rooflight} name='forge-vestibule-rooflight' plaster={plaster} />
    </group>
    {/* In the round wall’s own frame, as the reveals are built, where its paint knows which way its face looks. */}
    <group name='forge-vestibule-reveals' position={vestibuleWall.center} rotation={[0, vestibuleWall.rotation, 0]}>
      <RigidBody colliders={false} type='fixed'>
        {parts.revealCollision.map((args, i) => <TrimeshCollider key={i} args={args} />)}
        {parts.reveals.map(({name, geometry}) => <mesh key={name} castShadow geometry={geometry} material={linings[name]} name={`forge-vestibule-reveal_${name}`} receiveShadow />)}
      </RigidBody>
    </group>
  </>
}
