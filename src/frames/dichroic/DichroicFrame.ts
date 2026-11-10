import {color, float, max, mix, mx_cell_noise_float, mx_noise_float, normalView, positionViewDirection, select, vec2, vec3} from 'three/tsl'
import {MeshPhysicalNodeMaterial} from 'three/webgpu'

import {heightNormal, inside, insideBy, visibleDetail} from '#src/lib/materials/filters.ts'

import PortraitFrame, {frameBack} from '../base/PortraitFrame.ts'
import {withOpening} from '../lib/frameBack.ts'
import {assembleFrame, sweepProfile} from '../lib/frameGeometry.ts'
import FrameProfile from '../lib/FrameProfile.ts'
import {frameSurface} from '../lib/materials/frameAttributes.ts'
import {backSurface, screwHead} from '../lib/materials/frameBacks.ts'
import FrameMetalMaterial, {satinSteel} from '../lib/materials/FrameMetalMaterial.ts'
import frameStudio from '../lib/materials/frameStudio.ts'

const imageDepth = -0.056
/** the material of the back */
const back = 3
const steel = 0
const glass = 1
const edge = 2
/** the polished face of the slab, where the pieces of dichroic glass lie fused under a clear cap */
const face = {
  from: 0.011,
  to: 0.088,
  z: -0.034,
}
/** a slim lip of satin steel round the work, then a thick slab of fused glass beveled on both its edges, set in a tray of the same steel */
const profile = FrameProfile.from([-0.005, imageDepth], steel)
  .line(-0.005, -0.044)
  .line(0.007, -0.044)
  .line(0.007, -0.04, {material: edge})
  .line(face.from, face.z)
  .line(face.to, face.z, {material: glass})
  .line(0.094, -0.04, {material: edge})
  .line(0.094, frameBack, {material: steel})
  .line(-0.005, frameBack, {material: back})
/** how many rows of pieces run round the face, and about how long a piece is round the frame */
const rows = 2
const pieceLength = 0.068

/** The Oculus’: a slab of fused dichroic glass, pieces of every coating on black glass under a clear cap, each throwing back the borrowed light in colors that change as the viewer moves. */
export default class DichroicFrame extends PortraitFrame {
  override readonly description = 'Borrowed light, split into colors: a thick slab of fused glass round a slim lip of satin steel, its face set with pieces of dichroic glass on black, each coated a little thicker or thinner than its neighbors, so each throws back the light from above in a color of its own that slides from cyan through violet to gold as the viewer walks by, under a clear cap whose beveled edges glow with the colors let through. Its back is a panel of brushed aluminum screwed on at the corners, hung on a black Z-clip, with the maker’s barcode sticker.'
  override readonly front = profile.front
  override readonly imageDepth = imageDepth
  override readonly impactSound = 'heavy'
  override readonly reach = profile.reach
  override readonly tint = '#3b5f8a'
  override readonly title = 'Dichroic glass'

  override createGeometry(width: number, height: number) {
    return assembleFrame([...withOpening(sweepProfile(profile, width / 2, height / 2), back, width / 2, height / 2)])
  }

  protected override createMaterials() {
    return [new FrameMetalMaterial({metal: satinSteel}), new DichroicMaterial, new GlassEdgeMaterial, new DichroicBackMaterial]
  }
}

/**
 * Pieces of dichroic glass fused onto black glass: thin films whose interference colors the reflections, each piece with its own coating thickness and so its own color, which shifts with the angle the viewer sees it at. Between the pieces the black glass shows in narrow seams. The pieces run along every member in rows, cut where the members meet in the miters.
 */
