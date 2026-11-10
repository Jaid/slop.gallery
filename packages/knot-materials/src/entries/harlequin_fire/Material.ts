import type {Texture} from 'three/webgpu'

import {cameraPosition, color, float, luminance, mix, mx_fractal_noise_float, mx_fractal_noise_vec3, mx_noise_float, normalLocal, normalViewGeometry, pmremTexture, positionWorld, time, vec3} from 'three/tsl'

import {ambientRadiance, toWorldDirection} from '../../candidates/claude_opus/lib/environmentHighlight.ts'
import {refractedParallax} from '../../candidates/claude_opus/lib/refractedParallax.ts'
import {voronoi} from '../../candidates/claude_opus/lib/voronoi3dStruct.ts'
import {wavelengthColor} from '../../candidates/claude_opus/lib/wavelengthColorCie.ts'
import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

const silicaIndex = 1.45
/** Black opal. Every grain is a crystal of stacked silica spheres with its own lattice orientation and spacing. A grain only ignites when its lattice mirrors a real light source of the environment toward the eye, and its color obeys Bragg's law – tilt away from the lattice and a red grain slides through green into violet. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.3)
    this.name = knotData.id
    const {p, view, facing, grazing, near, intimate} = viewerFrame()
    const n = normalLocal.normalize()
    const incident = positionWorld.sub(cameraPosition).normalize()
// Continents of bright fire and dull potch give the mosaic composition instead of uniform glitter.
    const region = mx_fractal_noise_float(p.mul(1.9).add(3.1), 3, 2, 0.5).mul(0.5).add(0.5)
    const fireRegion = region.smoothstep(0.3, 0.6)
    const ambient = ambientRadiance(environment, n)
    const grainLayer = (depth: number, scale: number, seed: number, spread: number, sharpness: number) => {
      const q = refractedParallax(p, n, view, depth, silicaIndex)
// Strong domain warping bends the straight Voronoi walls into the ragged jigsaw of natural harlequin.
      const flow = mx_fractal_noise_vec3(q.mul(scale * 0.22).add(seed), 2, 2.1, 0.55).mul(0.6).add(mx_fractal_noise_vec3(q.mul(scale * 1.15).sub(seed), 2, 2.3, 0.5).mul(0.13))
      const cells = voronoi(q.mul(scale).add(flow).add(seed), 0.9)
      const rnd = cells.random
      const rnd2 = cellNoiseVec3(cells.cell.add(vec3(71.5, -13.5, seed + 29.5)))
// Lattices are frozen into the stone in 3D, independent of the polished surface, so a grain lights up as a whole.
// A slight outward bias keeps more grains facing the visitor; a slow precession keeps the fire rolling for a still visitor.
      const drift = time.mul(rnd.y.sub(0.5).mul(0.25)).add(rnd.x.mul(40))
      const wander = vec3(drift.sin(), drift.mul(1.3).cos(), drift.mul(0.7).sin()).mul(0.06)
      const random = rnd2.mul(2).sub(1).add(wander)
// Lamellar twinning: parallel stripes of alternating tilt inside the grain – the “rolling flash”.
      const stripeAxis = rnd.zxy.mul(2).sub(1).normalize()
      const stripePhase = q.mul(scale * 5.5).dot(stripeAxis).add(rnd.z.mul(20))
      const stripeResolved = stripePhase.fwidth().smoothstep(0.7, 2.4).oneMinus()
      const stripe = stripePhase.sin().mul(stripeResolved)
      const lattice = n.mul(0.3).add(random.mul(spread)).add(stripeAxis.cross(n).mul(stripe.mul(0.035))).normalize()
// Bragg reflection from sphere planes with spacing d inside silica: λ = 2·n·d·cosθᵢ.
// Sphere spacing drifts inside each grain too, so a flash sweeps a small rainbow across its patch.
      const spacing = rnd.y.mul(80).add(168).add(mx_noise_float(q.mul(scale * 1.3).add(rnd.mul(9))).mul(16))
      const cosOutside = lattice.dot(view).abs()
      const cosInside = cosOutside.pow2().oneMinus().div(silicaIndex ** 2).oneMinus().sqrt()
      const wavelength = cosInside.mul(spacing).mul(2 * silicaIndex)
// Wyman's fit peaks near 1 at 555 nm; lift the deep reds and violets that opal is prized for.
      const spectrum = wavelengthColor(wavelength).mul(vec3(1.25, 0.9, 1.35))
// Light of the real environment, mirrored by this grain's lattice.
      const mirror = toWorldDirection(lattice)
      const reflected = incident.reflect(mirror)
      const light = pmremTexture(environment, reflected, float(sharpness))
// Relative to the room's average radiance, so the same stone reads alike in any gallery lighting.
      const contrast = luminance(light).div(ambient)
      const ignition = contrast.smoothstep(2.2, 4.6).pow(1.5).mul(0.85)
// ...plus the glow a grain returns when it faces the visitor squarely, as if the gallery lights stood behind them.
      const faceOn = cosOutside.pow(70).mul(0.85)
      const brilliance = rnd2.x.smoothstep(0.15, 0.7).mul(0.8).add(0.2)
// The surface slices the 3D grains; when it only grazes a grain's far corner the slice is a thin needle.
// Such slices lie far from their feature point, so fading by F1 removes needles and feathers every margin.
      const core = cells.distance.smoothstep(0.42, 0.82).oneMinus().mul(0.85).add(0.15)
      const seam = cells.border.div(cells.border.fwidth().mul(1.2).add(0.006)).clamp().mul(0.5).add(0.5).mul(core)
// Sub-grain texture: sphere-packing domains and dislocations break up flat fills when you lean in.
      const grainScale = q.mul(scale * 7)
      const grainResolved = grainScale.fwidth().length().smoothstep(0.35, 1).oneMinus()
      const microGrain = mx_fractal_noise_float(grainScale, 2, 2.2, 0.5).mul(grainResolved).mul(0.9).add(1).clamp(0.25, 1.6)
// Even unaligned grains keep a smoldering tint under diffuse light, so the mosaic stays contiguous.
      const smolder = rnd.x.smoothstep(0.35, 0.95).mul(0.035).add(0.004)
// Some grains are clear silica windows, revealing the deeper strata of fire beneath.
      const coverage = rnd2.z.smoothstep(0.22, 0.34)
      return {
        flash: spectrum.mul(ignition.add(faceOn).add(smolder)).mul(brilliance).mul(seam).mul(microGrain),
        brilliance,
        coverage,
        seam,
        stripe,
      }
    }
    const top = grainLayer(0.002, 17, 0, 1.1, 0.13)
    const deep = grainLayer(0.04, 12, 17.3, 1, 0.14)
    const pinfire = grainLayer(0.012, 52, 41.9, 1.2, 0.1)
    const pinfireResolved = p.mul(52).fwidth().length().smoothstep(0.3, 0.8).oneMinus()
// Milky blue haze in the silica, deepest toward the silhouette where the path through the stone is longest.
    const haze = mx_noise_float(p.mul(4.2)).mul(0.5).add(0.5)
    this.colorNode = mix(color('#010103'), color('#050a1c'), haze.mul(grazing.pow(1.5)))
    this.metalness = 0
    this.roughness = 0.1
// Only the polished clearcoat reflects; the stone beneath is a light trap.
    this.specularIntensity = 0
    this.clearcoat = 0.65
    this.clearcoatRoughness = 0.012
    this.clearcoatNormalNode = normalViewGeometry
// Seams between grains are faintly sunken under the polish.
    this.normalNode = proceduralNormal(top.seam.mul(0.2).add(top.stripe.mul(0.05)), 0.0012)
    const topVisibility = top.coverage.mul(fireRegion.mul(0.9).add(0.1))
    this.emissiveNode = top.flash.mul(topVisibility).mul(near.mul(0.5).add(1))
      .add(deep.flash.mul(topVisibility.mul(0.9).oneMinus()).mul(0.75).mul(facing.mul(0.6).add(0.4)))
      .add(pinfire.flash.mul(pinfire.brilliance.pow(2)).mul(pinfireResolved).mul(intimate.mul(1.4).add(0.4)))
      .add(color('#0b1638').mul(haze).mul(grazing.pow(3)).mul(0.25))
  }
}
