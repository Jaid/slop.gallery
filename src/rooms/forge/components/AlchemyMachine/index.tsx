import type {Vec3} from '#src/lib/gallery.ts'
import type {AlchemyOrb} from './AlchemyWorks.ts'
import type {RapierRigidBody} from '@react-three/rapier'
import type {Group} from 'three/webgpu'

import {useFrame} from '@react-three/fiber'
import {CapsuleCollider, CuboidCollider, CylinderCollider, RigidBody, useAfterPhysicsStep, useRapier, useRevoluteJoint} from '@react-three/rapier'
import useDisposable from 'disposable-lifetime/react'
import hsl from 'okhsl'
import {useEffect, useMemo, useRef, useState} from 'react'
import {color, exp, positionLocal, smoothstep, vec3} from 'three/tsl'
import {Euler, MeshStandardNodeMaterial, Quaternion, Vector3} from 'three/webgpu'

import MeshSurfaceCollider from '#component/MeshSurfaceCollider'
import Orb from '#component/Orb'
import OrbHolder, {useOrbHolder} from '#component/OrbHolder'
import {environmentRandom} from '#src/lib/environmentSeed.ts'
import {alchemyCannon, alchemyPipe, alchemySink, holderSpot, machineBody, workbench, workbenchPivot, workbenchYawLimit} from '#src/lib/gallery/alchemy/alchemyMachine.ts'
import CannonGeometry, {trunnionReach} from '#src/lib/gallery/alchemy/CannonGeometry.ts'
import kickWorkbench from '#src/lib/gallery/alchemy/kickWorkbench.ts'
import MachineBodyGeometry from '#src/lib/gallery/alchemy/MachineBodyGeometry.ts'
import PipeGeometry, {pipeCenterline} from '#src/lib/gallery/alchemy/PipeGeometry.ts'
import SinkGeometry from '#src/lib/gallery/alchemy/SinkGeometry.ts'
import WorkbenchGeometry from '#src/lib/gallery/alchemy/WorkbenchGeometry.ts'
import {colliderGeometry} from '#src/lib/gallery/architecture.ts'
import {ironTableColliders, ironTableFinish, ironTableSlabMass} from '#src/lib/gallery/ironTable.ts'
import {environmentSeed} from '#src/lib/gameSeed.ts'
import BronzeMaterial from '#src/lib/materials/BronzeMaterial.ts'
import HammeredBrassMaterial from '#src/lib/materials/HammeredBrassMaterial.ts'
import {studioEnvironment} from '#src/lib/materials/metal.ts'
import SoapstoneMaterial from '#src/lib/materials/SoapstoneMaterial.ts'
import WroughtIronMaterial from '#src/lib/materials/WroughtIronMaterial.ts'

import AlchemyWorks from './AlchemyWorks.ts'
import CannonFx from './CannonFx.ts'

const [benchX, benchZ] = workbench.center
const [bodyX, bodyZ] = machineBody.center
/** the bench’s frame of iron, its slab having a collider of its own round the sink’s hole */
const benchColliders = ironTableColliders(workbench, 'alchemy-workbench', {top: false})
const up = new Vector3(0, 1, 0)
const benchYaw = environmentSeed ? environmentRandom(environmentSeed).makeChild(['forge', 'workbench-yaw']).rollRadius(workbenchYawLimit) : 0
/** Place the rotated bench so its local pivot still meets the fixed sink. */
const benchOrigin = (() => {
  const sink = new Vector3(...alchemySink.center)
  const pivot = new Vector3(...workbenchPivot)
  return sink.sub(pivot.applyAxisAngle(up, benchYaw)).toArray()
})()
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
/** The pipe’s collider: a capsule along each piece from the body’s outlet to the cannon. */
const pipeCapsules = (() => {
  const {points} = pipeCenterline(alchemyPipe.corners, alchemyPipe.bend)
  return points.slice(1).flatMap((point, index) => {
    const from = points[index]
    const along = point.clone().sub(from)
    const length = along.length()
    const half = length / 2
    if (!(half > 0.001)) {
      return []
    }
    return {
      half,
      position: from.clone().add(point).multiplyScalar(0.5).toArray(),
      rotation: turnOnto(along.divideScalar(length)),
    }
  })
})()
/** the part of the barrel behind its trunnions, short of where an orb starts in it, which a collider fills */
const breechBlock = alchemyCannon.breech.map((value, axis) => value + alchemyCannon.axis[axis] * trunnionReach / 2) as Vec3

/**
 * The alchemy workbench against the Forge’s south wall: its sink on the left feeds the centered chest through a sloping brass pipe. The rear pipe rises into the cannon; the orb holder stands on the right.
 * An orb thrown or dropped into the sink rolls down its throat into the body, which works on it for a while, its window glowing, and shoots it out of the cannon, see {@link AlchemyWorks}.
 */
