import type {StudioFinish} from '#src/rooms/studio/finishes.ts'
import type {StudioLamp} from '#src/rooms/studio/look.ts'
import type {StudioOpeningsChoice} from '#src/rooms/studio/openings/index.ts'
import type {Vec3} from 'math'
import type {DirectionalLight, Material, PointLight} from 'three/webgpu'

import {useFrame, useThree} from '@react-three/fiber'
import {CuboidCollider, RigidBody} from '@react-three/rapier'
import Branch from 'branch-component'
import useDisposable from 'disposable-lifetime/react'
import hsl from 'okhsl'
import {useEffect, useLayoutEffect, useMemo, useRef, useState} from 'react'
import {MeshBasicNodeMaterial, PlaneGeometry} from 'three/webgpu'
import {useShallow} from 'zustand/react/shallow'

import SandboxMoonlight from '#component/SandboxMoonlight'
import ShadowCaching from '#component/ShadowCaching'
import ShadowPool from '#component/ShadowPool'
import {FloorSlab} from '#component/VarnishedFloor'
import WallSurface from '#src/components/Scene/WallSurface.tsx'
import {sunDirectionFromAngles, sunGeometry, sunlitPoints} from '#src/lib/gallery/sun.ts'
import {environmentSeed} from '#src/lib/gameSeed.ts'
import ArchitecturalPlasterMaterial from '#src/lib/materials/ArchitecturalPlasterMaterial.ts'
import PlanarMirrorMaterial from '#src/lib/materials/PlanarMirrorMaterial.ts'
import {graphicsProfile, isHeavy, renderShadows} from '#src/lib/rendering/graphicsMode.ts'
import {lampLight} from '#src/lib/rendering/lamps.ts'
import {studioTuning} from '#src/lib/worldTuning/StudioTuningModule.ts'
import ceilingGeometry from '#src/rooms/studio/ceilingGeometry.ts'
import {designLook} from '#src/rooms/studio/design.ts'
import {studioFloors, studioWalls} from '#src/rooms/studio/finishes.ts'
import {studioOpenings} from '#src/rooms/studio/openings/index.ts'
import {studioSlab} from '#src/rooms/studio/plan.ts'
import {lampSoftShadow, studioLampIds} from '#src/rooms/studio/Studio.ts'
import sandbox from '#src/worlds/sandbox/studio.ts'

const {mirrorReflections, surfaceAnisotropy} = graphicsProfile
const studio = sandbox.room('studio')
const {room} = studio
const walls = sandbox.walls.filter(wall => wall.room === studio.id)
/** how many times deeper than the room the moon’s shadow frustum reaches: its shafts fade with the depth into it, so a deep one keeps them bright down to the floor */
const shaftReach = 5
/** Where the moon’s light stands, right over the ceiling, so its shafts glow down from the openings, with a shadow frustum round the whole room and far below it, whose walls and ceiling keep the moon out but through the openings. */
const moonGeometry = (toMoon: Vec3) => {
  const geometry = sunGeometry(toMoon, sunlitPoints(sandbox.rooms), {nearest: true})
  return {
    ...geometry,
    shadow: {
      ...geometry.shadow,
      far: geometry.shadow.near + (geometry.shadow.far - geometry.shadow.near) * shaftReach,
    },
  }
}
// Only the materials of the finishes the Studio was built with load, others once the world tuning picks them.
const [initialWalls, initialFloor] = await Promise.all([studioWalls[room.design.walls].load(), studioFloors[room.design.floor].load()])
/** the floor mirror’s own blur, which a design without one of its own keeps */
const ownBlur = new WeakMap<object, number>
/** The Studio: a floor between four walls in finishes of some of the game’s rooms, the Cell’s by default, under a plaster ceiling, nothing else, lit by a faint fill from no visible source, the lamp of the Cell’s chandelier without the chandelier, a secondary lamp and the moon, or a warm sun, falling in shafts through the openings cut in the ceiling, all as its design has them, which follows the world tuning live. */
export default function StudioRoom() {
  const design = studioTuning.useValues()
  const look = useMemo(() => designLook(design), [design])
  const {lightAzimuth, lightElevation} = design
  const moon = useMemo(() => moonGeometry(sunDirectionFromAngles(lightAzimuth, lightElevation)), [lightAzimuth, lightElevation])
  const makeWalls = useFinish(design.walls, studioWalls, [room.design.walls, initialWalls])
  const makeFloor = useFinish(design.floor, studioFloors, [room.design.floor, initialFloor])
  const scene = useThree(state => state.scene)
  const finish = useDisposable(useMemo(() => makeWalls({
    center: studio.center,
    size: studio.size,
    walls,
  }), [makeWalls]))
  const floor = useDisposable(useMemo(() => {
    const made = makeFloor({
      anisotropy: surfaceAnisotropy,
      center: studio.center,
      reflections: mirrorReflections,
      size: studio.size,
    })
    if (made.material instanceof PlanarMirrorMaterial) {
      ownBlur.set(made.material, made.material.reflectionBlur.value)
    }
    return made
  }, [makeFloor]))
  // The design’s mirror over the finish’s.
  const {blur: mirrorBlur, loss: mirrorLoss, strength: mirror} = look.floor
  useEffect(() => {
    if (floor.material instanceof PlanarMirrorMaterial) {
      // eslint-disable-next-line react-hooks/immutability -- the design owns the floor mirror’s uniforms, which change live.
      floor.material.reflectionStrength.value = mirror
      floor.material.reflectionBlur.value = mirrorBlur ?? ownBlur.get(floor.material) ?? floor.material.reflectionBlur.value
      floor.material.reflectionLevel.value = mirrorLoss
    }
  }, [floor, mirror, mirrorBlur, mirrorLoss])
  // The air’s shafts, which the render pipeline reads from the room every frame.
  useEffect(() => {
    room.volumetricSun = design.lightShafts
  }, [design.lightShafts])
  // A moved moon’s shadow frustum, which three only takes up anew once told.
  useLayoutEffect(() => {
    (scene.getObjectByName('moon') as DirectionalLight | undefined)?.shadow.camera.updateProjectionMatrix()
  }, [moon, scene])
  return <group name='studio'>
    <ambientLight intensity={look.fill.ambient} />
    <hemisphereLight color={hsl.integer(258, 100, 93)} groundColor={hsl.integer(72, 20, 48)} intensity={look.fill.hemisphere} />
    <SandboxMoonlight blur={look.moon.blur} color={look.moon.color} geometry={moon} intensity={look.moon.intensity} mapSize={4096} />
    {/* The lamps borrow its slots for their shadows, which only render again once something in their reach moves; both may blur theirs wider than every lamp’s. */}
    <Branch if={renderShadows}><ShadowPool softenable={2} /><ShadowCaching /></Branch>
    <FloorSlab center={studio.center} material={floor.material} name={studio.id} size={studio.size} />
    {walls.map(wall => <WallSurface key={wall.id} material={finish.trim(wall)} surfaceMaterial={finish.surface(wall)} wall={wall} />)}
    <Ceiling surface={finish.ceiling} />
    <TunedLamp id={room.globalId(studioLampIds.primary)} lamp={look.lamps.primary} />
    <TunedLamp id={room.globalId(studioLampIds.secondary)} lamp={look.lamps.secondary} />
  </group>
}

