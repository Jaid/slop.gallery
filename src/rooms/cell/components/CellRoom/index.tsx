import type {ArenaPolish, ArenaSurfaces} from '#component/ArenaShell'
import type {Material} from 'three/webgpu'

import {CuboidCollider, RigidBody, TrimeshCollider} from '@react-three/rapier'
import Branch from 'branch-component'
import useDisposable from 'disposable-lifetime/react'
import {useMemo} from 'react'
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js'
import {ExtrudeGeometry, PlaneGeometry, Shape} from 'three/webgpu'
import {useGraphicsModeValue} from 'use-graphics-mode'

import {useArenaMarble, useArenaSurfaces} from '#component/ArenaShell'
import CeilingLeds from '#component/CeilingLeds'
import Chandelier from '#component/Chandelier'
import ColumnPedestal, {useColumnPedestal} from '#component/ColumnPedestal'
import Orb from '#component/Orb'
import OrbHolder, {useOrbHolder} from '#component/OrbHolder'
import ShadowCaching from '#component/ShadowCaching'
import ShadowPool from '#component/ShadowPool'
import {surfaceTexture} from '#src/components/Scene/materials.ts'
import WallSurface from '#src/components/Scene/WallSurface.tsx'
import {colliderGeometry} from '#src/lib/gallery/architecture.ts'
import {openingCasingFronts, wallFace} from '#src/lib/gallery/architectureDimensions.ts'
import {cellLedY} from '#src/lib/gallery/CellCeilingGeometry.ts'
import {columnPedestalHeight} from '#src/lib/gallery/ColumnPedestalGeometry.ts'
import {orbSeat} from '#src/lib/gallery/OrbHolderGeometry.ts'
import roundRevealGeometry from '#src/lib/gallery/roundRevealGeometry.ts'
import {roundVestibuleFloorShape} from '#src/lib/gallery/roundVestibule.ts'
import {sunGeometry, sunlitPoints} from '#src/lib/gallery/sun.ts'
import {mergeParts} from '#src/lib/geometry.ts'
import DamaskWallpaperMaterial from '#src/lib/materials/DamaskWallpaperMaterial.ts'
import JoineryWoodMaterial from '#src/lib/materials/JoineryWoodMaterial.ts'
import WoodFloorMaterial from '#src/lib/materials/WoodFloorMaterial.ts'
import {getGraphicsProfile, getSunShadowSettings} from '#src/lib/rendering/graphicsMode.ts'
import {getShadowProps} from '#src/lib/rendering/shadowFilterNodes.ts'
import {cellLed} from '#src/rooms/cell/Cell.ts'
import CellCeiling from '#src/rooms/cell/components/CellCeiling/index.tsx'
import CellDoor from '#src/rooms/cell/components/CellDoor/index.tsx'
import CellTurntable from '#src/rooms/cell/components/CellTurntable/index.tsx'
import sandbox from '#src/worlds/sandbox/index.ts'
import {moonDirection, moonlight} from '#src/worlds/sandbox/night.ts'

