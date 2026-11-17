import type {DestructibleLeaf} from '#src/lib/gallery/destructiblePlants/base/DestructibleGeometry.ts'
import type PlantAttachment from '#src/lib/physics/PlantAttachment.ts'

import {ConvexHullCollider} from '@react-three/rapier'
import Branch from 'branch-component'

import GrabbableProp from '#src/components/Scene/GrabbableProp.tsx'
import decorationResources from '#src/lib/gallery/plantDecorations/DecorationResources.ts'
import initializeFoliageCollider from '#src/lib/physics/initializeFoliageCollider.ts'
import {leafPhysics} from '#src/lib/physics/plantPhysics.ts'

export default function DestructiblePlantLeaf({id, leaf, attachments, foliageMaterial}: {
  attachments: PlantAttachment
  foliageMaterial: 'foliage' | 'waxyFoliage'
  id: string
  leaf: DestructibleLeaf
}) {
  const resources = decorationResources()
  return <GrabbableProp
    id={id} colliders={false} position={leaf.position} rotation={leaf.rotation} title={leaf.title} type='fixed' {...leafPhysics}
    recoverAsDynamic={attachments.recoverLeafAsDynamic}
    onAttachmentChange={attached => attachments.setLeafAttached(id, attached)}
  >
    <ConvexHullCollider args={[leaf.vertices]} mass={leaf.mass} ref={initializeFoliageCollider} />
    <mesh castShadow geometry={leaf.geometry} material={resources[foliageMaterial]} name='pluckable-blade' receiveShadow />
    <Branch all={[leaf.stem, leaf.stemVertices]}>
      <ConvexHullCollider args={[leaf.stemVertices!]} mass={leaf.stemMass} ref={initializeFoliageCollider} />
      <mesh castShadow geometry={leaf.stem!} material={resources.stems} name='carried-stalk' receiveShadow />
    </Branch>
  </GrabbableProp>
}

