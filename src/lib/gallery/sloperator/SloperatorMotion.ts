import type {SloperatorSeat} from './SloperatorGeometry.ts'
import type SloperatorRig from './SloperatorRig.ts'
import type {SloperatorGoals} from './SloperatorRig.ts'

import {clamp} from 'math'
import {Vector3} from 'three/webgpu'

import {caneLength, lap, sided} from './SloperatorRig.ts'

/** goals at a moment of a move, as a share of it */
type Key = {
  at: number
  goals: SloperatorGoals
}

const sides = [-1, 1] as const
/** the order the numbers of goals run in, flattened, see {@link flatten} */
const sidedKeys = ['ankles', 'elbows', 'hands', 'knees'] as const
const pointKeys = ['grip', 'pelvis', 'tip'] as const
/** how far past the front edge of his seat, as far in front of where he sits as his lap, his ankles stand up, so the backs of his legs keep clear of it, in meters */
const standUpClearance = 0.12
/** how long standing up takes, and bringing his arms behind his back, in seconds */
const standUpTime = 1.8
const armsBackTime = 1.5
/** how far forward he leans to stand up, and on his way up, in radians */
const liftOffLean = 0.55
const risingLean = 0.35
/** how far his pelvis rises off the seat as he leans forward to stand up, taking his weight onto his feet, so the hem of his coat tipping forward with him stays over the seat */
const liftOffRise = 0.07
/** how high a foot lifts as it steps */
const stepHeight = 0.03
/** how far along his cane from its handle his fist holds it once it points up behind his back, as a share of its length, so its handle hangs under his fist */
const handleUnderFist = 0.06
const point = (x: number, y: number, z: number) => new Vector3(x, y, z)
/** Where his cane’s grip and tip are, held in his fist `along` of the way from its handle to its tip, or on top of its handle where negative, its shaft running toward `toward`. */
function held(fist: Vector3, toward: Vector3, along: number) {
  const direction = toward.clone().normalize()
  return {
    grip: fist.clone().addScaledVector(direction, -along * caneLength),
    tip: fist.clone().addScaledVector(direction, (1 - along) * caneLength),
  }
}
const mix = (from: Vector3, to: Vector3, share: number) => from.clone().lerp(to, share)
/** The goals partway from one to the other, every number of them `share` of the way. */
function mixGoals(from: SloperatorGoals, to: SloperatorGoals, share: number): SloperatorGoals {
  const end = flatten(to)
  return unflatten(flatten(from).map((value, index) => value + (end[index] - value) * share))
}
/** The goals moved by `offset`, all of him the same way. */
function shifted(goals: SloperatorGoals, offset: Vector3): SloperatorGoals {
  return {
    ...goals,
    ankles: sided(side => goals.ankles[side].clone().add(offset)),
    elbows: sided(side => goals.elbows[side].clone().add(offset)),
    grip: goals.grip.clone().add(offset),
    hands: sided(side => goals.hands[side].clone().add(offset)),
    knees: sided(side => goals.knees[side].clone().add(offset)),
    pelvis: goals.pelvis.clone().add(offset),
    tip: goals.tip.clone().add(offset),
  }
}
/** Every number of the goals in one row, see {@link unflatten}. */
function flatten(goals: SloperatorGoals) {
  return [
    goals.lean,
    ...pointKeys.flatMap(key => goals[key].toArray()),
    ...sidedKeys.flatMap(key => sides.flatMap(side => goals[key][side].toArray())),
  ]
}
function unflatten(values: ReadonlyArray<number>): SloperatorGoals {
  let at = 1
  const next = () => {
    const vector = point(values[at], values[at + 1], values[at + 2])
    at += 3
    return vector
  }
  const [grip, pelvis, tip] = pointKeys.map(next)
  // His right side first, as they run
  const [ankles, elbows, hands, knees] = sidedKeys.map(() => sided(next))
  return {
    ankles,
    elbows,
    grip,
    hands,
    knees,
    lean: values[0],
    pelvis,
    tip,
  }
}
/**
 * The slope of a smooth curve through the values at the moments, at each of them, which never overshoots between two of them nor turns back: level at both ends and wherever the values turn, as M. Steffen’s monotone cubic has them.
 */
function slopes(times: ReadonlyArray<number>, values: ReadonlyArray<number>) {
  const secants = values.slice(1).map((value, index) => (value - values[index]) / (times[index + 1] - times[index]))
  return values.map((_ignored, index) => {
    if (index === 0 || index === values.length - 1) {
      return 0
    }
    const [before, after] = [secants[index - 1], secants[index]]
    const [last, coming] = [times[index] - times[index - 1], times[index + 1] - times[index]]
    const middle = (before * coming + after * last) / (last + coming)
    return (Math.sign(before) + Math.sign(after)) * Math.min(Math.abs(before), Math.abs(after), Math.abs(middle) / 2)
  })
}

