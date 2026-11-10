/** a point of a frame’s cross-section: how far out past the opening’s edge it lies and how far in front of the frame’s middle */
export type SectionPoint = readonly [r: number, z: number]

/** a point of the profile and how the run that starts at it is made */
export type ProfileVertex = {
  /** whether the surface breaks at the point, a sharp arris, instead of running on smoothly */
  crease: boolean
  /** the index of the material of the run that starts at the point */
  material: number
  r: number
  z: number
}

type RunOptions = {
  /** the material of the new run, by default the one before */
  material?: number
  /** how many straight pieces a curve is made of */
  steps?: number
}

/**
 * The cross-section of a moulding, swept round the opening of a frame by {@link sweepProfile}.
 *
 * It runs from the sight edge, the inner lip on the image’s plane, up over the face and down the outer edge to the back, then in along the back: the solid lies to the right of the way it travels, and r grows outward, away from the image, while z grows toward the viewer. Every run ends in a hard arris unless it is a curve flowing into the next one.
 */
export default class FrameProfile {
  /** A profile starting at its sight edge, on the image’s plane, in the material with the index. */
  static from(start: SectionPoint, material = 0) {
    return new FrameProfile(start, material)
  }

  readonly points: Array<ProfileVertex>

  constructor([r, z]: SectionPoint, material = 0) {
    this.points = [{
      r,
      z,
      crease: true,
      material,
    }]
  }

  /** the point the profile has reached */
  get end(): SectionPoint {
    const {r, z} = this.points.at(-1)!
    return [r, z]
  }

  /** how far in front of the frame’s middle the profile reaches at most */
  get front() {
    return Math.max(...this.points.map(point => point.z))
  }

  /** how far out the profile reaches at most */
  get reach() {
    return Math.max(...this.points.map(point => point.r))
  }

  /**
   * A circular arc to the point, bulging out of the solid by `bulge` times its chord, a convex round like a bead or a torus, or into it for a negative one, a hollow like a cove or a scotia; 0.5 is a half circle.
   */
  arc(r: number, z: number, bulge: number, {material, steps = 8}: RunOptions = {}) {
    const [r0, z0] = this.end
    const chord = Math.hypot(r - r0, z - z0)
    if (chord < 1e-9 || bulge === 0) {
      return this.line(r, z, {material})
    }
    const sagitta = Math.abs(bulge) * chord
    const radius = (chord * chord / 4 + sagitta * sagitta) / (2 * sagitta)
    // The left of travel is outside the solid, where a convex arc bulges to.
    const left = [-(z - z0) / chord, (r - r0) / chord] as const
    const side = Math.sign(bulge)
    const middle = [(r0 + r) / 2, (z0 + z) / 2] as const
    const center = [middle[0] - left[0] * side * (radius - sagitta), middle[1] - left[1] * side * (radius - sagitta)] as const
    const start = Math.atan2(z0 - center[1], r0 - center[0])
    let sweep = Math.atan2(z - center[1], r - center[0]) - start
    // Convex arcs turn clockwise around their center, as the solid lies to the right; hollows turn the other way.
    if (side > 0) {
      while (sweep > 0) {
        sweep -= Math.PI * 2
      }
    } else {
      while (sweep < 0) {
        sweep += Math.PI * 2
      }
    }
    const points = Array.from({length: steps}, (_, index) => {
      const angle = start + sweep * (index + 1) / steps
      return index === steps - 1 ? [r, z] as const : [center[0] + Math.cos(angle) * radius, center[1] + Math.sin(angle) * radius] as const
    })
    return this.curve(points, material)
  }

  /** A straight run to the point, an arris where it ends. */
  line(r: number, z: number, {material, smooth = false}: {
    material?: number
    smooth?: boolean
  } = {}) {
    this.setMaterial(material)
    this.points.push({
      r,
      z,
      crease: !smooth,
      material: this.points.at(-1)!.material,
    })
    return this
  }

  /** An S-curve to the point: a cyma recta, hollow first and round where it ends, or with `reverse` a cyma reversa, round first; its two halves are quarter waves of a sine. */
  ogee(r: number, z: number, {material, reverse = false, steps = 12}: RunOptions & {reverse?: boolean} = {}) {
    const [r0, z0] = this.end
    const dr = r - r0
    const dz = z - z0
    // Leaving along one axis and arriving along the other gives the S its shoulders.
    return this.path(t => {
      const s = (1 - Math.cos(Math.PI * t)) / 2
      return reverse ? [r0 + dr * t, z0 + dz * s] as const : [r0 + dr * s, z0 + dz * t] as const
    }, {
      material,
      steps,
    })
  }

  /** A run along the points given by `f` for t from 0 to 1, excluding 0, which starts where the profile is, smooth within and ending in an arris. */
  path(f: (t: number) => SectionPoint, {material, steps = 8}: RunOptions = {}) {
    return this.curve(Array.from({length: steps}, (_, index) => f((index + 1) / steps)), material)
  }

  /** Marks the point reached as smooth, so the run before it flows into the next one without an arris. */
  smooth() {
    this.points.at(-1)!.crease = false
    return this
  }

  private curve(points: ReadonlyArray<SectionPoint>, material: number | undefined) {
    this.setMaterial(material)
    const run = this.points.at(-1)!.material
    for (const [index, [r, z]] of points.entries()) {
      this.points.push({
        r,
        z,
        crease: index === points.length - 1,
        material: run,
      })
    }
    return this
  }

  private setMaterial(material: number | undefined) {
    if (material !== undefined) {
      this.points.at(-1)!.material = material
    }
  }
}
