import type {ShowcasedKnot} from '#src/lib/gallery/showcasedKnots.ts'

import {ConvexHullCollider, useBeforePhysicsStep} from '@react-three/rapier'
import useDisposable from 'disposable-lifetime/react'
import KnotMaterials from 'knot-materials/KnotMaterials.ts'
import loadKnotMaterial from 'knot-materials/materials.ts'
import {useEffect, useMemo, useSyncExternalStore} from 'react'

import InteractiveObject from '#component/InteractiveObject'
import GrabbableProp, {propObjects} from '#src/components/Scene/GrabbableProp.tsx'
import KnotNarration from '#src/lib/audio/KnotNarration.ts'
import {narrator} from '#src/lib/audio/narration.ts'
import {animationTimeOverride} from '#src/lib/frozenTime.ts'
import {galleryEvents, narrateModel, useGallery} from '#src/lib/gallery.ts'
import showcasedKnots, {knotShowcaseHoverGap} from '#src/lib/gallery/showcasedKnots.ts'
import {trackLoadingItems} from '#src/lib/loadingItems.ts'
import {knotMass} from '#src/lib/physics/knotPhysics.ts'
import KnotRotation from '#src/lib/physics/KnotRotation.ts'
import {readKnotRotation} from '#src/lib/physics/rotatingKnots.ts'
import scaleKnotHull from '#src/lib/physics/scaleKnotHull.ts'
import {getPmremEnvironment} from '#src/lib/rendering/pmrem.ts'

const propId = ({entry}: ShowcasedKnot) => `prop-knot-${entry.id}`
const isRotating = readKnotRotation()
/** A core sits inside its shell, which takes every hit. */
const ignoreRaycast = () => {}

/**
 * Knots floating above their pedestals, rotating until struck for the first time, then falling as loose props to be grabbed or thrown; inspecting one announces its title and its model.
 * Their materials and the announcements only load with them. A Knot only enters once its shader has arrived and then wears its full material right away, leaving it to the renderer to stream it in like the rest of the gallery.
 * `knots` must keep its identity while it stays the same, since a new one builds every material anew.
 */
export default function KnotShowcase({knots}: {knots: ReadonlyArray<ShowcasedKnot>}) {
  const rotation = useMemo(() => new KnotRotation, [])
  useBeforePhysicsStep(world => {
    if (isRotating) {
      const seconds = animationTimeOverride()
      if (seconds === undefined) {
        rotation.advance(world.timestep)
      } else {
        rotation.set(seconds)
      }
    }
    for (const knot of knots) {
      const body = propObjects.get(propId(knot))?.body
      if (body) {
        rotation.step(body)
      }
    }
  })
  const materials = useDisposable(useMemo(() => new KnotMaterials(knots.map(knot => knot.entry), loadKnotMaterial, getPmremEnvironment()), [knots]))
  const worn = useSyncExternalStore(materials.subscribe, materials.getSnapshot, materials.getSnapshot)
  useEffect(() => trackLoadingItems(() => materials.pendingMaterials.map(material => `knot-material:${material}`)), [materials])
  const {resources} = materials
  // The collider vertices are scaled copies, which must keep their identity, or every render rebuilds the colliders.
  const hulls = useMemo(() => knots.map((knot, index) => scaleKnotHull(resources.items[index].colliderVertices, knot.height)), [knots, resources])
  useEffect(() => {
    const ids = knots.map(knot => {
      const id = propId(knot)
      showcasedKnots.set(id, {
        id: knot.entry.id,
        name: knot.entry.title,
        position: knot.position,
        rarity: knot.entry.rarity,
      })
      return id
    })
    return () => {
      for (const id of ids) {
        showcasedKnots.delete(id)
      }
    }
  }, [knots])
  // Inspecting a Knot announces it, as does asking for its narration or its model’s; the announcements’ voices only download once the first one plays.
  useEffect(() => {
    const owner = new AbortController
    const entries = new Map(knots.map(knot => [propId(knot), knot.entry]))
    let announcements: Promise<KnotNarration> | undefined
    const announce = (event: Event, play: (narration: KnotNarration, id: string, entry: ShowcasedKnot['entry']) => void) => {
      const id = (event as CustomEvent<string>).detail
      const entry = entries.get(id)
      if (!entry || !useGallery.getState().sound) {
        return
      }
      announcements ??= import('knot-materials/announcementAssets.ts').then(({default: url}) => new KnotNarration(narrator, url))
      announcements.then(narration => {
        if (!owner.signal.aborted) {
          play(narration, id, entry)
        }
      }).catch((error: unknown) => {
        console.warn('The Knots’ announcements could not be loaded:', error)
      })
    }
    const inspect = (event: Event) => announce(event, (narration, id, entry) => narration.enqueue(entry, {
      id,
      signal: owner.signal,
    }))
    const narrate = (event: Event) => announce(event, (narration, id, entry) => narration.enqueue(entry, {
      id,
      repeat: true,
      signal: owner.signal,
    }))
    const model = (event: Event) => announce(event, (narration, id, entry) => narration.enqueueModel(entry, {
      id,
      signal: owner.signal,
    }))
    galleryEvents.addEventListener('inspect', inspect)
    galleryEvents.addEventListener('narrate', narrate)
    galleryEvents.addEventListener('narrate-model', model)
    return () => {
      galleryEvents.removeEventListener('inspect', inspect)
      galleryEvents.removeEventListener('narrate', narrate)
      galleryEvents.removeEventListener('narrate-model', model)
      owner.abort()
    }
  }, [knots])
  return <>
    {knots.map((knot, index) => {
      const material = worn[index]
      if (!material) {
        return null
      }
      const {entry, position: [x, y, z], rotation: yaw = 0} = knot
      const {geometry} = resources.items[index]
      const {scale, vertices} = hulls[index]
      const {coreMaterial} = material
      const id = propId(knot)
      const skin = (entry.displacement ?? 0) * scale
      const radius = geometry.boundingSphere!.radius * scale + skin
      const body = () => propObjects.get(id)?.body
      const outOfShowcase = () => {
        const current = body()
        return current !== undefined && !rotation.isShowcased(current)
      }
      return <GrabbableProp
        key={id} id={id} blockedMessage={() => 'Knock this Knot out of its showcase first.'} canGrab={outOfShowcase} colliders={false} orbit={{radius}} position={[x, y + radius + knotShowcaseHoverGap, z]} recoverAsDynamic={outOfShowcase} rotation={[0, yaw, 0]} title={`${entry.title} · ${entry.modelTitle}`} type='fixed'
      >
        <ConvexHullCollider
          args={[vertices]} contactSkin={skin} mass={knotMass} onContactForce={({target}) => {
            if (target.rigidBody) {
              rotation.release(target.rigidBody)
            }
          }}
        />
        <InteractiveObject id={id} action='Listen' inspectable title={entry.title} onActivate={() => narrateModel(id)}>
          <mesh castShadow material={material} name={`knot-${entry.id}`} raycast={resources.raycast} receiveShadow scale={scale}>
            <primitive attach='geometry' object={geometry} />
            {coreMaterial && <mesh castShadow material={coreMaterial} name={`knot-${entry.id}-core`} raycast={ignoreRaycast} receiveShadow>
              <primitive attach='geometry' object={geometry} />
            </mesh>}
          </mesh>
        </InteractiveObject>
      </GrabbableProp>
    })}
  </>
}
