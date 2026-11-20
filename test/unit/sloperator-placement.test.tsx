import type {SloperatorSightId} from '../../src/lib/gallery/sloperator/sights.ts'
import type {Vec3} from '../../src/lib/gallery/types.ts'
import type {Camera, Mesh, Scene} from 'three/webgpu'

import {afterAll, afterEach, beforeAll, describe, expect, test} from 'bun:test'

import {advance, useThree} from '@react-three/fiber'
import {CuboidCollider, RigidBody} from '@react-three/rapier'
import {act} from 'react'
import {MeshBasicMaterial, Quaternion, Vector3} from 'three/webgpu'

import FountainBenches from '../../src/components/FountainBenches/index.tsx'
import LodgeFurnishings from '../../src/components/LodgeFurnishings/index.tsx'
import Sloperator from '../../src/components/Sloperator/index.tsx'
import {fountainBenches} from '../../src/lib/gallery/fountainBenches.ts'
import {probeGeofences, startGeofences, useGeofences} from '../../src/lib/gallery/geofences.ts'
import lodge from '../../src/lib/gallery/lodge.ts'
import {usePhysicsHold} from '../../src/lib/gallery/roomLoading.ts'
import {figureBounds, floorRise, furnitureBody, inTheWay, placeSloperator, seatOn, seatStray} from '../../src/lib/gallery/sloperator/placement.ts'
import {placementAt, useSloperator} from '../../src/lib/gallery/sloperator/sightings.ts'
import sights from '../../src/lib/gallery/sloperator/sights.ts'
import SloperatorGeometry from '../../src/lib/gallery/sloperator/SloperatorGeometry.ts'
import {useGallery} from '../../src/lib/gallery/store.ts'
import {setPlayerZoom} from '../../src/lib/rendering/playerView.ts'
import {dumpSloperator, spawnSloperator, triggerSloperatorSighting} from '../../src/lib/webmcp/sloperator.ts'
import SalonOttoman from '../../src/rooms/salon/components/SalonOttoman/index.tsx'
import slopGallery from '../../src/worlds/gallery/index.ts'
import {mountPhysics} from './helpers/inertPhysics.tsx'