const cell = sandbox.room('cell')
const {layout} = cell.room
const {chandelierLift, chandelierRod, floorTile, northZ, passage, vestibule} = layout
const [width, depth] = cell.size
const [x, z] = cell.center
const walls = sandbox.walls.filter(wall => wall.room === cell.id)
/** the round wall of the room beyond the north wall, upholstered in the Arena’s velvet */
const roundWall = walls.find(wall => wall.id === cell.room.globalId('vestibule'))
/** the hall’s four walls, papered like the Sienna’s, the velvet of the round room lining the arch through the north one */
const hallWalls = walls.filter(wall => wall !== roundWall)
const northWall = walls.find(wall => wall.id === cell.room.globalId('north'))!
const door = northWall.holes?.find(hole => hole.name === 'door')
const arch = northWall.holes?.find(hole => hole.name === 'vestibule')
/** where a point of the floor plan, relative to the room’s origin, lies in the world */
const worldPoint = ([pointX, pointZ]: readonly [number, number]) => {
  const [worldX, , worldZ] = cell.toWorld([pointX, 0, pointZ])
  return [worldX, worldZ] as const
}
// Whole tiles from the hall’s north-west corner, which the arch through its north wall then opens at a tile’s edge.
const floorOrigin = [x - width / 2, z - depth / 2] as const
/** Polished to a clear mirror of the LED panel, the velvet and the columns. */
const polish: ArenaPolish = {
  strength: 0.4,
  grazingStrength: 0.2,
}
/** The hall’s varnish, glossier than the Vesper’s, so its mirror shows the room more sharply. */
const varnish = {
  roughness: 0.15,
  gaussianBlur: 13,
}
const slabThickness = 0.24
const circleSegments = 96
/** the Banquet’s LED panel in the middle of the vestibule’s ceiling and the lamp under it, which flickers and dies with it */
const led = vestibule && {
  lamps: [{
    id: cell.room.globalId('led'),
    strength: cellLed.strength,
  }],
  slots: [{
    id: 'vestibule',
    position: cell.toWorld([vestibule.center[0], cellLedY(layout.roundHeight), vestibule.center[1]]),
    row: 0,
    slot: 0,
  }],
}
/** how far one repeat of the wood’s texture reaches along x and z, as the Vesper’s floor spreads its 3 × 3 repeats over 12 × 24 m */
const woodRepeat = [4, 8] as const
/**
 * the walnut threshold saddle across the arch through the north wall, over the seam on its center line where the hall’s wood meets the passage’s marble: as deep as the arch’s casing stands out of the wall, between the sides of the opening, its long edges sloping down in an ogee to a crowned top
 */
const threshold = {
  depth: openingCasingFronts.classic - wallFace,
  height: 0.028,
  /** how much higher the middle of its top stands than its edges */
  crown: 0.004,
  /** how far in from either long edge its slopes reach */
  slope: 0.05,
  /** how high its long edges stand over the floor */
  lip: 0.004,
}
/** the top of every floor, a millimeter over its slab, all in one plane, which the floors’ shared mirror reflects the room in */
const floorY = 0.001
/** where the moon’s light stands, right over the Cell’s roof, so its shafts keep their glow down into the room, with a shadow frustum round the whole Cell and its roof */
const moon = sunGeometry(moonDirection, sunlitPoints(sandbox.rooms), {nearest: true})
/** texels along each axis of the moon’s shadow map in heavy graphics, about a centimeter each across the Cell */
const moonShadowMapSize = 2048

/** The Sandbox’s one room: a hall with the Vesper’s varnished wood underfoot, papered like the Sienna under a gabled, coffered ceiling with roof lights and the Sienna’s chandelier, lit besides by the moon through the roof lights and a faint studio fill from no visible source, the work `?turntable` asks for turning in front of its east wall, and beyond its north wall the passage on to the round room with the items on their pedestals, or the door that closes it while there are none. */
export default function CellRoom() {
  const surfaces = useArenaSurfaces()
  // The Sienna’s damask, its baseboards, casings and cornice in one varnished timber, which the ceiling’s beams share.
  const damask = useDisposable(useMemo(() => new DamaskWallpaperMaterial, []))
  const joinery = useDisposable(useMemo(() => new JoineryWoodMaterial({grain: 'x'}), []))
  return <group name='cell'>
    <ambientLight intensity={0.15} />
    <hemisphereLight color='#e1edff' groundColor='#80705d' intensity={0.45} />
    <Moonlight />
    {/* Each chandelier’s lamp borrows one of its slots for its shadow, which only renders again once something in its reach moves. */}
    <ShadowPool />
    <ShadowCaching />
    <HallFloor />
    {hallWalls.map(wall => <WallSurface key={wall.id} material={joinery} plaster={surfaces.plaster} revealMaterial={wall === northWall ? surfaces.velvet : undefined} surfaceMaterial={damask} wall={wall} />)}
    <CellCeiling beams={joinery} />
    <group position={[x, chandelierLift, z]}>
      <Chandelier lamp={cell.room.globalId('chandelier')} rod={chandelierRod} />
    </group>
    <Branch if={door} else={<Vestibule joinery={joinery} surfaces={surfaces} />}><CellDoor hole={door!} surfaces={surfaces} wall={northWall} /></Branch>
    <Branch if={sandbox.turntable}><CellTurntable turntable={sandbox.turntable!} /></Branch>
  </group>
}