/**
 * How the Sloperator moves once the player caught sight of him, from his neutral pose into his sight pose, as goals his rig follows, see {@link SloperatorGoals}: off a seat, he leans forward, pushes himself up off his cane or the arms of the seat and stands up in front of it, his hands back on his cane; standing, he takes his cane up in his right fist, spins it round so it points up, and brings his hands behind his back, his left over his right, its shaft rising behind his back.
 * Through every number of the goals runs a smooth curve that never overshoots its keyframes, so he eases out of his neutral pose and into his sight pose.
 */
export default class SloperatorMotion {
  /**
   * Standing up where he stands: his right fist takes his cane up off the floor and spins it round forward, the shaft sliding through his fist to its middle while it lies level and back to under its handle once it points up, and both hands go round behind him to meet low at the seat of his coat, his left over his right, his arms hanging all but straight, his cane pointing up behind his back with its handle under his fist.
   */
  private static armsBack(rig: SloperatorRig): ReadonlyArray<Key> {
    const neutral = rig.stand().goals()
    // Out to his right, the cane still standing on its tip, clear of his coat to spin beside him, his left hand let go of it and out of the way of his thigh
    const aside = sided(side => (side < 0 ? point(-0.31, 0.92, 0.22) : point(0.28, 0.93, 0.21)))
    // Lifted a little, the cane level, held by its middle, his left arm hanging at his side
    const lifted = sided(side => (side < 0 ? point(-0.32, 0.96, 0.06) : point(0.25, 0.8, 0.07)))
    // Down at his right hip, the cane upright, his left hand on its way round
    const atHip = sided(side => (side < 0 ? point(-0.26, 0.9, -0.07) : point(0.24, 0.84, -0.08)))
    const clasped = sided(side => (side < 0 ? point(-0.025, 0.845, -0.155) : point(0.035, 0.865, -0.17)))
    // His elbows bend back, close to his sides, never out like arms akimbo, and a little out once his hands meet behind him, as arms hang behind a back.
    const elbows = (out: number, z: number) => sided(side => point(side * out, 1.12, z))
    return [
      {
        at: 0,
        goals: neutral,
      },
      {
        at: 0.15,
        goals: {
          ...neutral,
          elbows: elbows(0.24, -0.25),
          hands: aside,
          // His fist still on top of its handle, as his hands lay on it
          ...held(aside[-1], point(-0.02, -1, 0.05), -handleUnderFist),
        },
      },
      {
        at: 0.35,
        goals: {
          ...neutral,
          elbows: elbows(0.24, -0.3),
          hands: lifted,
          ...held(lifted[-1], point(0, 0, 1), 0.47),
        },
      },
      {
        at: 0.6,
        goals: {
          ...neutral,
          elbows: elbows(0.26, -0.3),
          hands: atHip,
          ...held(atHip[-1], point(-0.05, 1, -0.12), handleUnderFist),
        },
      },
      {
        at: 1,
        goals: {
          ...neutral,
          elbows: elbows(0.3, -0.15),
          hands: clasped,
          ...held(clasped[-1], point(0.25, 1, -0.2), handleUnderFist),
        },
      },
    ]
  }
  /**
   * Off the seat: he steps his feet to where he stands up, in front of its edge, leans forward and pushes himself up off his cane or the arms of the seat, and stands up straight, his cane back on the floor in front of his toes and his hands on its handle as he stands.
   * On a bench, his cane stays where it stands while he leans on it, and only then comes forward; in an armchair, his right fist keeps hold of it across his lap until he is up, then swings it down in front of him round the outside of his left leg.
   */
  private static standUp(rig: SloperatorRig, seat: SloperatorSeat): ReadonlyArray<Key> {
    const standing = rig.stand().goals()
    const seated = rig.sit(seat).goals()
    // Where he stands up, his ankles as far in front of where he sits as they are sitting, or past the seat’s edge
    const ankleZ = Math.max(seated.ankles[1].z, lap + standUpClearance)
    const up = shifted(standing, point(0, 0, ankleZ - standing.ankles[1].z))
    // On his way up, his knees bend forward over his feet, as close together as standing: toward points well in front of his shins, which his hips moving forward over his knees never come near.
    const forward = sided(side => point(up.knees[side].x, up.knees[side].y, up.ankles[side].z + 0.4))
    const stepped = (goals: SloperatorGoals): SloperatorGoals => ({
      ...goals,
      ankles: up.ankles,
      knees: forward,
    })
    // On a bench, he tips his cane forward, its tip where it stands, and leans on it; in an armchair, his hands stay on the rolls.
    const tipped = seat.arms ? seated : (() => {
      const grip = seated.tip.clone().add(point(0, Math.cos(0.25), Math.sin(0.25)).multiplyScalar(caneLength))
      const offset = grip.clone().sub(seated.grip)
      return {
        ...seated,
        grip,
        hands: sided(side => seated.hands[side].clone().add(offset)),
      }
    })()
    const liftOff: SloperatorGoals = {
      ...stepped(tipped),
      lean: -liftOffLean,
      pelvis: seated.pelvis.clone().add(point(0, liftOffRise, 0.06)),
    }
    const halfway = mixGoals(seated, liftOff, 0.5)
    const rising: SloperatorGoals = {
      ...liftOff,
      lean: -risingLean,
      pelvis: point(0, liftOff.pelvis.y + 0.55 * (up.pelvis.y - liftOff.pelvis.y), up.pelvis.z - 0.03),
    }
    // Nearly up, bringing his cane round to stand in front of him, lifted clear of the floor or of his left leg
    const share = 0.7
    const caneOnTheWay = seat.arms ? (() => {
      const fist = mix(seated.hands[-1], up.hands[-1], share)
      const grip = fist.clone().add(mix(seated.grip.clone().sub(seated.hands[-1]), up.grip.clone().sub(up.hands[-1]), share))
      const along = mix(seated.tip.clone().sub(seated.grip).normalize(), up.tip.clone().sub(up.grip).normalize(), share)
      return {
        grip,
        hands: sided(side => (side < 0 ? fist : mix(seated.hands[side], up.hands[side], share))),
        tip: along.normalize().multiplyScalar(caneLength).add(grip),
      }
    })() : (() => {
      const grip = mix(tipped.grip, up.grip, share).add(point(0, 0.05, 0))
      const offset = grip.clone().sub(tipped.grip)
      return {
        grip,
        hands: sided(side => tipped.hands[side].clone().add(offset)),
        tip: mix(tipped.tip, up.tip, share).add(point(0, 0.05, 0)),
      }
    })()
    const nearlyUp: SloperatorGoals = {
      ...up,
      ...caneOnTheWay,
      elbows: sided(side => mix(seated.elbows[side], up.elbows[side], share)),
      knees: forward,
      lean: -0.08,
      pelvis: up.pelvis.clone().add(point(0, -0.02, 0)),
    }
    return [
      {
        at: 0,
        goals: seated,
      },
      {
        at: 0.15,
        goals: {
          ...halfway,
          ankles: sided(side => mix(seated.ankles[side], up.ankles[side], 0.5).add(point(0, stepHeight, 0))),
        },
      },
      {
        at: 0.3,
        goals: liftOff,
      },
      {
        at: 0.6,
        goals: rising,
      },
      {
        at: 0.85,
        goals: nearlyUp,
      },
      {
        at: 1,
        goals: up,
      },
    ]
  }
  /** how long the move takes, in seconds */
  readonly duration: number
  private readonly keys: ReadonlyArray<Key>

