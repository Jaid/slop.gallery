import type {Material, Texture} from 'three/webgpu'

import {RigidBody, TrimeshCollider} from '@react-three/rapier'
import Branch from 'branch-component'
import useDisposable from 'disposable-lifetime/react'
import {useMemo} from 'react'
import {positionWorld, vec3} from 'three/tsl'
import {Color, ExtrudeGeometry, MeshStandardNodeMaterial, Path, Shape} from 'three/webgpu'
import useGraphicsMode, {useGraphicsModeValue} from 'use-graphics-mode'

import IronTable from '#component/IronTable'
import MeshSurfaceCollider from '#component/MeshSurfaceCollider'
import RoomFloor from '#component/RoomFloor'
import {colliderGeometry} from '#src/lib/gallery/architecture.ts'
import {floorThickness} from '#src/lib/gallery/floors.ts'
import {forgeFloor, forgeRowTables, forgeTable, forgeVestibule} from '#src/lib/gallery/forge.ts'
import forgeCeiling, {forgeMonitorSillY} from '#src/lib/gallery/forgeCeiling.ts'
import ForgeCeilingGeometry, {forgeCeilingCollision, ForgePendantsGeometry, ForgePilastersGeometry, forgeVestibuleCupolaCollision, ForgeVestibuleCupolaGeometry} from '#src/lib/gallery/ForgeCeilingGeometry.ts'
import {forgeRoundVestibule, vestibuleArches} from '#src/lib/gallery/forgeVestibule.ts'
import roundRevealGeometry from '#src/lib/gallery/roundRevealGeometry.ts'
import {roundVestibuleFloorShape, vestibuleArchOpening} from '#src/lib/gallery/roundVestibule.ts'
import CrownGlassMaterial from '#src/lib/materials/CrownGlassMaterial.ts'
import ForgeFloorMaterial from '#src/lib/materials/ForgeFloorMaterial.ts'
import ForgeVaultMaterial from '#src/lib/materials/ForgeVaultMaterial.ts'
import HammeredBrassMaterial from '#src/lib/materials/HammeredBrassMaterial.ts'
import VaultGlassMaterial from '#src/lib/materials/VaultGlassMaterial.ts'
import WroughtIronMaterial from '#src/lib/materials/WroughtIronMaterial.ts'
import {daylight} from '#src/lib/rendering/daylight.ts'
import {getGraphicsProfile} from '#src/lib/rendering/graphicsMode.ts'
import AlchemyMachine from '#src/rooms/forge/components/AlchemyMachine/index.tsx'
import slopGallery from '#src/worlds/gallery/index.ts'

const room = slopGallery.room('forge')
const vestibuleWall = slopGallery.walls.find(wall => wall.id === 'forge-vestibule')!
const circleSegments = 96
/**
 * Daylight bounced onto the limewashed foundry roof vaults and vestibule cupola: cool sky light rising toward the clerestory and oculus, plus a warm whisper from the brick walls below.
 * Follows the sun through `daylight`, so presets, moods and turning the sun off still work.
 */
const bounce = daylight.mul(vec3(...new Color('#e6eeff')).mul(positionWorld.y.smoothstep(forgeCeiling.baseY, forgeMonitorSillY).mul(0.11).add(0.11)).add(vec3(...new Color('#ffe7c8')).mul(0.065)))

/**
 * The Forge: a kiln-brick and wrought-iron foundry workshop with honed basalt flagstones, two rows of soapstone tables lit by industrial enamel pendants, the alchemy machine under the south wall’s cannon, a raised clerestory monitor overhead and an 8-ribbed cupola over its round north vestibule.
 */
