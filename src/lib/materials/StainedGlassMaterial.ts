import {atan, float, fract, mix, select, uv, vec3, vec4} from 'three/tsl'
import {Color, DoubleSide, MeshBasicNodeMaterial} from 'three/webgpu'

import {stainedGlassMarker} from '../rendering/StainedGlassShadowNode.ts'

/** How bright the glass glows with daylight behind it; values above 1 feed the bloom pass. */
const brightness = 2.4
/** Half the width of the lead cames, in fractions of the pane’s radius. */
const lead = 0.022
const petals = 12

export type StainedGlassPalette = {
  border: number
  center: number
  /** the petals alternate between these two */
  petals: readonly [number, number]
}

/**
 * A round stained-glass pane for a `CircleGeometry`: a rosette of twelve scalloped petals around a round center, framed by a band of panes, all held in dark lead.
 *
 * The glass glows by itself, lit by the sky behind it rather than by the room. In the shadow pass it tints the light that passes through it, so through a `StainedGlassShadowNode` the sun lays the rosette’s colors on whatever it falls on.
 */
export default class StainedGlassMaterial extends MeshBasicNodeMaterial {
  constructor({border, center, petals: [first, second]}: StainedGlassPalette) {
    super({side: DoubleSide})
    this.name = 'stained-glass'
    const color = (hex: number) => vec3(...new Color(hex))
    const point = uv().mul(2).sub(1)
    const distance = point.length()
    const angle = atan(point.y, point.x)
    const sector = angle.div(Math.PI * 2 / petals).add(petals)
    const along = fract(sector)
    const alternate = sector.floor().mod(2).equal(0)
    const centerRadius = float(0.3)
    // Each petal swells out to its tip halfway across its sector.
    const petalRadius = along.sub(0.5).abs().mul(2).oneMinus().pow(0.6).mul(0.26).add(0.5)
    const inCenter = distance.lessThan(centerRadius)
    const inPetal = distance.lessThan(petalRadius)
    const glass = select(inCenter, color(center), select(inPetal, select(alternate, color(first), color(second)), color(border)))
    // Spokes divide the petals from one another and the border into panes.
    const spoke = along.min(along.oneMinus()).mul(Math.PI * 2 / petals).mul(distance).lessThan(lead).and(distance.greaterThan(centerRadius))
    const ring = distance.sub(centerRadius).abs().lessThan(lead).or(distance.sub(petalRadius).abs().lessThan(lead)).or(distance.greaterThan(1 - lead * 2))
    const isLead = spoke.or(ring)
    this.colorNode = vec4(mix(glass.mul(brightness), vec3(0.02, 0.018, 0.015), isLead.select(float(1), float(0))), 1)
    this.castShadowNode = vec4(isLead.select(vec3(0), glass), stainedGlassMarker)
  }
}
