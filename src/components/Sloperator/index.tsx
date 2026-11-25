import type {SloperatorPlacement} from '#src/lib/gallery/sloperator/placement.ts'
import type {Sighting} from '#src/lib/gallery/sloperator/sightings.ts'
import type {SloperatorSightId} from '#src/lib/gallery/sloperator/sights.ts'
import type {Group, NodeMaterial} from 'three/webgpu'

import {useFrame, useThree} from '@react-three/fiber'
import {useAfterPhysicsStep, useRapier} from '@react-three/rapier'
import useDisposable from 'disposable-lifetime/react'
import hsl from 'okhsl'
import {useEffect, useLayoutEffect, useMemo, useRef, useState} from 'react'
import {MeshStandardNodeMaterial, Vector3} from 'three/webgpu'

import Curio from '#component/Curio'
import Slop from '#src/lib/gallery/curios/slop/Slop.ts'
import {useGeofences} from '#src/lib/gallery/geofences.ts'
import {usePhysicsHold} from '#src/lib/gallery/roomLoading.ts'
import {furnitureBody, placeSloperator} from '#src/lib/gallery/sloperator/placement.ts'
import {isShowingSloperatorSightings} from '#src/lib/gallery/sloperator/showSightings.ts'
import {awaitsSpawn, dumpSightings, pinSight, placementAt, sightSloperator, spawnAtSight, useSightWatched, useSloperator} from '#src/lib/gallery/sloperator/sightings.ts'
import sights, {slopRandom} from '#src/lib/gallery/sloperator/sights.ts'
import SloperatorGeometry from '#src/lib/gallery/sloperator/SloperatorGeometry.ts'
import {environmentSeed} from '#src/lib/gameSeed.ts'
import {lightIndoors} from '#src/lib/materials/lights/index.ts'
import SlopMaterial from '#src/lib/materials/SlopMaterial.ts'
import {isPlayerZoomedIn} from '#src/lib/rendering/playerView.ts'
import Sightline from '#src/lib/rendering/Sightline.ts'
import {telemetry} from '#src/lib/telemetry/index.ts'
import recordSloperatorSights from '#src/lib/telemetry/recordSloperatorSights.ts'
import recordSloperatorSpawns from '#src/lib/telemetry/recordSloperatorSpawns.ts'
import {provideSloperator} from '#src/lib/webmcp/sloperator.ts'
import slopGallery from '#src/worlds/gallery/index.ts'

import SightBounds from './SightBounds.tsx'

type Sight = typeof sights[number]
/** him where he is drawn: the placement he is drawn by, and what the `trigger_sloperator_sighting` tool asks of him, catching sight of him from where the camera is, in his sight pose right away if `instant` */
type FigureHandle = {
  placement: SloperatorPlacement
  sight: (instant: boolean) => Sighting
}

/** the sights in rooms in reach, see `World.reach` */
const present = sights.filter(sight => slopGallery.reach.covers(sight.room))
/** how long a sightline found blocked stays so before it is looked along again, in milliseconds: looking takes every mesh in sight */
const blockedFor = 100
/** how long he may take to be placed and drawn where `spawn_sloperator` brings him, in milliseconds */
const drawTimeout = 20_000
/** Resolves once `done` tells it is, looking every 10 ms, which takes no animation frame, or fails after {@link drawTimeout} with `failure`. */
async function until(done: () => boolean, failure: string) {
  const deadline = Date.now() + drawTimeout
  while (!done()) {
    if (Date.now() > deadline) {
      throw new Error(failure)
    }
    await new Promise(resolve => setTimeout(resolve, 10))
  }
}
const eye = new Vector3
const middle = new Vector3
/** Lights what he is made of like the room he is in. */
const lit = <T extends NodeMaterial>(material: T, {indoors}: Sight) => (indoors ? lightIndoors(material) : material)
/** Where he is drawn now, by sight. */
const figures = new Map<SloperatorSightId, FigureHandle>
/**
 * The Sloperator, the bowler-hatted gentleman of the gallery’s icon, at his sights about the gallery, see `sloperator/sights.ts`: at each, he only turns up while the player’s place is in the sight’s fence, where his seat or the spot he stands on can be seen from afar, and is gone as soon as the player leaves it.
 * Once the player caught sight of him at a sight, he gets up off his seat or brings his hands behind his back, and once the player has left the fence, a Slop lies there instead from then on, where he was, in the same green as the slop in front of his face there, which the seed rolls per sight.
 */
