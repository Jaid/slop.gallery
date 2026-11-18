import {color, float, max, min, mix, mx_noise_float, positionGeometry, vec2, vec3} from 'three/tsl'
import {DoubleSide, MeshBasicNodeMaterial, MeshPhysicalNodeMaterial, MeshStandardNodeMaterial, MultiplyBlending} from 'three/webgpu'

import salon from '#src/lib/gallery/salon.ts'
import {heightNormal, inside, line, visibleDetail} from '#src/lib/materials/filters.ts'

/** Lime and marble dust, lightly burnished. Two ruled lines and a five-leaf anthemion in each spandrel pick up the wall painter’s ochre. */
export function paintedStucco() {
  const material = new MeshStandardNodeMaterial({vertexColors: true})
  material.name = 'Salon • polychrome stucco'
  const p = positionGeometry.xz
  const cloud = mx_noise_float(vec3(p.mul(0.85), 2.4)).mul(0.08).add(mx_noise_float(vec3(p.mul(vec2(4, 6)), 5.1)).mul(0.035))
  const footprint = max(p.x.fwidth(), p.y.fwidth())
  const grit = mx_noise_float(vec3(p.mul(80), 1.5)).mul(visibleDetail(footprint, 0.025))
  const margin = vec2(salon.size[0] / 2, salon.size[1] / 2).sub(p.abs())
  const edge = min(margin.x, margin.y)
  const ruled = max(line(edge.sub(0.49), 0.008), line(edge.sub(0.55), 0.02))
  const stalk = margin.x.add(margin.y).sub(1.42).mul(Math.SQRT1_2)
  const across = margin.x.sub(margin.y).abs().mul(Math.SQRT1_2)
  // Fold both halves of the fan together. Each leaf sweeps outward from a common heel.
  const leaf = (angle: number, length: number, width: number) => {
    const along = stalk.mul(Math.cos(angle)).add(across.mul(Math.sin(angle)))
    const side = across.mul(Math.cos(angle)).sub(stalk.mul(Math.sin(angle)))
    const t = along.div(length).clamp(0, 1)
    const bow = t.mul(t).mul(angle * 0.19)
    return inside(max(side.sub(bow).abs().sub(t.mul(Math.PI).sin().mul(width)), max(along.negate(), along.sub(length))))
  }
  const leaves = max(leaf(0, 1.4, 0.094), leaf(0.36, 1.16, 0.085), leaf(0.82, 0.81, 0.07))
  const painted = mix(vec3(1), color('#af8254'), max(ruled, leaves).mul(0.83))
  material.colorNode = painted.mul(cloud.add(1).add(grit.mul(0.02)))
  material.normalNode = heightNormal(cloud.mul(0.002).add(grit.mul(0.00009)))
  material.roughnessNode = float(0.63).sub(cloud).add(grit.mul(0.04))
  return material
}

/** Mouth-blown sheet glass: its draw lines just disturb the sky, rather than filling the opening with a frosted diffuser. */
export function sheetGlass(heavy: boolean) {
  const sheet = {
    name: 'Salon • tinted sheet glass',
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
    forceSinglePass: true,
  } as const
  if (!heavy) {
    // Filter the existing sky color directly, with no backdrop copy or refraction pass.
    return new MeshBasicNodeMaterial({
      ...sheet,
      premultipliedAlpha: true,
      blending: MultiplyBlending,
    })
  }
  const material = new MeshPhysicalNodeMaterial({
    ...sheet,
    roughness: 0.055,
    ior: 1.51,
    transmission: 1,
    thickness: 0.018,
    envMapIntensity: 0.65,
  })
  const p = positionGeometry.xz
  const wave = mx_noise_float(vec3(p.mul(vec2(2.8, 8)), 1.1))
  const seeds = mx_noise_float(vec3(p.mul(32), 9)).mul(visibleDetail(max(p.x.fwidth(), p.y.fwidth()), 1 / 32))
  material.normalNode = heightNormal(wave.mul(0.0017).add(seeds.mul(0.00016)))
  return material
}
