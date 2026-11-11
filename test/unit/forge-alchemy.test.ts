import type {Vec3} from '../../src/lib/gallery/types.ts'
import type {Orb} from '../../src/orbs/index.ts'

import {afterAll, describe, expect, test} from 'bun:test'

import RAPIER from '@dimforge/rapier3d-compat'
import EgoMotor, {defaultEgoOptions} from 'ego-player/motor'
import {mulberry32} from 'math/random'
import {Mesh, MeshBasicMaterial, Object3D, Quaternion, Raycaster, Vector3} from 'three/webgpu'

import {alchemyCannon, alchemyPipe, alchemySink, cannonFlight, cannonLaunch, cannonTarget, holderSpot, inSinkThroat, machineBody, southWallFace, flight as stepsFrom, workbench} from '../../src/lib/gallery/alchemy/alchemyMachine.ts'
import CannonGeometry from '../../src/lib/gallery/alchemy/CannonGeometry.ts'
import {flavorCandidates, flavoredOrb, orbAround, transmutedOrb} from '../../src/lib/gallery/alchemy/flavor.ts'
import MachineBodyGeometry from '../../src/lib/gallery/alchemy/MachineBodyGeometry.ts'
import PipeGeometry from '../../src/lib/gallery/alchemy/PipeGeometry.ts'
import SinkGeometry from '../../src/lib/gallery/alchemy/SinkGeometry.ts'
import WorkbenchGeometry from '../../src/lib/gallery/alchemy/WorkbenchGeometry.ts'
import {colliderGeometry, createArchitectureGeometry, wallFace} from '../../src/lib/gallery/architecture.ts'
import {bastionCrater} from '../../src/lib/gallery/bastion.ts'
import {bastionLinkGate} from '../../src/lib/gallery/bastionNetwork.ts'
import {cistern, cisternChannel, cisternDomeHeight, cisternFloorHeight, cisternInflow, cisternShotLanding} from '../../src/lib/gallery/cistern/cistern.ts'
import CisternGeometry from '../../src/lib/gallery/cistern/CisternGeometry.ts'
import InflowGeometry from '../../src/lib/gallery/cistern/InflowGeometry.ts'
import {cisternWindow} from '../../src/lib/gallery/cistern/window.ts'
import {climbApproach, climbCulvert, climbRun} from '../../src/lib/gallery/climb.ts'
import {hatchet, helmet, paintingSet, pumpkin} from '../../src/lib/gallery/curios/index.ts'
import forge, {forgeRooflight, forgeVestibule} from '../../src/lib/gallery/forge.ts'
import {orbSeat} from '../../src/lib/gallery/OrbHolderGeometry.ts'
import {salonCeiling} from '../../src/lib/gallery/salon.ts'
import {weldedSurfaceSkin} from '../../src/lib/physics/weldedSurface.ts'
import {insideOpening, wallCoordinates, wallPosition} from '../../src/lib/placement/wallGeometry.ts'
import {halloweenOrb, horrorOrb, orbRadius, paintOrb, spookOrb, transparentOrb} from '../../src/orbs/index.ts'
import {partyEffects} from '../../src/party_effects/index.ts'
import {bastionBaseboard} from '../../src/rooms/bastion/walls.ts'
import CannonFx, {charging} from '../../src/rooms/forge/components/AlchemyMachine/CannonFx.ts'
import slopGallery from '../../src/worlds/gallery/index.ts'
import {openings} from '../../src/worlds/gallery/relations.ts'
import walls, {floorHeight, insideGallery} from './fixtures/gallery.ts'
import {addOrb, forgeAndBastionColliders, physicsWorld} from './helpers/bastionWorld.ts'

