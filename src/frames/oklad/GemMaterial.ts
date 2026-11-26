import type {Node} from 'three/webgpu'

import {atan, cameraPosition, color, float, modelWorldMatrix, modelWorldMatrixInverse, normalLocal, pmremTexture, positionLocal, reflect, refract, select, smoothstep, uv, vec2, vec3, vec4} from 'three/tsl'
import {Color, MeshPhysicalNodeMaterial} from 'three/webgpu'

import gemStudio from './gemStudio.ts'

/** what a gemstone is like inside */
export type Gem = {
  /** the color white light takes on through the stone and back out of it, as packed sRGB */
  body: number
  /** how much further a blue ray bends going in or out of the stone than a red one, the spread of its index of refraction, which splits white light into its fire */
  dispersion: number
  ior: number
}
type Vec2 = Node<'vec2'>

type Vec3 = Node<'vec3'>

/**
 * how a stone’s pavilion, hidden in its collet below its girdle, sends the light back up: its main facets round it, how steeply they slope from the girdle’s plane, in radians, a little steeper than a brilliant’s ideal 40.75° so a little of the room’s light leaks through as the stone tilts, and the lower girdle facets round its rim, twice as many and steeper still, where it reaches out past `rim` of the way to the girdle
 */
const pavilion = {
  mains: 8,
  slope: 0.74,
  rim: 0.72,
  girdleSlope: 0.8,
}
/** how far a ray goes through the stone between its crown and its pavilion and across from one side of the pavilion to the other, as shares of the stone’s half width */
const reach = {
  down: 0.55,
  across: 1.1,
}
/** how far a ray goes through the stone on its way back out, about, along which it takes on the stone’s body color exactly */
const averagePath = 3
/** how much brighter than the showroom’s light along its path what comes back out looks: a cut stone gathers the light of a broad cone of the room into every ray it sends back */
const brilliance = 1.5

/**
 * A cut gemstone in a jeweler’s showroom (`gemStudio.ts`): its crown mirrors the showroom’s lamps off each of its flat facets, and the light coming back out of it is traced through a pavilion of its own below the girdle, which the geometry leaves out.
 *
 * Every ray from the eye refracts through the facet it meets, reflects twice off the pavilion’s facets, whichever lies where it gets there, and leaves through the crown again opposite where it came in, each color at its own index of refraction, to fetch the showroom’s light there. Some rays leak out of the pavilion instead and leave their facets dark, so the stone breaks into the mosaic of bright and dark facets of a cut stone, which changes as it or the viewer moves, its light split into colored fire. Whatever comes back takes on the stone’s body color, deeper the further it went.
 *
 * It reads the stone’s girdle from its `uv`, −1 to 1 across it, and its axis from the frame’s z, which every stone of a frame faces along.
 */
export default class GemMaterial extends MeshPhysicalNodeMaterial {
  constructor({body, dispersion, ior}: Gem) {
    super({
      roughness: 0.02,
      ior,
      envMap: gemStudio,
      envMapIntensity: 1.5,
    })
    const eye = modelWorldMatrixInverse.mul(vec4(cameraPosition, 1)).xyz
    const incident = positionLocal.sub(eye).normalize().toVar('gemIncident')
    const facet = normalLocal.normalize().toVar('gemFacet')
    const inside = refract(incident, facet, 1 / ior).toVar('gemInside')
    const at = uv()
    // The pavilion facet a ray reaches at a point across the stone, as seen from the front: one of the mains round its middle, or nearer the girdle one of the lower girdle facets.
    const pavilionFacet = (point: Vec2) => {
      const nearRim = point.length().greaterThan(pavilion.rim)
      const count = select(nearRim, float(pavilion.mains * 2), float(pavilion.mains))
      const slope = select(nearRim, float(pavilion.girdleSlope), float(pavilion.slope))
      const turn = atan(point.y, point.x).mul(count.div(Math.PI * 2)).round().mul(float(Math.PI * 2).div(count))
      return vec3(turn.cos().mul(slope.sin()), turn.sin().mul(slope.sin()), slope.cos().negate())
    }
    const down = inside.z.negate().max(0.2)
    const first = at.add(inside.xy.mul(float(reach.down).div(down))).toVar('gemFirst')
    const once = reflect(inside, pavilionFacet(first)).toVar('gemOnce')
    const second = first.add(once.xy.add(vec2(1e-4, 0)).normalize().mul(reach.across))
    const twice = reflect(once, pavilionFacet(second)).toVar('gemTwice')
    // Out through the crown opposite where it came in, as a symmetrical cut would send it.
    const exit = vec3(facet.x, facet.y, facet.z.negate())
    const leaving = (index: number): Vec3 => refract(twice, exit, ior + dispersion * (index - 1))
    const fetch = (direction: Vec3) => pmremTexture(gemStudio, modelWorldMatrix.mul(vec4(direction, 0)).xyz.normalize(), float(0.02))
    // Refraction gives no ray back where the light can’t get out, which counts for nothing.
    const [red, green, blue] = [0, 1, 2].map(index => leaving(index))
    // A ray that never turns up again leaks out of the pavilion, and one turning back down at the crown stays inside; neither brings light back.
    const escapes = smoothstep(0.05, 0.3, twice.z)
    const light = vec3(fetch(red).r.mul(red.dot(red)), fetch(green).g.mul(green.dot(green)), fetch(blue).b.mul(blue.dot(blue)))
    const path = float(reach.down).div(down).add(reach.across + reach.down)
    // The body color is what a ray keeps over an average path; a longer one keeps less.
    const linear = new Color(body)
    const [absorbedRed, absorbedGreen, absorbedBlue] = [linear.r, linear.g, linear.b].map(channel => -Math.log(Math.max(channel, 1e-3)))
    const tint = vec3(absorbedRed, absorbedGreen, absorbedBlue).mul(path.div(averagePath)).negate().exp()
    const reflected = float(((ior - 1) / (ior + 1)) ** 2)
    const entering = float(1).sub(reflected.add(float(1).sub(reflected).mul(float(1).sub(incident.dot(facet).negate().clamp(0, 1)).pow(5))))
    // Over what comes back along the traced path, a faint glow of the stone’s color from the light it scatters every other way.
    this.emissiveNode = light.mul(tint).mul(escapes).mul(entering).mul(brilliance).add(color(body).mul(0.04))
    this.colorNode = color(body).mul(0.05)
  }
}
