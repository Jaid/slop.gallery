import {CuboidCollider, RigidBody} from '@react-three/rapier'
import useDisposable from 'disposable-lifetime/react'
import {useMemo} from 'react'
import useGraphicsMode, {useGraphicsModeValue} from 'use-graphics-mode'

import SandboxMoonlight from '#component/SandboxMoonlight'
import ShadowCaching from '#component/ShadowCaching'
import ShadowPool from '#component/ShadowPool'
import {FloorSlab} from '#component/VarnishedFloor'
import WallSurface from '#src/components/Scene/WallSurface.tsx'
import {sunGeometry, sunlitPoints} from '#src/lib/gallery/sun.ts'
import {environmentSeed} from '#src/lib/gameSeed.ts'
import ArchitecturalPlasterMaterial from '#src/lib/materials/ArchitecturalPlasterMaterial.ts'
import ClearGlassMaterial from '#src/lib/materials/ClearGlassMaterial.ts'
import FloorMaterial from '#src/lib/materials/FloorMaterial.ts'
import gold from '#src/lib/materials/gold.ts'
import JoineryWoodMaterial from '#src/lib/materials/JoineryWoodMaterial.ts'
import {getGraphicsProfile} from '#src/lib/rendering/graphicsMode.ts'
import {studioFloorId, studioFloors, studioWallId, studioWalls} from '#src/rooms/studio/finishes.ts'
import {studioSkylightTrim} from '#src/rooms/studio/skylights.ts'
import StudioCeilingGeometry from '#src/rooms/studio/StudioCeilingGeometry.ts'
import sandbox from '#src/worlds/sandbox/studio.ts'

const studio = sandbox.room('studio')
const {look} = studio.room
const walls = sandbox.walls.filter(wall => wall.room === studio.id)
/** where the moon’s light stands, right over the ceiling, so its shafts glow down from the skylights, with a shadow frustum round the whole room, whose walls and ceiling keep the moon out but through the skylights */
const moon = sunGeometry(studio.room.toMoon, sunlitPoints(sandbox.rooms), {nearest: true})
// Only the materials of the finishes this game’s seed picked load.
const [makeWalls, makeFloor] = await Promise.all([studioWalls[studioWallId(environmentSeed)](), studioFloors[studioFloorId(environmentSeed)]()])

/** The Studio: a floor between four walls in the finishes the seed picked of some of the game’s rooms, the Cell’s by default, under a plaster ceiling, nothing else, lit as the seed rolls it by a faint fill from no visible source, the lamp of the Cell’s chandelier without the chandelier and the moon falling in through two round skylights, each glazed in nine panes. */
export default function StudioRoom() {
  const {floorReflections, surfaceAnisotropy} = useGraphicsModeValue(getGraphicsProfile)
  const finish = useDisposable(useMemo(makeWalls, []))
  const floor = useDisposable(useMemo(() => {
    const made = makeFloor({
      anisotropy: surfaceAnisotropy,
      center: studio.center,
      reflections: floorReflections,
      size: studio.size,
    })
    // The seed’s mirror over the finish’s.
    if (made.material instanceof FloorMaterial) {
      made.material.reflectionStrength.value = look.floor.strength
      made.material.reflectionBlur.value = look.floor.blur ?? made.material.reflectionBlur.value
    }
    return made
  }, [floorReflections, surfaceAnisotropy]))
  return <group name='studio'>
    <ambientLight intensity={look.fill.ambient} />
    <hemisphereLight color='#e1edff' groundColor='#80705d' intensity={look.fill.hemisphere} />
    <SandboxMoonlight geometry={moon} intensity={look.moon.intensity} />
    {/* The lamp borrows one of its slots for its shadow, which only renders again once something in its reach moves. */}
    <ShadowPool />
    <ShadowCaching />
    <FloorSlab center={studio.center} material={floor.material} name={studio.id} size={studio.size} />
    {walls.map(wall => <WallSurface key={wall.id} material={finish.trim} surfaceMaterial={finish.surface} wall={wall} />)}
    <Ceiling />
  </group>
}

/** The ceiling: a slab over the walls in the tawny plaster of the Cell’s, pierced by the skylights, each in a walnut casing with a gilt bead and a walnut sash glazed in it with gilt bosses, a gilt ring round it, open to the renderer’s clear black, with a collider under the slab, which runs on across the skylights. */
function Ceiling() {
  const isHeavy = useGraphicsMode()
  const geometry = useDisposable(useMemo(() => new StudioCeilingGeometry(studio.room), []))
  const plaster = useDisposable(useMemo(() => new ArchitecturalPlasterMaterial({
    baseColor: '#7a5a42',
    heavy: isHeavy,
    roughness: 0.88,
  }), [isHeavy]))
  const walnut = useDisposable(useMemo(() => new JoineryWoodMaterial({grain: 'x'}), []))
  const glass = useDisposable(useMemo(() => {
    const material = new ClearGlassMaterial({
      name: 'studio-skylight-glass',
      ior: 1.52,
      absorption: 0.04,
      clearcoat: 0.3,
    })
    // Its depth ends the moonlight’s shafts at the panes, which would glow on in the lit air over the ceiling.
    material.depthWrite = true
    return material
  }, []))
  const [width, depth] = studio.size
  const {slab} = studioSkylightTrim
  return <group name='studio-ceiling' position={studio.toWorld([0, 0, 0])}>
    <RigidBody colliders={false} type='fixed'>
      <CuboidCollider args={[width / 2, slab / 2, depth / 2]} position={[0, studio.height + slab / 2, 0]} />
    </RigidBody>
    <mesh castShadow geometry={geometry.slab} material={plaster} name='studio-ceiling-slab' receiveShadow />
    <mesh castShadow geometry={geometry.casings} material={walnut} name='studio-skylight-casings' receiveShadow />
    <mesh castShadow geometry={geometry.stiles} material={walnut} name='studio-skylight-stiles' receiveShadow rotation={[0, Math.PI / 2, 0]} />
    <mesh castShadow geometry={geometry.gilt} material={gold} name='studio-skylight-gilt' receiveShadow />
    {/* Letting the moon through. */}
    <mesh geometry={geometry.glass} material={glass} name='studio-skylight-glass' />
  </group>
}