const material = new MeshBasicMaterial
const up = new Vector3(0, 1, 0)
const sight = (id: SloperatorSightId) => sights.find(candidate => candidate.id === id)!
/** The sight, which has a seat. */
const seated = (id: SloperatorSightId) => {
  const found = sight(id)
  if (!found.furniture) {
    throw new Error(`${id} has no seat`)
  }
  return found
}
const bench = seated('lobby_east_bench')
const ottoman = seated('salon_ottoman')
const armchair = seated('lodge_east_armchair')
let mounted: Awaited<ReturnType<typeof mountPhysics>>
/** the camera and the scene of the mounted root */
let view: {
  camera: Camera
  scene: Scene
}
function View() {
  view = useThree(({camera, scene}) => ({
    camera,
    scene,
  }))
  return null
}
/** the moment of the frame clock the last frame was drawn at, in milliseconds */
let frameTime = 0
/** Draws frames for `seconds` at 60 per second, like the game does. */
const frames = async (seconds: number) => {
  for (let frame = 0; frame < seconds * 60; frame++) {
    frameTime += 1000 / 60
    await act(async () => advance(frameTime))
  }
}
/** His cloth where he is drawn at the sight, which his whole figure moves with. */
const clothAt = (id: SloperatorSightId) => {
  let found: Mesh | undefined
  view.scene.traverse(object => {
    if (object.name === 'sloperator-cloth' && object.parent?.parent?.userData.room === sight(id).room) {
      found = object as Mesh
    }
  })
  return found
}
/** How tall he is drawn at the east fountain bench: about 1.5 m sitting and 1.9 m standing. */
const benchTop = () => clothAt('lobby_east_bench')!.geometry.boundingBox!.max.y
const step = (seconds: number, rate = 60) => {
  for (let i = 0; i < seconds * rate; i++) {
    mounted.physics.step(1 / rate)
  }
}
const bodyOf = (id: SloperatorSightId) => furnitureBody(mounted.physics, seated(id).furniture.body)!
const spawn = (id: SloperatorSightId) => placeSloperator(mounted.physics, sight(id), bodyOf(id))
/** Where he turns up at the sight as the physics stands now, failing the test where he stays away. */
const place = (id: SloperatorSightId) => {
  const spawned = spawn(id)
  if (spawned.result === 'failure') {
    throw new Error(`He stays away from ${id}: ${spawned.detection}`)
  }
  return spawned
}
const placementAtBench = () => placementAt(useSloperator.getState().spawns, 'lobby_east_bench')
/** Sets the sight’s furniture down where it stood when the game began, moved along the floor by `offset` in its own frame and turned by `turn` around y, or tipped `tilt` around its own x, at rest. */
const setDown = (id: SloperatorSightId, {offset = [0, 0, 0], tilt = 0, turn = 0}: {
  offset?: Vec3
  tilt?: number
  turn?: number
} = {}) => {
  const {furniture} = seated(id)
  const body = bodyOf(id)
  const yaw = furniture.yaw + turn
  const rotation = new Quaternion
  rotation.setFromAxisAngle(up, yaw)
  const tipped = new Quaternion
  rotation.multiply(tipped.setFromAxisAngle(new Vector3(1, 0, 0), tilt))
  const along = new Vector3(...offset)
  along.applyAxisAngle(up, furniture.yaw)
  body.setTranslation({
    x: furniture.position[0] + along.x,
    y: furniture.position[1] + along.y,
    z: furniture.position[2] + along.z,
  }, true)
  body.setRotation(rotation, true)
  body.setLinvel({
    x: 0,
    y: 0,
    z: 0,
  }, true)
  body.setAngvel({
    x: 0,
    y: 0,
    z: 0,
  }, true)
}
/** A box of the physics that is nobody’s seat, `half` its half extents, standing on the floor at `[x, y, z]`, removed by its return. */
const obstacle = ([x, y, z]: Vec3, half: Vec3) => {
  const {rapier, world} = mounted.physics
  const body = world.createRigidBody(rapier.RigidBodyDesc.fixed().setTranslation(x, y + half[1], z))
  world.createCollider(rapier.ColliderDesc.cuboid(...half), body)
  return () => world.removeRigidBody(body)
}
beforeAll(async () => {
  mounted = await mountPhysics(<>
    <RigidBody colliders={false} type='fixed'>
      <CuboidCollider args={[60, 0.1, 60]} position={[0, -0.1, 0]} />
    </RigidBody>
    <FountainBenches />
    <SalonOttoman />
    <group position={[lodge.center[0], lodge.floorY, lodge.center[1]]}>
      {/* Every finish is the same plain material; only the colliders matter here. */}
      <LodgeFurnishings materials={new Proxy({}, {get: () => material}) as never} />
    </group>
    <Sloperator />
    <View />
  </>)
  // Rooms of other tests may still hold the physics still.
  usePhysicsHold.setState({held: false})
  step(3)
})
afterEach(async () => {
  for (const id of ['lobby_east_bench', 'salon_ottoman'] as const) {
    setDown(id)
  }
  // Out of every fence first, so stepping places him nowhere
  await act(async () => {
    useGeofences.setState(useGeofences.getInitialState(), true)
    useSloperator.setState(useSloperator.getInitialState(), true)
    useGallery.setState({room: slopGallery.defaultRoom})
    usePhysicsHold.setState({held: false})
    setPlayerZoom(0)
    step(1.5)
  })
})
afterAll(async () => {
  await mounted[Symbol.asyncDispose]()
  material.dispose()
})
describe('his movable seats', () => {
  test('the Lobby’s benches and the Salon’s ottoman stand still where they stand through frames of any length, and fall asleep', () => {
    const bodies = [...fountainBenches.map(({name}) => name), 'salon-ottoman'].map(name => furnitureBody(mounted.physics, name)!)
    const starts = bodies.map(body => body.translation())
    for (const body of bodies) {
      expect(body.isDynamic()).toBe(true)
      body.wakeUp()
    }
    let drift = 0
    for (let frame = 0; frame < 40; frame++) {
      mounted.physics.step([0.5, 0.004, 0.25, 1 / 60][frame % 4])
      for (const [index, body] of bodies.entries()) {
        const {x, y, z} = body.translation()
        drift = Math.max(drift, Math.hypot(x - starts[index].x, y - starts[index].y, z - starts[index].z))
      }
    }
    expect(drift).toBeLessThan(0.001)
    for (const body of bodies) {
      expect(body.isSleeping()).toBe(true)
    }
  })
  test('they are heavy, 130 kg of teak and steel each and 80 kg of an upholstered walnut frame, and the Lodge’s armchair never moves', () => {
    for (const {name} of fountainBenches) {
      expect(furnitureBody(mounted.physics, name)!.mass()).toBeCloseTo(130, 3)
    }
    expect(bodyOf('salon_ottoman').mass()).toBeCloseTo(80, 3)
    expect(bodyOf('lodge_east_armchair').isFixed()).toBe(true)
  })
})
describe('where he turns up', () => {
  test('with his seats where they stood when the game began, he sits on each as its sight says, in the armchairs leaning back, with nothing in his way', () => {
    const withSeats = sights.filter(({furniture}) => furniture)
    expect(withSeats).toHaveLength(5)
    for (const {id, position, yaw} of withSeats) {
      const {detection, placement} = place(id)
      expect(detection).toBe('present')
      expect(placement.pose).toBe(id.startsWith('lodge_') ? 'sit_armchair' : 'sit')
      expect(placement.fixed).toBe(id.startsWith('lodge_'))
      expect(placement.surface).toBe(seated(id).seat.height)
      expect(Math.hypot(placement.position[0] - position[0], placement.position[1] - position[1], placement.position[2] - position[2])).toBeLessThan(0.001)
      expect(placement.yaw).toBeCloseTo(yaw, 3)
    }
  })
  test('with his seat moved and turned a little, he sits on it where it went, moved and turned along with it', () => {
    for (const id of ['lobby_east_bench', 'salon_ottoman'] as const) {
      const turn = 0.15
      setDown(id, {
        offset: [0.08, 0, -0.06],
        turn,
      })
      step(1.5)
      const {detection, placement} = place(id)
      expect(detection).toBe('moved')
      expect(placement.pose).toBe('sit')
      // Where he sits in the seat’s frame, carried over to where the seat stands now
      const {furniture, position, yaw} = seated(id)
      const now = bodyOf(id).translation()
      const relative = new Vector3(position[0] - furniture.position[0], 0, position[2] - furniture.position[2])
      relative.applyAxisAngle(up, turn)
      expect(placement.position[0]).toBeCloseTo(now.x + relative.x, 3)
      expect(placement.position[2]).toBeCloseTo(now.z + relative.z, 3)
      expect(placement.yaw).toBeCloseTo(yaw + turn, 3)
    }
  })
  test('with his seat gone farther, he stands where he would have sat, facing as he would have', () => {
    // Out from under him toward his back, and off along the floor
    setDown('lobby_east_bench', {offset: [0, 0, 1.6]})
    setDown('salon_ottoman', {
      offset: [3, 0, 0],
      turn: 1,
    })
    step(1.5)
    for (const {id, position, yaw} of [bench, ottoman]) {
      expect(spawn(id)).toEqual({
        detection: 'missing',
        placement: {
          fixed: false,
          pose: 'stand',
          position,
          surface: 0,
          yaw,
        },
        result: 'success',
      })
    }
  })
  test('with his seat tipped over, it is no seat of his, however near', () => {
    const lean = seatStray.tilt + 0.01
    expect(seatOn(ottoman, {
      rotation: {
        x: Math.sin(lean / 2),
        y: 0,
        z: 0,
        w: Math.cos(lean / 2),
      },
      translation: {
        x: ottoman.furniture.position[0],
        y: ottoman.furniture.position[1],
        z: ottoman.furniture.position[2],
      },
    })).toBeUndefined()
    setDown('salon_ottoman', {
      offset: [0, 0, -2],
      tilt: Math.PI / 2,
    })
    step(1.5)
    expect(place('salon_ottoman').placement.pose).toBe('stand')
  })
  test('his seat strayed too far to sit on it, yet still under him, keeps him away, since he would stand in it: it moved', () => {
    // Along its length, half a meter past where he may follow it
    setDown('lobby_east_bench', {offset: [0.5, 0, 0]})
    step(1.5)
    expect(seatOn(bench, {
      rotation: bodyOf('lobby_east_bench').rotation(),
      translation: bodyOf('lobby_east_bench').translation(),
    })).toBeUndefined()
    expect(spawn('lobby_east_bench')).toEqual({
      detection: 'moved',
      result: 'failure',
    })
  })
  test('anything else in the box he takes up keeps him away, on his seat, where he would stand up in front of it and off it, but the floor never does: it is blocked', () => {
    const blocked = {
      detection: 'blocked',
      result: 'failure',
    } as const
    for (const {id, position} of [bench, ottoman, armchair]) {
      // A thing left on his seat where he sits
      const removeOnSeat = obstacle([position[0], position[1] + seated(id).seat.height, position[2]], [0.1, 0.1, 0.1])
      step(0.1)
      expect(spawn(id)).toEqual(blocked)
      removeOnSeat()
      // A thing standing on the floor in front of his seat, where he would stand up once sighted
      const inFront = new Vector3(0, 0, SloperatorGeometry.lap + 0.2)
      inFront.applyAxisAngle(up, seated(id).yaw)
      const removeInFront = obstacle([position[0] + inFront.x, position[1], position[2] + inFront.z], [0.1, 0.4, 0.1])
      step(0.1)
      expect(spawn(id)).toEqual(blocked)
      removeInFront()
      step(0.1)
      expect(place(id).detection).toBe('present')
    }
    setDown('lobby_east_bench', {offset: [0, 0, 1.6]})
    step(1.5)
    // Something lying flat on the floor right in front of where he would stand
    const box = figureBounds()
    const front = new Vector3(0, 0, box.max.z - 0.05)
    front.applyAxisAngle(up, bench.yaw)
    const remove = obstacle([bench.position[0] + front.x, 0, bench.position[2] + front.z], [0.05, 0.02, 0.05])
    step(0.1)
    expect(spawn('lobby_east_bench')).toEqual(blocked)
    remove()
    step(0.1)
    expect(place('lobby_east_bench').detection).toBe('missing')
  })
})
describe('where he stands without a seat', () => {
  test('he stands on his spot on its floor, however it slopes, unless something else is in his way', () => {
    const glass = sight('exhibition_glass')
    const standing = {
      detection: 'none',
      placement: {
        fixed: false,
        pose: 'stand',
        position: glass.position,
        surface: 0,
        yaw: glass.yaw,
      },
      result: 'success',
    } as const
    expect(placeSloperator(mounted.physics, glass)).toEqual(standing)
    // The Exhibition’s floor under him, sloping up toward Moonfall, its top through the point under him
    const {grade, yaw} = glass.slope!
    const normal = new Vector3(-grade * Math.sin(yaw), 1, -grade * Math.cos(yaw))
    normal.normalize()
    const rotation = new Quaternion
    rotation.setFromUnitVectors(up, normal)
    const thickness = 0.1
    const [x, y, z] = glass.position
    const {rapier, world} = mounted.physics
    const floor = world.createRigidBody(rapier.RigidBodyDesc.fixed().setTranslation(x - normal.x * thickness, y - normal.y * thickness, z - normal.z * thickness).setRotation(rotation))
    world.createCollider(rapier.ColliderDesc.cuboid(4, thickness, 4), floor)
    step(0.1)
    expect(placeSloperator(mounted.physics, glass)).toEqual(standing)
    // Taken for level, the floor rising under his feet would stand in his way.
    expect(inTheWay(mounted.physics, {
      position: glass.position,
      yaw: glass.yaw,
    })).toHaveLength(1)
    // Something lying on the floor right in front of him
    const front = new Vector3(0, 0, figureBounds().max.z - 0.05)
    front.applyAxisAngle(up, glass.yaw)
    const remove = obstacle([x + front.x, y + grade * (front.x * Math.sin(yaw) + front.z * Math.cos(yaw)) + floorRise(glass.yaw, glass.slope), z + front.z], [0.05, 0.05, 0.05])
    step(0.1)
    expect(placeSloperator(mounted.physics, glass)).toEqual({
      detection: 'blocked',
      result: 'failure',
    })
    remove()
    world.removeRigidBody(floor)
    step(0.1)
    expect(placeSloperator(mounted.physics, glass)).toEqual(standing)
  })
})
describe('in the scene', () => {
  test('entering a sight’s fence places him on the next step of the physics, and leaving it forgets where, as dump_sloperator tells', async () => {
    const stateAtBench = () => dumpSloperator().find(({id}) => id === 'lobby_east_bench')!.state
    const outside: Vec3 = [0, 0.9, 0]
    const salon: Vec3 = [14, 0.9, -24]
    startGeofences(outside)
    setDown('lobby_east_bench', {
      offset: [0.1, 0, 0],
      turn: -0.1,
    })
    step(1.5)
    expect(useSloperator.getState().spawns).toEqual({})
    expect(stateAtBench()).toBe('away')
    await act(async () => probeGeofences(salon, [0, 0, 0]))
    expect(useSloperator.getState().spawns).toEqual({})
    expect(stateAtBench()).toBe('waiting')
    await act(async () => step(1 / 60))
    const placement = placementAtBench()
    expect(placement?.pose).toBe('sit')
    const dumped = dumpSloperator().find(({id}) => id === 'lobby_east_bench')!
    expect(dumped).toMatchObject({
      detection: 'moved',
      fence: 'salon',
      pose: 'sit',
      id: 'lobby_east_bench',
      position: placement!.position,
      sighted: false,
      state: 'seated',
      yaw: placement!.yaw,
    })
    // How far his seat strayed, which he followed
    expect(dumped.seat!.turned).toBeCloseTo(-0.1, 3)
    expect(dumped.seat!.tilted).toBeLessThan(0.001)
    expect(dumped.seat!.moved).toBeGreaterThan(0.01)
    expect(dumped.seat!.moved).toBeLessThan(seatStray.reach)
    expect(placement?.yaw).toBeCloseTo(bench.yaw - 0.1, 3)
    // Moving his seat while the player stays in the fence leaves him where he was placed.
    setDown('lobby_east_bench', {offset: [0, 0, 1.6]})
    await act(async () => step(1.5))
    expect(placementAtBench()).toBe(placement)
    await act(async () => probeGeofences(outside, [0, 0, 0]))
    expect(useSloperator.getState().spawns).toEqual({})
    // Back in the fence, the physics finds his seat gone and stands him up.
    await act(async () => probeGeofences(salon, [0, 0, 0]))
    await act(async () => step(1 / 60))
    expect(placementAtBench()?.pose).toBe('stand')
    expect(stateAtBench()).toBe('standing')
    // Something left where he would stand keeps him away the next time.
    await act(async () => probeGeofences(outside, [0, 0, 0]))
    const remove = obstacle(bench.position, [0.1, 0.3, 0.1])
    await act(async () => probeGeofences(salon, [0, 0, 0]))
    await act(async () => step(1 / 60))
    expect(useSloperator.getState().spawns.lobby_east_bench).toEqual({
      detection: 'blocked',
      result: 'failure',
    })
    expect(stateAtBench()).toBe('kept_away')
    remove()
  })
  test('spawn_sloperator brings him to a sight right away and keeps him there wherever the player goes, until the player leaves its fence after catching sight of him', async () => {
    const outside: Vec3 = [0, 0.9, 0]
    const forge: Vec3 = [-14, 0.9, -24]
    startGeofences(outside)
    await expect(spawnSloperator({sight: 'lobby_bench'})).rejects.toThrow('There is no sight "lobby_bench" in reach. Sights: lodge_east_armchair, lodge_west_armchair, lobby_east_bench, lobby_north_bench, salon_ottoman, exhibition_glass.')
    expect(() => triggerSloperatorSighting({sight: 'salon_ottoman'})).toThrow('The Sloperator is not at salon_ottoman but away; spawn_sloperator brings him there.')
    // Placed as the physics stands, without a step, which a film’s stopped clock never takes, and resolving once React drew him, which the act lets it do
    let spawning: ReturnType<typeof spawnSloperator> | undefined
    await act(async () => {
      spawning = spawnSloperator({sight: 'salon_ottoman'})
    })
    let spawned = await spawning
    expect(spawned).toMatchObject([{
      detection: 'present',
      id: 'salon_ottoman',
      pinned: true,
      pose: 'sit',
      sighted: false,
      state: 'seated',
    }])
    expect(clothAt('salon_ottoman')).toBeDefined()
    // In and out of his fence without catching sight of him, he stays where he is.
    await act(async () => probeGeofences(forge, [0, 0, 0]))
    await act(async () => step(1 / 60))
    await act(async () => probeGeofences(outside, [0, 0, 0]))
    expect(placementAt(useSloperator.getState().spawns, 'salon_ottoman')?.pose).toBe('sit')
    expect(clothAt('salon_ottoman')).toBeDefined()
    // Catching sight of him with the tool, he is in his sight pose at once with instant.
    let sightings: ReturnType<typeof triggerSloperatorSighting> = []
    await act(async () => {
      sightings = triggerSloperatorSighting({
        instant: true,
        sight: 'salon_ottoman',
      })
    })
    expect(sightings).toMatchObject([{
      pose: 'sit',
      sight: 'salon_ottoman',
    }])
    expect(sightings[0].distance).toBeGreaterThan(1)
    expect(useSloperator.getState().sighted as ReadonlyArray<unknown>).toEqual(sightings)
    expect(clothAt('salon_ottoman')!.geometry.boundingBox!.max.y).toBeGreaterThan(1.8)
    expect(() => triggerSloperatorSighting({sight: 'salon_ottoman'})).toThrow('The player already caught sight of him at salon_ottoman.')
    // Leaving the fence after that leaves his Slop and ends the pin, as ever.
    await act(async () => probeGeofences(forge, [0, 0, 0]))
    await act(async () => probeGeofences(outside, [0, 0, 0]))
    expect(Object.keys(useSloperator.getState().slopped)).toEqual(['salon_ottoman'])
    expect(useSloperator.getState().pinned).toEqual([])
    expect(clothAt('salon_ottoman')).toBeUndefined()
    // Brought there anew, he forgets his Slop and the sighting.
    await act(async () => {
      spawning = spawnSloperator({sight: 'salon_ottoman'})
    })
    spawned = await spawning
    expect(spawned).toMatchObject([{
      pinned: true,
      sighted: false,
      state: 'seated',
    }])
    expect(useSloperator.getState().slopped).toEqual({})
  })
  test('without a sight, spawn_sloperator brings him to the sight of the fence the player is in and trigger_sloperator_sighting catches sight of him wherever he is drawn, and neither does anything where there is no such sight', async () => {
    startGeofences([0, 0.9, 0])
    // In the Lobby, in none of his fences, with him drawn nowhere
    expect(await spawnSloperator({})).toEqual([])
    expect(triggerSloperatorSighting({instant: true})).toEqual([])
    expect(useSloperator.getState()).toMatchObject({
      pinned: [],
      sighted: [],
      spawns: {},
    })
    // In the Salon, the east bench’s fence, before the physics stepped
    const salon: Vec3 = [14, 0.9, -24]
    await act(async () => probeGeofences(salon, [0, 0, 0]))
    let spawning: ReturnType<typeof spawnSloperator> | undefined
    await act(async () => {
      spawning = spawnSloperator({})
    })
    expect(await spawning).toMatchObject([{
      id: 'lobby_east_bench',
      pinned: true,
      pose: 'sit',
      state: 'seated',
    }])
    let sightings: ReturnType<typeof triggerSloperatorSighting> = []
    await act(async () => {
      sightings = triggerSloperatorSighting({instant: true})
    })
    expect(sightings).toMatchObject([{
      pose: 'sit',
      sight: 'lobby_east_bench',
    }])
    expect(benchTop()).toBeGreaterThan(1.85)
    // Caught sight of already, he is no more to catch sight of.
    expect(triggerSloperatorSighting({})).toEqual([])
    // Brought there anew while he stands in his sight pose, he sits down in his neutral pose again, and the tool resolves once he is drawn so.
    await act(async () => {
      spawning = spawnSloperator({})
    })
    expect(await spawning).toMatchObject([{
      id: 'lobby_east_bench',
      sighted: false,
      state: 'seated',
    }])
    expect(benchTop()).toBeLessThan(1.55)
    // With him pinned to the ottoman as well, both are caught sight of, in the order of his sights.
    await act(async () => {
      spawning = spawnSloperator({sight: 'salon_ottoman'})
    })
    await spawning
    await act(async () => {
      sightings = triggerSloperatorSighting({})
    })
    expect(sightings.map(sighting => sighting.sight)).toEqual(['lobby_east_bench', 'salon_ottoman'])
  })
  test('while rooms load, which holds the physics still, spawn_sloperator waits for its first step once they are in, which places him like entering the fence', async () => {
    startGeofences([0, 0.9, 0])
    usePhysicsHold.setState({held: true})
    let spawning: ReturnType<typeof spawnSloperator> | undefined
    const pending = Symbol('pending')
    try {
      await act(async () => {
        spawning = spawnSloperator({sight: 'lodge_east_armchair'})
        expect(await Promise.race([spawning, Bun.sleep(50).then(() => pending)])).toBe(pending)
      })
      expect(useSloperator.getState().spawns).toEqual({})
      expect(dumpSloperator().find(({id}) => id === 'lodge_east_armchair')!.state).toBe('waiting')
    } finally {
      usePhysicsHold.setState({held: false})
    }
    await act(async () => step(1 / 60))
    expect(await spawning).toMatchObject([{
      detection: 'present',
      pinned: true,
      pose: 'sit_armchair',
      state: 'seated',
    }])
    expect(clothAt('lodge_east_armchair')).toBeDefined()
  })
  test('only zoomed in all the way does aiming at him catch sight of him, and from then on he gets up over the frames that follow', async () => {
    startGeofences([0, 0.9, 0])
    let spawning: ReturnType<typeof spawnSloperator> | undefined
    await act(async () => {
      spawning = spawnSloperator({sight: 'lobby_east_bench'})
    })
    await spawning
    await frames(0.1)
    const cloth = clothAt('lobby_east_bench')!
    const seatedTop = cloth.geometry.boundingBox!.max.y
    // In front of him by the fountain, looking at his head
    const [x, , z] = bench.position
    const {camera} = view
    camera.position.set(x - 4, 1.6, z)
    camera.lookAt(x, 1.3, z)
    for (const zoom of [0, 0.5, 0.99]) {
      setPlayerZoom(zoom)
      await frames(0.2)
      expect(useSloperator.getState().sighted).toEqual([])
    }
    // Zoomed in, looking away, nothing happens either.
    setPlayerZoom(1)
    camera.lookAt(x, 1.3, z + 5)
    await frames(0.2)
    expect(useSloperator.getState().sighted).toEqual([])
    camera.lookAt(x, 1.3, z)
    await frames(1 / 60)
    const [sighting] = useSloperator.getState().sighted
    expect(sighting).toMatchObject({
      pose: 'sit',
      sight: 'lobby_east_bench',
    })
    expect(sighting.distance).toBeGreaterThan(3.5)
    expect(sighting.distance).toBeLessThan(4)
    // Halfway through his move he is on his way up, and once it is over he stands.
    await frames(0.9)
    const rising = cloth.geometry.boundingBox!.max.y
    expect(rising).toBeGreaterThan(seatedTop + 0.05)
    expect(rising).toBeLessThan(1.85)
    await frames(1.2)
    expect(cloth.geometry.boundingBox!.max.y).toBeGreaterThan(1.85)
  })
})
