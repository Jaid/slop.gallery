import type {Vec3} from '../../types.ts'
import type {CurioShape} from '../base/Curio.ts'

import {color, mix, mx_noise_float, positionLocal} from 'three/tsl'
import {MeshPhysicalNodeMaterial} from 'three/webgpu'

import {studioEnvironment} from '../../../materials/metal.ts'
import {machineBody} from '../../alchemy/alchemyMachine.ts'
import Curio, {CurioModel} from '../base/Curio.ts'
import BowlerGeometry from './BowlerGeometry.ts'

/** A felt bowler resting on the alchemy chest until someone picks it up. */
export default class Bowler extends Curio {
  readonly id = 'bowler-hat'
  readonly mass = 0.25
  readonly position: Vec3 = [machineBody.center[0], machineBody.size[1] + 0.002, machineBody.center[1] - 0.08]
  readonly reach = 0.4
  readonly room = 'forge'
  // the brim it rests on, as wide as it is along the oval, and the rounded crown on it
  readonly shapes: ReadonlyArray<CurioShape> = [{
    border: 0.008,
    height: 0.022,
    kind: 'cylinder',
    position: [0, 0.011, 0],
    radius: 0.21,
  }, {
    border: 0.06,
    height: 0.227,
    kind: 'cylinder',
    position: [0, 0.1175, 0],
    radius: 0.145,
  }]
  readonly title = 'Bowler Hat'

  createModel() {
    const geometry = new BowlerGeometry
    const felt = new MeshPhysicalNodeMaterial({
      envMap: studioEnvironment,
      envMapIntensity: 0.4,
      roughness: 0.94,
      sheen: 0.65,
      sheenColor: '#686367',
      sheenRoughness: 0.85,
    })
    const nap = mx_noise_float(positionLocal.mul(480)).mul(0.5).add(0.5)
    felt.colorNode = mix(color('#272528'), color('#464347'), nap)
    const ribbon = new MeshPhysicalNodeMaterial({
      color: '#171619',
      envMap: studioEnvironment,
      envMapIntensity: 0.5,
      roughness: 0.32,
      sheen: 0.8,
      sheenColor: '#58545a',
      sheenRoughness: 0.48,
    })
    return new CurioModel([
      {
        name: 'bowler-felt',
        geometry: geometry.felt,
        material: felt,
      },
      {
        name: 'bowler-ribbon',
        geometry: geometry.ribbon,
        material: ribbon,
      },
    ])
  }
}
