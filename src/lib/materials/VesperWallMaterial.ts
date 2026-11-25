import type {Node} from 'three/webgpu'

import StudioEnvironment from 'knot-materials/StudioEnvironment.ts'
import hsl from 'okhsl'
import {color, float, max, mix, mx_noise_float, normalWorldGeometry, positionWorld, select, sqrt, vec2, vec3} from 'three/tsl'
import {MeshPhysicalNodeMaterial} from 'three/webgpu'

import {wallFace} from '../gallery/architectureDimensions.ts'
import {heightNormal, visibleDetail} from './filters.ts'

type Float = Node<'float'>

/** Layout of the stenciled wall, in meters; heights are measured from the floor. */
export const vesperFans = {
  /**
   * radius of one fan
   *
   * Fans repeat every two radii, the guilloche every `wavelength`. Both divide the 12 m by which the Vesper’s walls differ in length, so every corner meets the pattern at the same phase from either side and folds it like a mirror.
   */
  radius: 0.25,
  /** rise from one row of fans to the next, as a share of the radius; every row hides the lower half of the one above */
  rowStep: 0.5,
  /** gilded rays per fan, counted over the full circle */
  rays: 14,
  /** length of one twist of the guilloche */
  wavelength: 0.1,
  /** the lower border band between the plain dado and the fan field; the first row of fans springs from its top */
  border: [0.9, 1] as const,
  /** the frieze band that closes the field, just clear of the cornice, which starts 0.47 m below the 5.5 m wall top */
  frieze: [4.9, 5] as const,
}

const palette = {
  deep: hsl.integer(161, 35, 37),
  light: hsl.integer(167, 31, 51),
  glaze: hsl.integer(85, 54, 81),
  glazeShadow: hsl.integer(83, 52, 60),
}

/**
 * The fan that shows at a point of the field, mirroring the shader. `x` runs along the wall from the pattern axis and `y` up from the first row of fan centers, both in meters.
 *
 * Fans of row `j` are centered at y = j · step, every two radii along the wall, odd rows shifted by one radius. Lower rows lie in front, so a point belongs to the lowest fan that contains it. Searching from the row just above the point down to two rows below always finds it: the row above only shows in a thin sliver right under its hub, and anything lower than two rows down is always covered.
 */
export function fanAt(x: number, y: number, {radius, rowStep} = vesperFans) {
  const step = radius * rowStep
  const top = Math.floor(y / step)
  let fan: {
    center: [number, number]
    row: number
  } | undefined
  for (let below = -1; below <= 2; below++) {
    const row = top - below
    const offset = (row % 2 + 2) % 2 * radius
    const center: [number, number] = [Math.round((x - offset) / (2 * radius)) * 2 * radius + offset, row * step]
    if (Math.hypot(x - center[0], y - center[1]) < radius) {
      fan = {
        center,
        row,
      }
    }
  }
  return fan
}

/**
 * Polished green Venetian plaster with a gilded Art Deco fan stencil, the Vesper’s answer to carved wall ornaments.
 *
 * The ground is burnished stucco veneziano: soft clouds in two greens, crossed by faint trowel passes that are a little glossier than the rest, under a thin waxed clearcoat. Over it runs a field of overlapping fans in a champagne lustre glaze, each with a bold rim, a fine pinstripe, gilded rays and a small hub; every other wedge is burnished instead of painted, so the fans read from across the room by sheen alone. The glaze is metallic and thin-film iridescent: walking past, it shifts from gold toward rose and green. A guilloche band separates the plain dado from the field and another closes it below the cornice.
 *
 * Everything is mapped along whichever wall it is drawn on, measured from the room center, so the pattern is centered on every wall; doorway reveals stay plain plaster. Lines are filtered against the pixel footprint and thin to their average before they could shimmer.
 */
export default class VesperWallMaterial extends MeshPhysicalNodeMaterial {
  private readonly studio = new StudioEnvironment

