import type {SculptureModelProps} from '#src/sculptures/index.ts'

import {ConvexHullCollider} from '@react-three/rapier'
import useDisposable from 'disposable-lifetime/react'
import {useMemo} from 'react'

import KentonganGeometry from '../../KentonganGeometry.ts'

export default function KentonganSculptureModel({mass, material}: SculptureModelProps) {
  const geometry = useDisposable(useMemo(() => new KentonganGeometry, []))
  return <>
    {geometry.hulls.map(({points, share}, i) => <ConvexHullCollider key={i} args={[points]} mass={mass * share} />)}
    <mesh castShadow geometry={geometry} material={material} name='sculpture-kentongan' receiveShadow />
  </>
}
