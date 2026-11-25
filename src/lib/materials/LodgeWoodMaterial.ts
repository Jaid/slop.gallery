import hsl from 'okhsl'
import {bumpMap, color, float, mix, mx_noise_float, normalWorldGeometry, positionWorld, select, vec3} from 'three/tsl'
import {MeshStandardNodeMaterial} from 'three/webgpu'

/** Vertical cedar boards, with narrow dark seams and grain at physical scale. */
export default class LodgeWoodMaterial extends MeshStandardNodeMaterial {
  constructor() {
    super({
      roughness: 0.78,
      envMapIntensity: 0.25,
    })
    const normal = normalWorldGeometry
    // Upright faces count their boards along themselves, whichever way they run; the rest, floors, ceilings and chamfers, along x and z at once.
    const upright = normal.y.abs().lessThan(0.25)
    const along = vec3(normal.z, 0, normal.x.negate()).normalize()
    const across = select(upright, positionWorld.dot(along), positionWorld.x.add(positionWorld.z))
    const course = across.div(0.25)
    const board = course.fract()
    // Analytically filter fine seams and grain on long, grazing-angle stair walls.
    const footprint = course.fwidth().mul(0.5).max(0.0125)
    const seam = mix(board.min(board.oneMinus()).smoothstep(float(0.0275).sub(footprint), float(0.0275).add(footprint)), float(0.945), course.fwidth().smoothstep(0.1, 0.3))
    const grain = mx_noise_float(positionWorld.mul(vec3(42, 1.8, 42)))
    const phase = across.mul(95).add(grain.mul(5))
    const rings = mix(phase.sin().mul(0.5).add(0.5), float(0.5), phase.fwidth().smoothstep(1, 3))
    const tone = mx_noise_float(across.div(0.25).floor().mul(4.7)).mul(0.16).add(0.8)
    this.colorNode = mix(color(hsl.integer(56, 28, 11)), mix(color(hsl.integer(56, 49, 31)), color(hsl.integer(62, 49, 48)), rings.mul(0.4).add(0.3)).mul(tone), seam)
    this.normalNode = bumpMap(seam.mul(0.5).add(rings.mul(0.1)), float(0.035))
  }
}
