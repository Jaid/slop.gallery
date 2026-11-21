import type {SculptureModelProps} from '#src/sculptures/index.ts'

import {ConvexHullCollider} from '@react-three/rapier'
import useDisposable from 'disposable-lifetime/react'
import {useMemo} from 'react'

import carvingGeometry from '../../carvingGeometry.ts'

export default function TungTungTungSahurSculptureModel({mass, material}: SculptureModelProps) {
  const {geometry, hulls} = useMemo(carvingGeometry, [])
  useDisposable(geometry)
  return <>
    {hulls.map(({points, share}, i) => <ConvexHullCollider key={i} args={[points]} mass={mass * share} />)}
    <mesh castShadow geometry={geometry} material={material} name='sculpture-tung_tung_tung_sahur' receiveShadow />
  </>
}
