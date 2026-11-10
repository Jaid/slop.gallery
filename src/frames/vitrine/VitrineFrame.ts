import {bool, color, float, normalView, positionViewDirection} from 'three/tsl'
import {MeshPhysicalNodeMaterial, PlaneGeometry} from 'three/webgpu'

import PortraitFrame, {frameBack} from '../base/PortraitFrame.ts'
import {assembleFrame, corners, ornament, place, sweepProfile} from '../lib/frameGeometry.ts'
import FrameProfile from '../lib/FrameProfile.ts'
import FrameMetalMaterial, {blackAnodized, brass} from '../lib/materials/FrameMetalMaterial.ts'
import FramePaintMaterial from '../lib/materials/FramePaintMaterial.ts'
import frameStudio from '../lib/materials/frameStudio.ts'
import {block, dome} from '../lib/ornaments.ts'

const imageDepth = -0.075
const lining = 0
const casing = 1
const glass = 2
const fittings = 3
/** the front of the case, which the glass lies just behind */
const front = -0.018
/** the work lies deep in a box lined in black, whose anodized casing closes in front of it round a pane of glass */
const profile = FrameProfile.from([-0.005, imageDepth - 0.002], lining)
  .line(0.012, imageDepth - 0.002)
  .line(0.012, front - 0.006)
  .line(0.012, front, {material: casing})
  .line(0.04, front)
  .arc(0.044, front - 0.004, 0.35, {steps: 3})
  .line(0.044, frameBack)
  .line(-0.005, frameBack)
const screw = () => dome(0.0045, 0.0018, {
  rings: 2,
  kind: 2,
})

/** The Exhibition’s: a deep vitrine of black anodized aluminium, the work sealed behind museum glass at the back of a black-lined box, a brass plate screwed to the case. */
export default class VitrineFrame extends PortraitFrame {
  override readonly description = 'Sealed behind glass, lit like evidence: a deep vitrine of black anodized aluminium, the work set at the back of a box lined in black felt behind a pane of museum glass that all but vanishes face on and mirrors the room at an angle, its case held by four screws and labeled with a small brass plate.'
  override readonly front = front
  override readonly imageDepth = imageDepth
  override readonly impactSound = 'heavy'
  override readonly reach = profile.reach
  override readonly tint = '#202224'
  override readonly title = 'Sealed vitrine'

  override createGeometry(width: number, height: number) {
    const halfWidth = width / 2
    const halfHeight = height / 2
    const pane = ornament(new PlaneGeometry(width + 0.026, height + 0.026), {
      kind: 1,
      cavity: 0,
    })
    pane.translate(0, 0, front - 0.003)
    const plate = block(0.09, 0.022, 0.002, {kind: 3})
    return assembleFrame([
      ...sweepProfile(profile, halfWidth, halfHeight),
      [glass, pane],
      [fittings, place(screw(), corners(halfWidth, halfHeight, 0.026, front))],
      [fittings, place(plate, [{position: [halfWidth - 0.06, -halfHeight - 0.026, front]}])],
    ])
  }

  protected override createMaterials() {
    return [
      new FramePaintMaterial({
        color: '#0b0b0b',
        roughness: 0.95,
        grime: 0,
      }),
      new FrameMetalMaterial({metal: blackAnodized}),
      new VitrineGlassMaterial,
      new FrameMetalMaterial({metal: brass}),
    ]
  }
}

/** Museum glass in front of the work: nearly invisible face on, mirroring the room more and more toward grazing angles. */
class VitrineGlassMaterial extends MeshPhysicalNodeMaterial {
  constructor() {
    super({
      roughness: 0.02,
      metalness: 0,
      envMap: frameStudio,
      envMapIntensity: 1.5,
      transparent: true,
      depthWrite: false,
      color: '#0a0d0d',
    })
    const facing = normalView.dot(positionViewDirection.negate()).clamp(0, 1)
    // Schlick’s Fresnel for glass, so the pane all but disappears when seen straight on.
    const fresnel = float(0.04).add(float(0.96).mul(facing.oneMinus().pow(5)))
    this.opacityNode = fresnel.mul(0.75).add(0.03)
    this.colorNode = color('#1c2224')
    // The pane throws no shadow over the work behind it.
    this.maskShadowNode = bool(false)
  }
}
