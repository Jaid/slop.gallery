import type {SculptureModelProps} from '#src/sculptures/index.ts'

import {ConvexHullCollider} from '@react-three/rapier'
import useDisposable from 'disposable-lifetime/react'
import {useMemo} from 'react'

import SahurMaterial from '../../SahurMaterial.ts'
import TungTungTungSahurGeometry from '../../TungTungTungSahurGeometry.ts'

export default function TungTungTungSahurModel({mass}: SculptureModelProps) {
  const geometry = useDisposable(useMemo(() => new TungTungTungSahurGeometry, []))
  const material = useDisposable(useMemo(() => new SahurMaterial, []))
  return <>
    {geometry.hulls.map(({points, share}, i) => <ConvexHullCollider key={i} args={[points]} mass={mass * share} />)}
    <mesh castShadow geometry={geometry} material={material} name='sculpture-tung_tung_tung_sahur' receiveShadow />
  </>
}
