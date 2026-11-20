import type StairFlight from './StairFlight.ts'

/**
 * Layout of a woven stair runner that is painted into the tread material instead of being separate geometry.
 *
 * The runner follows one continuous path down the flight: from a tread laid into whatever the flight starts from, in front of its first riser, across each tread, over the rounded nosing and down the riser to the next brass stair rod. Path distance therefore never jumps, so the woven pattern flows from step to step like a real fitted runner.
 *
 * All values are meters. `u` is measured across the flight from its center line, `s` along a tread from its back edge toward the nosing and `h` down a riser from the nosing.
 */
export default class StairRunner {
  /** woven ochre tape that binds both long edges */
  readonly binding = 0.018
  /** cross-flight distance of the finial centers from the center line */
  readonly finialOffset: number
  /** radius of the ball finials that end every rod */
  readonly finialRadius = 0.0135
  readonly halfWidth: number
  /** wood nosing roundover radius */
  readonly nosingRadius = 0.014
  /** distance from a tread’s back edge to the rod axis */
  readonly rodCenter: number
  /** how far each rod reaches past the runner edge before its finial */
  readonly rodOverhang = 0.042
  /** radius of the brass stair rods in the tread/riser corner */
  readonly rodRadius = 0.0085
  /** path length of one tread plus its riser, the period of the runner path */
  readonly stepLength: number
  /** pile height above the wood, also the height of the rounded edge roll */
  readonly thickness = 0.009

  constructor(readonly flight: StairFlight, readonly width: number, readonly margin = 0.2) {
    if (!Number.isFinite(width) || width <= 0) {
      throw new RangeError('A stair runner needs a positive finite width.')
    }
    this.halfWidth = width / 2
    this.rodCenter = this.rodRadius + 0.004
    this.finialOffset = this.halfWidth + this.rodOverhang + this.finialRadius * 0.6
    this.stepLength = flight.run + flight.rise
    if (this.finialOffset + this.finialRadius > flight.width / 2 - margin) {
      throw new RangeError('A stair runner and its rod finials must leave a margin of bare wood on both sides of the flight.')
    }
    if (this.rodCenter + this.rodRadius >= flight.run / 2 || this.nosingRadius >= flight.rise / 2) {
      throw new RangeError('The flight’s treads are too shallow for stair rods and rounded nosings.')
    }
  }

  /** Continuous path distance of a point on tread `step` (0-based): `s` on its top face, or `h` down its riser. */
  pathDistance(step: number, face: 'riser' | 'tread', offset: number) {
    return step * this.stepLength + (face === 'tread' ? offset : this.flight.run + offset)
  }
}
