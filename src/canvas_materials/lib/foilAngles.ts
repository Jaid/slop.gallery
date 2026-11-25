import type {Node} from 'three/webgpu'

import {modelWorldMatrixInverse, positionLocal, uniform} from 'three/tsl'
import {Vector3, Vector4} from 'three/webgpu'

import foilKeyLight from './foilKeyLight.ts'

/** The key and viewer’s half-vector in print space, and how directly the strongest scene light shines on the face. */
export default function foilAngles(view: Node<'vec3'>) {
  const center = new Vector3
  const source = new Vector4(0, 0, 0, 0)
  const key = uniform(source).onObjectUpdate(({renderer, scene, object}) => foilKeyLight(renderer!.lighting.getNode(scene!).getLights(), center.setFromMatrixPosition(object!.matrixWorld), source))
  const toward = modelWorldMatrixInverse.mul(key).xyz.sub(positionLocal.mul(key.w)).toVar()
  const length = toward.length()
  const light = toward.div(length.max(1e-6))
  const sum = light.add(view)
  return {
    half: sum.div(sum.length().max(1e-6)).toVar('foilHalf'),
    facing: length.greaterThan(0).select(light.z.smoothstep(-0.04, 0.38), 0).toVar('foilFacing'),
  }
}
