import {color, float, max, mix, mx_noise_float, positionGeometry, vec2, vec3} from 'three/tsl'
import {DoubleSide} from 'three/webgpu'

import salonRoof from '#src/lib/gallery/salonRoof.ts'
import ClearGlassMaterial, {paneFresnelTransmittance} from '#src/lib/materials/ClearGlassMaterial.ts'
import {heightNormal, visibleDetail} from '#src/lib/materials/filters.ts'

const ior = 1.52

/** Thin rolled glass: almost clear across the fan, with a faint celadon veil in the panes outboard of the bronze ring. */
export default class RolledGlassMaterial extends ClearGlassMaterial {
  constructor(heavy: boolean) {
    super({
      name: 'salon-rolled-glass',
      ior,
      absorption: 0.05,
      envMapIntensity: 0.86,
    })
    this.side = DoubleSide
    this.forceSinglePass = true
    const point = positionGeometry.xz
    const radius = point.div(vec2(...salonRoof.opening)).length()
    // The transition lies behind the actual glazing bar, not a second seam drawn across the glass.
    const rim = radius.smoothstep(salonRoof.border - 0.003, salonRoof.border + 0.003)
    const haze = mix(float(0.05), float(0.27), rim)
    this.colorNode = mix(color('#a9c3bc'), color('#89a991'), rim).mul(haze)
    this.roughnessNode = mix(float(0.07), float(0.24), rim)
    if (heavy) {
      const footprint = max(point.x.fwidth(), point.y.fwidth())
      const ripple = mx_noise_float(vec3(point.x.mul(5.5), point.y.mul(2.4), 7.1))
      this.normalNode = heightNormal(ripple.mul(0.0015).mul(visibleDetail(footprint, 0.18)))
    }
    this.opacityNode = float(1).sub(paneFresnelTransmittance(ior).mul(haze.oneMinus()))
  }
}
