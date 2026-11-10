import type {Vec3} from '#src/lib/gallery.ts'
import type {AlchemyOrb} from './AlchemyWorks.ts'
import type {Group} from 'three/webgpu'

import {useFrame} from '@react-three/fiber'
import {CapsuleCollider, CuboidCollider, CylinderCollider, RigidBody} from '@react-three/rapier'
import useDisposable from 'disposable-lifetime/react'
import {useEffect, useMemo, useRef, useState} from 'react'
import {color, exp, positionLocal, smoothstep, vec3} from 'three/tsl'
import {Euler, MeshStandardNodeMaterial, Quaternion, Vector3} from 'three/webgpu'

import MeshSurfaceCollider from '#component/MeshSurfaceCollider'
import Orb from '#component/Orb'
import OrbHolder, {useOrbHolder} from '#component/OrbHolder'
import {alchemyCannon, alchemyPipe, alchemySink, holderSpot, machineBody, workbench} from '#src/lib/gallery/alchemy/alchemyMachine.ts'
import CannonGeometry, {trunnionReach} from '#src/lib/gallery/alchemy/CannonGeometry.ts'
import MachineBodyGeometry from '#src/lib/gallery/alchemy/MachineBodyGeometry.ts'
import PipeGeometry, {pipeCenterline} from '#src/lib/gallery/alchemy/PipeGeometry.ts'
import SinkGeometry from '#src/lib/gallery/alchemy/SinkGeometry.ts'
import WorkbenchGeometry from '#src/lib/gallery/alchemy/WorkbenchGeometry.ts'
import {colliderGeometry} from '#src/lib/gallery/architecture.ts'
import BronzeMaterial from '#src/lib/materials/BronzeMaterial.ts'
import BrushedMetalMaterial from '#src/lib/materials/BrushedMetalMaterial.ts'
import HammeredBrassMaterial from '#src/lib/materials/HammeredBrassMaterial.ts'
import {studioEnvironment} from '#src/lib/materials/metal.ts'
import WroughtIronMaterial from '#src/lib/materials/WroughtIronMaterial.ts'

import AlchemyWorks from './AlchemyWorks.ts'
import CannonFx from './CannonFx.ts'

const [benchX, benchZ] = workbench.center
const [sinkX, sinkY, sinkZ] = alchemySink.center
const up = new Vector3(0, 1, 0)
/** The turn from up the y axis onto the direction, as Euler angles. */
const turnOnto = (direction: Vector3) => {
  const turn = new Quaternion
  turn.setFromUnitVectors(up, direction)
  const angles = new Euler
  const {x, y, z} = angles.setFromQuaternion(turn)
  return [x, y, z] as Vec3
}
/** the barrel turned from up its own y axis onto the cannon’s axis */
const barrelTurn = turnOnto(new Vector3(...alchemyCannon.axis))
/** The pipe’s collider: a capsule along every straight piece between the points along its middle, but those inside the body. */
const pipeCapsules = (() => {
  const {points} = pipeCenterline(alchemyPipe.corners, alchemyPipe.bend)
  return points.slice(1).flatMap((point, index) => {
    const from = points[index]
    const along = point.clone().sub(from)
    const length = along.length()
    // The first piece starts inside the body, which has a collider of its own.
    const start = index ? from : from.clone().addScaledVector(along, machineBody.size[0] / 2 / length)
    const half = point.distanceTo(start) / 2
    if (!(half > 0.001)) {
      return []
    }
    return {
      half,
      position: start.clone().add(point).multiplyScalar(0.5).toArray(),
      rotation: turnOnto(along.divideScalar(length)),
    }
  })
})()
/** the part of the barrel behind its trunnions, short of where an orb starts in it, which a collider fills */
const breechBlock = alchemyCannon.breech.map((value, axis) => value + alchemyCannon.axis[axis] * trunnionReach / 2) as Vec3

/**
 * The alchemy machine against the Forge’s south wall: a workbench with the machine’s brass sink let into its east end, and an orb holder on its west end, the machine’s iron body under the sink, and its pipe out of the body, up the wall and into a cannon over the bench, which shoots across the Forge through the arch into the vestibule and through the window there into the Bastion’s cistern.
 * An orb thrown or dropped into the sink rolls down its throat into the body, which works on it for a while, its window glowing, and shoots it out of the cannon, see {@link AlchemyWorks}.
 */