  constructor({center, floorY = 0, size}: {
    /** room center in world x/z; the pattern is centered on it along every wall */
    center: readonly [number, number]
    floorY?: number
    /** inner room size in world x/z, measured between wall center lines */
    size: readonly [number, number]
  }) {
    super({
      roughness: 0.5,
      metalness: 0,
      clearcoat: 0.12,
      clearcoatRoughness: 0.3,
      envMapIntensity: 0.4,
    })
    // Gilding needs something bright to mirror; the gallery’s own environment is a dim gradient, so the wall carries the same softbox studio as the other gold.
    this.envMap = this.studio
    const {radius, rowStep, rays, wavelength, border, frieze} = vesperFans
    const n = normalWorldGeometry
    const vertical = n.y.abs().lessThan(0.5).toVar('vesperVertical')
    // The horizontal direction along the wall, to the right as seen from the room.
    const tangent = select(vertical, vec3(n.z, 0, n.x.negate()).normalize(), vec3(1, 0, 0))
    const offsetX = positionWorld.x.sub(center[0])
    const offsetZ = positionWorld.z.sub(center[1])
    const along = offsetX.mul(tangent.x).add(offsetZ.mul(tangent.z)).toVar('vesperAlong')
    // Only the room’s four faces are stenciled. Doorway reveals also face sideways, but they lie well inside the room’s outline.
    const faceDistance = select(n.x.abs().greaterThan(n.z.abs()), offsetX.abs().sub(size[0] / 2 - wallFace), offsetZ.abs().sub(size[1] / 2 - wallFace))
    const roomFace = vertical.and(faceDistance.greaterThan(-0.02)).toVar('vesperRoomFace')
    const y = positionWorld.y.sub(floorY).toVar('vesperY')
    const footprint = max(along.fwidth(), y.fwidth()).toVar('vesperFootprint')
    const fineDetail = visibleDetail(footprint, 0.02)
    // Coverage is filtered against the footprint of the wall position, not the derivatives of each distance: the fan a pixel belongs to changes abruptly at every overlap, and its distances jump with it.
    const inside = (d: Float) => float(0.5).sub(d.div(footprint)).clamp(0, 1)
    const line = (d: Float, halfWidth: number) => inside(d.abs().sub(halfWidth)).mul(float(halfWidth * 2).div(footprint).min(1))
    // Plaster: soft clouds, and trowel passes at two fixed slants that a slow mask trades off against each other.
    const clouds = mx_noise_float(vec3(along.mul(0.5), y.mul(0.5), 1.9)).mul(0.6).add(mx_noise_float(vec3(along.mul(1.7), y.mul(1.7), 6.2)).mul(0.4)).mul(0.5).add(0.5).toVar('vesperClouds')
    const pass = (angle: number, seed: number) => {
      const u = along.mul(Math.cos(angle)).add(y.mul(Math.sin(angle)))
      const v = y.mul(Math.cos(angle)).sub(along.mul(Math.sin(angle)))
      return mx_noise_float(vec3(u.mul(1.3), v.mul(7), seed)).mul(0.5).add(0.5)
    }
    const passMask = mx_noise_float(vec3(along.mul(0.8), y.mul(0.8), 3.3)).mul(0.5).add(0.5).smoothstep(0.3, 0.7)
    const strokes = mix(pass(0.5, 7.7), pass(-0.6, 2.9), passMask).toVar('vesperStrokes')
    const grain = mx_noise_float(vec3(along.mul(40), y.mul(40), 4.4))
    const tone = clouds.mul(0.75).add(strokes.mul(0.25)).smoothstep(0.1, 0.95)
    const isDado = y.lessThan(border[0])
    const plaster = mix(color(palette.deep), color(palette.light), tone).mul(select(isDado, float(0.8), float(1))).mul(grain.mul(0.025).mul(fineDetail).add(1)).toVar('vesperPlaster')
    // Fans: the lowest of the four candidate rows that contains the point lies in front.
    const step = radius * rowStep
    const fy = y.sub(border[1]).toVar('vesperFanY')
    const topRow = fy.div(step).floor().toVar('vesperFanRow')
    let fanCenter = vec2(0, -1000) as Node<'vec2'>
    for (let below = -1; below <= 2; below++) {
      const row = topRow.sub(below)
      const offset = row.sub(row.div(2).floor().mul(2)).mul(radius)
      const candidate = vec2(along.sub(offset).div(2 * radius).round().mul(2 * radius).add(offset), row.mul(step))
      fanCenter = select(vec2(along, fy).sub(candidate).length().lessThan(radius), candidate, fanCenter)
    }
    const local = vec2(along, fy).sub(fanCenter).toVar('vesperFanLocal')
    const r = local.length().toVar('vesperFanRadius')
    const angle = local.x.atan(local.y)
    const sector = 2 * Math.PI / rays
    const nearestRay = angle.div(sector).round()
    const rayDistance = r.mul(angle.sub(nearestRay.mul(sector)).sin().abs()).toVar('vesperRayDistance')
    // Wedges between rays alternate; the parity flips exactly on a ray, so the signed distance to it keeps the edge filtered.
    const wedge = angle.div(sector).floor()
    const wedgeSide = wedge.sub(wedge.div(2).floor().mul(2)).mul(2).sub(1)
    // The bold rim runs right to the edge of the fan, so the edge of the one behind is always hidden under gilding.
    const rimWidth = 0.009
    const pinstripe = radius - 0.024
    const rim = max(line(r.sub(radius - rimWidth / 2), rimWidth / 2), line(r.sub(pinstripe), 0.0012))
    const body = inside(r.sub(pinstripe - 0.004)).mul(inside(float(radius * 0.3).sub(r))).toVar('vesperFanBody')
    const ray = line(rayDistance, 0.0013).mul(body)
    const hub = max(inside(r.sub(radius * 0.13)), line(r.sub(radius * 0.24), 0.0015))
    // Seen from far off or at a glancing angle, the hubs and wedges fade to their average before they could crawl; the lines already thin out by themselves.
    const fanDetail = visibleDetail(footprint, 0.03)
    const fan = max(max(rim, ray), mix(float(0.03), hub, fanDetail))
    const burnished = mix(float(0.4), inside(rayDistance.mul(wedgeSide).negate()).mul(body), fanDetail).toVar('vesperBurnished')
    // Guilloche: two interlaced strands between fillets, with a pearl in every eye.
    const band = (bottom: number, top: number) => {
      const middle = (bottom + top) / 2
      const amplitude = (top - bottom) * 0.24
      const phase = along.mul(2 * Math.PI / wavelength)
      const strandSlope = sqrt(phase.cos().mul(amplitude * 2 * Math.PI / wavelength).pow(2).add(1))
      const offset = y.sub(middle)
      const strands = max(line(offset.sub(phase.sin().mul(amplitude)).div(strandSlope), 0.0024), line(offset.add(phase.sin().mul(amplitude)).div(strandSlope), 0.0024))
      const eyeAlong = along.sub(along.div(wavelength / 2).floor().add(0.5).mul(wavelength / 2))
      const eyes = inside(vec2(eyeAlong, offset).length().sub(0.0065))
      const fillets = max(line(y.sub(bottom + 0.006), 0.0035), line(y.sub(top - 0.006), 0.0035))
      return {
        coverage: max(max(strands, eyes), fillets),
        inside: y.greaterThan(bottom).and(y.lessThan(top)),
      }
    }
    const lower = band(...border)
    const upper = band(...frieze)
    const inField = y.greaterThan(border[1]).and(y.lessThan(frieze[0] - 0.012))
    const painted = select(lower.inside, lower.coverage, select(upper.inside, upper.coverage, select(inField, fan, float(0))))
    // Hand-stenciled: the glaze lies a little thinner in places.
    const wear = mx_noise_float(vec3(along.mul(3.1), y.mul(3.1), 9.3)).mul(0.5).add(0.5).smoothstep(0.1, 0.9)
    const glaze = select(roomFace, painted.mul(wear.mul(0.2).add(0.8)), float(0)).toVar('vesperGlaze')
    const sheen = select(roomFace.and(inField), burnished, float(0)).toVar('vesperSheen')
    const lustre = mix(color(palette.glazeShadow), color(palette.glaze), clouds)
    this.colorNode = mix(plaster.mul(sheen.mul(0.07).add(1)), lustre, glaze)
    this.metalnessNode = glaze.mul(0.85)
    // Trowel passes are burnished a little; the burnished wedges and the glaze are smoother still.
    this.roughnessNode = mix(strokes.mul(0.16).add(clouds.mul(0.08)).add(0.44).sub(sheen.mul(0.2)), float(0.3), glaze)
    this.clearcoatNode = mix(float(0.12).add(sheen.mul(0.18)), float(0.05), glaze)
    // Plaster reflects less than glass would; only the glaze should mirror the studio’s softboxes.
    this.specularIntensityNode = mix(float(0.6), float(1), glaze)
    this.iridescenceNode = glaze.mul(0.6)
    this.iridescenceIORNode = float(1.7)
    // Uneven film thickness lets the shimmer drift across each fan.
    this.iridescenceThicknessNode = mx_noise_float(vec3(along.mul(1.6), y.mul(1.6), 5.5)).mul(160).add(420)
    // Only a whisper of relief: the trowel passes and a fine grain.
    this.normalNode = heightNormal(strokes.mul(0.0004).add(grain.mul(0.00005)).mul(fineDetail))
  }

  override dispose() {
    this.studio.dispose()
    super.dispose()
  }
}