export default function Sloperator() {
  const physics = useRapier()
  useEffect(() => {
    if (telemetry) {
      const stops = [recordSloperatorSpawns(telemetry, useSloperator), recordSloperatorSights(telemetry, useSloperator)]
      return () => {
        for (const stop of stops) {
          stop()
        }
      }
    }
  }, [])
  useEffect(() => {
    const dump = (dumped: ReadonlyArray<Sight>) => dumpSightings(dumped, furniture => {
      const seat = furnitureBody(physics, furniture.body)
      return seat && {
        rotation: seat.rotation(),
        translation: seat.translation(),
      }
    })
    return provideSloperator({
      dump: () => dump(present),
      // Pinned, the physics places him on its next step like on entering the fence, but while rooms still load, it holds still and has not seen his seat yet. Otherwise, it places him right away, as on that step, which a film’s stopped clock never takes. React draws him without an animation frame.
      spawn: async ({sight: id}) => {
        const {fences} = useGeofences.getState()
        const chosen = id === undefined ? present.filter(({fence}) => fences.includes(fence)) : [presentSight(id)]
        const {held} = usePhysicsHold.getState()
        for (const sight of chosen) {
          pinSight(sight.id)
          if (!held) {
            spawnAtSight(sight.id, placeSloperator(physics, sight, sight.furniture && furnitureBody(physics, sight.furniture.body)))
          }
        }
        await Promise.all(chosen.map(async ({id: sight}) => {
          await until(() => useSloperator.getState().spawns[sight] !== undefined, `The physics did not place the Sloperator at ${sight} within ${drawTimeout / 1000} s, holding still while rooms load.`)
          // drawn by the placement just taken down, not one from before it, where he was already
          await until(() => {
            const spawn = useSloperator.getState().spawns[sight]
            return spawn?.result === 'failure' || spawn !== undefined && figures.get(sight)?.placement === spawn.placement
          }, `The Sloperator was not drawn at ${sight} within ${drawTimeout / 1000} s.`)
        }))
        return dump(chosen)
      },
      sight: ({instant = false, sight: id}) => {
        if (id === undefined) {
          const {sighted} = useSloperator.getState()
          return present.filter(sight => figures.has(sight.id) && !sighted.some(sighting => sighting.sight === sight.id)).map(sight => figures.get(sight.id)!.sight(instant))
        }
        const sight = presentSight(id)
        const figure = figures.get(sight.id)
        if (!figure) {
          throw new Error(`The Sloperator is not at ${sight.id} but ${dump([sight])[0].state}; spawn_sloperator brings him there.`)
        }
        return [figure.sight(instant)]
      },
    })
  }, [physics])
  return present.map(sight => <SloperatorSight key={sight.id} sight={sight} />)
}

/** The sight in reach, or an error naming those there are. */
function presentSight(id: string) {
  const sight = present.find(candidate => candidate.id === id)
  if (!sight) {
    throw new Error(`There is no sight "${id}" in reach. Sights: ${present.map(candidate => candidate.id).join(', ') || 'none'}${present.length < sights.length ? `, and out of this page’s ?world_reach: ${sights.filter(candidate => !present.includes(candidate)).map(candidate => candidate.id).join(', ')}` : ''}.`)
  }
  return sight
}
function SloperatorSight({sight}: {sight: Sight}) {
  const placement = useSightPlacement(sight)
  const slopped = useSloperator(state => state.slopped[sight.id])
  const slop = useMemo(() => slopped && new Slop(sight, slopped, slopRandom(environmentSeed, sight.id)), [sight, slopped])
  return <>
    {isShowingSloperatorSightings && <SightBounds placement={placement ?? slopped} sight={sight} />}
    {/* His room owns him, so he shows and hides with it, see ownerRoom. */}
    {placement && <group userData={{room: sight.room}}><Figure placement={placement} sight={sight} /></group>}
    {slop && <Curio curio={slop} />}
  </>
}
/**
 * Where he turns up at the sight while the player’s place is in its fence: the physics places him once the player enters it, or starts in it, on the first step it takes after that, when every body stands where it stands then, see {@link placeSloperator}. Out of the fence, the store forgets where, unless the sight is pinned.
 * Undefined while nothing placed him yet, where something keeps him away and once he left his Slop there.
 */
function useSightPlacement(sight: Sight) {
  const physics = useRapier()
  const watched = useSightWatched(sight)
  const placement = useSloperator(state => placementAt(state.spawns, sight.id))
  useAfterPhysicsStep(() => {
    if (awaitsSpawn(sight)) {
      spawnAtSight(sight.id, placeSloperator(physics, sight, sight.furniture && furnitureBody(physics, sight.furniture.body)))
    }
  })
  return watched ? placement : undefined
}
/**
 * The man himself with his cane, sitting on his seat or standing where it stood, or where he stands at a sight without one, made when he appears and disposed of when he is gone. He is nothing to bump into: nobody is in the room while he is.
 * Every frame the player is zoomed in all the way, he asks whether the middle of the view meets him with nothing but glass in between, like the panes of the windows he is seen through, until it does: the player caught sight of him. From then on, he moves into his sight pose, see `SloperatorMotion`.
 */
