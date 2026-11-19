import type {Group, NodeMaterial} from 'three/webgpu'

import {useFrame} from '@react-three/fiber'
import Branch from 'branch-component'
import useDisposable from 'disposable-lifetime/react'
import {useEffect, useMemo, useRef, useState} from 'react'
import {MeshStandardNodeMaterial, Vector3} from 'three/webgpu'

import Curio from '#component/Curio'
import Slop from '#src/lib/gallery/curios/slop/Slop.ts'
import {sightSloperator, useSloperator, useSloperatorSeated} from '#src/lib/gallery/sloperator/sightings.ts'
import sights, {slopRandom} from '#src/lib/gallery/sloperator/sights.ts'
import SloperatorGeometry from '#src/lib/gallery/sloperator/SloperatorGeometry.ts'
import {environmentSeed} from '#src/lib/gameSeed.ts'
import {lightIndoors} from '#src/lib/materials/lights/index.ts'
import SlopMaterial from '#src/lib/materials/SlopMaterial.ts'
import Sightline from '#src/lib/rendering/Sightline.ts'
import {telemetry} from '#src/lib/telemetry/index.ts'
import recordSloperatorSights from '#src/lib/telemetry/recordSloperatorSights.ts'
import slopGallery from '#src/worlds/gallery/index.ts'

type Sight = typeof sights[number]

/** the sights in rooms in reach, see `World.reach` */
const present = sights.filter(sight => slopGallery.reach.covers(sight.room))
/** how long a sightline found blocked stays so before it is looked along again, in milliseconds: looking takes every mesh in sight */
const blockedFor = 100
const eye = new Vector3
/** Lights what he is made of like the room he sits in. */
const lit = <T extends NodeMaterial>(material: T, {indoors}: Sight) => (indoors ? lightIndoors(material) : material)

/**
 * The Sloperator, the bowler-hatted gentleman of the gallery’s icon, at his sights about the gallery, see `sloperator/sights.ts`: at each, he only sits while the player’s place is in the sight’s fence, where his seat can be seen from afar, and is gone as soon as the player leaves it.
 * Once the player caught sight of him at a sight, a Slop lies there instead from then on, where he sat, in the same green as the slop in front of his face there, which the seed rolls per sight.
 */
export default function Sloperator() {
  useEffect(() => {
    if (telemetry) {
      return recordSloperatorSights(telemetry, useSloperator)
    }
  }, [])
  return present.map(sight => <SloperatorSight key={sight.id} sight={sight} />)
}

function SloperatorSight({sight}: {sight: Sight}) {
  const seated = useSloperatorSeated(sight)
  const slopped = useSloperator(state => state.slopped.includes(sight.id))
  const slop = useMemo(() => new Slop(sight, slopRandom(environmentSeed, sight.id)), [sight])
  return <>
    {/* His room owns him, so he shows and hides with it, see ownerRoom. */}
    <Branch if={seated}><group userData={{room: sight.room}}><Figure sight={sight} /></group></Branch>
    <Branch if={slopped}><Curio curio={slop} /></Branch>
  </>
}
/**
 * The man himself on his seat, made when he appears and disposed of when he is gone. He is nothing to bump into: nobody is in the room while he is.
 * Every frame, he asks whether the middle of the view meets him with nothing but glass in between, like the panes of the windows he is seen through, until it does: the player caught sight of him.
 */
function Figure({sight}: {sight: Sight}) {
  const figure = useRef<Group>(null)
  const [sightline] = useState(() => new Sightline)
  /** until when the sightline last found blocked counts as blocked, in milliseconds of the frame clock */
  const blockedUntil = useRef(0)
  const sighted = useSloperator(state => state.sighted.some(sighting => sighting.sight === sight.id))
  const geometry = useDisposable(useMemo(() => new SloperatorGeometry(sight.seat), [sight]))
  const cloth = useDisposable(useMemo(() => lit(new MeshStandardNodeMaterial({
    color: '#1d1c21',
    roughness: 0.92,
  }), sight), [sight]))
  const skin = useDisposable(useMemo(() => lit(new MeshStandardNodeMaterial({
    color: '#b79d8c',
    roughness: 0.7,
  }), sight), [sight]))
  // The same green as the Slop he leaves here
  const slime = useDisposable(useMemo(() => lit(new SlopMaterial(slopRandom(environmentSeed, sight.id)), sight), [sight]))
  useFrame(({camera, scene}) => {
    if (sighted || !figure.current) {
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
      position: camera.getWorldPosition(eye).toArray(),
    })
  })
  return <group name='sloperator' position={sight.position} rotation={[0, sight.yaw, 0]} ref={figure}>
    <mesh castShadow geometry={geometry.cloth} material={cloth} name='sloperator-cloth' receiveShadow />
    <mesh castShadow geometry={geometry.skin} material={skin} name='sloperator-skin' receiveShadow />
    <mesh castShadow geometry={geometry.slime} material={slime} name='sloperator-slime' receiveShadow />
  </group>
}
