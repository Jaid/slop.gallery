import type {Light, Vector4} from 'three/webgpu'

import {DirectionalLight, MathUtils, PointLight, SpotLight, Vector3} from 'three/webgpu'

const position = new Vector3
const direction = new Vector3
const target = new Vector3

/** Writes the strongest direct light at the work’s center: a world-space direction (w = 0), a lamp position (w = 1) or zero under fill alone. The foil follows one source like the review bench’s key, while three shades the material with all the lights. */
export default function foilKeyLight(lights: ReadonlyArray<Light>, center: Vector3, result: Vector4) {
  result.set(0, 0, 0, 0)
  let highest = 0
  for (const light of lights) {
    if (!light.visible || light.intensity <= 0) {
      continue
    }
    const {r, g, b} = light.color
    let level = light.intensity * (r * 0.2126 + g * 0.7152 + b * 0.0722)
    position.setFromMatrixPosition(light.matrixWorld)
    if (light instanceof DirectionalLight) {
      position.sub(target.setFromMatrixPosition(light.target.matrixWorld)).normalize()
    } else if (light instanceof PointLight || light instanceof SpotLight) {
      const distance = position.distanceTo(center)
      if (light.distance > 0) {
        if (distance >= light.distance) {
          continue
        }
        level *= (1 - (distance / light.distance) ** 4) ** 2
      }
      level /= Math.max(0.01, distance ** light.decay)
      if (light instanceof SpotLight) {
        const axis = target.setFromMatrixPosition(light.target.matrixWorld).sub(position).normalize()
        const cosine = direction.subVectors(center, position).normalize().dot(axis)
        level *= MathUtils.smoothstep(cosine, Math.cos(light.angle), Math.cos(light.angle * (1 - light.penumbra)))
      }
    } else {
      continue
    }
    if (!(level > highest)) {
      continue
    }
    highest = level
    result.set(position.x, position.y, position.z, Number(!(light instanceof DirectionalLight)))
  }
  return result
}