  /** every number of the goals of each keyframe, flattened */
  private readonly rows: ReadonlyArray<ReadonlyArray<number>>

  /** how fast each of those numbers changes at each keyframe, per share of the move */
  private readonly slopes: ReadonlyArray<ReadonlyArray<number>>

  /** Poses the rig in his neutral pose on the `seat`, or standing without one, and works out his move from there. */
  constructor(private readonly rig: SloperatorRig, seat?: SloperatorSeat) {
    this.keys = seat ? SloperatorMotion.standUp(rig, seat) : SloperatorMotion.armsBack(rig)
    this.duration = seat ? standUpTime : armsBackTime
    const rows = this.keys.map(({goals}) => flatten(goals))
    const times = this.keys.map(({at}) => at)
    const columns = rows[0].map((_ignored, index) => slopes(times, rows.map(row => row[index])))
    this.rows = rows
    this.slopes = rows.map((_ignored, key) => columns.map(column => column[key]))
    this.pose(0)
  }

  /** Poses his rig `progress` of the way through the move, from 0 in his neutral pose to 1 in his sight pose. */
  pose(progress: number) {
    const {keys, rows, slopes: rates} = this
    const time = clamp(progress, 0, 1)
    // the keyframe the moment follows, short of the last one
    const key = Math.min(keys.findLastIndex(({at}) => at <= time), keys.length - 2)
    const span = keys[key + 1].at - keys[key].at
    const t = (time - keys[key].at) / span
    // Cubic Hermite between the two keyframes
    const [h00, h10, h01, h11] = [2 * t ** 3 - 3 * t ** 2 + 1, t ** 3 - 2 * t ** 2 + t, -2 * t ** 3 + 3 * t ** 2, t ** 3 - t ** 2]
    this.rig.follow(unflatten(rows[key].map((value, index) => h00 * value + h10 * span * rates[key][index] + h01 * rows[key + 1][index] + h11 * span * rates[key + 1][index])))
  }
}
