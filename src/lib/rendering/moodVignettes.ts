import type {default as Mood, MoodVignette} from '#src/moods/base/Mood.ts'
import type {ShownVignette} from '#src/moods/lib/MoodMixer.ts'
import type {Node} from 'three/webgpu'

import {Fn, int, Loop, mix, Switch, uniform, uniformArray, vec4} from 'three/tsl'
import {Vector4} from 'three/webgpu'

import {moods} from '#src/moods/index.ts'

/** Composites registered vignette shaders in the mixer’s order without rebuilding the render graph when moods change. */
export class MoodVignettes {
  private readonly count = uniform(0, 'int')
  private readonly indices: ReadonlyMap<MoodVignette, number>
  /** shader index, opacity and reveal, in draw order */
  private readonly layers: Array<Vector4>
  private readonly shaders: ReadonlyArray<MoodVignette>

  constructor(shaders: Iterable<MoodVignette>) {
    const registered = [...shaders]
    this.shaders = [...new Set(registered)]
    this.indices = new Map(this.shaders.map((shader, index) => [shader, index]))
    this.layers = registered.map(() => new Vector4)
  }

  get active() {
    return this.count.value > 0
  }

  /** Lays the active overlays over the display-space frame, leaving its alpha alone. With none active, the shaders aren’t evaluated. */
  compose(frame: Node<'vec4'>): Node<'vec4'> {
    if (!this.shaders.length) {
      return frame
    }
    const layers = uniformArray<'vec4'>(this.layers, 'vec4')
    return Fn(() => {
      const source = frame.toVar()
      const painted = source.rgb.toVar()
      Loop(this.count, ({i}) => {
        const layer = layers.element(i).toVar()
        const pick = Switch(int(layer.x))
        for (const [index, shader] of this.shaders.entries()) {
          pick.Case(int(index), () => {
            const ink = shader(layer.z).toVar()
            painted.assign(mix(painted, ink.rgb, ink.a.mul(layer.y)))
          })
        }
      })
      return vec4(painted, source.a)
    })()
  }

  show(vignettes: ReadonlyArray<ShownVignette>) {
    let count = 0
    for (const {amount, reveal, vignette} of vignettes) {
      const index = this.indices.get(vignette)
      if (amount > 0 && index !== undefined && count < this.layers.length) {
        this.layers[count++].set(index, amount, reveal, 0)
      }
    }
    this.count.value = count
  }
}

export const moodVignettes = new MoodVignettes(Object.values<Mood>(moods).flatMap(mood => mood.vignette ?? []))
