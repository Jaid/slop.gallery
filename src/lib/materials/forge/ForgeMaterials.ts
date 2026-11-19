import {color, float, mix, mx_noise_float, positionWorld, uv, vec2, vec3} from 'three/tsl'
import {DoubleSide, MeshStandardNodeMaterial} from 'three/webgpu'

import {forgeVestibule} from '#src/lib/gallery/forge.ts'
import {daylight} from '#src/lib/rendering/daylight.ts'

import MadeOnDemand from '../base/MadeOnDemand.ts'
import {heightNormal, visibleDetail} from '../filters.ts'
import EndGrainMaterial from './EndGrainMaterial.ts'
import FirebrickMaterial from './FirebrickMaterial.ts'

/** The finishes shared by the two roofs, the floors and the walls of the assay works. */
export default class ForgeMaterials extends MadeOnDemand {
  get brass() {
    return this.once('brass', () => new MeshStandardNodeMaterial({
      name: 'Drawn brass',
      color: '#d4a965',
      metalness: 0.58,
      roughness: 0.35,
    }))
  }

  /** Galvanized sheets with a shallow rolled flute every 14 cm and a pale mineral wash that picks up the light of the adjacent glass. */
  get deck() {
    return this.once('deck', () => {
      const mat = new MeshStandardNodeMaterial({
        name: 'Folded zinc sheeting',
        roughness: 0.59,
        metalness: 0.23,
        side: DoubleSide,
      })
      const metric = uv()
      const flute = metric.x.mul(2 * Math.PI / 0.14).cos().mul(visibleDetail(metric.x.fwidth(), 0.14))
      const bloom = mx_noise_float(metric.mul(vec2(7, 2)))
      const zinc = mix(color('#8a9a96'), color('#b4c4bd'), bloom.mul(0.22).add(0.54)).mul(flute.mul(0.044).add(1))
      mat.colorNode = zinc
      mat.normalNode = heightNormal(flute.mul(0.006))
      mat.emissiveNode = zinc.mul(daylight).mul(0.055)
      return mat
    })
  }

  get floor() {
    return this.once('floor', () => new EndGrainMaterial)
  }

  get frame() {
    return this.once('frame', () => new MeshStandardNodeMaterial({
      name: 'Petrol enamel on iron',
      color: '#496b64',
      metalness: 0.26,
      roughness: 0.3,
      side: DoubleSide,
    }))
  }

  /** Rolled opal glass with the diagonal reinforcing wire visible inside. It diffuses the view out; its transmitted light follows the gallery sun rather than glowing like a lamp at night. */
  get glass() {
    return this.once('glass', () => {
      const mat = new MeshStandardNodeMaterial({
        name: 'Opal wired glass',
        roughness: 0.32,
        side: DoubleSide,
      })
      const p = uv()
      const pixel = p.fwidth().x.max(p.fwidth().y)
      const wire = (d: typeof p.x) => d.div(0.082).add(0.5).fract().sub(0.5).abs().mul(0.082).smoothstep(0.0007, pixel.add(0.0016)).oneMinus()
      const mesh = wire(p.x.add(p.y)).max(wire(p.x.sub(p.y))).mul(visibleDetail(pixel, 0.082))
      const rolled = p.x.mul(2 * Math.PI / 0.034).sin().mul(visibleDetail(pixel, 0.034))
      const cloud = mx_noise_float(p.mul(1.7)).mul(0.18).add(0.68)
      const sky = mix(vec3(0.58, 0.64, 0.62), vec3(0.72, 0.92, 0.99), positionWorld.y.smoothstep(5.8, 7.5))
      const transmission = sky.mul(cloud.add(rolled.mul(0.05))).mul(float(1).sub(mesh.mul(0.63)))
      mat.colorNode = transmission.mul(0.56)
      mat.emissiveNode = transmission.mul(daylight).mul(0.95)
      mat.normalNode = heightNormal(rolled.mul(0.0012))
      return mat
    })
  }

  get roundWall() {
    return this.once('roundWall', () => new FirebrickMaterial(forgeVestibule.radius))
  }

  get wall() {
    return this.once('wall', () => new FirebrickMaterial)
  }
}
