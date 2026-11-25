import hsl from 'okhsl'
import {atan, color, float, max, mix, mx_fractal_noise_float, mx_noise_float, positionLocal, vec3} from 'three/tsl'
import {MeshStandardNodeMaterial} from 'three/webgpu'

import {heightNormal, visibleDetail} from './filters.ts'

/**
 * The waxy rind of a ripe field pumpkin: deep orange, darker and a little greener down the grooves between its ribs, paler on the swell of every rib, mottled in broad soft patches and freckled with tiny pale pores.
 *
 * It finds the ribs by the angle round the pumpkin’s upright axis, in its own frame, so its geometry needs to lay out `ribs` evenly round that axis with a rib’s middle straight ahead along z.
 */
export default class PumpkinRindMaterial extends MeshStandardNodeMaterial {
  constructor({ribs}: {ribs: number}) {
    super({
      roughness: 0.46,
      envMapIntensity: 0.4,
    })
    this.name = 'Pumpkin rind'
    const p = positionLocal
    const angle = atan(p.x, p.z)
    // 1 on the middle of a rib, 0 down a groove
    const swell = angle.mul(ribs / 2).cos().abs().toVar('pumpkinSwell')
    const groove = float(1).sub(swell).pow(3)
    const mottle = mx_fractal_noise_float(p.mul(9), 3, 2, 0.5).mul(0.5).add(0.5)
    const footprint = max(p.x.fwidth(), p.y.fwidth())
    const pores = mx_noise_float(p.mul(260)).smoothstep(0.62, 0.85).mul(visibleDetail(footprint, 0.004))
    const orange = mix(color(hsl.integer(44, 95, 52)), color(hsl.integer(53, 95, 66)), mottle.mul(0.6).add(swell.mul(0.4)))
    const deep = mix(orange, color(hsl.integer(50, 85, 34)), groove.mul(0.75))
    this.colorNode = mix(deep, color(hsl.integer(68, 81, 78.6)), pores.mul(0.5))
    this.roughnessNode = float(0.4).add(groove.mul(0.18)).add(mottle.mul(0.08))
    // faint stretch lines along the ribs, from stem to blossom end
    const streaks = mx_noise_float(vec3(angle.mul(60), p.y.mul(4), 1.7)).mul(visibleDetail(footprint, 0.01))
    this.normalNode = heightNormal(streaks.mul(0.0003).add(pores.mul(0.0002)))
  }
}
