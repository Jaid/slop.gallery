import type {Node, Texture} from 'three/webgpu'

import {abs, attribute, cameraPosition, cameraViewMatrix, color, dot, exp, float, mix, mx_noise_float, normalize, normalView, positionGeometry, positionViewDirection, positionWorld, sin, smoothstep, time, transformNormalToView, vec3} from 'three/tsl'
import {DoubleSide, MeshPhysicalNodeMaterial} from 'three/webgpu'

type Float = Node<'float'>

/** Schlick’s reflectance of water at normal incidence. */
const waterF0 = 0.02
/** Filtered foam around a ring, broken up so that it never reads as a drawn circle. */
function ringFoam(radius: Float, churn: Float, reach: number) {
  return exp(abs(radius).mul(-reach)).mul(churn.mul(0.75).add(0.45))
}

/**
 * The limestone fountain’s water, either the still pools or the falling veils, ring jets and central column.
 *
 * Pools ripple outward from every ring where water lands (`splashA`, `splashB`), with broad swell, drifting capillary ripples and a rim of churned foam. Their shading carries a Fresnel-weighted reflection of the bright vault above, so every crest and trough shifts the reflected light. Falling water is a translucent sheet whose streaks travel down with the water and which frays into strands and turns white with air as it falls (`waterFall`, 0 at the lip and 1 at the pool); jets are the same water drawn as closed tubes (`waterDense`), so they stay coherent and glossy on their way up.
 *
 * Transparency rather than screen-space transmission keeps the carved stone below readable without the ghosting of a double-sided refraction buffer. Both graphics modes share the shading; the fast one only drops the environmental reflection a little.
 */
