import type {SculptureModelProps} from '#src/sculptures/index.ts'

import {CuboidCollider} from '@react-three/rapier'
import useDisposable from 'disposable-lifetime/react'
import {useMemo} from 'react'

import CrumbledStoneGeometry from '#src/lib/gallery/CrumbledStoneGeometry.ts'

import {blockSize} from '../../config.ts'

export default function BlockSculptureModel({mass, material}: SculptureModelProps) {
  const [width, height, depth] = blockSize
  const geometry = useDisposable(useMemo(() => new CrumbledStoneGeometry(blockSize), []))
  return <group position={[0, height / 2, 0]}>
    <CuboidCollider args={[width / 2, height / 2, depth / 2]} mass={mass} />
    <mesh castShadow geometry={geometry} material={material} name='sculpture-block' receiveShadow />
  </group>
}
