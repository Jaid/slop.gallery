import type {SculptureModelProps} from '#src/sculptures/index.ts'

import {CuboidCollider, RigidBody} from '@react-three/rapier'
import useDisposable from 'disposable-lifetime/react'
import {useMemo} from 'react'

import CrumbledStoneGeometry from '#src/lib/gallery/CrumbledStoneGeometry.ts'

import {blockSize} from '../../config.ts'

export default function BlockSculptureModel({material}: SculptureModelProps) {
  const [width, height, depth] = blockSize
  const geometry = useDisposable(useMemo(() => new CrumbledStoneGeometry(blockSize), []))
  return <RigidBody colliders={false} position={[0, height / 2, 0]} type='fixed'>
    <CuboidCollider args={[width / 2, height / 2, depth / 2]} />
    <mesh castShadow geometry={geometry} material={material} name='sculpture-block' receiveShadow />
  </RigidBody>
}
