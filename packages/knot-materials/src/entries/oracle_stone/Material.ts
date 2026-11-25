import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_noise_float, vec3} from 'three/tsl'

import {cellularPoints} from '../../lib/cellularPoints.ts'
import {glints} from '../../lib/glints.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {opticalBands} from '../../lib/opticalBands.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Four narrow object-space cleavage families take turns as the eye circles the stone. Each carries long parallel lamellae instead of colored spots, and the charcoal body remains deliberately rough enough to stay dark between flashes. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.72)
    this.name = knotData.id
    const {p, view, near, intimate} = viewerFrame()
    const inner = p.sub(view.mul(0.075))
    const bodyVariation = mx_noise_float(p.mul(3.2)).mul(0.5).add(0.5)
    const fracture = mx_noise_float(inner.mul(5.8).add(vec3(4.2, 8.7, 1.6))).mul(0.5).add(0.5)
    const east = vec3(0.97, 0.08, 0.22).normalize()
    const west = vec3(-0.93, 0.12, 0.34).normalize()
    const north = vec3(0.26, -0.08, 0.96).normalize()
    const south = vec3(-0.2, 0.1, -0.97).normalize()
    const eastAlignment = view.dot(east).abs().smoothstep(0.79, 0.96)
    const westAlignment = view.dot(west).abs().smoothstep(0.79, 0.96)
    const northAlignment = view.dot(north).abs().smoothstep(0.79, 0.96)
    const southAlignment = view.dot(south).abs().smoothstep(0.79, 0.96)
    const eastStrata = opticalBands(inner.dot(north).mul(32).add(fracture.mul(2.7))).mul(0.48).add(0.52)
    const westStrata = opticalBands(inner.dot(south).mul(28).add(bodyVariation.mul(3.3))).mul(0.48).add(0.52)
    const northStrata = opticalBands(inner.dot(east).mul(35).add(fracture.mul(3.8))).mul(0.48).add(0.52)
    const southStrata = opticalBands(inner.dot(west).mul(30).add(bodyVariation.mul(2.4))).mul(0.48).add(0.52)
    const eastSheet = inner.dot(north).mul(5.1).sin().mul(0.5).add(0.5).smoothstep(0.72, 0.89)
    const westSheet = inner.dot(south).mul(4.7).sin().mul(0.5).add(0.5).smoothstep(0.74, 0.9)
    const northSheet = inner.dot(east).mul(5.4).sin().mul(0.5).add(0.5).smoothstep(0.75, 0.91)
    const southSheet = inner.dot(west).mul(4.9).sin().mul(0.5).add(0.5).smoothstep(0.74, 0.9)
    const eastFire = eastAlignment.mul(fracture.smoothstep(0.61, 0.78)).mul(eastSheet).mul(eastStrata)
    const westFire = westAlignment.mul(bodyVariation.smoothstep(0.62, 0.8)).mul(westSheet).mul(westStrata)
    const northFire = northAlignment.mul(fracture.oneMinus().smoothstep(0.62, 0.8)).mul(northSheet).mul(northStrata)
    const southFire = southAlignment.mul(bodyVariation.oneMinus().smoothstep(0.62, 0.8)).mul(southSheet).mul(southStrata)
    const flash = eastFire.add(westFire).add(northFire).add(southFire).clamp()
    const fireMask = flash.pow(3.2)
    const fireEnergy = color(hsl.integer(252, 100, 59)).mul(eastFire).add(color(hsl.integer(185, 96.7, 79)).mul(westFire)).add(color(hsl.integer(262.6, 100, 53)).mul(northFire)).add(color(hsl.integer(235, 100, 64)).mul(southFire))
    const fire = fireEnergy.div(flash.add(0.0001))
    const matrix = mix(color(hsl.integer(243, 18, 3)), color(hsl.integer(220, 32, 7)), bodyVariation.mul(0.32).add(fracture.mul(0.12)).clamp())
    const spark = cellularPoints(inner.mul(82), 0.022, 0.13, 0.84).mul(intimate).mul(flash)
    this.colorNode = mix(matrix, fire, fireMask.mul(0.96).add(spark.mul(0.1)).clamp())
    this.metalness = 0
    this.roughnessNode = float(0.47).sub(fireMask.mul(0.24)).add(fracture.mul(0.04)).clamp(0.15, 0.56)
    this.ior = 1.54
    this.clearcoatNode = fireMask.mul(0.44).add(0.035)
    this.clearcoatRoughnessNode = float(0.1).sub(fireMask.mul(0.05))
    const mineralHeight = eastStrata.mul(eastFire.mul(0.13).add(0.014)).add(westStrata.mul(westFire.mul(0.13).add(0.014))).add(northStrata.mul(northFire.mul(0.13).add(0.014))).add(southStrata.mul(southFire.mul(0.13).add(0.014)).add(fracture.mul(0.075)))
    const mineralNormal = proceduralNormal(mineralHeight, 0.00105)
    this.normalNode = mineralNormal
    this.clearcoatNormalNode = mineralNormal
    const sharpFlash = glints(mineralNormal, 120).mul(fireMask).mul(near)
    this.emissiveNode = fireEnergy.mul(fireMask).mul(near.mul(0.9).add(0.28)).add(color(hsl.integer(196, 100, 96.6)).mul(sharpFlash.add(spark.mul(0.2))).mul(0.075))
  }
}
