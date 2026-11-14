import type {OrbitSettings} from '../../camera/OrbitInspection.ts'
import type {StudioSubjectSize} from './studioFraming.ts'
import type {Object3D} from 'three/webgpu'

import {AmbientLight, DirectionalLight, Group, HemisphereLight, PerspectiveCamera, Quaternion, Vector3} from 'three/webgpu'

import OrbitInspection from '../../camera/OrbitInspection.ts'
import worldClock from '../../worldClock.ts'
import Studio from './base/Studio.ts'
import {boxClearance, clearance, fitDistance, studioFov, subjectRadius} from './studioFraming.ts'

/** how far the camera may still move or turn in a frame, in meters and radians, to count as at rest */
const rest = 1e-5
/** how close the camera gets, as a share of the distance the object fits the view from in front, unless the box around the object keeps it farther out */
const closest = 0.35
const origin = new Vector3
const front = new Vector3(0, 0, 1)
const position = new Vector3
const rotation = new Quaternion
/** a lamp of the view’s rig: where it shines from as the viewer sees it, x to the right, y up and z toward the viewer, with its color and intensity */
type Lamp = readonly [color: string, intensity: number, x: number, y: number, z: number]

/**
 * The lamps of a showroom as the viewer sees them, to be turned along with the camera, which looks down −z, so turning the camera around an object lights it like turning the object in one’s hands under fixed lamps: whichever side comes into view is lit.
 *
 * Something black and glossy, like a frame of blackened steel, only shows where it mirrors a lamp, and each of these is a point in its mirror image, so the lamps spread over the directions its faces mirror as it turns instead of leaving all the light to a few strong ones. They stay weak wherever they would flatten the relief of something pale.
 */
const lamps: ReadonlyArray<Lamp> = [
  // The key, warm, from the upper left: it rakes across whatever faces the viewer, so its relief throws shadows.
  ['#fff0d7', 2.3, -8, 6, 3],
  // Three faint lamps around the camera, for a sheen on what faces the viewer: far enough off the view’s axis that a pane of glass facing the viewer mirrors them outside of itself.
  ['#ffffff', 0.4, -4, 3.5, 8],
  ['#ffffff', 0.4, 4, 3.5, 8],
  ['#ffffff', 0.3, 0, -4, 8],
  // From the sides, cool from the right and low from the left, for faces turned a little away, where the key has no counterpart.
  ['#e6eeff', 0.9, 8, 0, 3.5],
  ['#fff4e4', 0.6, -8, -2, 3.5],
  // Kickers from behind, left, right and above: they graze the sides coming into view and draw the edges of something dark out of a dark backdrop.
  ['#fff4e4', 1.3, -8, 1, -3],
  ['#e6eeff', 1.4, 8, 3, -3],
  ['#ffffff', 1, 0, 8, -4],
]
/** The lamps as a group to turn along with the camera. */
function viewerLights() {
  const rig = new Group
  rig.name = 'studio-view-lights'
  for (const [color, intensity, x, y, z] of lamps) {
    const light = new DirectionalLight(color, intensity)
    light.position.set(x, y, z)
    rig.add(light)
  }
  return rig
}

/**
 * A studio the player looks into: it shows one object at a time on a canvas of its own, transparent around the object, and orbits the camera around it like holding V does in the world, by {@link turn}, {@link zoom} and {@link reset}, all the way round and never into it.
 *
 * Put its {@link canvas} into the page, tell it its size with {@link resize} and let it draw with {@link start}. It only draws a frame when the view changed, and every frame while the world’s clock runs, which the time of its shaders follows: animated materials stand still under the Escape key’s pause menu, like in the world.
 */
export default class StudioView extends Studio {
  /** what the studio draws on, for the page to lay out; its drawing buffer follows {@link resize} */
  readonly canvas: HTMLCanvasElement
  private readonly camera = new PerspectiveCamera(studioFov, 1, 0.05, 100)
  /** whether pipelines are compiling, which nothing is drawn during */
  private compiling = false
  /** Moves the camera on and draws a frame, then asks for the next one while there is anything left to move. */
  private readonly draw = (time: number) => {
    this.frame = undefined
    if (!this.canRender) {
      return
    }
    const delta = this.drawnAt === undefined ? 1 / 60 : (time - this.drawnAt) / 1000
    position.copy(this.camera.position)
    rotation.copy(this.camera.quaternion)
    this.orbit?.update(origin, delta)
    const moving = position.distanceTo(this.camera.position) > rest || rotation.angleTo(this.camera.quaternion) > rest
    this.render()
    if (moving || !worldClock.frozen) {
      this.drawnAt = time
      this.requestFrame()
    } else {
      this.drawnAt = undefined
    }
  }
  /** whether it draws, see {@link start} */
  private drawing = false
  /** when the last frame of a run of frames was drawn, by the browser’s frame clock */
  private drawnAt: number | undefined
  /** the frame asked for */
  private frame: number | undefined
  /** the lamps that turn along with the camera */
  private readonly lights: Group
  private orbit: OrbitInspection | undefined
  /** how the camera orbits the object on the stage, its distances following the canvas’s shape */
  private orbiting: OrbitSettings = {radius: 1}
  /** whether the GPU device is there */
  private ready = false
  /** the box around the object on the stage */
  private size: StudioSubjectSize | undefined
  /** what was last asked to be shown, on the stage or on its way there */
  private subject: Object3D | undefined
  private unfollowClock: (() => void) | undefined

  constructor() {
    const lights = viewerLights()
    // Soft light from all round, the sky’s from above whichever way the viewer looks.
    super([new AmbientLight('#ffffff', 0.12), new HemisphereLight('#e1edff', '#80705d', 0.4), lights])
    this.lights = lights
    this.canvas = this.renderer.domElement
  }

