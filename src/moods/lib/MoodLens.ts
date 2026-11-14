import type {Camera} from 'three/webgpu'

import {clamp} from 'math'
import {PerspectiveCamera} from 'three/webgpu'

export type MoodLensView = {
  /** seconds since the last frame, which the share of the widening eases over */
  delta: number
  /** whether the camera shows exactly what something else set it to, like a capture that posed it, so none of the widening applies, at once */
  exact?: boolean
  /** whether the share of the widening eases as the camera is taken from the player and handed back; without, it cuts, as `?fade=false` asks for */
  fading?: boolean
  /** whether the camera is the player’s own view rather than one taken from them, like V-viewing’s, the intro’s or a bookmark’s, which keep their own field of view */
  own: boolean
  /** whether the frame shows the same moment as the one before, like a frame of a frozen world, so the share of the widening stays where its easing stands instead of cutting for want of a `delta` */
  still?: boolean
  /** how far the player has zoomed in, 0–1, which gives the widening up along the way */
  zoom?: number
}

/** how fast the share of the widening follows the camera being taken from the player and handed back, per second, like V-viewing eases its own field of view */
const pace = 10
/** the narrowest and widest a lens leaves a view, in degrees */
const limits = [1, 179] as const

/**
 * Widens the player’s view by what the moods showing ask for, their `fov`, only while it is drawn: {@link widen} right before a frame, {@link restore} right after, or {@link during} a render of its own, like a capture’s.
 * In between, the camera keeps the field of view everything else set and reads back, like the player’s zoom, V-viewing and the tuning panel, which each remember the one they found to return to it, so the lens never ends up in what they remember.
 * Only the player’s own view widens: zooming in gives the widening up along the way, and a camera taken from the player eases out of it, or drops it at once where it must show exactly what it was set to.
 */
export default class MoodLens {
  /** how many degrees it widens a view by now, narrower where negative, as {@link update} last worked it out */
  widening = 0
  private camera: PerspectiveCamera | undefined
  /** the field of view the camera had before the lens widened it */
  private own = 0
  /** how much of what the moods ask for applies, 0–1 */
  private share = 1

  /** Widens the camera only while `render` runs, for a render outside the frames’ own, like a capture’s. */
  during(camera: Camera, render: () => void) {
    this.widen(camera)
    try {
      render()
    } finally {
      this.restore()
    }
  }

  /** Stops widening anything and forgets how far the camera was taken from the player. */
  reset() {
    this.restore()
    this.widening = 0
    this.share = 1
  }

  /** Gives the camera back the field of view it had before {@link widen}, to the bit. */
  restore() {
    if (!this.camera) {
      return
    }
    this.camera.fov = this.own
    this.camera.updateProjectionMatrix()
    this.camera = undefined
  }

  /** Works out how far views widen from now on: by `degrees`, as far as `view` lets them. */
  update(degrees: number, {delta, exact = false, fading = true, own, still = false, zoom = 0}: MoodLensView) {
    const target = own && !exact ? 1 : 0
    if (exact || !fading || !still && !(delta > 0)) {
      this.share = target
    } else if (!still) {
      this.share += (target - this.share) * (1 - Math.exp(-Math.min(delta, 0.06) * pace))
      if (Math.abs(target - this.share) < 0.001) {
        this.share = target
      }
    }
    this.widening = degrees * this.share * (1 - clamp(zoom, 0, 1))
  }

  /** Widens the camera by {@link widening} until {@link restore}. */
  widen(camera: Camera) {
    this.restore()
    if (!this.widening || !(camera instanceof PerspectiveCamera)) {
      return
    }
    this.camera = camera
    this.own = camera.fov
    camera.fov = clamp(camera.fov + this.widening, ...limits)
    camera.updateProjectionMatrix()
  }
}

/** the lens every render of the page’s view looks through: the frames’ and the captures’ */
export const moodLens = new MoodLens
