import type {KnotEntry} from 'knot-materials'

import {ConvexHullCollider, useBeforePhysicsStep} from '@react-three/rapier'
import useDisposable from 'disposable-lifetime/react'
import {special, unknown} from 'knot-materials'
import {knotExhibition, knotFloatHeight, knotRarityMode} from 'knot-materials/exhibition.ts'
import {createKnotGeometry} from 'knot-materials/geometry.ts'
import KnotMaterials from 'knot-materials/KnotMaterials.ts'
import loadKnotMaterial from 'knot-materials/materials.ts'
import {knotSign, knotSignPosition} from 'knot-materials/signs.ts'
import {useEffect, useMemo, useSyncExternalStore} from 'react'

import InteractiveObject from '#component/InteractiveObject'
import KnotLabels from '#component/KnotLabels'
import GrabbableProp, {propObjects} from '#src/components/Scene/GrabbableProp.tsx'
import {animationTimeOverride} from '#src/lib/frozenTime.ts'
import {narrate, narrateModel, notify} from '#src/lib/gallery/actions.ts'
import {trackLoadingItems} from '#src/lib/loadingItems.ts'
import {knotMass} from '#src/lib/physics/knotPhysics.ts'
import KnotRotation from '#src/lib/physics/KnotRotation.ts'
import {readKnotRotation} from '#src/lib/physics/rotatingKnots.ts'
import {getPmremEnvironment} from '#src/lib/rendering/pmrem.ts'
import {knotRarityEditor} from '#src/worlds/knottingham/rarity.ts'

const isRotating = readKnotRotation()
/** A core sits inside its shell, which takes every hit. */
const ignoreRaycast = () => {}
const baseRadius = (() => {
  const geometry = createKnotGeometry()
  geometry.computeBoundingSphere()
  const radius = geometry.boundingSphere!.radius
  geometry.dispose()
  return radius
})()
/** every exhibited Knot’s nameplate, beside it and turned in toward its row */
const signs = knotExhibition.map(exhibit => ({
  entry: exhibit,
  position: knotSignPosition(exhibit),
  rotation: exhibit.rotation + knotSign.inwardRotation,
}))
/** E on a nameplate announces its Knot, or with `?rarity=edit` rates it one star higher. */
const activateKnotSign = (entry: Pick<KnotEntry, 'id' | 'title'>) => {
  if (knotRarityMode !== 'edit') {
    narrate(`prop-knot-${entry.id}`)
    return
  }
  const value = knotRarityEditor.cycle(entry.id)
  let rating = `${value}/4 stars`
  if (value === unknown) {
    rating = 'unknown'
  } else if (value === special) {
    rating = 'special, only shown on request'
  }
  notify(`${entry.title}: ${rating}`)
}

/** The nameplates stand from the start, while each Knot only enters once its shader has arrived and then wears its full material right away, leaving it to the renderer to stream it in. */
export default function KnotExhibition() {
  const ratings = useSyncExternalStore(knotRarityEditor.subscribe, knotRarityEditor.getSnapshot, knotRarityEditor.getSnapshot)
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
    for (const exhibit of knotExhibition) {
      const body = propObjects.get(`prop-knot-${exhibit.id}`)?.body
      if (body) {
        rotation.step(body)
      }
    }
  })
  const materials = useDisposable(useMemo(() => new KnotMaterials(knotExhibition, loadKnotMaterial, getPmremEnvironment()), []))
  const worn = useSyncExternalStore(materials.subscribe, materials.getSnapshot, materials.getSnapshot)
  useEffect(() => trackLoadingItems(() => materials.pendingMaterials.map(id => `knot-material:${id}`)), [materials])
  const {resources} = materials
  return <group name='lobby-knot-exhibition'>
    <KnotLabels action={knotRarityMode === 'edit' ? 'Rate' : 'Listen'} ratings={ratings} signs={signs} onActivate={activateKnotSign} />
    {knotExhibition.map((finish, index) => {
      const material = worn[index]
      if (!material) {
        return null
      }
      const {geometry, colliderVertices} = resources.items[index]
      const {coreMaterial} = material
      const id = `prop-knot-${finish.id}`
      const body = () => propObjects.get(id)?.body
      const outOfShowcase = () => {
        const current = body()
        return current !== undefined && !rotation.isShowcased(current)
      }
      return <GrabbableProp
        key={finish.id} id={id} blockedMessage={() => 'Knock this Knot out of its showcase first.'} canGrab={outOfShowcase} colliders={false} orbit={{radius: baseRadius + (finish.displacement ?? 0)}} position={[finish.position[0], knotFloatHeight, finish.position[2]]} recoverAsDynamic={outOfShowcase} rotation={[0, finish.rotation, 0]} title={`${finish.label} · ${finish.title} · ${finish.modelTitle}`} type='fixed'
      >
        <ConvexHullCollider
          args={[colliderVertices]} contactSkin={finish.displacement ?? 0} mass={knotMass} onContactForce={({target}) => {
            if (target.rigidBody) {
              rotation.release(target.rigidBody)
            }
          }}
        />
        <InteractiveObject id={id} action='Listen' inspectable title={finish.title} onActivate={() => narrateModel(id)}>
          <mesh castShadow material={material} name={`knot-${finish.id}`} raycast={resources.raycast} receiveShadow>
            <primitive attach='geometry' object={geometry} />
            {coreMaterial && <mesh castShadow material={coreMaterial} name={`knot-${finish.id}-core`} raycast={ignoreRaycast} receiveShadow>
              <primitive attach='geometry' object={geometry} />
            </mesh>}
          </mesh>
        </InteractiveObject>
      </GrabbableProp>
    })}
  </group>
}