  /** whether a frame can be drawn right now */
  private get canRender() {
    return this.drawing && this.ready && !this.compiling && !this.disposed
  }

  /** Takes the object off the stage, or keeps it from getting there if it is still on its way, which leaves the canvas empty. Does nothing for an object that something else took the place of. */
  hide(object: Object3D) {
    if (this.subject !== object) {
      return
    }
    this.subject = undefined
    if (this.stage.children.includes(object)) {
      this.stage.remove(object)
      this.orbit = undefined
      this.requestFrame()
    }
  }

  protected override releaseResources() {
    this.stop()
    this.stage.clear()
    this.subject = undefined
    this.orbit = undefined
  }

  /** Lets the camera ease back to where it started, straight in front of the object. */
  reset() {
    if (this.orbit) {
      this.orbit = this.createOrbit()
      this.requestFrame()
    }
  }

  /** Fits the drawing buffer to the canvas’s size in device pixels. */
  resize(width: number, height: number) {
    if (!(width > 0 && height > 0) || this.disposed) {
      return
    }
    this.renderer.setSize(Math.round(width), Math.round(height), false)
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
    // Right where the object fits the new shape, and drawn at once: the resized canvas is blank, and the browser paints before the next frame is due.
    this.fitOrbit()
    this.orbit?.settle(origin)
    if (this.canRender) {
      this.render()
    }
    this.requestFrame()
  }

  /**
   * Puts the object on the stage in place of whatever is there, seen from straight in front of it (its +z), which fills most of the canvas, and resolves with whether it got there: its pipelines compile first, without stalling the page, and whatever was asked to be shown or hidden meanwhile takes its place.
   * The object is shown as it is, so its middle belongs at its origin. Rejects if the GPU has no device for the studio or reported an error.
   * @param size the box around the object’s origin that holds all of it
   */
  async show(object: Object3D, size: StudioSubjectSize) {
    if (this.disposed) {
      throw new Error('The studio view has been disposed.')
    }
    this.subject = object
    return this.queue(async () => {
      if (this.subject !== object) {
        return false
      }
      await this.init()
      this.ready = true
      this.stage.clear()
      this.stage.add(object)
      const radius = subjectRadius(size)
      this.size = size
      this.orbiting = {
        radius,
        facing: [0, 0, 1],
        fov: studioFov,
        keepOut: boxClearance(size),
        // From every side as far away as all of the object takes to fit the canvas, so turning it never moves any of it out of view.
        distanceToward: direction => fitDistance(size, direction, this.camera.aspect),
      }
      this.fitOrbit()
      // Nearer than the camera gets to the box around the object.
      this.camera.near = radius * clearance / 2
      this.camera.far = radius * 40
      this.orbit = this.createOrbit()
      // What the camera doesn’t see wouldn’t compile.
      this.orbit.settle(origin)
      this.errors.length = 0
      this.compiling = true
      try {
        await this.renderer.compileAsync(this.scene, this.camera)
        await this.device.queue.onSubmittedWorkDone()
      } finally {
        this.compiling = false
      }
      const shown = this.subject === object
      if (!shown || this.errors.length) {
        this.stage.remove(object)
      }
      // At once, so whoever waited for it finds it on the canvas.
      if (this.canRender) {
        this.render()
      }
      this.requestFrame()
      if (this.errors.length) {
        throw new Error(`${object.name || 'The object'}: ${this.errors.splice(0).join('\n')}`)
      }
      return shown
    })
  }

  /** Draws from now on, whenever the view changes and while the world’s clock runs. */
  start() {
    if (this.drawing || this.disposed) {
      return
    }
    this.drawing = true
    // An animated material goes on with the world.
    this.unfollowClock = worldClock.subscribe(() => this.requestFrame())
    this.requestFrame()
  }

  /** Stops drawing, like while its canvas is out of the page. */
  stop() {
    this.drawing = false
    this.unfollowClock?.()
    this.unfollowClock = undefined
    if (this.frame !== undefined) {
      cancelAnimationFrame(this.frame)
      this.frame = undefined
    }
    this.drawnAt = undefined
  }

  /** Turns the camera around the object, in radians: `yaw` to the right, `pitch` upward. */
  turn(yaw: number, pitch: number) {
    this.orbit?.addInput(yaw, pitch)
    this.requestFrame()
  }

  /** Moves the camera away from the object, by a share of the distance all of the object fits the canvas from, or toward it if negative; it gets as far as 1.75 times that distance and as close as about a third of it, but never into the box around the object. */
  zoom(amount: number) {
    this.orbit?.adjustDistance(amount)
    this.requestFrame()
  }

  /** An orbit that heads for the front of the object from wherever the camera is. */
  private createOrbit() {
    return new OrbitInspection(this.camera, origin, this.orbiting)
  }

  /** Sets how close the camera gets by the canvas’s shape, which the orbit reads anew as it moves the camera. */
  private fitOrbit() {
    if (this.size) {
      this.orbiting.minDistance = fitDistance(this.size, front, this.camera.aspect) * closest
    }
  }

  /** Draws the stage as the camera sees it right now. */
  private render() {
    if (this.errors.length) {
      console.warn('The studio view’s GPU device reported errors.', ...this.errors.splice(0))
    }
    this.lights.quaternion.copy(this.camera.quaternion)
    this.nodeFrame.update()
    this.renderer.render(this.scene, this.camera)
  }

  private requestFrame() {
    if (this.drawing && !this.compiling) {
      this.frame ??= requestAnimationFrame(this.draw)
    }
  }
}
