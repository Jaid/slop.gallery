import type {SculptureModelProps} from '#src/sculptures/index.ts'

import {ConvexHullCollider} from '@react-three/rapier'
import useDisposable from 'disposable-lifetime/react'
import {useMemo} from 'react'

import CounterflowGeometry from '../../CounterflowGeometry.ts'

export default function CounterflowSculptureModel({mass, material}: SculptureModelProps) {
  const geometry = useDisposable(useMemo(() => new CounterflowGeometry, []))
  return <>
    {geometry.colliders.map(({vertices, massFraction}, i) => <ConvexHullCollider key={i} args={[vertices]} mass={massFraction * mass} />)}
    <mesh castShadow geometry={geometry.ribbon} material={material} name='counterflow-ribbon' receiveShadow />
    <mesh castShadow geometry={geometry.foot} material={material} name='counterflow-foot' receiveShadow />
  </>
}
