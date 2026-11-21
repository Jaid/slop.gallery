import type {SculptureModelProps} from '#src/sculptures/index.ts'

import {ConvexHullCollider} from '@react-three/rapier'
import useDisposable from 'disposable-lifetime/react'
import {useMemo} from 'react'

import SahurGeometry from '../../SahurGeometry.ts'

export default function SahurSculptureModel({mass, material}: SculptureModelProps) {
  const geometry = useDisposable(useMemo(() => new SahurGeometry, []))
  return <>
    {geometry.hulls.map(({points, share}, i) => <ConvexHullCollider key={i} args={[points]} mass={mass * share} />)}
    <mesh castShadow geometry={geometry} material={material} name='sculpture-sahur' receiveShadow />
  </>
}