await RAPIER.init()
const bench = new WorkbenchGeometry
const sink = new SinkGeometry
afterAll(() => {
  for (const geometry of [bench, sink]) {
    geometry.dispose()
  }
})
const wallById = (id: string) => walls.find(wall => wall.id === id)!
const [benchX, benchZ] = workbench.center
const [sinkX, sinkY, sinkZ] = alchemySink.center
const northZ = forge.center[1] - forge.size[1] / 2
const roomAt = (position: Vec3) => slopGallery.roomAt(position)?.id
/** where the orb is after every step before it passes the face of the cistern’s wall behind the window */
const flight = cannonFlight.points
/** Where the orb’s middle is as it crosses the plane `z`, between the steps on either side of it, flying on freely past where `flight` ends. */
const crossing = (z: number) => {
  let previous = cannonLaunch.position
  for (const point of stepsFrom(cannonLaunch.position, cannonLaunch.velocity)) {
    if (point[2] <= z) {
      const share = (previous[2] - z) / (previous[2] - point[2])
      return previous.map((value, axis) => value + (point[axis] - value) * share) as Vec3
    }
    previous = point
  }
  throw new Error('An orb flies on forever.')
}
/** How far out from the point in plan along the direction the face of the cistern’s round wall lies. */
const wallAhead = ([x, z]: readonly [number, number], [dx, dz]: readonly [number, number]) => {
  const [ox, oz] = [x - cistern.center[0], z - cistern.center[1]]
  const along = ox * dx + oz * dz
  return -along + Math.sqrt(along ** 2 - (ox ** 2 + oz ** 2 - (cistern.radius - wallFace) ** 2))
}
describe('the Forge’s alchemy machine', () => {
  test('stands against the middle of the south wall: its bench on the room’s axis, its sink in the bench’s east end and its body under the sink, between the legs', () => {
    expect(benchX).toBe(forge.center[0])
    expect(southWallFace - (benchZ + workbench.depth / 2)).toBeCloseTo(0.05, 9)
    expect(roomAt([benchX, 1, benchZ])).toBe('forge')
    // Left of the bench’s middle, seen from the room, with room for the flange and the aprons round it
    expect(sinkX).toBeGreaterThan(benchX)
    expect(benchX + workbench.length / 2 - (sinkX + alchemySink.radius)).toBeGreaterThan(0.1)
    expect(workbench.depth / 2 - workbench.overhang - workbench.apron[1] - (alchemySink.radius + alchemySink.thickness)).toBeGreaterThan(0.01)
    expect(sinkY).toBe(workbench.height)
    // An orb drops through the throat with room to spare, into the body under it.
    expect(alchemySink.throat - orbRadius - weldedSurfaceSkin).toBeGreaterThan(0.015)
    expect(alchemySink.throatY).toBeGreaterThan(machineBody.size[1] + orbRadius)
    expect(machineBody.center).toEqual([sinkX, benchZ])
    const legInside = workbench.length / 2 - workbench.overhang - workbench.leg
    expect(sinkX + machineBody.size[0] / 2 - benchX).toBeLessThan(legInside)
    expect(machineBody.size[2] / 2).toBeLessThan(workbench.depth / 2 - workbench.overhang - workbench.leg)
    // The holder stands right of the bench’s middle, on its top, an orb’s width clear of the cannon’s bracket over it.
    expect(holderSpot[0]).toBeLessThan(benchX - 0.4)
    expect(holderSpot[1]).toBe(workbench.height)
    // Redesigned to be larger and clear the room baseboard
    expect(workbench.length).toBeGreaterThan(2.8)
    expect(workbench.depth).toBeGreaterThan(1.1)
    expect(southWallFace - (benchZ + workbench.depth / 2 - workbench.rearOverhang)).toBeGreaterThan(0.145)
  })
  test('the bench’s top lies flush round the hole the sink fills, which an orb dropped there falls through and anything set down beside it stands on', () => {
    bench.top.computeBoundingBox()
    expect(bench.top.boundingBox!.max.y).toBeCloseTo(workbench.height, 6)
    expect(bench.top.boundingBox!.min.y).toBeCloseTo(workbench.height - workbench.top, 6)
    expect(bench.top.hasAttribute('woodGrain')).toBe(false)
    const material = new MeshBasicMaterial
    try {
      const top = new Mesh(bench.top, material)
      top.position.set(benchX, 0, benchZ)
      top.updateMatrixWorld()
      const down = new Vector3(0, -1, 0)
      const hits = (x: number, z: number) => {
        const ray = new Raycaster(new Vector3(x, 2, z), down)
        return ray.intersectObject(top).length > 0
      }
      expect(hits(sinkX, sinkZ)).toBe(false)
      expect(hits(sinkX + alchemySink.radius + alchemySink.thickness - 0.005, sinkZ)).toBe(false)
      expect(hits(sinkX + alchemySink.radius + alchemySink.thickness + 0.005, sinkZ)).toBe(true)
      expect(hits(holderSpot[0], holderSpot[2])).toBe(true)
    } finally {
      material.dispose()
    }
    // The sink’s brass runs from just over the top, its flange lying on it, down into the body.
    sink.metal.computeBoundingBox()
    const {min, max} = sink.metal.boundingBox!
    expect(max.y).toBeGreaterThan(0)
    expect(max.y).toBeLessThan(0.005)
    expect(sinkY + min.y).toBeLessThan(machineBody.size[1])
    expect(Math.max(max.x, -min.x)).toBeLessThan(alchemySink.radius + 0.04)
  })
  test('takes in every orb dropped into its sink and some thrown at it from in front of the bench, nearly at eye height, which roll down the throat into its body', () => {
    const world = new RAPIER.World({
      x: 0,
      y: -9.81,
      z: 0,
    })
    const welded = (triangles: [Float32Array, Uint32Array], [x, y, z]: Vec3) => world.createCollider(RAPIER.ColliderDesc.trimesh(...triangles, RAPIER.TriMeshFlags.FIX_INTERNAL_EDGES).setContactSkin(weldedSurfaceSkin).setTranslation(x, y, z))
    /** whether an orb set off from the point with the velocity drops down the throat within 10 s */
    const taken = (start: Vec3, velocity: Vec3) => {
      const body = addOrb(world, start)
      body.setLinvel({
        x: velocity[0],
        y: velocity[1],
        z: velocity[2],
      }, true)
      try {
        for (let step = 0; step < 60 * 10; step++) {
          world.step()
          const {x, y, z} = body.translation()
          if (inSinkThroat([x, y, z])) {
            return true
          }
        }
        return false
      } finally {
        world.removeRigidBody(body)
      }
    }
    try {
      world.timestep = 1 / 60
      Object.assign(world.integrationParameters, {
        normalizedAllowedLinearError: 0.001,
        normalizedPredictionDistance: 0.002,
      })
      welded(colliderGeometry(bench.top), [benchX, 0, benchZ])
      welded(colliderGeometry(sink.collision), alchemySink.center)
      world.createCollider(RAPIER.ColliderDesc.cuboid(machineBody.size[0] / 2, machineBody.size[1] / 2, machineBody.size[2] / 2).setTranslation(sinkX, machineBody.size[1] / 2, sinkZ))
      world.createCollider(RAPIER.ColliderDesc.cuboid(8, 0.1, 8).setTranslation(benchX, -0.1, benchZ - 4))
      world.createCollider(RAPIER.ColliderDesc.cuboid(8, 3, 0.1).setTranslation(benchX, 3, southWallFace + 0.1))
      let dropped = 0
      for (let index = 0; index < 24; index++) {
        // Spread evenly over the bowl, 30 cm over the bench
        const [angle, out] = [index * 2.4, Math.sqrt((index + 0.5) / 24) * (alchemySink.radius - 0.02)]
        if (taken([sinkX + Math.cos(angle) * out, workbench.height + 0.3, sinkZ + Math.sin(angle) * out], [0, 0, 0])) {
          dropped++
        }
      }
      expect(dropped).toBe(24)
      // Thrown like a carried prop, 10 m/s along the view and 2 m/s up, from a player standing up to 4 m in front of the bench, aiming the throw’s arc at the middle of the bowl, a hand over the bench: it stands nearly at eye height, so every throw comes at the sink almost flat, and the bowl flings many out again like a ramp.
      const target: Vec3 = [sinkX, sinkY + 0.15, sinkZ]
      let throws = 0
      let caught = 0
      for (const distance of [0.6, 1.5, 2.5, 4]) {
        for (const aside of [-0.4, 0, 0.4]) {
          const eye: Vec3 = [sinkX + aside, 1.6, benchZ - workbench.depth / 2 - 0.3 - distance]
          const yaw = Math.atan2(target[0] - eye[0], target[2] - eye[2])
          const shot = (pitch: number) => {
            const direction: Vec3 = [Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)]
            return {
              start: [eye[0] + direction[0] * 0.5, eye[1] - 0.22 + direction[1] * 0.5, eye[2] + direction[2] * 0.5] as Vec3,
              velocity: [direction[0] * 10, direction[1] * 10 + 2, direction[2] * 10] as Vec3,
            }
          }
          /** how far over or under the target the throw passes it */
          const miss = (pitch: number) => {
            const {start, velocity} = shot(pitch)
            const t = Math.hypot(target[0] - start[0], target[2] - start[2]) / Math.hypot(velocity[0], velocity[2])
            return Math.abs(start[1] + velocity[1] * t - 9.81 * t ** 2 / 2 - target[1])
          }
          let pitch = -1.4
          for (let candidate = -1.4; candidate < 0.6; candidate += 0.002) {
            if (miss(candidate) < miss(pitch)) {
              pitch = candidate
            }
          }
          const {start, velocity} = shot(pitch)
          throws++
          if (taken(start, velocity)) {
            caught++
          }
        }
      }
      // Hard to land, but not hopeless
      expect(caught).toBeGreaterThanOrEqual(throws / 4)
    } finally {
      world.free()
    }
  })
  test('its pipe runs from its body under the bench, up the south wall and along it into the cannon’s breech, and the cannon over the bench’s middle points north along the room’s axis', () => {
    const [start, riserFoot, riserTop, turn, end] = alchemyPipe.corners
    expect(start).toEqual([sinkX, start[1], benchZ])
    expect(riserFoot[0] - alchemyPipe.radius).toBeGreaterThan(benchX + workbench.length / 2)
    expect(riserTop[0]).toBe(riserFoot[0])
    expect(turn[0]).toBe(benchX)
    expect(end).toEqual(alchemyCannon.breech)
    // Clear of the bench’s top, the wall and the ceiling
    expect(riserTop[1] - alchemyPipe.radius).toBeGreaterThan(workbench.height + 0.5)
    for (const corner of alchemyPipe.corners) {
      expect(southWallFace - corner[2]).toBeGreaterThan(alchemyPipe.radius)
    }
    expect(alchemyPipe.bore).toBeGreaterThan(orbRadius)
    expect(alchemyCannon.axis[0]).toBe(0)
    expect(alchemyCannon.axis[2]).toBeLessThan(0)
    expect(alchemyCannon.bore - orbRadius).toBeGreaterThan(0.02)
    // High over a visitor’s head standing before the bench
    expect(alchemyCannon.muzzle[1] - 0.26).toBeGreaterThan(2.1)
    const body = new MachineBodyGeometry
    const pipe = new PipeGeometry
    const cannon = new CannonGeometry
    try {
      for (const part of [body.brass, body.glass, body.iron, pipe.brackets, pipe.pipe, cannon.barrel, cannon.bracket]) {
        expect(part.getAttribute('position').count).toBeGreaterThan(0)
      }
    } finally {
      for (const geometry of [body, pipe, cannon]) {
        geometry.dispose()
      }
    }
  })
})
describe('the alchemy machine’s cannon', () => {
  test('shoots an orb along its barrel, from a step down it, under the rooflight’s ring and the ceiling across the Forge, through the arch over the middle of its threshold, and through the window, a hand over its sill', () => {
    for (const axis of [0, 1, 2]) {
      expect(cannonLaunch.position[axis] + alchemyCannon.axis[axis] * alchemyCannon.depth).toBeCloseTo(alchemyCannon.muzzle[axis], 9)
      expect(cannonLaunch.velocity[axis] / cannonLaunch.speed).toBeCloseTo(alchemyCannon.axis[axis], 9)
    }
    expect(alchemyCannon.elevation).toBeGreaterThan(0)
    const ring = salonCeiling.underside - forgeRooflight.depth - forgeRooflight.bead
    for (const [x, y, z] of flight) {
      expect(x).toBe(cannonTarget.arch[0])
      expect(y + orbRadius).toBeLessThan(salonCeiling.underside - 0.3)
      if (Math.abs(Math.hypot(x - forge.center[0], z - forge.center[1]) - forgeRooflight.radius - forgeRooflight.frame / 2) < forgeRooflight.frame / 2 + orbRadius + 0.05) {
        expect(y + orbRadius).toBeLessThan(ring - 0.1)
      }
    }
    expect(crossing(northZ)[1]).toBeCloseTo(cannonTarget.arch[1], 3)
    expect(cannonTarget.window).toEqual(cisternWindow.aim)
    expect(cannonTarget.window).toEqual([cisternWindow.center[0], cisternWindow.sill + 0.3, cisternWindow.center[1]])
    expect(crossing(cisternWindow.center[1])[1]).toBeCloseTo(cannonTarget.window[1], 3)
    // Its last step falls short of the face of the cistern’s wall by less than a step.
    const last = flight.at(-1)!
    expect(last[2]).toBeGreaterThan(cisternWindow.channelZ)
    expect(last[2] - cisternWindow.channelZ).toBeLessThan(Math.abs(cannonLaunch.velocity[2]) / 60)
  })
  test('Rapier flies an orb shot out of it along the very steps its aim follows, up to the window', () => {
    const world = physicsWorld(forgeAndBastionColliders())
    try {
      const body = addOrb(world, cannonLaunch.position)
      body.setLinvel({
        x: cannonLaunch.velocity[0],
        y: cannonLaunch.velocity[1],
        z: cannonLaunch.velocity[2],
      }, true)
      let worst = 0
      for (const point of flight) {
        world.step()
        const {x, y, z} = body.translation()
        worst = Math.max(worst, Math.hypot(x - point[0], y - point[1], z - point[2]))
      }
      expect(worst).toBeLessThan(0.002)
    } finally {
      world.free()
    }
  }, 30_000)
  test('the orb passes the arch between the Forge and its vestibule well clear of its crown and the window clear of its sill, jambs and arch, and no wall has an opening of its own for it', () => {
    const north = wallById('forge-north')
    const ring = wallById('forge-vestibule')
    const flat = wallById('bastion-cistern_flat')
    const arches = [[north, north.holes!.find(hole => hole.name === 'vestibule')!], [ring, ring.holes!.find(hole => hole.name === 'forge')!]] as const
    for (const [wall, hole] of arches) {
      // Every step within the arch, the whole orb stays inside it, clear of its edge by the walls’ skin and a hand more.
      const clearance = orbRadius + weldedSurfaceSkin + 0.1
      let inside = 0
      for (const [x, y, z] of flight) {
        if (Math.abs(z - northZ) > wallFace + orbRadius + 0.3) {
          continue
        }
        inside++
        const u = wallCoordinates(wall, [x, y, z])
        for (const [du, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          expect(insideOpening(hole, u + du * clearance, y - wall.center[1] + dy * clearance)).toBe(true)
        }
      }
      expect(inside).toBeGreaterThan(0)
    }
    expect(north.holes!.map(hole => hole.name)).toEqual(['vestibule'])
    // Through the window, from the vestibule’s face of the round wall to the cistern’s face of the flat wall, every centimeter of the way, the whole orb stays inside both walls’ openings, clear of their edges by the walls’ skin and a few centimeters more.
    const [windowX, wallZ] = cisternWindow.center
    const clearance = orbRadius + weldedSurfaceSkin + 0.05
    for (let z = wallZ + wallFace; z >= wallZ - wallFace; z -= 0.01) {
      const [x, y] = crossing(z)
      expect(x).toBe(windowX)
      for (const [wall, name] of [[ring, 'cistern'], [flat, 'vestibule']] as const) {
        const hole = wall.holes!.find(value => value.name === name)!
        const u = wallCoordinates(wall, [x, y, z])
        for (const [du, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [Math.SQRT1_2, Math.SQRT1_2], [-Math.SQRT1_2, Math.SQRT1_2]]) {
          expect(insideOpening(hole, u + du * clearance, y - wall.center[1] + dy * clearance)).toBe(true)
        }
      }
    }
  })
})
describe('the alchemy machine’s cannon going off', () => {
  test('gathers itself, squashing while a swell runs up its barrel, then stretches, kicks back and wobbles home with a bang out of its muzzle, and lets a new flavor’s effect burst out with the orb', () => {
    const fx = new CannonFx
    const barrel = new Object3D
    const breech = new Vector3(...alchemyCannon.breech)
    const fromBreech = () => barrel.position.distanceTo(breech)
    try {
      fx.update(0, barrel)
      expect(barrel.scale.toArray()).toEqual([1, 1, 1])
      expect(fromBreech()).toBe(0)
      expect(fx.swell.size.value).toBe(0)
      // A new Halloween Orb’s bats wait hidden in the cannon; a Transparent Orb brings no effect.
      const halloween = `${halloweenOrb.propId}-alchemy-1`
      fx.prepare(halloween, halloweenOrb.effect)
      fx.prepare(transparentOrb.propId, transparentOrb.effect)
      expect(fx.root.children).toHaveLength(2)
      const [bats] = fx.root.children.filter(child => child !== fx.blast) as Array<CannonFx['blast']>
      expect(bats.uniforms.clock.value).toBeLessThan(0)
      fx.charge(1)
      const swells = [1.04, 1.1, 1.16, 1.22].map(clock => {
        fx.update(clock, barrel)
        return fx.swell.at.value
      })
      expect(swells).toEqual(swells.toSorted((a, b) => a - b))
      expect(fx.swell.size.value).toBeGreaterThan(0.2)
      expect(barrel.scale.y).toBeLessThan(1)
      expect(barrel.scale.x).toBeGreaterThan(1)
      expect(fx.blast.uniforms.clock.value).toBeGreaterThan(10)
      fx.fire(1 + charging, halloween)
      fx.update(1 + charging + 0.02, barrel)
      expect(barrel.scale.y).toBeGreaterThan(1.1)
      expect(barrel.scale.x).toBeLessThan(1)
      expect(fromBreech()).toBeGreaterThan(0.02)
      expect(fx.swell.at.value).toBe(alchemyCannon.length)
      expect(fx.blast.uniforms.clock.value).toBeCloseTo(0.02, 9)
      expect(bats.uniforms.clock.value).toBeCloseTo(0.02, 9)
      fx.update(1 + charging + 3, barrel)
      for (const value of [barrel.scale.x, barrel.scale.y, barrel.scale.z]) {
        expect(value).toBeCloseTo(1, 6)
      }
      expect(fromBreech()).toBe(0)
      expect(fx.swell.size.value).toBe(0)
      // Once the bats have flown off, they are gone.
      fx.update(1 + charging + partyEffects[halloweenOrb.effect].duration + 1.5, barrel)
      expect(fx.root.children).toEqual([fx.blast])
    } finally {
      fx.dispose()
    }
  })
})
describe('the Bastion’s cistern', () => {
  const [windowX, wallZ] = cisternWindow.center
  const {bed, bottom, leg, loop, rim, turn} = cisternChannel
  const lipZ = climbCulvert.z + wallFace + cisternChannel.lip
  test('its channel starts behind the window on the vestibule’s axis, runs straight north, turns 180° counter-clockwise round the cistern’s floor, runs straight back south and on out through the culvert on the run’s axis, falling evenly all along', () => {
    const start = cisternChannel.at(0)
    expect(start.point[0]).toBeCloseTo(windowX, 9)
    expect(start.point[2]).toBeCloseTo(cisternWindow.channelZ, 9)
    // Straight north along its first leg, a meter and more
    expect(leg).toBeGreaterThan(1)
    for (let along = 0; along <= leg; along += 0.05) {
      const {direction, point} = cisternChannel.at(along)
      expect(point[0]).toBeCloseTo(windowX, 9)
      expect(point[2]).toBeCloseTo(cisternWindow.channelZ - along, 9)
      expect(direction[0]).toBeCloseTo(0, 9)
      expect(direction[2]).toBeLessThan(-0.99)
    }
    expect(turn.from).toBe(leg)
    expect(turn.center).toEqual([windowX - turn.radius, cisternWindow.channelZ - leg])
    const middle = cisternChannel.at((turn.from + turn.to) / 2)
    expect(middle.point[0]).toBeCloseTo(turn.center[0], 9)
    expect(middle.point[2]).toBeCloseTo(turn.center[1] - turn.radius, 9)
    expect(middle.direction[0]).toBeLessThan(-0.99)
    expect(turn.to - turn.from).toBeCloseTo(Math.PI * turn.radius, 9)
    expect(loop - turn.to).toBeCloseTo(leg, 9)
    // Straight back south along its second leg, on the run’s axis, and on through the culvert
    for (let along = turn.to; along <= cisternChannel.length; along += 0.05) {
      const {direction, point} = cisternChannel.at(along)
      expect(point[0]).toBeCloseTo(climbCulvert.x, 9)
      expect(direction[2]).toBeGreaterThan(0.99)
    }
    expect(cisternChannel.at(loop).point[2]).toBeCloseTo(cisternWindow.channelZ, 9)
    expect(cisternChannel.at(cisternChannel.crossing).point[2]).toBeCloseTo(wallZ, 9)
    expect(cisternChannel.at(cisternChannel.length).point[2]).toBeCloseTo(lipZ, 9)
    // Its middle keeps well inside the round wall all the way round, with the floor beyond its outer side.
    for (let along = 0; along <= loop; along += 0.05) {
      const [x, , z] = cisternChannel.at(along).point
      expect(Math.hypot(x - cistern.center[0], z - cistern.center[1]) + cisternChannel.bore).toBeLessThan(cistern.radius - wallFace - 0.25)
    }
    // Evenly, steeply enough for an orb set down in it to roll off at 0.4 m/s within 2.5 s, before Rapier lets it fall asleep, its bottom a few centimeters over the culvert’s sill at its lip
    expect(9.81 * cisternChannel.fall * 5 / 7 * 2.5).toBeGreaterThan(0.4)
    for (let along = 0; along <= cisternChannel.length; along += 0.5) {
      expect(bottom(along) - bottom(along + 0.5)).toBeCloseTo(cisternChannel.fall * 0.5, 9)
    }
    expect(bottom(cisternChannel.length) - climbCulvert.bottom).toBeCloseTo(0.04, 9)
    // An orb in it passes under the culvert’s head.
    expect(bottom(cisternChannel.crossing) + orbRadius * 2 + 0.05).toBeLessThan(climbCulvert.height)
    // Sunk into the floor all round, its sides as high as the floor beside it where it leaves, so the floor carries whatever lies on it into it
    for (let along = 0; along <= loop; along += 0.05) {
      expect(cistern.apronEdge(along)).toBeGreaterThanOrEqual(rim(along) - 1e-9)
    }
    expect(cistern.apronEdge(loop)).toBeCloseTo(rim(loop), 9)
    expect(cistern.apronEdge(0)).toBe(cisternWindow.sill - cisternWindow.step)
  })
  test('its head rises out of it to lie flush with the floor under the window, short of where the shot’s orb drops into it', () => {
    const [start, end] = cisternChannel.head
    const floor = cisternWindow.sill - cisternWindow.step
    expect(bed(0)).toBe(floor)
    expect(bed(start)).toBeCloseTo(floor, 9)
    for (let along = start; along < end; along += 0.01) {
      expect(bed(along + 0.01)).toBeLessThan(bed(along))
    }
    for (let along = end; along <= cisternChannel.length; along += 0.1) {
      expect(bed(along)).toBeCloseTo(bottom(along), 9)
    }
    expect(cisternShotLanding).toBeGreaterThan(end)
  })
  test('the shot comes down through the window into the channel’s first leg, past its head', () => {
    const [x, y, z] = crossing(cisternWindow.channelZ - cisternShotLanding)
    expect(x).toBe(windowX)
    expect(y).toBeCloseTo(cisternWindow.sill - cisternWindow.step + orbRadius, 6)
    expect(cisternShotLanding).toBeGreaterThan(cisternChannel.head[1])
    expect(cisternShotLanding).toBeLessThan(leg - 0.3)
    expect(z).toBeLessThan(cisternWindow.channelZ)
  })
  test('the window opens through the vestibule’s round wall and the cistern’s flat wall where they touch, under the same round arch, as wide as it is high, just high enough for a crouching player, but not for one standing', () => {
    const ring = wallById('forge-vestibule')
    const flat = wallById('bastion-cistern_flat')
    const inRing = ring.holes!.find(hole => hole.name === 'cistern')!
    const inFlat = flat.holes!.find(hole => hole.name === 'vestibule')!
    for (const [wall, hole] of [[ring, inRing], [flat, inFlat]] as const) {
      const [x, , z] = wallPosition(wall, hole.u, 0, 0)
      expect(x).toBeCloseTo(windowX, 9)
      expect(z).toBeCloseTo(wallZ, 9)
      expect([hole.profile, hole.casing]).toEqual(['arch', false])
      // Through the round wall a hair lower and higher, under and over the reveal lining it on from the flat wall
      const tuck = wall.curveRadius ? 0.003 : 1e-9
      expect(Math.abs(hole.bottom! - cisternWindow.sill)).toBeLessThan(tuck)
      expect(Math.abs(hole.height - cisternWindow.spring - cisternWindow.rise)).toBeLessThan(tuck)
      expect(hole.height - hole.rise!).toBeCloseTo(cisternWindow.spring, 9)
      const [left, right] = [-1, 1].map(side => wallPosition(wall, hole.u + side * hole.width / 2, 0, 0))
      expect(Math.abs(left[0] - right[0])).toBeCloseTo(cisternWindow.width, 9)
    }
    // How far the round wall’s center line stands behind the flat wall’s at the jambs
    const jamb = wallPosition(ring, inRing.u + inRing.width / 2, 0, 0)
    expect(jamb[2] - wallZ).toBeCloseTo(cisternWindow.gap, 9)
    // A round arch on jambs half as high, square round it, a few centimeters over a crouching player standing on the sill in its middle
    const {contactOffset, crouchHeight, height, radius} = defaultEgoOptions
    const opening = cisternWindow.spring + cisternWindow.rise - cisternWindow.sill
    expect(cisternWindow.rise).toBeCloseTo(cisternWindow.width / 2, 9)
    expect(cisternWindow.width).toBeCloseTo(opening, 9)
    // The middle of the crouching player’s rounded top, and how much room it leaves under the arch past the gap the character controller keeps
    const top = cisternWindow.sill + contactOffset + crouchHeight - radius
    const room = cisternWindow.rise - (top - cisternWindow.spring) - radius - contactOffset
    expect(room).toBeGreaterThan(0.03)
    expect(room).toBeLessThan(0.08)
    expect(cisternWindow.width / 2 - radius - contactOffset).toBeGreaterThan(0.2)
    expect(opening).toBeLessThan(height)
    // Low enough to jump onto, standing
    expect(cisternWindow.sill).toBeLessThan(defaultEgoOptions.jumpHeight - 0.4)
    expect(openings.filter(({rooms: pair}) => pair.includes('forge') && pair.includes('bastion')).map(({holes}) => holes)).toEqual([[['forge-vestibule', 'bastion']], [['forge-vestibule', 'cistern']]])
  })
  test('a player jumps onto the window’s sill from the vestibule, ducks through it into the cistern, stands up there and ducks back out', () => {
    const world = physicsWorld(forgeAndBastionColliders())
    const body = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(windowX, 0.02, wallZ + 0.8))
    const collider = world.createCollider(RAPIER.ColliderDesc.capsule(0.55, 0.3).setTranslation(0, 0.85, 0), body)
    const motor = new EgoMotor(RAPIER, world, body, collider)
    const north = new Quaternion
    const step = (input: Parameters<EgoMotor['step']>[1]) => {
      motor.step(world.timestep, input, north)
      world.step()
    }
    try {
      // Up to the wall under the window, then a jump, ducking as it rises, on into the window and through it
      for (let frame = 0; frame < 60; frame++) {
        step({forward: true})
      }
      expect(body.translation().z).toBeGreaterThan(wallZ + wallFace + defaultEgoOptions.radius)
      for (let frame = 0; frame < 150; frame++) {
        step({
          forward: body.translation().z > cisternWindow.channelZ - 0.5,
          jump: frame < 40,
          crouch: frame > 2,
        })
      }
      const inside = body.translation()
      expect(inside.z).toBeLessThan(cisternWindow.channelZ - defaultEgoOptions.radius)
      expect(inside.y).toBeGreaterThan(cisternWindow.sill - cisternWindow.step - 0.1)
      expect(roomAt([inside.x, inside.y + 1, inside.z])).toBe('bastion')
      expect(motor.grounded).toBe(true)
      for (let frame = 0; frame < 30; frame++) {
        step({})
      }
      expect(motor.crouching).toBe(false)
      for (let frame = 0; frame < 300; frame++) {
        step({
          backward: true,
          crouch: true,
        })
      }
      const out = body.translation()
      expect(out.z).toBeGreaterThan(wallZ + wallFace + defaultEgoOptions.radius)
      expect(out.y).toBeLessThan(0.1)
      expect(roomAt([out.x, out.y + 1, out.z])).toBe('forge')
    } finally {
      motor.dispose()
      world.free()
    }
  }, 30_000)
  test('its inflow’s pipe leaves the foot of the half dome near the round wall’s east end, slopes down toward the channel and turns down over it near the end of its first leg, its spout clear over a standing player’s head, pouring into the channel', () => {
    const {leaves, mouth, normal, turns} = cisternInflow
    // On the half dome’s inside, between the round wall’s east end and its first rib, a little over its spring
    expect(leaves[1]).toBeGreaterThan(cistern.spring)
    expect(leaves[1]).toBeCloseTo(cisternDomeHeight(leaves[0], leaves[2]), 6)
    const azimuth = Math.atan2(cistern.center[1] - leaves[2], leaves[0] - cistern.center[0])
    expect(azimuth).toBeGreaterThan(0)
    expect(azimuth).toBeLessThan(Math.PI / 8)
    expect(normal[0]).toBeLessThan(0)
    // Sloping down from it toward the channel, then straight down over the water near the end of its first leg
    expect(turns[1]).toBeLessThan(leaves[1] - 0.2)
    expect([mouth[0], mouth[2]]).toEqual([turns[0], turns[2]])
    const [x, , z] = cisternChannel.at(cisternInflow.along).point
    expect([turns[0], turns[2]]).toEqual([x, z])
    expect(cisternInflow.along).toBeGreaterThan(cisternShotLanding)
    expect(cisternInflow.along).toBeLessThan(leg)
    expect(leg - cisternInflow.along).toBeLessThan(0.2)
    expect(mouth[1] - cistern.apronEdge(cisternInflow.along) - defaultEgoOptions.height).toBeGreaterThan(0.08)
    // Far over the shot’s line
    expect(mouth[1]).toBeGreaterThan(cisternWindow.spring + cisternWindow.rise + 0.2)
    // Its pipe collides; its stream reaches from its mouth down under the water’s surface.
    const pipe = new InflowGeometry
    const parts = new CisternGeometry
    try {
      pipe.collision.computeBoundingBox()
      expect(pipe.collision.boundingBox!.min.y).toBeCloseTo(mouth[1], 2)
      parts.falling.computeBoundingBox()
      expect(parts.falling.boundingBox!.max.y).toBeGreaterThan(mouth[1])
      const positions = parts.falling.getAttribute('position')
      let lowest = Infinity
      for (let index = 0; index < positions.count; index++) {
        if (Math.hypot(positions.getX(index) - mouth[0], positions.getZ(index) - mouth[2]) < 0.1) {
          lowest = Math.min(lowest, positions.getY(index))
        }
      }
      expect(lowest).toBeLessThan(bottom(cisternInflow.along) + 0.06)
      expect(lowest).toBeGreaterThan(bed(cisternInflow.along))
    } finally {
      pipe.dispose()
      parts.dispose()
    }
  })
  test('its culvert opens through its flat wall and the approach’s north wall back to back, low on the run’s axis, wide and high enough for the channel’s stone and an orb drifting in it', () => {
    const approach = climbApproach.walls.find(wall => wall.holes?.some(hole => hole.name === 'cistern'))!
    const flat = wallById('bastion-cistern_flat')
    const fromApproach = approach.holes!.find(hole => hole.name === 'cistern')!
    const fromCistern = flat.holes!.find(hole => hole.name === 'approach')!
    for (const [wall, hole] of [[approach, fromApproach], [flat, fromCistern]] as const) {
      const [x, , z] = wallPosition(wall, hole.u, 0, 0)
      expect(x).toBeCloseTo(climbCulvert.x, 9)
      expect(z).toBeCloseTo(climbCulvert.z, 9)
      expect(wall.center[1]).toBe(0)
      expect([hole.profile, hole.casing, hole.width, hole.bottom, hole.height]).toEqual(['rectangle', false, climbCulvert.width, climbCulvert.bottom, climbCulvert.height])
    }
    expect(climbCulvert.width / 2 - cisternChannel.bore).toBeGreaterThan(0.1)
    expect(climbCulvert.height - climbCulvert.bottom).toBeLessThan(0.6)
    // Facing down the run, its middle on the run’s axis
    expect(approach.rotation).toBeCloseTo(0, 9)
    expect(climbCulvert.x).toBe(climbRun.route.end.point[0])
  })
  test('its floor falls toward the channel from everywhere, so whatever lands on it rolls into the channel and out through the culvert, as does whatever lands in the channel', () => {
    const colliders = forgeAndBastionColliders()
    const [cx, cz] = turn.center
    // Round the turn, and beside both legs, near the window and further on
    const spokes = [
      ...[0.08, 0.4, 0.9, 1.5, 2.1, 2.7, 3.06].map(angle => ({
        base: [cx, cz] as const,
        direction: [Math.cos(angle), -Math.sin(angle)] as const,
      })),
      ...[0.4, 1].flatMap(into => [1, -1].map(side => ({
        base: [cx, cisternWindow.channelZ - into] as const,
        direction: [side, 0] as const,
      }))),
    ]
    const stuck: Array<Vec3> = []
    for (const {base, direction} of spokes) {
      const reach = wallAhead(base, direction)
      for (const out of [0.3, 1.5, 2.6, 3.5, turn.radius, cistern.outerEdge + (reach - cistern.outerEdge) * 0.4, cistern.outerEdge + (reach - cistern.outerEdge) * 0.85]) {
        const [x, z] = [base[0] + direction[0] * out, base[1] + direction[1] * out]
        const drop: Vec3 = [x, cisternFloorHeight(x, z) + orbRadius + 0.1, z]
        const world = physicsWorld(colliders)
        try {
          const body = addOrb(world, drop)
          let left = false
          for (let step = 0; step < 60 * 60 && !left; step++) {
            world.step()
            const position = body.translation()
            left = position.z > lipZ && Math.abs(position.x - climbCulvert.x) < climbCulvert.width / 2
          }
          if (!left) {
            stuck.push(drop)
          }
        } finally {
          world.free()
        }
      }
    }
    expect(stuck).toEqual([])
  }, 240_000)
  test('its walls stand on its floor, their baseboards following it as it falls toward the channel', () => {
    const material = new MeshBasicMaterial
    try {
      for (const id of ['bastion-cistern_flat', 'bastion-cistern_round']) {
        const wall = wallById(id)
        expect(wall.baseboardProfile).toBeDefined()
        const geometry = createArchitectureGeometry(wall)
        try {
          const trim = new Mesh(geometry.trim[0], material)
          for (let step = 1; step < 40; step++) {
            const u = wall.width * (step / 40 - 0.5)
            // Clear of the culvert, which cuts through the baseboard
            if (wall.holes?.some(hole => Math.abs(u - hole.u) < hole.width / 2 + 0.3)) {
              continue
            }
            const [x, , z] = wallPosition(wall, u, 0, wallFace)
            const floor = cisternFloorHeight(x, z)
            // 23 cm out of its center line, over the baseboard’s cap
            const [localX, localZ] = wall.curveRadius ? [(wall.curveRadius - 0.23) * Math.sin(u / wall.curveRadius), wall.curveRadius - (wall.curveRadius - 0.23) * Math.cos(u / wall.curveRadius)] : [u, 0.23]
            const down = new Raycaster(new Vector3(localX, floor + 1, localZ), new Vector3(0, -1, 0), 0, 2)
            expect(down.intersectObject(trim)[0].point.y).toBeCloseTo(floor + bastionBaseboard.baseboardHeight, 1)
          }
        } finally {
          geometry.dispose()
        }
      }
    } finally {
      material.dispose()
    }
  })
  test('belongs to the Bastion, which holds it from its floor to its half dome’s crown', () => {
    const [cx, cz] = cistern.center
    for (const [dx, dz] of [[0, -0.5], [-5, -1], [4.5, -2], [0, -5.5], [-2.5, -3]]) {
      const [x, z] = [cx + dx, cz + dz]
      const floor = cisternFloorHeight(x, z)
      expect(roomAt([x, floor + 1.6, z])).toBe('bastion')
      expect(floorHeight([x, floor + 1.6, z])).toBeCloseTo(floor, 9)
      expect(insideGallery([x, cistern.crown - 0.1, z])).toBe(true)
    }
    // The vestibule stays the Forge’s, right up to its wall.
    expect(roomAt([windowX, 1.6, wallZ + 0.3])).toBe('forge')
    expect(roomAt([windowX, 1.6, wallZ - 0.3])).toBe('bastion')
  })
})
describe('the alchemy machine’s orbs', () => {
  const orb = transparentOrb.propId
  test('an orb is around while any orb is in the Forge or anywhere in the Bastion, but not for other props or orbs elsewhere', () => {
    expect(orbAround([], roomAt)).toBe(false)
    expect(orbAround([[orb, cannonLaunch.position]], roomAt)).toBe(true)
    expect(orbAround([[`${orb}-holder-3`, [holderSpot[0], holderSpot[1] + orbSeat, holderSpot[2]]]], roomAt)).toBe(true)
    expect(orbAround([['prop-orb-spook', [bastionCrater.center[0], bastionCrater.center[1] - 0.2, bastionCrater.center[2]]]], roomAt)).toBe(true)
    expect(orbAround([['prop-orb-horror', [-14, 1, -4]]], roomAt)).toBe(false)
    expect(orbAround([['prop-sculpture', [forge.center[0], 1, forge.center[1]]]], roomAt)).toBe(false)
  })
  test('a flavored orb comes out as itself, while a Transparent Orb takes the flavor the Forge steers it to', () => {
    for (const flavored of [halloweenOrb, horrorOrb, paintOrb, spookOrb]) {
      for (const random of [0, 0.5, 0.99]) {
        expect(transmutedOrb(flavored, [['prop-pumpkin', [forge.center[0], 1, forge.center[1]]]], roomAt, random)).toBe(flavored)
      }
    }
    expect([0, 0.4, 0.99].map(random => transmutedOrb(transparentOrb, [], roomAt, random))).toEqual([transparentOrb, transparentOrb, transparentOrb])
    expect(transmutedOrb(transparentOrb, [['prop-hatchet', [forge.center[0], 1, forge.center[1]]]], roomAt, 0.3)).toBe(horrorOrb)
  })
  test('leaves a Transparent Orb as it is while nothing in the Forge steers it, whatever it rolls', () => {
    expect(flavorCandidates([], roomAt)).toEqual([transparentOrb])
    const drawn = new Set<Orb>
    const draws = 300
    for (let index = 0; index < draws; index++) {
      drawn.add(flavoredOrb([], roomAt, (index + 0.5) / draws))
    }
    expect([...drawn]).toEqual([transparentOrb])
    expect(flavoredOrb([], roomAt, 0)).toBe(transparentOrb)
    expect(flavoredOrb([], roomAt, 1 - 1e-12)).toBe(transparentOrb)
  })
  test('gives it the flavor of a pumpkin, a hatchet, a helmet or a Painting Set lying in the Forge or carried into it, and of those there one at random, but heeds neither them outside it nor other props in it', () => {
    const inForge: Vec3 = [forge.center[0], 1, forge.center[1]]
    const inVestibule: Vec3 = [forgeVestibule.center[0], 1.4, forgeVestibule.center[1]]
    const inLobby: Vec3 = [0, 1, -20]
    expect(roomAt(inVestibule)).toBe('forge')
    expect(roomAt(inLobby)).not.toBe('forge')
    expect([pumpkin, hatchet, helmet, paintingSet].map(curio => curio.propId)).toEqual(['prop-pumpkin', 'prop-hatchet', 'prop-helmet', 'prop-painting-set'])
    expect(flavorCandidates([['prop-pumpkin', inForge]], roomAt)).toEqual([halloweenOrb])
    expect(flavorCandidates([['prop-hatchet', inVestibule]], roomAt)).toEqual([horrorOrb])
    expect(flavorCandidates([['prop-knife', inForge]], roomAt)).toEqual([transparentOrb])
    expect(flavorCandidates([['prop-helmet-2', inForge]], roomAt)).toEqual([spookOrb])
    expect(flavorCandidates([['prop-painting-set', inVestibule]], roomAt)).toEqual([paintOrb])
    expect(flavorCandidates([['prop-painting-set', inLobby]], roomAt)).toEqual([transparentOrb])
    // Where they lie when a game begins, only the Painting Set is in the Forge already.
    expect(flavorCandidates([pumpkin, hatchet, helmet, paintingSet].map(curio => [curio.propId, curio.position] as const), roomAt)).toEqual([paintOrb])
    // Several of a kind steer it no harder than one.
    expect(flavorCandidates([['prop-pumpkin', inForge], ['prop-pumpkin-2', inForge], ['prop-hatchet', inForge]], roomAt)).toEqual([halloweenOrb, horrorOrb])
    expect([0, 0.49, 0.5, 0.99].map(random => flavoredOrb([['prop-pumpkin', inForge], ['prop-hatchet', inForge]], roomAt, random))).toEqual([halloweenOrb, halloweenOrb, horrorOrb, horrorOrb])
    expect(flavorCandidates([['prop-pumpkin', inLobby], ['prop-cube', inForge], ['prop-pumpkinseed', inForge], [halloweenOrb.propId, inForge]], roomAt)).toEqual([transparentOrb])
  })
  test('scattered cannon shots pass the arch and the window untouched, come down into the cistern’s channel and ride it round without leaving its groove, out through the culvert and on down the Bastion to its crater, never dragged across the welded surfaces', () => {
    const colliders = forgeAndBastionColliders()
    const state = mulberry32.create(7)
    const scatter = (size: number) => (mulberry32.sample(state) * 2 - 1) * size
    const {hatch, wall} = bastionLinkGate
    const [hatchX, gateZ] = [wall.center[0] + hatch.u, wall.center[2]]
    const shots = 20
    const [cx, cz] = cisternChannel.turn.center
    const [windowX] = cisternWindow.center
    /** how far the point in plan lies from the channel’s middle, in the cistern */
    const offCenter = (x: number, z: number) => (z >= cz ? Math.min(Math.abs(x - windowX), Math.abs(x - climbCulvert.x)) : Math.abs(Math.hypot(x - cx, z - cz) - cisternChannel.turn.radius))
    const lipZ = climbCulvert.z + wallFace + cisternChannel.lip
    const exitSpeeds: Array<number> = []
    let through = 0
    let caught = 0
    /** steps an orb rolled at a good pace, and of those, how many it moved much less than its velocity says */
    let rolling = 0
    let dragged = 0
    for (let shot = 0; shot < shots; shot++) {
      const world = physicsWorld(colliders)
      try {
        const body = addOrb(world, cannonLaunch.position)
        const speed = 1 + scatter(0.001)
        const [vx, vy, vz] = cannonLaunch.velocity
        body.setLinvel({
          x: vx + scatter(0.01),
          y: vy * speed + scatter(0.01),
          z: vz * speed,
        }, true)
        let untouched = true
        let struck = false
        let strayed = 0
        let exited = false
        let atGate: number | undefined
        let previousZ = Infinity
        let previous = body.translation()
        for (let step = 0; step < 60 * 60; step++) {
          const before = body.linvel()
          world.step()
          const position = body.translation()
          const velocity = body.linvel()
          const pace = Math.hypot(velocity.x, velocity.y, velocity.z)
          // Flying freely through the window, gravity alone changing its velocity, down into the channel’s groove, until the groove first steers it
          if (!struck && Math.hypot(velocity.x - before.x, velocity.z - before.z) > 1e-6) {
            struck = true
            if (position.z > cisternWindow.channelZ - cisternChannel.head[1] || offCenter(position.x, position.z) > cisternChannel.bore) {
              untouched = false
            }
          }
          if (struck && !exited && position.z < cisternWindow.channelZ) {
            strayed = Math.max(strayed, offCenter(position.x, position.z))
          }
          if (struck && !exited && position.z > lipZ && Math.abs(position.x - climbCulvert.x) < climbCulvert.width / 2) {
            exited = true
            exitSpeeds.push(pace)
          }
          if (pace > 1 && exited) {
            rolling++
            if (Math.hypot(position.x - previous.x, position.y - previous.y, position.z - previous.z) < pace * world.timestep * 0.8) {
              dragged++
            }
          }
          previous = position
          // Low down in the mouth, it passes the gate where it stands, through its hatch.
          if (position.y < -3 && previousZ > gateZ && position.z <= gateZ && atGate === undefined) {
            atGate = position.x
          }
          previousZ = position.z
        }
        expect(untouched).toBe(true)
        expect(strayed).toBeLessThan(cisternChannel.bore)
        expect(exited).toBe(true)
        if (atGate === undefined) {
          continue
        }
        through++
        expect(Math.abs(atGate - hatchX)).toBeLessThan(hatch.width / 2 - orbRadius / 2)
        const {x: endX, y: endY, z: endZ} = body.translation()
        if (Math.hypot(endX - bastionCrater.center[0], endZ - bastionCrater.center[2]) < bastionCrater.radius * 1.05 && endY < bastionCrater.center[1]) {
          caught++
        }
      } finally {
        world.free()
      }
    }
    // Out of the culvert, they come at a brisk pace, slower than they came in.
    expect(Math.min(...exitSpeeds)).toBeGreaterThan(2)
    expect(Math.max(...exitSpeeds)).toBeLessThan(5)
    expect(through).toBeGreaterThanOrEqual(shots * 0.9)
    expect(caught).toBeGreaterThanOrEqual(through * 0.8)
    // but where they strike something
    expect(dragged / rolling).toBeLessThan(0.02)
  }, 120_000)
})
