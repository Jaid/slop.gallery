import type AmbienceLoop from '../audio/ambience/base/AmbienceLoop.ts'
import type {AudioOutput} from '../audio/proceduralAudio.ts'
import type TransformerChain from '../audio/transformers/TransformerChain.ts'
import type Mood from './base/Mood.ts'
import type {MoodFade, MoodLight} from './base/Mood.ts'
import type {Light} from 'three/webgpu'

import {clamp} from 'math'
import {Color} from 'three/webgpu'

import {noTint} from '../rendering/lightLevels.ts'
import {paintMoodGrades} from '../rendering/moodGrade.ts'

/** where moods sound: their loops on the effects master, centered, and their transformers between the world and it, as `SoundEngine` offers both */
export type MoodOutput = AudioOutput & {
  readonly transformers: TransformerChain
}
export type MoodMixerOptions = {
  /** whether moods come and go at their pace; without, each shows in full or not at all from one frame to the next, its loop and its transformer cut in and out along, as `?fade=false` asks for */
  fade?: boolean
}
/** the moods the world asks for */
export type MoodTarget = {
  /** the mood cast over the world, like that of a held prop or a fusion in progress, which shows over the room’s */
  cast: Mood | null
  /** the moods of the room the listener is in */
  room: ReadonlyArray<Mood>
}
/** a mood while it shows, also while it fades in or out */
type Showing = {
  ambience?: AmbienceLoop
  /** the level the loop was last set to */
  level: number
  mood: Mood
  progress: number
  /** where the mood’s transformer takes its share of the world’s sound, once it does */
  transformers?: TransformerChain
}

/** seconds a mood takes to come over the world, slowly, and to leave it again, quickly, once its prop is thrown or dropped, unless the mood has a pace of its own */
export const moodFade: MoodFade = {
  in: 4,
  out: 0.25,
}
/** the world asking for no mood at all */
export const noMood: MoodTarget = {
  cast: null,
  room: [],
}

type Lamp = Light & {
  isPointLight?: boolean
  isSpotLight?: boolean
}

/** Whether a light is one of the rooms’ lamps, rather than fill or daylight, which comes through windows even as a point light. */
const isLamp = (light: Light) => {
  const lamp = light as Lamp
  return Boolean(lamp.isPointLight || lamp.isSpotLight) && !lamp.userData.daylight
}
/** how strongly a mood shows at `progress` (0–1) of its fade, eased in and out */
const ease = (progress: number) => progress * progress * (3 - 2 * progress)

/**
 * Blends the moods the world asks for over it, stacked: those of the listener’s room beneath the one cast over the world. Each fades in while it is asked for and out otherwise, at its own pace, while the others hold on.
 * The moods cast over the world take turns: only once the one showing is gone does the next one fade in, so two of them never mix. The moods of two rooms cross over as the listener walks from one into the other.
 * It paints the render pipeline’s gradient maps, keeps the tints of the lamps and of the fill, sounds the moods’ loops and lets their transformers take the world’s sound, each mood’s at its own eased strength.
 * Without `fade`, every mood shows in full while it is asked for and not at all otherwise, the next mood cast replacing the last one within the same frame.
 */
export default class MoodMixer {
  /** what the fill and daylight are multiplied by now */
  readonly fillTint = new Color(1, 1, 1)
  /** what the lamps are multiplied by now */
  readonly lampTint = new Color(1, 1, 1)
  /** the mood cast over the world that shows, also while it fades out, which the next one cast waits for */
  private cast: Mood | null = null
  private readonly fading: boolean
  private readonly showing = new Map<Mood, Showing>

  constructor({fade = true}: MoodMixerOptions = {}) {
    this.fading = fade
  }

  /** the moods showing, also while they fade in or out, from the bottom of the stack to its top */
  get moods(): ReadonlyArray<Mood> {
    return this.stack().map(showing => showing.mood)
  }

  /** How strongly `mood` shows, 0–1, eased in and out; 0 while it doesn’t. */
  amountOf(mood: Mood) {
    const showing = this.showing.get(mood)
    return showing ? ease(showing.progress) : 0
  }

  /** Lets every mood go at once, with its loop and its transformer, without waiting for its fade. */
  cut() {
    if (!this.showing.size) {
      return
    }
    for (const showing of this.showing.values()) {
      this.release(showing, this.smoothing(0.3))
    }
    this.paint()
  }

  dispose() {
    this.cut()
  }

  /** Shows the moods of `target` in full at once, without waiting for any fade, sounding them on `output` once there is one, and lets every other mood go at once. */
  snap(target: MoodTarget, output?: MoodOutput) {
    this.cast = target.cast
    const wanted = this.wanted(target)
    for (const showing of this.showing.values()) {
      if (!wanted.has(showing.mood)) {
        this.release(showing, this.smoothing(0.3))
      }
    }
    for (const mood of wanted) {
      this.show(mood).progress = 1
    }
    this.update(target, 0, output)
  }