/** The moon shining through the roof lights, the roof and walls shadowing the rest of the room, which the render pipeline marches for its shafts in heavy graphics. */
function Moonlight() {
  const profile = useGraphicsModeValue(getGraphicsProfile)
  // Without the roof’s shadow, it would light the whole room.
  if (!profile.shadows) {
    return null
  }
  const settings = getSunShadowSettings(profile, moonShadowMapSize)
  const {bottom, far, left, near, normalBias, right, top} = moon.shadow
  // A new filter needs a new shadow, so the light is built anew.
  return <directionalLight key={settings.samples} castShadow color={moonlight.color} intensity={moonlight.intensity} name='moon' position={moon.position} shadow-camera-bottom={bottom} shadow-camera-far={far} shadow-camera-left={left} shadow-camera-near={near} shadow-camera-right={right} shadow-camera-top={top} shadow-normalBias={normalBias} {...getShadowProps(settings)} />
}
/** The hall’s floor: the Vesper’s varnished wood, mirroring the room through a blur, on a dark slab with its collider. */
function HallFloor() {
  const {floorReflections, surfaceAnisotropy} = useGraphicsModeValue(getGraphicsProfile)
  const wood = useDisposable(useMemo(() => {
    const texture = surfaceTexture('wood', surfaceAnisotropy)
    texture.repeat.set(1 / woodRepeat[0], 1 / woodRepeat[1])
    return texture
  }, [surfaceAnisotropy]))
  const floor = useDisposable(useMemo(() => new WoodFloorMaterial(wood, floorReflections, varnish), [floorReflections, wood]))
  const geometry = useDisposable(useMemo(() => {
    const slab = new RoundedBoxGeometry(width, slabThickness, depth, 2, 0.035)
    const plane = new PlaneGeometry(width, depth)
    // In meters across the world, the grain along z like the Vesper’s; the plane’s y runs along −z once laid flat.
    const position = plane.getAttribute('position')
    const uv = plane.getAttribute('uv')
    for (let index = 0; index < uv.count; index++) {
      uv.setXY(index, x + position.getX(index), position.getY(index) - z)
    }
    return {
      slab,
      plane,
      dispose() {
        slab.dispose()
        plane.dispose()
      },
    }
  }, []))
  const reflection = floor.reflectionTarget
  return <>
    <RigidBody colliders={false} type='fixed'>
      <CuboidCollider args={[width / 2, slabThickness / 2, depth / 2]} position={[x, -slabThickness / 2, z]} />
    </RigidBody>
    <mesh castShadow geometry={geometry.slab} name='cell-floor-slab' position={[x, -slabThickness / 2, z]} receiveShadow>
      <meshStandardNodeMaterial color='#23201d' roughness={0.8} />
    </mesh>
    <mesh geometry={geometry.plane} material={floor} name='cell-wood-floor' position={[x, floorY, z]} receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
      <Branch if={reflection}><primitive object={reflection!} /></Branch>
    </mesh>
  </>
}
/** The round room beyond the north wall and the passage on to it: the Arena’s checkered marble on their floor, level with the hall’s, a walnut board on the threshold of the arch into the hall, the Arena’s velvet on the round wall and on the reveal that lines its arch on through the passage to the north wall’s center line, the Banquet’s LED panel in the middle of the ceiling, and the items on their columns, every orb resting in a holder on its column’s cap. */
function Vestibule({joinery, surfaces}: {
  /** the hall’s walnut, its grain along each mesh’s x axis */
  joinery: Material
  surfaces: ArenaSurfaces
}) {
  // One for every floor in a plane of its own, and the round room’s lies in the hall’s.
  const floor = useArenaMarble(floorOrigin, floorTile, polish)
  const pedestal = useColumnPedestal()
  const holder = useOrbHolder()
  const parts = useDisposable(useMemo(() => {
    const {center, arch: {width: archWidth}} = vestibule!
    const extrude = (shape: Shape) => {
      const geometry = new ExtrudeGeometry(shape, {
        depth: slabThickness,
        bevelEnabled: false,
        curveSegments: circleSegments,
      })
      return geometry.rotateX(-Math.PI / 2)
    }
    const [roundX, roundZ] = worldPoint(center)
    // The passage’s floor, from the north wall’s center line, where the hall’s wood ends, to the plane where the round wall touches it and the round floor’s threshold begins; in the shape’s plane, y runs along −z.
    const lane = new Shape
    lane.moveTo(-archWidth / 2, 0)
    lane.lineTo(archWidth / 2, 0)
    lane.lineTo(archWidth / 2, passage)
    lane.lineTo(-archWidth / 2, passage)
    lane.closePath()
    const [laneX, laneZ] = worldPoint([center[0], northZ])
    const slab = mergeParts([
      extrude(roundVestibuleFloorShape(vestibule!)).translate(roundX, floorY - slabThickness, roundZ),
      extrude(lane).translate(laneX, floorY - slabThickness, laneZ),
    ])
    // The round wall’s arch, lined out through the passage to the north wall’s center line, where the north wall’s own reveal takes over: like every wall, it only lines its opening from there to its face.
    const reveal = roundRevealGeometry(roundWall!, roundWall!.holes!.find(hole => hole.name === 'cell')!, vestibule!.arch, passage).rotateY(roundWall!.rotation).translate(...roundWall!.center)
    // Its section across the seam, extruded along the opening and turned so the extrusion runs along the wall’s x, centered on the seam.
    const {crown, height, lip, slope} = threshold
    const half = threshold.depth / 2
    const section = new Shape
    section.moveTo(-half, 0)
    section.lineTo(-half, lip)
    section.bezierCurveTo(-half + slope * 0.55, lip, -half + slope * 0.45, height, -half + slope, height)
    section.quadraticCurveTo(0, height + crown * 2, half - slope, height)
    section.bezierCurveTo(half - slope * 0.45, height, half - slope * 0.55, lip, half, lip)
    section.lineTo(half, 0)
    section.closePath()
    const saddle = new ExtrudeGeometry(section, {
      depth: arch!.width,
      bevelEnabled: false,
      curveSegments: 12,
    })
    const board = saddle.rotateY(Math.PI / 2).translate(-arch!.width / 2, 0, 0)
    return {
      slab,
      reveal,
      board,
      floorCollision: colliderGeometry(slab),
      revealCollision: colliderGeometry(reveal),
      dispose() {
        for (const geometry of [slab, reveal, board]) {
          geometry.dispose()
        }
      },
    }
  }, []))
  const [vestibuleX, vestibuleZ] = worldPoint(vestibule!.center)
  return <group name='cell-vestibule'>
    <RigidBody colliders={false} type='fixed'>
      <TrimeshCollider args={parts.floorCollision} />
      <TrimeshCollider args={parts.revealCollision} />
    </RigidBody>
    {/* Lying on both floors across the seam where they meet, along the north wall’s center line. */}
    <group position={northWall.center} rotation={[0, northWall.rotation, 0]}>
      <RigidBody colliders={false} type='fixed'>
        <CuboidCollider args={[arch!.width / 2, threshold.height / 2, threshold.depth / 2]} position={[arch!.u, floorY + threshold.height / 2, 0]} />
      </RigidBody>
      <mesh castShadow geometry={parts.board} material={joinery} name='cell-threshold' position={[arch!.u, floorY, 0]} receiveShadow />
    </group>
    <WallSurface material={surfaces.trim} plaster={surfaces.plaster} surfaceMaterial={surfaces.velvet} wall={roundWall!} />
    <mesh geometry={parts.slab} material={floor} name='cell-vestibule-floor' receiveShadow />
    <Branch if={floor.reflectionTarget}><group position={[vestibuleX, floorY, vestibuleZ]} rotation={[-Math.PI / 2, 0, 0]}><primitive object={floor.reflectionTarget!} /></group></Branch>
    <mesh castShadow geometry={parts.reveal} material={surfaces.velvet} name='cell-vestibule-reveal' receiveShadow />
    <CeilingLeds lamps={led!.lamps} name='cell-vestibule' slots={led!.slots} />
    {sandbox.items.map(({id, orb}, index) => {
      const {position, rotation} = layout.pedestals[index]
      const [pedestalX, pedestalZ] = worldPoint(position)
      return <group key={id}>
        <ColumnPedestal {...pedestal} position={[pedestalX, 0, pedestalZ]} rotation={rotation}><OrbHolder {...holder} /></ColumnPedestal>
        {/* Let down onto the holder’s lip from just over it. */}
        <Orb id={id} orb={orb} position={[pedestalX, columnPedestalHeight + orbSeat + 0.002, pedestalZ]} />
      </group>
    })}
  </group>
}