export default function AlchemyMachine() {
  const [orbs, setOrbs] = useState<ReadonlyArray<AlchemyOrb>>([])
  const fx = useDisposable(useMemo(() => new CannonFx, []))
  const {world} = useRapier()
  const works = useMemo(() => new AlchemyWorks(orb => setOrbs(current => [...current, orb]), fx), [fx])
  const barrel = useRef<Group>(null)
  const chest = useRef<Group>(null)
  const holderBase = useRef<Group>(null!)
  const machine = useRef<RapierRigidBody>(null!)
  const table = useRef<RapierRigidBody>(null!)
  const shotKicks = useMemo(() => environmentRandom(environmentSeed).makeChild(['forge', 'workbench-kick']), [])
  const hinge = useRevoluteJoint(machine, table, [alchemySink.center, workbenchPivot, [0, 1, 0]])
  useEffect(() => {
    // Rapier 0.21 only applies revolute limits on the live joint. The joint itself models the fit at the rim.
    hinge.current?.setLimits(-workbenchYawLimit, workbenchYawLimit)
    hinge.current?.setContactsEnabled(false)
  }, [hinge])
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
    const stone = new SoapstoneMaterial({seed: 4391})
    const brass = new HammeredBrassMaterial
    const iron = new WroughtIronMaterial
    const benchIron = new WroughtIronMaterial(ironTableFinish)
    const bronze = new BronzeMaterial({environment: studioEnvironment})
    // the swell running up the barrel as it gathers itself: wider round its axis where it is, but not out along the trunnions
    const {at, size} = fx.swell
    const around = positionLocal.xz.length()
    const swell = exp(positionLocal.y.sub(at).div(0.13).pow(2).negate()).mul(size).mul(smoothstep(0.34, 0.3, around)).add(1)
    bronze.positionNode = positionLocal.mul(vec3(swell, 1, swell))
    // smoky glass, lit from inside by the work going on behind it
    const window = new MeshStandardNodeMaterial({
      color: hsl.integer(56, 32, 10),
      roughness: 0.15,
      metalness: 0,
    })
    window.emissiveNode = color(hsl.integer(47.5, 100, 68)).mul(works.glow)
    return {
      stone,
      brass,
      iron,
      benchIron,
      bronze,
      window,
      dispose() {
        for (const material of [stone, brass, iron, benchIron, bronze, window]) {
          material.dispose()
        }
      },
    }
  }, [fx, works]))
  useEffect(() => {
    const base = holderBase.current
    const first = AlchemyWorks.holderOrb(base, 1)
    setOrbs(current => (current.length ? current : [first]))
    return works.restock(base)
  }, [works])
  useAfterPhysicsStep(() => works.takeIn())
  useFrame((_, delta) => {
    if (works.update(delta, barrel.current, chest.current)) {
      kickWorkbench(world, table.current, shotKicks.next().rollRadius(1))
    }
  })
  return <group name='alchemy-machine'>
    <RigidBody angularDamping={3} colliders={false} friction={0.65} name='alchemy-workbench' position={benchOrigin} rotation={[0, benchYaw, 0]} type='dynamic' ref={table}>
      <MeshSurfaceCollider args={parts.topCollision} mass={ironTableSlabMass} />
      {benchColliders.map(({center, mass, name, size}, index) => <CuboidCollider key={index} args={[size[0] / 2, size[1] / 2, size[2] / 2]} mass={mass} name={name} position={center} />)}
      <mesh castShadow geometry={parts.bench.top} material={materials.stone} name='alchemy-workbench-top' receiveShadow />
      <mesh castShadow geometry={parts.bench.frame} material={materials.benchIron} name='alchemy-workbench-frame' receiveShadow />
      <group position={[holderSpot[0] - benchX, holderSpot[1], holderSpot[2] - benchZ]} ref={holderBase}><OrbHolder {...holder} /></group>
    </RigidBody>
    <RigidBody colliders={false} name='alchemy-machine' type='fixed' ref={machine}>
      <MeshSurfaceCollider args={parts.sinkCollision} position={alchemySink.center} />
      <CuboidCollider args={[machineBody.size[0] / 2, machineBody.size[1] / 2, machineBody.size[2] / 2]} position={[bodyX, machineBody.size[1] / 2, bodyZ]} />
      {pipeCapsules.map(({half, position, rotation}) => <CapsuleCollider key={position.join()} args={[half, alchemyPipe.radius]} position={position} rotation={rotation} />)}
      <CylinderCollider args={[trunnionReach / 2, 0.27]} position={breechBlock} rotation={barrelTurn} />
      <mesh castShadow geometry={parts.sink.metal} material={materials.brass} name='alchemy-sink' position={alchemySink.center} receiveShadow />
      <group position={[bodyX, 0, bodyZ]} ref={chest}>
        <mesh castShadow geometry={parts.body.iron} material={materials.iron} name='alchemy-body' receiveShadow />
        <mesh castShadow geometry={parts.body.brass} material={materials.brass} name='alchemy-body-brass' receiveShadow />
        <mesh geometry={parts.body.glass} material={materials.window} name='alchemy-body-window' />
      </group>
      <mesh castShadow geometry={parts.pipe.pipe} material={materials.brass} name='alchemy-pipe' receiveShadow />
      <mesh castShadow geometry={parts.pipe.brackets} material={materials.iron} name='alchemy-pipe-brackets' receiveShadow />
      <mesh castShadow geometry={parts.cannon.bracket} material={materials.iron} name='alchemy-cannon-bracket' receiveShadow />
    </RigidBody>
    <group position={alchemyCannon.breech} rotation={barrelTurn} ref={barrel}>
      <mesh castShadow geometry={parts.cannon.barrel} material={materials.bronze} name='alchemy-cannon' receiveShadow />
    </group>
    <primitive object={fx.root} />
    {orbs.map(({id, orb, position, withheld}) => <Orb key={id} id={id} orb={orb} position={position} withheld={withheld} />)}
  </group>
}