class DichroicMaterial extends MeshPhysicalNodeMaterial {
  constructor() {
    super({
      envMap: frameStudio,
      envMapIntensity: 1.6,
      clearcoat: 1,
      clearcoatRoughness: 0.015,
    })
    const surface = frameSurface()
    const p = surface.position
    const footprint = max(p.x.fwidth(), p.y.fwidth()).max(p.z.fwidth()).toVar('dichroicFootprint')
    const rowHeight = (face.to - face.from) / rows
    const t = surface.reach.sub(face.from).div(rowHeight)
    const row = t.floor().clamp(0, rows - 1)
    // Pieces of uneven length along each member, every row cut at its own places.
    const along = surface.along.div(pieceLength).add(row.mul(0.37)).add(surface.member.round().mul(0.21)).add(mx_noise_float(vec3(row.mul(5.3), surface.along.mul(9), surface.member)).mul(0.25))
    const coating = mx_cell_noise_float(vec3(along.floor(), row, surface.member.round().add(3.7))).toVar('dichroicCoating')
    // How far inside its piece the point lies, in meters, for the seams of black glass between pieces: 1 on a piece, 0 in a seam.
    const inPiece = along.fract().min(along.fract().oneMinus()).mul(pieceLength).min(t.sub(row).min(t.sub(row).oneMinus()).mul(rowHeight))
    const onPiece = insideBy(float(0.0007).sub(inPiece), footprint)
    // A thin film’s interference: each wavelength reflected as strongly as the light it sends back through the film meets the light reflected off its face in step. The path through the film shortens as the view tilts, so every color slides toward the blue.
    const cosine = normalView.dot(positionViewDirection.negate()).clamp(0, 1)
    const filmIndex = 2.1
    const refracted = float(1).sub(float(1).sub(cosine.mul(cosine)).div(filmIndex * filmIndex)).sqrt()
    // No coating is even: it thickens and thins in streaks across each piece, so every piece shades through neighboring colors.
    const streaks = mx_noise_float(vec3(surface.along.mul(22), surface.reach.mul(12), coating.mul(40))).mul(7)
    // First-order films between 140 and 250 nm, which give dichroic glass its violet, blue, cyan, gold and magenta, sweeping across the frame together as the viewer moves.
    const thickness = mix(float(140), float(250), coating).add(streaks)
    const path = thickness.mul(refracted).mul(filmIndex * 4 * Math.PI)
    const film = vec3(path.div(650).cos(), path.div(540).cos(), path.div(450).cos()).mul(-0.5).add(0.5)
    // Saturated a little past the physics, as dichroic glass looks in a dim room, and darker in the seams of black glass.
    const vivid = film.pow(vec3(1.3)).mul(onPiece).mul(0.9)
    this.colorNode = vivid
    this.metalnessNode = onPiece.mul(0.9)
    this.roughnessNode = float(0.22)
    this.emissiveNode = vivid.mul(0.05)
  }
}
/** The clear glass of the slab’s beveled edges, glowing with the colors the films let through. */
class GlassEdgeMaterial extends MeshPhysicalNodeMaterial {
  constructor() {
    super({
      roughness: 0.04,
      envMap: frameStudio,
      envMapIntensity: 1.4,
      clearcoat: 1,
      clearcoatRoughness: 0.01,
    })
    const surface = frameSurface()
    const drift = mx_noise_float(vec3(surface.along.mul(6), surface.member.mul(1.7), 3.1)).mul(0.5).add(0.5)
    this.colorNode = color('#0c1418')
    this.emissiveNode = mix(color('#ffc98a'), color('#9fdcff'), drift).mul(drift.mul(0.05).add(0.04))
  }
}
/** The back: a panel of brushed aluminum screwed on at its corners, a black anodized Z-clip across its top to hang it by, and the maker’s sticker with its barcode. */
class DichroicBackMaterial extends MeshPhysicalNodeMaterial {
  constructor() {
    super({
      envMap: frameStudio,
      envMapIntensity: 0.5,
    })
    const surface = backSurface()
    const {footprint, opening, point} = surface
    const outer = opening.add(profile.reach)
    const brushed = mx_noise_float(vec3(point.x.mul(4), point.y.mul(1600), 3.3)).mul(0.5).add(0.5).mul(visibleDetail(footprint, 0.001))
    const screw = screwHead(surface, point.sign().mul(outer.sub(0.025)), 0.0035)
    const clip = inside(max(point.x.abs().sub(opening.x.mul(0.6)), point.y.sub(opening.y.mul(0.45)).abs().sub(0.0125)))
    // The sticker, white with a barcode of bars of their own widths.
    const at = point.sub(vec2(outer.x.mul(0.4), outer.y.mul(-0.55))).div(1.6)
    const sticker = inside(max(at.x.abs().sub(0.035), at.y.abs().sub(0.018)))
    const code = select(mx_cell_noise_float(vec3(at.x.div(0.0008).floor(), 4.2, 0)).greaterThan(0.5).and(at.x.abs().lessThan(0.029)).and(at.y.abs().lessThan(0.01)), float(1), float(0))
    const bars = mix(float(0.4), code, visibleDetail(footprint, 0.002))
    const aluminum = mix(color('#7c8084'), color('#9a9ea2'), brushed)
    const metal = mix(mix(aluminum, color('#1c1d1f'), clip), mix(color('#9a9ea2'), color('#3a3c3e'), screw.slot), screw.cover)
    const labeled = mix(color('#f2f2ee'), color('#121212'), bars.mul(0.9))
    this.colorNode = mix(metal, labeled, sticker)
    this.metalnessNode = sticker.oneMinus()
    this.roughnessNode = mix(mix(float(0.48).add(brushed.mul(0.08)), float(0.45), clip), float(0.6), sticker)
    this.normalNode = heightNormal(brushed.mul(0.00002).add(clip.mul(0.003)).add(screw.height).add(sticker.mul(0.0002)))
  }
}
