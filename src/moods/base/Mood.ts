import type {SoundTransformer} from '#src/lib/audio/transformers/TransformerChain.ts'
import type {AmbienceLoop} from 'ambience-emitter'

/** what a kind of light is multiplied by while a mood holds: a color, whose channels pass that share of the light, and a gain on top */
export type MoodLight = {
  color: string
  gain: number
}

/** a gradient map in display space: the frame’s luminance picks a color from `shadow` over `midtone` to `highlight`, which replaces `strength` of the frame’s own color */
export type MoodGrade = {
  highlight: string
  midtone: string
  shadow: string
  strength: number
}

/** seconds a mood takes to come over the world and to leave it again */
export type MoodFade = {
  in: number
  out: number
}

/** a loop a mood sounds, which takes no options */
export type MoodAmbience = new () => AmbienceLoop

/**
 * A spell over the whole world while something casts it, like a held prop that carries it, a fusion in progress or the room the listener is in, made of whatever it contributes, all fading in and out together: color filters (a gradient map over the finished frame and tints of the lights), an ambience (a loop sounding centered), a sound transformer (which every sound of the world passes through) and a wider or narrower view.
 * Moods stack: several may show at once, like a room’s and that of the orb held in it, the filters of each over those of the moods beneath, the transformers one after the other, their changes of the view added up.
 * Colors are sRGB hex.
 */
export default abstract class Mood {
  /** the loop that sounds while the mood holds, made anew each time it begins */
  readonly ambience?: MoodAmbience
  /** how fast the mood comes and goes, if not at the mixer’s usual pace */
  readonly fade?: MoodFade
  /** ambient, hemisphere and directional lights: the fill and the sun */
  readonly fill?: MoodLight
  /** how many degrees wider the player’s own view gets while the mood holds, of its vertical field of view, or narrower where negative; see `MoodLens` */
  readonly fov?: number
  readonly grade?: MoodGrade
  abstract readonly id: string
  /** point and spot lights: the rooms’ lamps */
  readonly lamps?: MoodLight
  abstract readonly title: string
  /** what every sound of the world passes through while the mood holds, like the ringing of a room’s walls, taking as much of it as the mood shows */
  readonly transformer?: SoundTransformer
}