function Figure({placement, sight}: {
  placement: SloperatorPlacement
  sight: Sight
}) {
  const figure = useRef<Group>(null)
  const camera = useThree(state => state.camera)
  const [sightline] = useState(() => new Sightline)
  /** until when the sightline last found blocked counts as blocked, in milliseconds of the frame clock */
  const blockedUntil = useRef(0)
  /** how far he is on his way into his sight pose */
  const progress = useRef(0)
  const sighted = useSloperator(state => state.sighted.some(sighting => sighting.sight === sight.id))
  const {pose} = placement
  const geometry = useDisposable(useMemo(() => new SloperatorGeometry(pose === 'stand' ? undefined : sight.seat), [pose, sight]))
  // polished walnut
  const cane = useDisposable(useMemo(() => lit(new MeshStandardNodeMaterial({
    color: hsl.integer(51, 57, 22),
    roughness: 0.35,
  }), sight), [sight]))
  const cloth = useDisposable(useMemo(() => lit(new MeshStandardNodeMaterial({
    color: hsl.integer(295, 10, 13),
    roughness: 0.92,
  }), sight), [sight]))
  const skin = useDisposable(useMemo(() => lit(new MeshStandardNodeMaterial({
    color: hsl.integer(55, 22, 67),
    roughness: 0.7,
  }), sight), [sight]))
  // the same green as the Slop he leaves here
  const slime = useDisposable(useMemo(() => lit(new SlopMaterial(slopRandom(environmentSeed, sight.id)), sight), [sight]))
  // Drawn anew where the player already caught sight of him, like in a scene built anew, he is in his sight pose already.
  useLayoutEffect(() => {
    progress.current = useSloperator.getState().sighted.some(sighting => sighting.sight === sight.id) ? 1 : 0
    geometry.pose(progress.current)
  }, [geometry, sight])
  // Where the sighting is forgotten, like spawn_sloperator bringing him there anew, he is back in his neutral pose.
  useLayoutEffect(() => {
    if (!sighted) {
      progress.current = 0
      geometry.pose(0)
    }
  }, [geometry, sighted])
  useEffect(() => {
    const handle: FigureHandle = {
      placement,
      sight: instant => {
        const sighting: Sighting = {
          sight: sight.id,
          distance: figure.current!.localToWorld(middle.copy(geometry.cloth.boundingSphere!.center)).distanceTo(camera.getWorldPosition(eye)),
          pose,
          position: eye.toArray(),
        }
        if (!sightSloperator(sighting)) {
          throw new Error(`The player already caught sight of him at ${sight.id}.`)
        }
        if (instant) {
          progress.current = 1
          geometry.pose(1)
        }
        return sighting
      },
    }
    figures.set(sight.id, handle)
    return () => {
      if (figures.get(sight.id) === handle) {
        figures.delete(sight.id)
      }
    }
  }, [camera, geometry, placement, pose, sight])
  useFrame(({scene}, delta) => {
    if (sighted) {
      if (progress.current < 1) {
        progress.current = Math.min(progress.current + delta / geometry.duration, 1)
        geometry.pose(progress.current)
      }
      return
    }
    if (!figure.current || !isPlayerZoomedIn()) {
      return
    }
    const distance = sightline.distanceTo(figure.current, camera)
    const now = performance.now()
    if (distance === undefined || now < blockedUntil.current) {
      return
    }
    if (sightline.blocked(scene, figure.current, distance)) {
      blockedUntil.current = now + blockedFor
      return
    }
    sightSloperator({
      sight: sight.id,
      distance,
      pose,
      position: camera.getWorldPosition(eye).toArray(),
    })
  })
  return <group name='sloperator' position={placement.position} rotation={[0, placement.yaw, 0]} ref={figure}>
    <mesh castShadow geometry={geometry.cane} material={cane} name='sloperator-cane' receiveShadow />
    <mesh castShadow geometry={geometry.cloth} material={cloth} name='sloperator-cloth' receiveShadow />
    <mesh castShadow geometry={geometry.skin} material={skin} name='sloperator-skin' receiveShadow />
    <mesh castShadow geometry={geometry.slime} material={slime} name='sloperator-slime' receiveShadow />
  </group>
}