export default function AlchemyMachine() {
  const [orbs, setOrbs] = useState<ReadonlyArray<AlchemyOrb>>([AlchemyWorks.firstOrb])
  const fx = useDisposable(useMemo(() => new CannonFx, []))
  const works = useMemo(() => new AlchemyWorks(orb => setOrbs(current => [...current, orb]), fx), [fx])
  const barrel = useRef<Group>(null)
  const holder = useOrbHolder()
  const parts = useDisposable(useMemo(() => {
    const bench = new WorkbenchGeometry
    const sink = new SinkGeometry
    const body = new MachineBodyGeometry
    const pipe = new PipeGeometry
    const cannon = new CannonGeometry
    return {
      bench,
      sink,
      body,
      pipe,
      cannon,
      topCollision: colliderGeometry(bench.top),
      sinkCollision: colliderGeometry(sink.collision),
      dispose() {
        for (const part of [bench, sink, body, pipe, cannon]) {
          part.dispose()
        }
      },
    }
  }, []))
  const materials = useDisposable(useMemo(() => {
    const steel = new BrushedMetalMaterial({environment: studioEnvironment})
    const brass = new HammeredBrassMaterial
    const iron = new WroughtIronMaterial
    const bronze = new BronzeMaterial({environment: studioEnvironment})
    // The swell running up the barrel as it gathers itself: wider round its axis where it is, but not out along the trunnions
    const {at, size} = fx.swell
    const around = positionLocal.xz.length()
    const swell = exp(positionLocal.y.sub(at).div(0.13).pow(2).negate()).mul(size).mul(smoothstep(0.34, 0.3, around)).add(1)
    bronze.positionNode = positionLocal.mul(vec3(swell, 1, swell))
    // Smoky glass, lit from inside by the work going on behind it
    const window = new MeshStandardNodeMaterial({
      color: '#1d130c',
      roughness: 0.15,
      metalness: 0,
    })
    window.emissiveNode = color('#ff7a26').mul(works.glow)
    return {
      steel,
      brass,
      iron,
      bronze,
      window,
      dispose() {
        for (const material of [steel, brass, iron, bronze, window]) {
          material.dispose()
        }
      },
    }
  }, [fx, works]))
  useEffect(() => works.restock(), [works])
  useFrame((_, delta) => {
    works.update(delta, barrel.current)
  })
  return <group name='alchemy-machine'>
    <RigidBody colliders={false} name='alchemy-machine' type='fixed'>
      <MeshSurfaceCollider args={parts.topCollision} position={[benchX, 0, benchZ]} />
      {parts.bench.colliders.map(({center, size}) => <CuboidCollider key={center.join()} args={[size[0] / 2, size[1] / 2, size[2] / 2]} position={[benchX + center[0], center[1], benchZ + center[2]]} />)}
      <MeshSurfaceCollider args={parts.sinkCollision} position={alchemySink.center} />
      <CuboidCollider args={[machineBody.size[0] / 2, machineBody.size[1] / 2, machineBody.size[2] / 2]} position={[sinkX, machineBody.size[1] / 2, sinkZ]} />
      {pipeCapsules.map(({half, position, rotation}) => <CapsuleCollider key={position.join()} args={[half, alchemyPipe.radius]} position={position} rotation={rotation} />)}
      <CylinderCollider args={[trunnionReach / 2, 0.27]} position={breechBlock} rotation={barrelTurn} />
      <group position={[benchX, 0, benchZ]}>
        <mesh castShadow geometry={parts.bench.top} material={materials.steel} name='alchemy-workbench-top' receiveShadow />
        <mesh castShadow geometry={parts.bench.frame} material={materials.iron} name='alchemy-workbench-frame' receiveShadow />
      </group>
      <mesh castShadow geometry={parts.sink.metal} material={materials.brass} name='alchemy-sink' position={[sinkX, sinkY, sinkZ]} receiveShadow />
      <group position={[sinkX, 0, sinkZ]}>
        <mesh castShadow geometry={parts.body.iron} material={materials.iron} name='alchemy-body' receiveShadow />
        <mesh castShadow geometry={parts.body.brass} material={materials.brass} name='alchemy-body-brass' receiveShadow />
        <mesh geometry={parts.body.glass} material={materials.window} name='alchemy-body-window' />
      </group>
      <mesh castShadow geometry={parts.pipe.pipe} material={materials.brass} name='alchemy-pipe' receiveShadow />
      <mesh castShadow geometry={parts.pipe.brackets} material={materials.iron} name='alchemy-pipe-brackets' receiveShadow />
      <mesh castShadow geometry={parts.cannon.bracket} material={materials.iron} name='alchemy-cannon-bracket' receiveShadow />
      <group position={holderSpot}><OrbHolder {...holder} /></group>
    </RigidBody>
    <group position={alchemyCannon.breech} rotation={barrelTurn} ref={barrel}>
      <mesh castShadow geometry={parts.cannon.barrel} material={materials.bronze} name='alchemy-cannon' receiveShadow />
    </group>
    <primitive object={fx.root} />
    {orbs.map(({id, orb, position, withheld}) => <Orb key={id} id={id} orb={orb} position={position} withheld={withheld} />)}
  </group>
}
