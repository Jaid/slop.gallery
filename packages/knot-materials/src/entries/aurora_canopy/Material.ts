import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {cameraPosition, color, mix, modelWorldMatrixInverse, mx_fractal_noise_float, mx_noise_float, normalLocal, normalViewGeometry, positionGeometry, positionView, positionViewDirection, time, uv, vec2, vec4} from 'three/tsl'

import BaseKnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {TAU} from '../../lib/TAU.ts'
import knotData from './data.ts'

/** A gossamer curtain of woven silk wrapped around the knot, lit from behind by an aurora borealis that drifts and shivers as you walk. The fabric has a fine vertical weave that catches a sharp anisotropic sheen along its grain; the aurora colours are layered through several slow scrolling curtains that cross-fade through green, teal, magenta and violet. From intimate range you can read the weave, and the backlight grows so strong the silk looks lit through a stained-glass window. */
export default class extends BaseKnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.35)
    this.name = knotData.id
    this.envMapIntensity = 0.3
    const p = positionGeometry
    const cameraLocal = modelWorldMatrixInverse.mul(vec4(cameraPosition, 1)).xyz
    const viewDir = cameraLocal.sub(p).normalize()
    const facing = normalViewGeometry.dot(positionViewDirection).abs().clamp()
    const grazing = facing.oneMinus()
    const distance = positionView.length()
    const near = distance.smoothstep(1.25, 5.5).oneMinus()
    const intimate = distance.smoothstep(0.8, 2.7).oneMinus()
    // ---- silk weave ----
    // The silk has a fine vertical weave (warp threads) and a sparser
    // horizontal one (weft threads).
    const tube = uv()
    const warp = tube.y.mul(140)
    const weft = tube.x.mul(40)
    const weaveNoise = mx_noise_float(vec2(warp, weft).add(vec2(0, 0))).mul(0.5).add(0.5)
    const warpShadow = warp.mul(6).sin().abs().smoothstep(0.95, 1).mul(0.55)
    const weftShadow = weft.mul(2).sin().abs().smoothstep(0.92, 1).mul(0.3)
    const weaveDepth = warpShadow.add(weftShadow).mul(weaveNoise)
    // ---- base silk colour ----
    // A translucent off-white silk that lets the backlight through.
    const silkBase = color(hsl.integer(87, 30, 96)).mul(weaveNoise.mul(0.18).add(0.82))
    // ---- aurora backlight ----
    // Five layered curtains, each a cosine palette over its own slow
    // scrolling phase, anchored to a different vertical band so they
    // appear to drift past one another.
    const driftA = time.mul(0.22)
    const driftB = time.mul(0.13).add(2.3)
    const driftC = time.mul(0.27).add(4.5)
    const curtain1 = tube.y.mul(8).add(driftA).add(p.x.mul(2)).cos().mul(0.5).add(0.5)
    const curtain2 = tube.y.mul(11).add(driftB).add(p.z.mul(2)).cos().mul(0.5).add(0.5)
    const curtain3 = tube.x.mul(7).add(driftC).cos().mul(0.5).add(0.5)
    const curtainMix = curtain1.mul(0.5).add(curtain2.mul(0.3)).add(curtain3.mul(0.2))
    // Per-vertex micro-shimmer using fractal noise (the aurora's ripples)
    const shimmer = mx_fractal_noise_float(p.mul(6).add(vec2(time.mul(0.3), time.mul(-0.4))), 4, 2.1, 0.55)
      .mul(0.5).add(0.5)
    // The palette moves through green → teal → magenta → violet.
    const auroraGreen = color(hsl.integer(151, 99.9, 85.5))
    const auroraTeal = color(hsl.integer(226, 100, 76))
    const auroraMagenta = color(hsl.integer(344, 100, 64.3))
    const auroraViolet = color(hsl.integer(294, 100, 54))
    const auroraColour = (auroraGreen as unknown as Node<'vec3'>) as unknown as ReturnType<typeof mix>
    auroraColour
    const auroraMixed = mix(auroraGreen, auroraTeal, curtainMix)
      .add(mix(auroraMagenta, auroraViolet, curtainMix.mul(curtainMix)).mul(shimmer))
    // ---- assembly ----
    // The silk × aurora mix: at near range the backlight shines through.
    const backlit = silkBase.mul(auroraMixed).mul(intimate.mul(0.85).add(0.25))
    const silkFront = silkBase.mul(facing.pow(1.5).mul(0.55).add(0.45))
    const visible = (mix as unknown as (a: Node<'vec3'>, b: Node<'vec3'>, t: Node<'float'>) => Node<'vec3'>)(silkFront, backlit, intimate.mul(0.7).add(0.2))
    const silkColor = color(visible.x, visible.y, visible.z).mul(weaveNoise.mul(0.25).add(0.75))
    this.colorNode = silkColor
    this.metalness = 0
    this.roughness = 0.35
    this.sheen = 1
    this.sheenColor.set(hsl.integer(315, 100, 97))
    this.sheenRoughness = 0.22
    this.transmission = 0.4
    this.thickness = 0.16
    this.ior = 1.42
    this.attenuationColor.set(hsl.integer(262, 100, 80))
    this.attenuationDistance = 0.35
    this.clearcoat = 0.25
    this.clearcoatRoughness = 0.18
    this.anisotropy = 0.95
    // Anisotropy runs along the warp (vertical) direction.
    const warpDirection = vec2(0, 1)
    this.anisotropyNode = warpDirection.mul(weaveDepth.smoothstep(0.3, 0.7))
    // ---- vertex displacement for silk draping ----
    const drape = tube.y.mul(TAU * 4).sin().mul(0.0012).add(weaveDepth.mul(0.0005))
    this.positionNode = p.add(normalLocal.mul(drape))
    this.normalNode = proceduralNormal(weaveDepth.mul(0.0014).add(shimmer.mul(0.0008)), 0.7)
    // ---- emissive ----
    const backlightEmissive = auroraMixed
      .mul(intimate.mul(1.8).add(0.6))
      .mul(near.mul(0.4).add(0.4))
    const silkShimmer = (color(hsl.integer(0, 0, 100)) as unknown as Node<'vec3'>).mul(shimmer).mul(grazing.pow(3)).mul(near).mul(0.4)
    const rimGlow = mix(auroraMagenta, auroraTeal, facing).mul(grazing.pow(2.5)).mul(intimate).mul(0.35)
    this.emissiveNode = backlightEmissive.add(silkShimmer as unknown as ReturnType<typeof mix>).add(rimGlow)
    viewDir
  }
}