/** What the finish `id` makes, starting with `initial` and keeping the one before while another loads. */
function useFinish<Id extends string, Make>(id: Id, finishes: Record<Id, StudioFinish<Make>>, initial: readonly [Id, Make]) {
  const [loaded, setLoaded] = useState(initial)
  useEffect(() => {
    if (loaded[0] === id) {
      return
    }
    let current = true
    finishes[id].load().then(make => {
      if (current) {
        setLoaded([id, make])
      }
    }).catch(reportError)
    return () => {
      current = false
    }
  }, [finishes, id, loaded])
  return loaded[1]
}
/** how thick the ceiling’s collider is, from the slab’s underside up, so nothing thrown passes through the thin slab between two steps */
const colliderThickness = 0.5
/** The holes of the openings the design names: those the room was built with, others cut through its ceiling, or none. */
const openingHoles = (style: StudioOpeningsChoice, variant: number) => (style === room.openings.style && variant === room.design.variant ? room.openings.holes : studioOpenings(environmentSeed, room.toMoon, style, {
  plan: room.plan,
  variant,
}).holes)
/** The ceiling: a thin slab over the walls, surfaced like them, or else in the tawny plaster of the Cell’s, cut through by the openings, black above them, with a collider from its underside up, which runs on across the openings. */
function Ceiling({surface}: {
  /** what the walls’ finish surfaces it with, if anything */
  surface: Material | undefined
}) {
  const [width, depth] = studio.size
  const {openings, variant} = studioTuning.useValues(useShallow(design => ({
    openings: design.openings,
    variant: design.variant,
  })))
  const slab = useDisposable(useMemo(() => ceilingGeometry({
    height: studio.height,
    holes: openingHoles(openings, variant),
    size: studio.size,
    slab: studioSlab,
  }), [openings, variant]))
  const plaster = useDisposable(useMemo(() => new ArchitecturalPlasterMaterial({
    baseColor: hsl.integer(58, 36, 42),
    heavy: isHeavy,
    roughness: 0.88,
  }), []))
  // Black over the openings, as the renderer clears, but near enough to end the moonlight’s shafts, which would glow on in the lit air over the ceiling; it casts no shadow, so the moon comes through.
  const backdrop = useDisposable(useMemo(() => {
    const plane = new PlaneGeometry(width, depth)
    return plane.rotateX(Math.PI / 2)
  }, [width, depth]))
  const black = useDisposable(useMemo(() => new MeshBasicNodeMaterial({
    color: hsl.integer(0, 0, 0),
    name: 'studio-ceiling-backdrop',
  }), []))
  return <group name='studio-ceiling' position={studio.toWorld([0, 0, 0])}>
    <RigidBody colliders={false} type='fixed'>
      <CuboidCollider args={[width / 2, colliderThickness / 2, depth / 2]} position={[0, studio.height + colliderThickness / 2, 0]} />
    </RigidBody>
    {/* Mounted anew for other openings, so the shadow maps see the slab change. */}
    <mesh key={`${openings}-${variant}`} castShadow geometry={slab} material={surface ?? plaster} name='studio-ceiling-slab' receiveShadow />
    <mesh geometry={backdrop} material={black} name='studio-ceiling-backdrop' position-y={studio.height + studioSlab + 0.02} />
  </group>
}
/**
 * Moves and sets the lamp of the global id as the design has it, which the room built it from, once its light is there and whenever the design changes it.
 * Its levels take a new intensity as its base, and the shadow pool copies its blur every frame.
 */
function TunedLamp({id, lamp}: {
  id: string
  lamp: StudioLamp
}) {
  const applied = useRef('')
  useFrame(() => {
    const light = lampLight(id) as PointLight | undefined
    const key = JSON.stringify(lamp)
    if (!light || applied.current === key) {
      return
    }
    light.position.set(...studio.toWorld(lamp.position))
    light.intensity = lamp.strength
    light.decay = lamp.decay
    light.distance = lamp.range
    light.color.set(lamp.tint)
    const softShadow = lampSoftShadow(lamp.blur)
    if (softShadow) {
      light.userData.softShadow = softShadow
    } else {
      delete light.userData.softShadow
    }
    applied.current = key
  })
  return null
}
