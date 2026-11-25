import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {cameraPosition, color, float, mix, mx_fractal_noise_float, mx_noise_float, normalView, normalWorld, normalWorldGeometry, positionGeometry, positionWorld, reflect, refract, vec3} from 'three/tsl'

import {airBubbles} from '../../candidates/space_bunny/lib/airBubbles.ts'
import {backlight} from '../../candidates/space_bunny/lib/backlight.ts'
import {studioRadiance} from '../../candidates/space_bunny/lib/studio.ts'
import {filament} from '../../lib/filament.ts'
import {glints} from '../../lib/glints.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** A ray bending into the ice; total internal reflection mirrors it instead. */
function iceRay(ior: number) {
  const incident = positionWorld.sub(cameraPosition).normalize()
  const bent = refract(incident, normalWorld, float(1).div(ior))
  const alive = bent.dot(bent).greaterThan(0.25).select(float(1), float(0))
  return {
    alive,
    ray: mix(reflect(incident, normalWorld), bent, alive),
  }
}

/** A frozen cathedral. Clear glacial ice, blue to the core where the light has to cross the whole body and white at the edge where the chord is short, with the studio bent through it and split by the 1.31 index. Rime has settled on the upward faces and nowhere else, and it arrives as you come closer: the nearer you stand, the more of the frost, the fracture planes and the air it traps resolve out of the ice. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.45)
    this.name = knotData.id
    const {p, view, facing, grazing, near, intimate} = viewerFrame()
    const up = normalWorldGeometry.y.mul(0.5).add(0.5)
// The chord through the block: long down the belly of every curve, short at the silhouette.
    const chord = facing.mul(3.2).add(0.05)
    const depth = vec3(0.5, 0.2, 0.1).mul(chord).negate().exp()
    const scatter = backlight(normalView, 2.6, 0.5)
// Rime: frost settles on the faces that can see the sky, and only resolves as you approach.
    const bloom = mx_fractal_noise_float(p.mul(26), 3, 2.15, 0.55).mul(0.5).add(0.5).clamp(0, 1)
    const needles = mx_noise_float(p.mul(120)).abs().pow(0.4).oneMinus()
    const rime = up.mul(bloom.smoothstep(0.42, 0.86)).mul(near.mul(0.75).add(0.25)).clamp(0, 1)
// Fracture planes and the air frozen into the core.
    const fracture = filament(mx_noise_float(p.mul(vec3(8, 3, 6)).add(2.1)), 0.018).mul(near.mul(0.6).add(0.4))
    const air = airBubbles(positionGeometry.sub(view.mul(0.05)), 12, 3.7)
    const deepAir = airBubbles(positionGeometry.sub(view.mul(0.14)), 5, 11.9)
    const bent = iceRay(1.31)
    this.colorNode = mix(color(hsl.integer(230, 58, 94)), color(hsl.integer(241, 76, 37)), facing.pow(0.7)).mul(depth.mul(0.45).add(0.62))
      .add(color(hsl.integer(232, 100, 98)).mul(rime).mul(0.85))
    this.metalness = 0
    this.roughnessNode = float(0.045).add(rime.mul(0.5)).add(fracture.mul(0.15)).sub(needles.mul(0.02))
    this.ior = 1.31
    this.clearcoat = 1
    this.clearcoatRoughnessNode = float(0.012).add(needles.mul(0.05))
    this.normalNode = proceduralNormal(rime.mul(0.0016).add(needles.mul(rime).mul(0.0004)).add(fracture.mul(0.0008)), 0.5)
    const sparkle = glints(normalView, 150).mul(rime).mul(near.mul(0.5).add(0.5))
    this.emissiveNode = color(hsl.integer(231, 100, 96)).mul(scatter).mul(mix(float(0.45), float(1.1), grazing)).mul(1.5)
      .add(studioRadiance(bent.ray).mul(depth).mul(color(hsl.integer(242, 100, 89.5))).mul(0.8))
      .add(color(hsl.integer(234, 70, 82)).mul(air.rim.mul(0.5).add(deepAir.rim.mul(0.8))).mul(0.2))
      .add(color(hsl.integer(0, 0, 100)).mul(fracture).mul(grazing.mul(0.5).add(0.5)).mul(0.35))
      .add(color(hsl.integer(0, 0, 100)).mul(sparkle).mul(0.4))
      .add(color(hsl.integer(240, 72, 68)).mul(grazing.pow(3)).mul(intimate.mul(0.5).add(0.2)).mul(0.05))
  }
}
