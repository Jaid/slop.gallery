import {color, faceDirection, float, hash, max, mix, mx_noise_float, positionWorld, uv, vec3} from 'three/tsl'
import {Color, DoubleSide, MeshStandardNodeMaterial} from 'three/webgpu'

import forge, {forgeVestibule} from '#src/lib/gallery/forge.ts'
import {daylight} from '#src/lib/rendering/daylight.ts'

import {heightNormal, line, visibleDetail} from '../filters.ts'
import {runningBond} from './ForgeWallMaterial.ts'

/** Smoke-stained pitch pine, laid in narrow boards running down the opaque pitches. */
export class ForgeDeckMaterial extends MeshStandardNodeMaterial {
  constructor() {
    super({
      roughness: 0.78,
      side: DoubleSide,
      envMapIntensity: 0.45,
    })
    this.name = 'Forge pitch pine decking'
    const x = positionWorld.x.sub(forge.center[0])
    const board = x.div(0.23)
    const id = hash(board.floor().add(103))
    const along = positionWorld.z
    const footprint = max(x.fwidth(), along.fwidth())
    const grain = mx_noise_float(vec3(x.mul(66), along.mul(2.3), id.mul(27))).mul(visibleDetail(footprint, 0.018))
    const broad = mx_noise_float(vec3(x.mul(12), along.mul(0.8), id.mul(16)))
    const joint = line(float(0.5).sub(board.fract().sub(0.5).abs()).mul(0.23), 0.003)
    const pine = mix(color('#563727'), color('#ae7c4b'), id.mul(0.6).add(broad.mul(0.16)).add(0.2))
    const inside = faceDirection.mul(0.5).add(0.5)
    const timber = pine.mul(grain.mul(0.22).sub(joint.mul(0.55)).add(1))
    const zinc = color('#626c71').mul(broad.mul(0.17).sub(joint.mul(0.42)).add(1))
    this.colorNode = mix(zinc, timber, inside)
    this.metalnessNode = inside.oneMinus().mul(0.65)
    this.normalNode = heightNormal(grain.mul(0.00045).mul(inside).sub(joint.mul(0.002)))
    // Approximate the light entering through the clerestories and bouncing back onto their soffits.
    this.emissiveNode = timber.mul(inside).mul(daylight).mul(vec3(...new Color('#e8f2ff'))).mul(0.14)
  }
}

/** Concentric courses of buff brick following the vestibule’s curved soffit. */
export class ForgeCupolaMaterial extends MeshStandardNodeMaterial {
  constructor() {
    super({
      roughness: 0.85,
      side: DoubleSide,
    })
    this.name = 'Forge radial firebrick'
    const coord = uv()
    const r = coord.y
    const courses = 8
    const pitch = forgeVestibule.radius / courses
    const course = r.div(pitch).floor()
    const circumference = course.add(0.5).mul(pitch * 2 * Math.PI)
    const count = circumference.div(0.27).round().max(4)
    // Map each radial course to its own whole number of bricks. Use a smooth estimate of the UV footprint between courses.
    const footprint = max(coord.x.fwidth().mul(r).mul(2 * Math.PI), r.fwidth()).toVar()
    const brick = runningBond(coord.x.mul(count).mul(0.27), r, [0.27, pitch], 0.008, 0.009, footprint, count)
    const grains = mx_noise_float(positionWorld.mul(56)).mul(visibleDetail(footprint, 0.024))
    const clay = mix(color('#a27a57'), color('#cfac83'), brick.tone.mul(0.8).add(0.1)).mul(grains.mul(0.14).add(1))
    this.colorNode = mix(color('#8d7968'), clay, brick.face)
    this.normalNode = heightNormal(brick.relief.mul(0.003).add(grains.mul(0.00065)).mul(visibleDetail(footprint, 0.05)))
  }
}
