import type {Frustum, Light, LightShadow, PerspectiveCamera} from 'three/webgpu'

import {Sphere} from 'three/webgpu'

type RangedLight = Light & {
  distance?: number
  isPointLight?: boolean
  isSpotLight?: boolean
  shadow: LightShadow<PerspectiveCamera>
}

const reach = new Sphere

/** Whether the light can shine on anything inside the frustum, where its shadows would show: a point or spot light within its range or else its shadow camera’s, any other light everywhere. */
export default function reachesFrustum(light: Light, frustum: Frustum) {
  const {distance, isPointLight, isSpotLight, matrixWorld, shadow} = light as RangedLight
  if (!isPointLight && !isSpotLight) {
    return true
  }
  reach.center.setFromMatrixPosition(matrixWorld)
  reach.radius = distance || shadow.camera.far
  return frustum.intersectsSphere(reach)
}
