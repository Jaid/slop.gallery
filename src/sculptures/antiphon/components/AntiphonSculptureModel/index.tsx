import type {SculptureModelProps} from '#src/sculptures/index.ts'

import {ConvexHullCollider} from '@react-three/rapier'
import useDisposable from 'disposable-lifetime/react'
import {useMemo} from 'react'

import AntiphonGeometry from '../../AntiphonGeometry.ts'

export default function AntiphonSculptureModel({mass, material}: SculptureModelProps) {
  const geometry = useDisposable(useMemo(() => new AntiphonGeometry, []))
  return <>
    {geometry.hulls.map(({points, share}, i) => <ConvexHullCollider key={i} args={[points]} mass={mass * share} />)}
    <mesh castShadow geometry={geometry} material={material} name='sculpture-antiphon' receiveShadow />
  </>
}