  /** What a light is multiplied by now: the lamps’ tint or the fill’s, or nothing for a light with `userData.untinted`, which keeps its own color through every mood, like a fusion portal’s glow. */
  tintOf(light: Light) {
    if (light.userData.untinted) {
      return noTint
    }
    return isLamp(light) ? this.lampTint : this.fillTint
  }

  /** Moves every mood `delta` seconds toward `target`, each at its own pace, sounding them on `output` once there is one. */
  update(target: MoodTarget, delta: number, output?: MoodOutput) {
    // The next mood cast takes over once the last one is gone, or right away if the room holds on to that one anyway or nothing fades.
    if (target.cast !== this.cast && (!this.fading || !this.cast || !this.showing.has(this.cast) || target.room.includes(this.cast))) {
      this.cast = target.cast
    }
    const wanted = this.wanted(target)
    for (const mood of wanted) {
      this.show(mood)
    }
    for (const showing of this.showing.values()) {
      const rising = wanted.has(showing.mood)
      if (this.fading) {
        const fade = showing.mood.fade ?? moodFade
        showing.progress = clamp(showing.progress + delta / (rising ? fade.in : -fade.out), 0, 1)
      } else {
        showing.progress = rising ? 1 : 0
      }
      if (!rising && showing.progress === 0) {
        this.release(showing, this.smoothing())
        continue
      }
      if (output) {
        this.sound(showing, output)
      }
    }
    this.paint()
  }

  private paint() {
    const stack = this.stack()
    paintMoodGrades(stack.filter(({mood}) => mood.grade).map(({mood, progress}) => ({
      grade: mood.grade!,
      amount: ease(progress),
    })))
    this.lampTint.setRGB(1, 1, 1)
    this.fillTint.setRGB(1, 1, 1)
    for (const {mood, progress} of stack) {
      tint(this.lampTint, mood.lamps, ease(progress))
      tint(this.fillTint, mood.fill, ease(progress))
    }
  }

  /** Forgets a mood, which has faded out, stops its loop, which has gone silent with it, and lets its transformer ring out. */
  private release(showing: Showing, fade?: number) {
    const {mood} = showing
    showing.ambience?.stop(fade)
    if (mood.transformer) {
      showing.transformers?.transform(mood, mood.transformer, 0, this.smoothing())
    }
    this.showing.delete(mood)
    if (mood === this.cast) {
      this.cast = null
    }
  }

  /** The mood’s state of showing, a new one at nothing for a mood that doesn’t show yet. */
  private show(mood: Mood) {
    let showing = this.showing.get(mood)
    if (!showing) {
      showing = {
        level: 0,
        mood,
        progress: 0,
      }
      this.showing.set(mood, showing)
    }
    return showing
  }

  /** The time constant in seconds an audio change follows with: `seconds`, or the callee’s own default where left out, while moods fade, and 0, at once, otherwise. */
  private smoothing(seconds?: number) {
    return this.fading ? seconds : 0
  }

  /** Sounds a mood showing on `output` as strongly as it shows: its loop, started the first time, and its transformer. */
  private sound(showing: Showing, output: MoodOutput) {
    const {mood} = showing
    const amount = ease(showing.progress)
    const {ambience: Ambience} = mood
    if (Ambience && !showing.ambience) {
      showing.ambience = new Ambience
      showing.ambience.setLevel(0)
      showing.ambience.start(output, this.smoothing())
    }
    if (showing.ambience && amount !== showing.level) {
      showing.level = amount
      showing.ambience.setLevel(amount, this.smoothing(0.05))
    }
    if (mood.transformer) {
      showing.transformers = output.transformers
      output.transformers.transform(mood, mood.transformer, amount, this.smoothing())
    }
  }

  /** the moods showing from the bottom of the stack to its top: the rooms’ in the order they came, the one cast over the world on top */
  private stack() {
    const {cast} = this
    return this.showing.values().toArray().toSorted((a, b) => Number(a.mood === cast) - Number(b.mood === cast))
  }

  /** The moods `target` asks for that may show: the room’s and the one cast, unless it still waits for the last one to go. */
  private wanted(target: MoodTarget) {
    const wanted = new Set(target.room)
    if (target.cast && target.cast === this.cast) {
      wanted.add(target.cast)
    }
    return wanted
  }
}

const full = new Color
const blend = new Color
/** Multiplies `target` by white blended toward the light’s full tint by `amount`. */
function tint(target: Color, light: MoodLight | undefined, amount: number) {
  if (light) {
    target.multiply(blend.setRGB(1, 1, 1).lerp(full.set(light.color).multiplyScalar(light.gain), amount))
  }
}
