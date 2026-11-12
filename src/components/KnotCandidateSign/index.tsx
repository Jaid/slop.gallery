import type {RapierRigidBody} from '@react-three/rapier'
import type {KnotBay} from 'knot-materials/exhibition.ts'

import {CuboidCollider, CylinderCollider, RigidBody, useRevoluteJoint} from '@react-three/rapier'
import useDisposable from 'disposable-lifetime/react'
import {knotLayout} from 'knot-materials/exhibition.ts'
import {candidateSignSuspensionCenter, candidateSignSuspensionHeight, knotCandidateSign} from 'knot-materials/knotCandidateSign.ts'
import KnotCandidateSignGeometry from 'knot-materials/KnotCandidateSignGeometry.ts'
import {useMemo, useRef} from 'react'
import {MeshBasicNodeMaterial, MeshStandardNodeMaterial} from 'three/webgpu'
import useGraphicsMode, {useGraphicsModeValue} from 'use-graphics-mode'

import InteractiveObject from '#component/InteractiveObject'
import KnotCandidateSignFace, {candidateSignBackground, candidateSignTextureSize} from '#component/KnotCandidateSignFace'
import {narrate} from '#src/lib/gallery/actions.ts'
import {knotGalleryBounds} from '#src/lib/gallery/knotGallery.ts'
import {getGraphicsProfile} from '#src/lib/rendering/graphicsMode.ts'
import useLoadingElementTexture from '#src/lib/useLoadingElementTexture.ts'

export default function KnotCandidateSign({bay}: {bay: KnotBay}) {
  const anchor = useRef<RapierRigidBody>(null!)
  const sign = useRef<RapierRigidBody>(null!)
  useRevoluteJoint(anchor, sign, [[0, 0, 0], knotCandidateSign.anchor, knotCandidateSign.axis, knotCandidateSign.limits])
  const isHeavy = useGraphicsMode()
  const {canvasTextureMipmaps: mipmaps, canvasTextureResolution: resolution} = useGraphicsModeValue(getGraphicsProfile)
  const metal = useDisposable(useMemo(() => (isHeavy ? new MeshStandardNodeMaterial({
    color: '#ac9270',
    metalness: 0.85,
    roughness: 0.3,
  }) : new MeshBasicNodeMaterial({color: '#ac9270'})), [isHeavy]))
  const geometry = useDisposable(useMemo(() => new KnotCandidateSignGeometry, []))
  const {candidate} = bay
  const texture = useLoadingElementTexture(`model-sign-texture:${candidate.id}`, useMemo(() => ({
    width: candidateSignTextureSize[0],
    height: candidateSignTextureSize[1],
    resolution,
    name: `Candidate sign: ${candidate.title}`,
    mipmaps,
    render: () => <KnotCandidateSignFace icon={candidate.icon} title={candidate.title} />,
  }), [candidate, mipmaps, resolution]))
  const face = useDisposable(useMemo(() => new MeshBasicNodeMaterial({
    map: texture,
    color: texture ? '#ffffff' : candidateSignBackground,
    toneMapped: false,
  }), [texture]))
  const [width, height, depth] = knotCandidateSign.size
  const placement = knotLayout.candidateSign
  return <group name={`candidate-sign-${candidate.id}`} position={[placement.x, knotGalleryBounds.height - knotCandidateSign.ceilingInset - knotCandidateSign.anchor[1], placement.z]} rotation={[0, placement.rotation, 0]}>
    <RigidBody colliders={false} position={knotCandidateSign.anchor} type='fixed' ref={anchor} />
    <mesh castShadow geometry={geometry.canopy} material={metal} receiveShadow />
    <RigidBody additionalSolverIterations={8} angularDamping={knotCandidateSign.angularDamping} canSleep={false} ccd colliders={false} linearDamping={knotCandidateSign.linearDamping} ref={sign}>
      <CuboidCollider args={[width / 2, height / 2, depth / 2]} mass={knotCandidateSign.mass} restitution={0.15} />
      {knotCandidateSign.suspensionX.map(x => <CylinderCollider key={x} args={[candidateSignSuspensionHeight / 2, 0.014]} mass={knotCandidateSign.suspensionMass} position={[x, candidateSignSuspensionCenter, 0]} />)}
      <InteractiveObject id={`candidate-sign-${candidate.id}`} action='Listen' title={`${candidate.title} sign`} onActivate={() => narrate(`candidate-sign-${candidate.id}`)}>
        <mesh castShadow geometry={geometry.panel} material={[metal, metal, metal, metal, face, face]} receiveShadow />
        <mesh castShadow geometry={geometry.chains} material={metal} receiveShadow />
      </InteractiveObject>
    </RigidBody>
  </group>
}
