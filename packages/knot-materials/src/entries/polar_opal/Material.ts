import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_cell_noise_float, mx_fractal_noise_float, mx_noise_float, mx_worley_noise_float, normalViewGeometry, vec3} from 'three/tsl'

import {cellularBoundary} from '../../lib/cellularBoundary.ts'
import {cosinePalette} from '../../lib/cosinePalette.ts'
import {glints} from '../../lib/glints.ts'
import BaseKnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {spectralColor} from '../../lib/spectralColor.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

export default class extends BaseKnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.9)
    this.name = knotData.id
    const {p, view, grazing, rim, near, intimate} = viewerFrame()
    const roll = view.dot(vec3(0.7, 0.2, 0.68)).add(view.y.mul(0.35))
    const domain = p.mul(2.8).add(view.mul(0.45))
    const potch = mx_fractal_noise_float(domain, 4, 2.1, 0.48)
    const fireMask = potch.smoothstep(0.02, 0.42)
    const sheet = mx_noise_float(p.mul(6.5).add(view.mul(1.8)))
    const flash = mx_noise_float(p.mul(13).add(vec3(roll.mul(2), view.x.mul(3), view.y.mul(-2))))
    const crystalPosition = p.mul(7).add(view.mul(0.25))
    const crystalIdentity = mx_worley_noise_float(crystalPosition, 1, 1)
    const crystalRandom = mx_cell_noise_float(vec3(crystalIdentity.mul(65_536), 7, 19)).smoothstep(0.35, 0.85)
    // Fade crystal identity to a shared value before crossing a domain wall.
    const crystalInterior = cellularBoundary(crystalPosition).smoothstep(0, crystalPosition.fwidth().length().add(0.18))
    const harlequin = mix(float(0.5), crystalRandom, crystalInterior)
    const hueA = potch.mul(4.2).add(roll.mul(3.4)).add(sheet.mul(1.8))
    const hueB = flash.mul(5).add(roll.mul(-2.2)).add(2.1)
    const hueC = harlequin.mul(3.5).add(view.z.mul(2)).add(potch.mul(2))
    const playA = spectralColor(hueA)
    const playB = cosinePalette(hueB, [0.55, 0.42, 0.5], [0.45, 0.38, 0.42], [1, 1.1, 0.9], [0, 0.33, 0.67])
    const playC = mix(color(hsl.integer(169, 100, 90)), color(hsl.integer(340, 100, 70)), hueC.sin().mul(0.5).add(0.5))
    const fire = playA.mul(0.55).add(playB.mul(0.35)).add(playC.mul(0.25)).mul(fireMask)
    const contra = fireMask.oneMinus().mul(grazing.pow(1.4))
    const pinfire = flash.smoothstep(0.55, 0.8).mul(intimate).mul(fireMask)
    this.envMapIntensity = 0.55
    this.colorNode = mix(color(hsl.integer(297, 14, 6)), mix(color(hsl.integer(305, 25, 11)), fire, 0.72), fireMask.mul(0.85).add(0.08))
    this.metalnessNode = fireMask.mul(0.35).add(0.12)
    this.roughnessNode = float(0.18).sub(fireMask.mul(0.07)).sub(pinfire.mul(0.05)).max(0.05)
    this.clearcoat = 1
    this.clearcoatRoughness = 0.025
    this.iridescence = 1
    this.iridescenceIOR = 1.48
    this.iridescenceThicknessNode = potch.mul(280).add(roll.mul(90)).add(320)
    this.normalNode = proceduralNormal(potch.mul(0.45).add(harlequin.mul(0.2)), 0.0035)
    this.emissiveNode = fire
      .mul(0.85)
      .mul(near.mul(0.45).add(0.6))
      .add(playB.mul(pinfire).mul(1.4))
      .add(playA.mul(contra).mul(0.18))
      .add(color(hsl.integer(295, 60, 10.5)).mul(rim).mul(0.1))
      .add(fire.mul(glints(normalViewGeometry, 80)).mul(0.22))
  }
}
