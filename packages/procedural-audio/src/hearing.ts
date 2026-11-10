/** a point in the listener’s space, in meters */
export type Position = readonly [x: number, y: number, z: number]
/** how far a sound carries: at full level within `near` meters, fading linearly to silence at `far` */
export type Hearing = {
  far: number
  near: number
}
/** a sound’s way from where it is to the listener: every sound of it goes into the panner and comes out of the absorption */
export type HearingPath = {
  /** the lowpass the air takes the highs through */
  absorption: BiquadFilterNode
  panner: PannerNode
}

/** the cutoff of the lowpass a sound is heard through right next to it, which leaves it whole */
export const openCutoff = 18_000
/** the cutoff of the lowpass a sound is heard through at the edge of its hearing, a muffled wash */
const farCutoff = 2200
const clamp = (value: number) => Math.min(Math.max(value, 0), 1)

/** How far, 0–1, the listener at `listener` is on a sound’s way from `near` to `far` round `position`: 0 within `near`, 1 from `far` on. */
export function hearingShare(position: Position, listener: Position, {far, near}: Hearing) {
  const distance = Math.hypot(listener[0] - position[0], listener[1] - position[1], listener[2] - position[2])
  return clamp((distance - near) / (far - near))
}

/** The lowpass cutoff in Hz a sound is heard through at `share` (0–1) of its way from `near` to `far`, see {@link hearingShare}: distance takes the highs before the level, open nearby and closing toward a muffled 2.2 kHz at the edge of hearing, quickly at first. */
export function absorptionCutoff(share: number) {
  return openCutoff * (farCutoff / openCutoff) ** clamp(share) ** 0.7
}

/** Where the listener of the context stands. */
export function listenerPosition({listener}: BaseAudioContext): Position {
  return [listener.positionX.value, listener.positionY.value, listener.positionZ.value]
}

/**
 * The way of a sound at `position` to the context’s listener: an HRTF panner, at full level within `hearing.near` and fading linearly to silence at `hearing.far`, into a lowpass that takes the highs the air would, at `cutoff` hertz, by default what the listener’s distance right now makes of it.
 * The two are connected to each other, but not to any output.
 */
export function hearingPath(context: BaseAudioContext, position: Position, hearing: Hearing, cutoff = absorptionCutoff(hearingShare(position, listenerPosition(context), hearing))): HearingPath {
  const [x, y, z] = position
  const panner = new PannerNode(context, {
    panningModel: 'HRTF',
    distanceModel: 'linear',
    refDistance: hearing.near,
    maxDistance: hearing.far,
    rolloffFactor: 1,
    positionX: x,
    positionY: y,
    positionZ: z,
  })
  const absorption = new BiquadFilterNode(context, {
    type: 'lowpass',
    frequency: cutoff,
    Q: 0.5,
  })
  panner.connect(absorption)
  return {
    panner,
    absorption,
  }
}