export default function ForgeRoom({bluestone, glass, masonry, stone, wood}: {
  /** the Forge’s honed dark bluestone, shared with its walls’ baseboards, casings and cornices */
  bluestone: Material
  glass: Material
  /** the Bastion’s stone, which lines the vestibule’s arch onto its approach */
  masonry: Material
  stone: Texture
  wood: Texture
}) {
  const isHeavy = useGraphicsMode()
  const {floorReflections} = useGraphicsModeValue(getGraphicsProfile)
  // Shared foundry architecture materials: warm limewashed roof plaster, blackened wrought iron, hammered brass, aged floor inlay and factory glazing.
  const materials = useDisposable(useMemo(() => {
    const plaster = new ForgeVaultMaterial({
      bounce,
      heavy: isHeavy,
    })
    const iron = new WroughtIronMaterial({
      tone: '#46423d',
      bloomColor: '#66452e',
      metalness: 0.72,
    })
    iron.envMapIntensity = 1.15
    const brass = new HammeredBrassMaterial
    const inlay = new MeshStandardNodeMaterial({
      color: '#aa894c',
      metalness: 0.65,
      roughness: 0.38,
      envMapIntensity: floorReflections ? 1 : 0.35,
    })
    const windowGlass = isHeavy ? new CrownGlassMaterial({
      name: 'forge-clerestory-glass-heavy',
      ior: 1.52,
      absorption: 0.04,
      specularColor: '#fff4e2',
      clearcoat: 0.25,
      envMapIntensity: 1.1,
      paneSize: [1.4, forgeCeiling.monitor.windowHeight],
      bodyColor: '#eef4ef',
      haze: 0.025,
      smudges: 0.04,
      grime: 0.35,
      waviness: 0.0035,
    }) : new VaultGlassMaterial({heavy: false})
    const skylightGlass = new VaultGlassMaterial({
      heavy: isHeavy,
      paneSize: [1.4, 1.3],
    })
    return {
      plaster,
      iron,
      brass,
      inlay,
      windowGlass,
      skylightGlass,
      dispose() {
        for (const material of [plaster, iron, brass, inlay, windowGlass, skylightGlass]) {
          material.dispose()
        }
      },
    }
  }, [floorReflections, isHeavy]))
  const mainFloor = useDisposable(useMemo(() => new ForgeFloorMaterial({
    center: room.center,
    size: room.size,
    inset: forgeFloor.border,
    reflections: floorReflections,
    ...forgeFloor.polish,
  }), [floorReflections]))
  const floorMaterials = useMemo(() => ({
    slab: mainFloor,
    inlay: materials.inlay,
    reflection: mainFloor.reflectionTarget ?? undefined,
  }), [mainFloor, materials.inlay])
  return <group name='forge'>
    <group position={[room.center[0], 0, room.center[1]]}>
      <RoomFloor glass={glass} materials={floorMaterials} room={room} seams={false} stone={stone} wood={wood} />
      <FoundryCeiling bluestone={bluestone} brass={materials.brass} iron={materials.iron} plaster={materials.plaster} skylightGlass={materials.skylightGlass} windowGlass={materials.windowGlass} />
      <FoundryPilasters bluestone={bluestone} brass={materials.brass} iron={materials.iron} />
      <FoundryPendants brass={materials.brass} iron={materials.iron} />
    </group>
    <Vestibule bluestone={bluestone} brass={materials.brass} floorReflections={floorReflections} inlay={materials.inlay} iron={materials.iron} masonry={masonry} plaster={materials.plaster} windowGlass={materials.windowGlass} />
    <AlchemyMachine />
    {forgeRowTables.map(({center: [x, z], name, seed, turn}) => <group key={name} position={[x, 0, z]} rotation-y={turn}>
      <IronTable name={name} seed={seed} table={forgeTable} />
    </group>)}
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
/** The main hall’s sloped limewashed foundry ceiling, open-web parabolic wrought-iron arch trusses and raised gable-ended clerestory monitor. */
function FoundryCeiling({bluestone, brass, iron, plaster, skylightGlass, windowGlass}: {
  bluestone: Material
  brass: Material
  iron: Material
  plaster: Material
  skylightGlass: Material
  windowGlass: Material
}) {
  const geometry = useDisposable(useMemo(() => new ForgeCeilingGeometry(room.size), []))
  const collision = useMemo(() => forgeCeilingCollision(room.size), [])
  return <group name='forge-foundry-ceiling'>
    <RigidBody colliders={false} type='fixed'>
      <MeshSurfaceCollider args={collision} />
    </RigidBody>
    <mesh castShadow geometry={geometry.plaster} material={plaster} name='forge-ceiling' receiveShadow />
    <mesh castShadow geometry={geometry.stone} material={bluestone} name='forge-ceiling-stone' receiveShadow />
    <mesh castShadow geometry={geometry.iron} material={iron} name='forge-ceiling-iron' receiveShadow />
    <mesh castShadow geometry={geometry.brass} material={brass} name='forge-ceiling-brass' receiveShadow />
    {/* Glazing lets the midday sun through cleanly; only the iron rafters, trusses and mullions cast shadows. */}
    <mesh castShadow={false} geometry={geometry.windowGlass} material={windowGlass} name='forge-monitor-windows' />
    <mesh castShadow={false} geometry={geometry.skylightGlass} material={skylightGlass} name='forge-monitor-skylight' />
  </group>
}
/** Engaged bluestone and wrought-iron pilasters dividing the west brick wall under the arch trusses and flanking the east Lobby window. */
function FoundryPilasters({bluestone, brass, iron}: {
  bluestone: Material
  brass: Material
  iron: Material
}) {
  const geometry = useDisposable(useMemo(() => new ForgePilastersGeometry(room.size), []))
  return <group name='forge-pilasters'>
    <mesh castShadow geometry={geometry.stone} material={bluestone} name='forge-pilasters-stone' receiveShadow />
    <mesh castShadow geometry={geometry.iron} material={iron} name='forge-pilasters-iron' receiveShadow />
    <mesh castShadow geometry={geometry.brass} material={brass} name='forge-pilasters-brass' receiveShadow />
  </group>
}
/** A small wrought-iron and brass cupola lantern suspended inside the vestibule’s oculus, matching the `forge-vestibule` lamp. */
function CupolaLantern({brass, iron}: {
  brass: Material
  iron: Material
}) {
  const glow = useDisposable(useMemo(() => new MeshStandardNodeMaterial({
    color: '#ffe0a0',
    emissive: '#ff9b38',
    emissiveIntensity: 0.72,
    roughness: 0.32,
    metalness: 0,
  }), []))
  const cageBars = [0, Math.PI / 2, Math.PI, -Math.PI / 2] as const
  return <group name='forge-vestibule-lantern' position={[0, 5.85, 0]}>
    {/* Downrod rising from the lantern crown to the cupola finial */}
    <mesh material={iron} position={[0, 1.35, 0]}>
      <cylinderGeometry args={[0.018, 0.018, 2.5, 6]} />
    </mesh>
    {/* Wide dark-iron top canopy, brass collar, four wrought-iron cage ribs, dark-iron base ring, turned brass finial and warm frosted glass cylinder */}
    <mesh material={iron} position={[0, 0.25, 0]}>
      <coneGeometry args={[0.29, 0.17, 12]} />
    </mesh>
    <mesh material={brass} position={[0, 0.36, 0]}>
      <cylinderGeometry args={[0.055, 0.075, 0.09, 10]} />
    </mesh>
    <mesh material={iron} position={[0, -0.175, 0]}>
      <cylinderGeometry args={[0.21, 0.14, 0.055, 12]} />
    </mesh>
    <mesh material={brass} position={[0, -0.255, 0]}>
      <sphereGeometry args={[0.052, 8, 6]} />
    </mesh>
    <mesh material={brass} position={[0, -0.34, 0]} rotation={[Math.PI, 0, 0]}>
      <coneGeometry args={[0.036, 0.1, 8]} />
    </mesh>
    {cageBars.map(angle => <mesh key={angle} material={iron} position={[Math.cos(angle) * 0.165, 0.02, Math.sin(angle) * 0.165]}>
      <cylinderGeometry args={[0.017, 0.017, 0.4, 6]} />
    </mesh>)}
    <mesh material={glow} position={[0, 0.02, 0]}>
      <cylinderGeometry args={[0.135, 0.115, 0.34, 12]} />
    </mesh>
  </group>
}
/** Six industrial vitreous-enamel & hammered-brass workshop pendant lamps over the four soapstone tables and flanking the south alchemy workbench. */
function FoundryPendants({brass, iron}: {
  brass: Material
  iron: Material
}) {
  const geometry = useDisposable(useMemo(() => new ForgePendantsGeometry(room.size), []))
  const materials = useDisposable(useMemo(() => {
    const enamel = new MeshStandardNodeMaterial({
      color: '#dfd2b8',
      emissive: '#e89f48',
      emissiveIntensity: 0.22,
      roughness: 0.34,
      metalness: 0,
    })
    const bulb = new MeshStandardNodeMaterial({
      color: '#ffe2a8',
      emissive: '#ff9c38',
      emissiveIntensity: 1.55,
      roughness: 0.2,
      metalness: 0,
    })
    return {
      enamel,
      bulb,
      dispose() {
        enamel.dispose()
        bulb.dispose()
      },
    }
  }, []))
  return <group name='forge-pendants'>
    <mesh castShadow geometry={geometry.iron} material={iron} name='forge-pendants-iron' receiveShadow />
    <mesh castShadow geometry={geometry.brass} material={brass} name='forge-pendants-brass' receiveShadow />
    <mesh geometry={geometry.enamel} material={materials.enamel} name='forge-pendants-enamel' />
    <mesh geometry={geometry.bulb} material={materials.bulb} name='forge-pendants-bulbs' />
  </group>
}
/**
 * The round vestibule north of the room: concentric radial basalt flagstones with a brass ring inlay, bluestone and Bastion-stone arch reveals, and an 8-ribbed wrought-iron cupola with a glazed conical lantern overhead.
 */
function Vestibule({bluestone, brass, floorReflections, inlay, iron, masonry, plaster, windowGlass}: {
  bluestone: Material
  brass: Material
  floorReflections: boolean
  inlay: Material
  iron: Material
  masonry: Material
  plaster: Material
  windowGlass: Material
}) {
  const {center, radius} = forgeVestibule
  const paving = useDisposable(useMemo(() => new ForgeFloorMaterial({
    center,
    radius,
    inset: forgeFloor.border,
    reflections: floorReflections,
    ...forgeFloor.polish,
  }), [center, floorReflections, radius]))
  const cupola = useDisposable(useMemo(() => new ForgeVestibuleCupolaGeometry, []))
  const cupolaCollision = useMemo(() => forgeVestibuleCupolaCollision(), [])
  const linings = {
    forge: bluestone,
    bastion: masonry,
  }
  const parts = useDisposable(useMemo(() => {
    const slab = new ExtrudeGeometry(roundVestibuleFloorShape(forgeRoundVestibule), {
      depth: floorThickness,
      bevelEnabled: false,
      curveSegments: circleSegments,
    })
    slab.rotateX(-Math.PI / 2).translate(0, -floorThickness, 0)
    const brassRing = ring(radius - forgeFloor.border - 0.013, radius - forgeFloor.border + 0.013, 0.012).translate(0, 0.009, 0)
    const reveals = vestibuleArches.map(arch => ({
      name: arch.name,
      geometry: roundRevealGeometry(vestibuleWall, vestibuleWall.holes!.find(hole => hole.name === arch.name)!, vestibuleArchOpening(forgeRoundVestibule, arch)),
    }))
    return {
      slab,
      brassRing,
      reveals,
      floorCollision: colliderGeometry(slab),
      revealCollision: reveals.map(({geometry}) => colliderGeometry(geometry)),
      dispose() {
        for (const geometry of [slab, brassRing, ...reveals.map(reveal => reveal.geometry)]) {
          geometry.dispose()
        }
      },
    }
  }, [radius]))
  const reflection = paving.reflectionTarget
  return <>
    <group name='forge-vestibule' position={[center[0], 0, center[1]]}>
      <RigidBody colliders={false} type='fixed'>
        <TrimeshCollider args={parts.floorCollision} />
        <MeshSurfaceCollider args={cupolaCollision} />
        <mesh geometry={parts.slab} material={paving} name='forge-vestibule-floor' receiveShadow />
        <mesh geometry={parts.brassRing} material={inlay} name='forge-vestibule-inlay' receiveShadow />
      </RigidBody>
      <Branch if={reflection}><group rotation={[-Math.PI / 2, 0, 0]}><primitive object={reflection!} /></group></Branch>
      <mesh castShadow geometry={cupola.plaster} material={plaster} name='forge-vestibule-cupola' receiveShadow />
      <mesh castShadow geometry={cupola.stone} material={bluestone} name='forge-vestibule-cupola-stone' receiveShadow />
      <mesh castShadow geometry={cupola.iron} material={iron} name='forge-vestibule-cupola-iron' receiveShadow />
      <mesh castShadow geometry={cupola.brass} material={brass} name='forge-vestibule-cupola-brass' receiveShadow />
      <mesh castShadow={false} geometry={cupola.glass} material={windowGlass} name='forge-vestibule-cupola-glass' />
      <CupolaLantern brass={brass} iron={iron} />
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