export default class LimestoneFountainWaterMaterial extends MeshPhysicalNodeMaterial {
  constructor(falling = false, heavy = true, {environment}: {environment?: Texture} = {}) {
    super({
      clearcoat: falling ? 0.3 : 0.85,
      clearcoatRoughness: 0.05,
      color: '#ffffff',
      depthWrite: false,
      envMap: environment ?? null,
      envMapIntensity: heavy ? 1.3 : 0.65,
      ior: 1.333,
      metalness: 0,
      roughness: 0.05,
      side: DoubleSide,
      transparent: true,
    })
    // Schlick’s Fresnel factor, which turns water into a mirror at grazing angles.
    const fresnel = abs(normalView.dot(positionViewDirection)).oneMinus().pow(5).mul(1 - waterF0).add(waterF0)
    const glancing = fresnel.mul(2.4).min(1)
    if (falling) {
      const fall = attribute<'float'>('waterFall', 'float')
      const air = attribute<'float'>('waterAir', 'float')
      const dense = attribute<'float'>('waterDense', 'float')
      const rib = attribute<'float'>('waterRib', 'float')
      const hem = attribute<'float'>('waterHem', 'float')
      const p = positionGeometry
      // Noise fixed to the water and scrolling down with it; three dimensions keep the pattern seamless around the axis.
      const scroll = p.y.mul(2.1).add(time.mul(2.4))
      const streaks = mx_noise_float(vec3(p.x.mul(34), scroll, p.z.mul(34))).mul(0.6)
        .add(mx_noise_float(vec3(p.x.mul(83), scroll.mul(1.7).sub(4.1), p.z.mul(83))).mul(0.4))
        .mul(0.5).add(0.5)
      const tears = mx_noise_float(vec3(p.x.mul(8.5), scroll.mul(0.3).sub(9.3), p.z.mul(8.5))).mul(0.55)
        .add(mx_noise_float(vec3(p.x.mul(19), scroll.mul(0.46), p.z.mul(19))).mul(0.45))
        .mul(0.5).add(0.5)
      // The sheet leaves the lip whole and frays into strands only once it is well on its way down.
      const threshold = fall.pow(1.7).mul(0.6).sub(0.08).max(0)
      const frayed = smoothstep(threshold, threshold.add(0.22), tears)
      const whole = mix(float(1), frayed, fall.smoothstep(0.3, 0.85))
      // Water gathers along the crest of every tongue; the folds between them stay thin.
      const tongues = mix(float(1), rib, fall.smoothstep(0.05, 0.5))
      // Every tongue dissolves where it ends instead of stopping on a hard edge.
      const ending = float(1).sub(smoothstep(0.82, 1, hem).mul(0.92))
      const sheet = whole.mul(tongues.mul(0.35).add(0.75)).mul(streaks.mul(0.25).add(0.85)).mul(ending).clamp()
      // Air torn into the water makes white water: the sheet turns opaque white where it is aerated and stays clear where it is not.
      const foam = air.mul(streaks.mul(0.4).add(0.75)).add(glancing.mul(0.4)).add(fall.pow(3).mul(0.15)).clamp()
      const sheen = mix(color('#8dcfdd'), color('#f8feff'), glancing)
      const sheetColor = mix(mix(color('#9ddbd2'), color('#ffffff'), foam), sheen, glancing.mul(0.4))
      const tubeColor = mix(color('#a5ded6'), color('#f4fffd'), air.mul(0.5).add(streaks.mul(0.3)).add(0.2))
      this.colorNode = mix(sheetColor, tubeColor, dense)
      this.opacityNode = mix(sheet.mul(mix(0.42, 0.96, foam)), float(0.48).add(glancing.mul(0.35)), dense).clamp(0, 1)
      this.roughnessNode = mix(fall.mul(0.12).add(0.04), float(0.03), dense)
      // A slow wobble keeps the curtain from reading as a rigid shell.
      const wobble = mx_noise_float(vec3(p.x.mul(4.5), scroll.mul(0.4), p.z.mul(4.5))).mul(fall).mul(0.016)
      this.positionNode = p.add(vec3(p.x, 0, p.z).normalize().mul(wobble))
    } else {
      const p = positionGeometry.xz
      const radius = p.length()
      const splashA = attribute<'float'>('splashA', 'float')
      const splashB = attribute<'float'>('splashB', 'float')
      const foamA = attribute<'float'>('foamA', 'float')
      const foamB = attribute<'float'>('foamB', 'float')
      const churn = mx_noise_float(vec3(p.mul(6.5), time.mul(1.15))).mul(0.5).add(0.5)
      /** Every landing ring sends out a fast train of crests and a slower swell. */
      const train = (x: Float, z: Float, splash: Float, reach: number, scale: number, speed: number, amplitude: number) => {
        const distance = x.mul(x).add(z.mul(z)).sqrt().sub(splash)
        return sin(distance.mul(scale).sub(time.mul(speed))).mul(exp(abs(distance).mul(-reach))).mul(amplitude)
      }
      // The swell of the whole surface, capillary ripples drifting across it and rings from every landing.
      const waveHeight = (x: Float, z: Float) => train(x, z, splashA, 8, 52, 7.4, 0.006)
        .add(train(x, z, splashA, 2.4, 17, 2.3, 0.004))
        .add(train(x, z, splashB, 10, 47, 8.1, 0.005))
        .add(train(x, z, splashB, 3.2, 15, 2.6, 0.003))
        .add(sin(x.mul(7.1).add(z.mul(4.3)).sub(time.mul(1.35))).mul(0.003))
        .add(sin(x.mul(-5.2).add(z.mul(8.9)).add(time.mul(1.9))).mul(0.0023))
        .add(sin(x.mul(2.4).sub(z.mul(11.3)).add(time.mul(2.5))).mul(0.0015))
        .add(mx_noise_float(vec3(x.mul(11), z.mul(11), time.mul(0.5))).mul(0.002))
        .add(mx_noise_float(vec3(x.mul(31), z.mul(31), time.mul(0.85))).mul(0.0008))
      const height = waveHeight(p.x, p.y)
      // Slopes from the wave field itself: screen-space derivatives of a procedural node come out flat on these shaders.
      const sampling = 0.004
      const slopeX = waveHeight(p.x.add(sampling), p.y).sub(waveHeight(p.x.sub(sampling), p.y)).div(sampling * 2)
      const slopeZ = waveHeight(p.x, p.y.add(sampling)).sub(waveHeight(p.x, p.y.sub(sampling))).div(sampling * 2)
      const rippled = transformNormalToView(normalize(vec3(slopeX.negate(), 1, slopeZ.negate())))
      // Reflect the vault above about the rippled surface: the view direction mirrored at the normal.
      const worldNormal = rippled.transformNormalByInverseViewMatrix(cameraViewMatrix).normalize()
      const reflected = positionWorld.sub(cameraPosition).normalize().reflect(worldNormal)
      const froth = mx_noise_float(vec3(p.mul(24), time.mul(1.6))).mul(0.5).add(0.5)
        .mul(mx_noise_float(vec3(p.mul(7), time.mul(0.9))).mul(0.5).add(0.5))
      const foam = ringFoam(radius.sub(splashA), churn, 12).mul(foamA)
        .add(ringFoam(radius.sub(splashB), churn, 13).mul(foamB))
        .add(froth.mul(0.12))
        .mul(froth.mul(0.55).add(0.6))
        .clamp(0, 1)
      const crest = height.abs().mul(70).min(0.34)
      // Light from the bright vault: slopes that face it catch the sky, the ones turned away fall into the water’s own shade.
      const skyDirection = normalize(vec3(0.3, 1, 0.22))
      const skyLight = dot(worldNormal, skyDirection).clamp(0, 1)
      const water = mix(color('#12463f'), color('#79cfc0'), crest.mul(1.1).add(0.14)).mul(mix(float(0.24), float(1.85), skyLight))
      const reflectedSky = mix(color('#3f95b0'), color('#f4feff'), dot(reflected, skyDirection).max(0).pow(3))
      this.colorNode = mix(mix(water, color('#f4fffc'), foam.mul(foam)), reflectedSky, fresnel.mul(1.3).add(0.1).min(0.94))
      this.opacityNode = foam.mul(0.15).add(fresnel.mul(0.1)).add(0.8).clamp(0.5, 0.99)
      this.normalNode = rippled
      this.positionNode = positionGeometry.add(vec3(0, height, 0))
      this.roughnessNode = mix(mix(float(0.03), float(0.2), crest), float(0.45), foam)
    }
  }
}
