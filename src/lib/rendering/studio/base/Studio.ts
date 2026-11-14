import type {Light, NodeFrame, Object3D} from 'three/webgpu'

import {WebgpuRenderer} from 'three-fiber-game'
import {ACESFilmicToneMapping, AmbientLight, DirectionalLight, Group, HemisphereLight, Scene} from 'three/webgpu'

type DetachedRenderer = WebgpuRenderer & {
  _animation: {stop: () => void}
  _nodes: {nodeFrame: NodeFrame}
}

const animationKey = '_animation' as const
const nodesKey = '_nodes' as const

/** The lights of the Knot billboards: soft light from all round and a warm key from high behind, which rims whatever stands in it. */
export function billboardLights(): Array<Light> {
  const key = new DirectionalLight('#fff0d7', 2.3)
  key.position.set(-3, 9, -16)
  return [new AmbientLight('#ffffff', 0.45), new HemisphereLight('#e1edff', '#80705d', 1.3), key]
}

/**
 * A neutral studio apart from the world: a detached WebGPU renderer of its own with a scene of nothing but its lights and a stage, which shows objects of the world on a transparent backdrop, tone mapped like the world.
 *
 * What stands on the stage shares its geometries and materials with the world. three keeps caches per renderer for them, so the gallery’s pipelines, its warmup and its streaming stay untouched, whatever the studio builds.
 * A studio draws only when it is asked to and does one thing at a time, see {@link queue}.
 */
export default abstract class Studio {
  /** what the GPU’s device reported, for whoever draws to clear before and to read after */
  protected readonly errors: Array<string> = []
  protected readonly renderer = new WebgpuRenderer({
    antialias: true,
    alpha: true,
  })
  protected readonly scene = new Scene
  /** what the studio shows, in the middle of its lights */
  protected readonly stage = new Group
  private disposal?: Promise<void>
  private initialization?: Promise<void>
  private released = false
  /** settles once everything queued so far has finished */
  private tail: Promise<void> = Promise.resolve()

  /**
   * @param lights what lights the stage, lights or whatever holds them, the Knot billboards’ lights by default
   */
  constructor(lights: ReadonlyArray<Object3D> = billboardLights()) {
    this.renderer.toneMapping = ACESFilmicToneMapping
    this.renderer.setClearColor(0, 0)
    this.scene.add(...lights, this.stage)
  }

  protected get device() {
    return (this.renderer.backend as typeof this.renderer.backend & {device: GPUDevice}).device
  }

  /** whether the studio has been disposed and takes no more work */
  get disposed() {
    return this.released
  }

  /** the clock of the studio’s shaders */
  protected get nodeFrame() {
    return (this.renderer as DetachedRenderer)[nodesKey].nodeFrame
  }

  /** Releases the studio’s GPU device once whatever it is doing has finished. It takes no more work from now on. */
  dispose() {
    if (!this.disposal) {
      this.released = true
      this.disposal = this.release()
    }
  }

  /** Like {@link dispose}, resolving once everything is released. */
  async disposeAsync() {
    this.dispose()
    await this.disposal
  }

  /** Requests the GPU device on the first call. three’s own animation loop stops, as a studio draws only when it is asked to. */
  protected async init() {
    this.initialization ??= (async () => {
      await this.renderer.init()
      ;(this.renderer as DetachedRenderer)[animationKey].stop()
      this.device.addEventListener('uncapturederror', event => this.errors.push(event.error.message))
    })()
    return this.initialization
  }

  /** Runs the job once every job queued before it has finished, as a studio has one renderer, one scene and one stage. */
  protected async queue<Result>(job: () => Promise<Result>): Promise<Result> {
    const previous = this.tail
    const gate = Promise.withResolvers<void>()
    this.tail = gate.promise
    await previous
    try {
      return await job()
    } finally {
      gate.resolve()
    }
  }

  /** Frees what the studio made of its own, before its renderer goes and after whatever it was doing has finished. */
  protected abstract releaseResources(): void

  /** Sets the time the studio’s shaders read for the next frame, in seconds. */
  protected setTime(seconds: number) {
    const {nodeFrame} = this
    nodeFrame.frameId++
    nodeFrame.time = seconds
    nodeFrame.deltaTime = 1 / 60
  }

  private async release() {
    try {
      await this.tail
      this.releaseResources()
      await this.renderer.dispose()
    } catch (error) {
      console.error('Studio disposal failed.', error)
    }
  }
}
