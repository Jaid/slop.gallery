import type {Projection} from './GalleryDrawingPipeline.ts'
import type {Drawable} from './worldBounds.ts'
import type {WebgpuRendererOptions} from 'three-fiber-game'
import type {Camera, Material, Scene} from 'three/webgpu'

import {WebgpuRenderer} from 'three-fiber-game'
import {Object3D, Vector3} from 'three/webgpu'

import {isDevelopmentMode} from '#src/lib/developmentMode.ts'
import {startLoading, trackLoadingItems} from '#src/lib/loadingItems.ts'
import {BatchedLighting} from '#src/lib/materials/lights/base/BatchedLightsNode.ts'
import {perceptualDistance, perceptualDistanceToBox} from '#src/lib/perceptualDistance.ts'
import {telemetry} from '#src/lib/telemetry/index.ts'

import GalleryDrawingPipeline from './GalleryDrawingPipeline.ts'
import {cinematicMaxTextureSize, readCinematicGraphics} from './graphicsMode.ts'
import {readStreamBudget} from './streamBudget.ts'
import worldBounds from './worldBounds.ts'

type Culler = (camera: Camera) => void
type RenderObject = {
  camera: Camera
  material: {
    name: string
    type: string
  }
  object: Object3D
  scene: Object3D
}
type PromiseSink = {push: (promise: Promise<void>) => void}
/** the turns of a camera’s passes, which warming and streaming give the objects nearest to the frame’s camera first, see {@link GalleryRenderer.planTurns} */
type Turns = {
  /** how far from the frame’s camera the objects that get their turn in the camera’s passes in {@link frame} may be at most; Infinity admits by the budget alone, and -Infinity with an infinite {@link reserved} admits nothing */
  cutoff: number
  /** the frame the camera’s passes last ran in */
  frame: number
  /** the objects the camera’s passes left out in {@link frame} */
  left: Set<Object3D>
  /** what building the objects within the cutoff that the camera’s passes haven’t admitted yet in {@link frame} is expected to cost, in milliseconds, which farther objects leave to them */
  reserved: number
  /** where the frame’s camera stood in {@link frame} */
  viewpoint: Vector3
  /** how many objects within the cutoff the camera’s passes came across in {@link frame}, admitted or left for the budget */
  within: number
}
/** WebGPUBackend parameters three doesn’t type, which it reads when it requests the device in `init` */
type BackendInternals = {parameters: {
  device?: GPUDevice
  powerPreference?: GPUPowerPreference
  requiredLimits: Record<string, number>
}}
/** bytes per pixel of all render targets of a pass, which screen-space reflections exceed with a fifth half-float target; WebGPU guarantees 32 and desktop GPUs offer 64 or more */
const wideColorAttachmentBytes = 64
/** sampled textures per shader stage that cinematic asks for; its heaviest fragment shaders sample 18, above the 16 WebGPU guarantees */
const cinematicSampledTextures = 32
/** Renderer internals that three doesn’t type. */
type Internals = {
  _currentRenderBundle: unknown
  _nodes: {
    getForRender: (renderObject: RenderObject) => unknown
    nodeFrame: {frameId: number}
  }
  _pipelines: {
    getForRender: (renderObject: RenderObject, promises: PromiseSink | null) => unknown
    isReady: (renderObject: RenderObject) => boolean
    updateForRender: (renderObject: RenderObject) => void
  }
}

// eslint-disable-next-line typescript/unbound-method -- Only compared, to find classes that override it.
const updateMatrixWorld = Object3D.prototype.updateMatrixWorld
/** an object’s name, or else its type inside the nearest named ancestor, to tell telemetry and loading items apart */
const objectLabel = (object: Object3D) => {
  if (object.name) {
    return object.name
  }
  let ancestor = object.parent
  while (ancestor && !ancestor.name) {
    ancestor = ancestor.parent
  }
  return ancestor ? `${ancestor.name}>${object.type}` : object.type
}
/** each object’s position, quaternion and scale when its matrix was last composed */
const poses = new WeakMap<Object3D, Float64Array>
const parents = new WeakMap<Object3D, Object3D | null>
/**
 * Like `updateMatrixWorld`, but only composes matrices whose transform or parent changed since the last call.
 * three recomposes every matrix of the scene each frame, although almost nothing in the gallery moves.
 */
export const updateChangedMatrices = (object: Object3D, parentChanged: boolean) => {
  // Cameras and other classes with their own bookkeeping keep three’s update.
  if (object.updateMatrixWorld !== updateMatrixWorld) {
    object.updateMatrixWorld(parentChanged)
    return
  }
  let changed = parentChanged
  if (parents.get(object) !== object.parent) {
    parents.set(object, object.parent)
    changed = true
  }
  if (object.matrixAutoUpdate) {
    const {position: p, quaternion: q, scale: s} = object
    let pose = poses.get(object)
    if (!pose) {
      pose = new Float64Array(10)
      poses.set(object, pose)
      pose[0] = Number.NaN
    }
    if (pose[0] !== p.x || pose[1] !== p.y || pose[2] !== p.z || pose[3] !== q.x || pose[4] !== q.y || pose[5] !== q.z || pose[6] !== q.w || pose[7] !== s.x || pose[8] !== s.y || pose[9] !== s.z) {
      pose.set([p.x, p.y, p.z, q.x, q.y, q.z, q.w, s.x, s.y, s.z])
      object.updateMatrix()
    }
  }
  if (object.matrixWorldNeedsUpdate || changed) {
    if (object.matrixWorldAutoUpdate) {
      if (object.parent) {
        object.matrixWorld.multiplyMatrices(object.parent.matrixWorld, object.matrix)
      } else {
        object.matrixWorld.copy(object.matrix)
      }
    }
    object.matrixWorldNeedsUpdate = false
    changed = true
  }
  for (const child of object.children) {
    if (child.matrixWorldAutoUpdate || changed) {
      updateChangedMatrices(child, changed)
    }
  }
}
// Milliseconds a warming frame may spend building the node graphs of objects drawn outside the camera frustum. Behind the loading screen, long frames matter less than getting through the scene: a frame’s own rendering adds up over many short ones.
const warmupBuildBudget = 50
// Milliseconds a streaming frame may spend building the node graphs of objects drawn for the first time in a pass, see readStreamBudget. Building happens synchronously, from a few milliseconds per object to over a hundred for the heaviest; a frame always admits at least one.
const streamBudget = readStreamBudget()
const streamedBuildBudget = streamBudget === false ? Number.POSITIVE_INFINITY : streamBudget
/** the least a build is expected to cost, in milliseconds, so a frame never admits more than a budget’s worth of objects whose materials are built already */
const minimumBuildCost = 0.1
/** the build cost a camera’s passes are expected to have for a material they haven’t built yet, in milliseconds, until they built one */
const initialFreshBuildCost = 30
/** milliseconds after which a pipeline that compiled in the background is logged as slow */
const slowPipelineMs = 500
/** frames in a row without anything left to stream after which streaming stops */
const streamedIdleFrames = 300

/**
 * Instruments real lifecycle operations and keeps per-frame work in the frame scene to once per frame:
 * matrices update before the first pass and pipelines compile in the background instead of blocking the GPU process.
 */
export class GalleryRenderer extends WebgpuRenderer {
  /** objects that every pass of the current frame skips, including their children */
  readonly hidden = new Set<Object3D>
  /** objects that only the camera and its reflection leave out, while shadow maps keep them as casters */
  readonly hiddenFromView = new Set<Object3D>
  /** the cameras of shadow maps, which draw {@link hiddenFromView} */
  readonly shadowCameras = new WeakSet<Camera>
  /** the cameras of shadow maps of lights from outside the rooms, like the sun, which draw {@link hidden} too */
  readonly unculledCameras = new WeakSet<Camera>
  /** what warming went through so far, for loading telemetry */
  readonly warmup = {
    /** milliseconds spent building node graphs of admitted objects */
    buildMs: 0,
    frames: 0,
    /** objects admitted outside the camera frustum */
    objects: 0,
  }
  /** milliseconds this frame spent building node graphs */
  private buildTime = 0
  /** the materials each camera’s passes built node graphs for already */
  private readonly builtMaterials = new WeakMap<Camera, WeakSet<object>>
  /** the sequence numbers of the pipelines still compiling in the background, oldest first */
  private readonly compilingPipelines = new Set<number>
  private culledCamera: Camera | null = null
  private culler: Culler | null = null
  /** how every render projects its scene; the frame scene’s passes swap in {@link frameProjection} */
  private readonly drawing = new GalleryDrawingPipeline
  private frame = -1
  /** how the passes of the frame scene project objects, see {@link installProjection} */
  private frameProjection: Projection = this.drawing.standard
  private frameScene: Scene | null = null
  /** per camera, the recent average of milliseconds spent building an object whose material its passes haven’t built yet; that varies by pass, since three may reuse what another pass built, as for most shadow maps, or build it again for the pass, as for the floor reflection */
  private readonly freshBuildCosts = new WeakMap<Camera, number>
  /** shadow cameras that left out objects not built yet this frame, with those objects */
  private gatedCameras = new Map<Camera, Set<Object3D>>
  /** objects that streaming left out of passes other than shadow maps this frame although they will get their turn */
  private gatedObjects = new Set<Object3D>
  /** shadow cameras whose map left out objects not built yet the last time it rendered, so it must render again, with those objects */
  private readonly incompleteCameras = new Map<Camera, Set<Object3D>>
  private initialization?: Promise<this>
  /** what building each material took the last time a pass other than a shadow map built it from scratch, in milliseconds; a heavy material is heavy in every such pass */
  private readonly materialBuildCosts = new WeakMap<object, number>
  /** the sequence number of the last pipeline that started compiling in the background */
  private pipelineSequence = 0
  /** the build cost this frame’s admissions are expected to add up to */
  private plannedBuildCost = 0
  /** projects objects outside of loading, leaving out {@link hidden} outside of {@link unculledCameras} and, outside of shadow maps, {@link hiddenFromView} */
  private projectCulled?: Projection
  private projectStreaming?: Projection
  /** projects objects while loading, admitting the next ones outside the frustum */
  private projectWarming?: Projection
  /** each object’s {@link perceptualDistanceToBox} from the frame’s camera, with the frame it was measured in */
  private readonly ranks = new WeakMap<Object3D, {
    frame: number
    rank: number
  }>
  /** shadow cameras whose map rendered this frame while streaming */
  private readonly renderedShadowCameras = new Set<Camera>
  /** shadow cameras whose map left out objects whose pipelines were still compiling, with the sequence number of the last pipeline that had started by then */
  private readonly shadowsAwaitingPipelines = new Map<Camera, number>
  /** the recent average of milliseconds spent building an object whose material a camera’s passes built already, which three mostly takes from its caches */
  private sharedBuildCost = 1
  private streamFound = false
  private streamIdle = 0
  private streaming = false
  private streamPriority: ((object: Object3D) => boolean) | null = null
  private streamPriorityFound = false
  private streamRest = false
  /** the turns of each camera’s passes, see {@link planTurns} */
  private readonly turns = new Map<Camera, Turns>
  private readonly untrackLoading: () => void
  /** the camera whose position {@link viewpoint} holds this frame, if any yet */
  private viewedCamera: Camera | null = null
  /** where the frame’s camera stands, which warming and streaming build the nearest objects to first */
  private readonly viewpoint = new Vector3
  /** objects that streaming left out of passes other than shadow maps last frame although they will get their turn */
  private waitingObjects = new Set<Object3D>
  private warmedFrame = -1
  private warming = false
  /** the cameras each object was drawn for outside their frustum while loading */
  private readonly warmObjects = new WeakMap<Object3D, Set<Camera>>
  private warmupAdmissions = 0
  /** how many times this frame left an object out of a pass for a later turn */
  private warmupPostponements = 0

  constructor(options: WebgpuRendererOptions) {
    super({
      ...options,
      requiredLimits: {
        ...readCinematicGraphics() ? {maxTextureDimension2D: cinematicMaxTextureSize} : {},
        ...isDevelopmentMode || readCinematicGraphics() ? {maxColorAttachmentBytesPerSample: wideColorAttachmentBytes} : {},
      },
      alpha: false,
      antialias: false,
      trackTimestamp: telemetry !== null,
    })
    this.lighting = new BatchedLighting
    this.drawingPipeline = this.drawing
    this.createProjections()
    this.untrackLoading = trackLoadingItems(() => {
      // Incomplete shadow maps render again one per frame in turn, so what they left out stays listed until their next turn. Listing only what last frame’s passes left out would jump with whichever map rendered.
      const waiting = new Set(this.waitingObjects)
      for (const objects of this.incompleteCameras.values()) {
        for (const object of objects) {
          waiting.add(object)
        }
      }
      return [
        ...this.warming && this.warmedFrame !== this.frame ? ['warmup'] : [],
        ...waiting.values().map(object => `stream:${object.name || object.uuid}`),
        ...this.incompleteCameras.keys().map(camera => `shadow-map:${camera.uuid}`),
      ]
    })
  }

  private get internals() {
    return this as unknown as Internals
  }

  /** whether warming draws every object in every pass, see {@link setWarming} */
  get isWarming() {
    return this.warming
  }

  /** the number of render pipelines that are still compiling in the background */
  get pendingPipelines() {
    return this.compilingPipelines.size
  }

  /** whether the last warming frame drew every object in the frame scene, so all that is left are pipelines compiling in the background */
  get warmedAll() {
    return this.warmedFrame === this.frame
  }

  override compileAsync(scene: Object3D, camera: Camera, targetScene?: Scene | null) {
    return telemetry ? telemetry.wrap('three.compile', () => super.compileAsync(scene, camera, targetScene)) : super.compileAsync(scene, camera, targetScene)
  }

  override async dispose() {
    this.untrackLoading()
    await super.dispose()
  }

  override init(): Promise<this> {
    this.initialization ??= this.requestCinematicLimits().then(() => (telemetry ? telemetry.wrap('three.init', () => super.init()) : super.init())).then(renderer => {
      this.compilePipelinesAsync()
      return renderer
    })
    return this.initialization
  }

  /**
   * Runs passes of the frame scene that belong to the camera’s frame, such as its reflection rendered ahead of it, with the frame’s matrices and the camera’s culling.
   * Shadow faces and reflections render the same scene again within a frame. They reuse the matrices of the first pass instead of walking the whole scene graph every time.
   */
  prepass(scene: Object3D, camera: Camera, pass: () => void) {
    if (scene !== this.frameScene || !scene.matrixWorldAutoUpdate) {
      pass()
      return
    }
    this.startFrame()
    if (this.viewedCamera !== camera) {
      this.viewedCamera = camera
      camera.getWorldPosition(this.viewpoint)
    }
    if (this.culler && this.culledCamera !== camera) {
      this.culledCamera = camera
      this.culler(camera)
    }
    scene.matrixWorldAutoUpdate = false
    try {
      pass()
    } finally {
      scene.matrixWorldAutoUpdate = true
    }
  }

  override render(scene: Object3D, camera: Camera) {
    const {drawing} = this
    const outer = drawing.projection
    // Only the frame scene warms and streams. A postprocessing pass draws a quad of its own, which streaming would leave out until a later frame, and the quad of the final pass is what draws the scene pass, so that frame would never come.
    drawing.projection = scene === this.frameScene ? this.frameProjection : drawing.standard
    try {
      if (scene !== this.frameScene || !scene.matrixWorldAutoUpdate) {
        // Shadow maps render within the frame’s passes.
        if (this.shadowCameras.has(camera)) {
          if (this.streaming) {
            this.renderedShadowCameras.add(camera)
          }
          // Once the pipelines it waited for are ready, the map draws what it left out.
          if (!this.awaitsPipelines(camera)) {
            this.shadowsAwaitingPipelines.delete(camera)
          }
        }
        super.render(scene, camera)
        return
      }
      this.prepass(scene, camera, () => {
        super.render(scene, camera)
      })
    } finally {
      drawing.projection = outer
    }
  }

  /** Sets the function that fills {@link hidden} for the camera of each frame, once the frame’s matrices are up to date. */
  setCuller(culler: Culler | null) {
    this.culler = culler
    this.culledCamera = null
    this.hidden.clear()
    this.hiddenFromView.clear()
  }

  /** Sets the scene the game renders every frame, together with its shadow and reflection passes. */
  setFrameScene(scene: Scene | null) {
    this.frameScene = scene
  }

  /**
   * Builds the objects not drawn in a pass yet a few per frame after loading, instead of all at once when they first come into view. Until then, a pass leaves them out.
   * Objects the priority accepts come first, the rest once no prioritized one is left, either of them nearest to the camera first (see {@link planTurns}), and streaming stops after a while without anything left to build.
   */
  setStreaming(streaming: boolean) {
    this.streaming = streaming
    this.streamIdle = 0
    this.turns.clear()
    this.incompleteCameras.clear()
    this.gatedCameras.clear()
    this.renderedShadowCameras.clear()
    this.waitingObjects.clear()
    this.gatedObjects.clear()
    this.installProjection()
  }

  /** Sets which objects streaming builds first, all by default. */
  setStreamPriority(priority: ((object: Object3D) => boolean) | null) {
    this.streamPriority = priority
  }

  /** Draws every object of the frame scene in every pass, regardless of the camera frustum, so that all their pipelines compile while loading, those nearest to the camera first (see {@link planTurns}). */
  setWarming(warming: boolean) {
    this.warming = warming
    this.turns.clear()
    this.installProjection()
  }

  /** Whether the shadow map of this camera left out objects that streaming hasn’t built yet, or whose pipelines were still compiling and are ready by now, so it must render again. */
  shadowIncomplete(camera: Camera) {
    return this.incompleteCameras.has(camera) || this.shadowsAwaitingPipelines.has(camera) && !this.awaitsPipelines(camera)
  }

  /**
   * Admits an object to be built this frame for the camera’s pass if its expected cost fits the frame’s budget, of which a frame always admits at least one: first the turns {@link planTurns} gave the camera’s passes in this frame, the objects nearest to the camera, and then, in what of the budget they leave, any other.
   * Otherwise, it waits for a later turn, which it gets by its distance.
   */
  private admit(object: Object3D, camera: Camera, budget: number) {
    const turns = this.turnsOf(camera, budget)
    const cost = this.buildCost(object, camera)
    const turn = this.rankOf(object) <= turns.cutoff
    // What the turns are expected to build still is kept for them, and so is the one object a frame always admits.
    const reserved = turn ? 0 : turns.reserved
    if (turn) {
      turns.within++
    }
    if ((this.warmupAdmissions > 0 || reserved > 0) && (this.buildTime >= budget || this.plannedBuildCost + reserved + cost > budget)) {
      this.warmupPostponements++
      turns.left.add(object)
      return false
    }
    if (turn) {
      turns.reserved = Math.max(0, turns.reserved - cost)
    }
    this.warmupAdmissions++
    this.plannedBuildCost += cost
    return true
  }

  /** Carries what the last streaming frame found over to the next one. */
  private advanceStreaming() {
    // Everything else waits while prioritized objects are left.
    this.streamRest = !this.streamPriorityFound
    this.streamIdle = this.streamFound ? 0 : this.streamIdle + 1
    // A shadow map that didn’t render last frame still misses what it left out before.
    for (const camera of this.renderedShadowCameras) {
      const gated = this.gatedCameras.get(camera)
      if (gated) {
        this.incompleteCameras.set(camera, gated)
      } else {
        this.incompleteCameras.delete(camera)
      }
    }
    this.renderedShadowCameras.clear()
    this.gatedCameras = new Map
    const waiting = this.gatedObjects
    this.gatedObjects = this.waitingObjects
    this.gatedObjects.clear()
    this.waitingObjects = waiting
    this.streamFound = false
    this.streamPriorityFound = false
    if (this.streamIdle > streamedIdleFrames) {
      this.setStreaming(false)
    }
  }

  /** Whether a pipeline that had started compiling when the camera’s shadow map last left out an object is still compiling. */
  private awaitsPipelines(camera: Camera) {
    const until = this.shadowsAwaitingPipelines.get(camera)
    // Sequence numbers only grow and the set keeps their order, so its first one is the oldest still compiling.
    const oldest = this.compilingPipelines.values().next().value
    return until !== undefined && oldest !== undefined && oldest <= until
  }

  /**
   * What building the object for the camera’s pass is expected to cost, in milliseconds.
   * Objects are admitted while projecting, before any of them is built, so the cost is a guess: an object whose material the camera’s passes haven’t built yet costs what that material took in another pass, or else about as much as the last such ones did in its passes, while one that shares a built material is cheap. A single average would let a run of cheap objects lower it until a frame admits dozens of expensive ones at once.
   */
  private buildCost(object: Object3D, camera: Camera) {
    const built = this.builtMaterials.get(camera)
    const materials = (object as Object3D & {material?: Array<Material> | Material}).material
    const fresh = this.freshBuildCosts.get(camera) ?? initialFreshBuildCost
    // Shadow maps draw with materials of their own, so what the object’s material cost elsewhere tells nothing about them.
    const known = this.shadowCameras.has(camera) ? null : this.materialBuildCosts
    // They draw with the light’s shadow material in place of the object’s, so only their first object builds it from scratch.
    const override = this.frameScene?.overrideMaterial
    let cost = 0
    const list: ReadonlyArray<Material | undefined> = Array.isArray(materials) ? materials : [materials]
    for (const own of list) {
      const material = override && own?.allowOverride !== false ? override : own
      if (material && built?.has(material)) {
        cost += this.sharedBuildCost
      } else {
        cost += (material && known?.get(material)) ?? fresh
      }
    }
    return cost
  }

  /** Replaces three’s synchronous pipeline creation for the frame scene. Objects are drawn once their pipeline is ready, so a new variant no longer stalls the frame. */
  private compilePipelinesAsync() {
    const internals = this.internals
    const pipelines = internals._pipelines
    const nodes = internals._nodes
    const buildNodes = nodes.getForRender.bind(nodes)
    // Only objects new to a pass build their node graphs, so timing them costs nothing in a settled frame.
    nodes.getForRender = renderObject => {
      const start = performance.now()
      try {
        return buildNodes(renderObject)
      } finally {
        const ms = performance.now() - start
        this.buildTime += ms
        let built = this.builtMaterials.get(renderObject.camera)
        if (!built) {
          built = new WeakSet
          this.builtMaterials.set(renderObject.camera, built)
        }
        if (built.has(renderObject.material)) {
          this.sharedBuildCost = Math.max(minimumBuildCost, this.sharedBuildCost * 0.7 + ms * 0.3)
        } else {
          built.add(renderObject.material)
          if (!this.shadowCameras.has(renderObject.camera)) {
            this.materialBuildCosts.set(renderObject.material, ms)
          }
          this.freshBuildCosts.set(renderObject.camera, Math.max(minimumBuildCost, (this.freshBuildCosts.get(renderObject.camera) ?? initialFreshBuildCost) * 0.7 + ms * 0.3))
        }
      }
    }
    let compiling: RenderObject | null = null
    const sink: PromiseSink = {
      push: promise => {
        const sequence = ++this.pipelineSequence
        this.compilingPipelines.add(sequence)
        const id = compiling ? `pipeline:${objectLabel(compiling.object)}/${compiling.material.name || compiling.material.type}` : 'pipeline'
        const loaded = startLoading(id)
        const start = performance.now()
        const settle = () => {
          this.compilingPipelines.delete(sequence)
          loaded()
          const ms = performance.now() - start
          if (ms >= slowPipelineMs) {
            telemetry?.event('pipeline.slow', {
              'pipeline.id': id,
              'pipeline.ms': Math.round(ms),
              'pipeline.pending': this.compilingPipelines.size,
            })
          }
        }
        void promise.then(settle, settle)
      },
    }
    const isReady = pipelines.isReady.bind(pipelines)
    // A shadow map only renders again once something in its light’s reach changes, so what it leaves out while their pipelines compile would stay missing. Without the walls and roofs in the sun’s map, the sun shafts fill the rooms.
    pipelines.isReady = renderObject => {
      const ready = isReady(renderObject)
      if (!ready && renderObject.scene === this.frameScene && this.shadowCameras.has(renderObject.camera)) {
        this.shadowsAwaitingPipelines.set(renderObject.camera, this.pipelineSequence)
      }
      return ready
    }
    // A render bundle records its draws once, so an object missing from it would stay missing.
    pipelines.updateForRender = renderObject => {
      if (renderObject.scene !== this.frameScene || internals._currentRenderBundle !== null) {
        return pipelines.getForRender(renderObject, null)
      }
      compiling = renderObject
      try {
        return pipelines.getForRender(renderObject, sink)
      } finally {
        compiling = null
      }
    }
  }

  /** Creates how the frame scene’s passes project objects outside of loading, while warming and while streaming. */
  private createProjections() {
    const {drawing, hidden, hiddenFromView, shadowCameras, unculledCameras} = this
    const {standard} = drawing
    this.projectCulled = (object, camera, groupOrder, renderList, clippingContext) => {
      if ((!hidden.has(object) || unculledCameras.has(camera)) && (!hiddenFromView.has(object) || shadowCameras.has(camera))) {
        standard(object, camera, groupOrder, renderList, clippingContext)
      }
    }
    this.projectWarming = (object, camera, groupOrder, renderList, clippingContext) => {
      if (hidden.has(object) && !unculledCameras.has(camera)) {
        return
      }
      if (!object.frustumCulled || !('geometry' in object)) {
        standard(object, camera, groupOrder, renderList, clippingContext)
        return
      }
      let cameras = this.warmObjects.get(object)
      if (!cameras) {
        if (!this.admit(object, camera, warmupBuildBudget)) {
          // Postpone the rest of the scene to the next frames.
          this.warmedFrame = -1
          standard(object, camera, groupOrder, renderList, clippingContext)
          return
        }
        cameras = new Set
        this.warmObjects.set(object, cameras)
      }
      // One draw per pass requests the object’s pipelines. Drawing it outside the frustum again would only redo the work, which in every shadow map of every loading frame adds up to seconds.
      if (cameras.has(camera)) {
        // Shadow maps drawn while loading are redrawn once the shadow cache takes over, so they only draw what still needs its pipelines.
        if (!this.frameScene?.overrideMaterial) {
          standard(object, camera, groupOrder, renderList, clippingContext)
        }
        return
      }
      cameras.add(camera)
      object.frustumCulled = false
      try {
        standard(object, camera, groupOrder, renderList, clippingContext)
      } finally {
        object.frustumCulled = true
      }
    }
    this.projectStreaming = (object, camera, groupOrder, renderList, clippingContext) => {
      const culled = hidden.has(object) && !unculledCameras.has(camera) || hiddenFromView.has(object) && !shadowCameras.has(camera)
      const cameras = this.warmObjects.get(object)
      if (!object.visible || !object.layers.test(camera.layers) || !object.frustumCulled || !('geometry' in object) || cameras?.has(camera)) {
        if (!culled) {
          standard(object, camera, groupOrder, renderList, clippingContext)
        }
        return
      }
      const priority = this.streamPriority?.(object) ?? true
      this.streamFound = true
      this.streamPriorityFound ||= priority
      if (!(priority || this.streamRest) || !this.admit(object, camera, streamedBuildBudget)) {
        // Left out until its turn, which keeps a shadow map rendering; its children still go their own way.
        if (shadowCameras.has(camera)) {
          let gated = this.gatedCameras.get(camera)
          if (!gated) {
            gated = new Set
            this.gatedCameras.set(camera, gated)
          }
          gated.add(object)
        } else {
          this.gatedObjects.add(object)
        }
        for (const child of object.children) {
          drawing.project(child, camera, groupOrder, renderList, clippingContext)
        }
        return
      }
      if (cameras) {
        cameras.add(camera)
      } else {
        this.warmObjects.set(object, new Set([camera]))
      }
      object.frustumCulled = false
      try {
        standard(object, camera, groupOrder, renderList, clippingContext)
      } finally {
        object.frustumCulled = true
      }
    }
    this.installProjection()
  }

  /** Lets the turns admit nothing, only find out what waits and how far it is, for the next frame to plan from. */
  private findOut(turns: Turns) {
    turns.cutoff = Number.NEGATIVE_INFINITY
    turns.reserved = Number.POSITIVE_INFINITY
  }

  /** Projection runs for every object of every pass of the frame scene, so outside of loading it does nothing but leave out {@link hidden}. */
  private installProjection() {
    const project = this.warming ? this.projectWarming : (this.streaming ? this.projectStreaming : this.projectCulled)
    if (project) {
      this.frameProjection = project
    }
  }

  /**
   * Plans which of the objects that the camera’s passes left out the last time they ran get their turn now: the nearest to the frame’s camera by {@link perceptualDistanceToBox}, as many as the budget fits, and always the nearest one. Any other object as near, give or take how far the camera moved since, gets its turn too, like one of a room that just mounted. What the turns leave of the budget goes to whatever else comes up first.
   * Passes admit objects while projecting, in the order of the scene graph, so a plan can only come from what they came across before. Which passes run changes from frame to frame, like the shadow maps that render again one per frame in turn, so each camera plans its own.
   * Where the passes left nothing out the last time, they only find out what waits and how far it is, admitting nothing, like they do the first time they run. Where they came across nothing within their turns, because what they planned for moved away or left, they admit by the budget alone, in the order of the scene graph, so loading never stalls.
   */
  private planTurns(turns: Turns, camera: Camera, budget: number) {
    const stalled = turns.cutoff > Number.NEGATIVE_INFINITY && turns.within === 0 && turns.left.size > 0
    const waiting = turns.left.values().filter(object => {
      // Warming builds an object for every pass once one admitted it, and streaming for each pass that admitted it.
      const warmed = this.warmObjects.get(object)
      return !warmed || !this.warming && !warmed.has(camera)
    }).map(object => ({
      object,
      rank: this.ranks.get(object)?.rank ?? Number.POSITIVE_INFINITY,
    })).toArray()
    turns.reserved = 0
    if (stalled || budget === Number.POSITIVE_INFINITY) {
      turns.cutoff = Number.POSITIVE_INFINITY
    } else if (!waiting.length) {
      this.findOut(turns)
    } else {
      waiting.sort((a, b) => a.rank - b.rank)
      let cutoff = waiting[0].rank
      let planned = 0
      for (const {object, rank} of waiting) {
        const cost = this.buildCost(object, camera)
        if (planned > 0 && planned + cost > budget) {
          break
        }
        planned += cost
        cutoff = rank
      }
      turns.cutoff = cutoff + perceptualDistance(this.viewpoint, turns.viewpoint)
      turns.reserved = planned
    }
    turns.frame = this.frame
    turns.left.clear()
    turns.viewpoint.copy(this.viewpoint)
    turns.within = 0
  }

  /** The object’s {@link perceptualDistanceToBox} from the frame’s camera, measured once per frame; objects without bounds count as farthest. */
  private rankOf(object: Object3D) {
    let entry = this.ranks.get(object)
    if (!entry) {
      entry = {
        frame: -1,
        rank: 0,
      }
      this.ranks.set(object, entry)
    }
    if (entry.frame !== this.frame) {
      entry.frame = this.frame
      const {geometry} = object as Drawable
      const rank = geometry ? perceptualDistanceToBox(this.viewpoint, worldBounds(object, geometry)) : Number.POSITIVE_INFINITY
      entry.rank = rank >= 0 ? rank : Number.POSITIVE_INFINITY
    }
    return entry.rank
  }

  /** Raises the sampled texture limit for cinematic to what the adapter offers, up to {@link cinematicSampledTextures}, so GPUs with fewer still get a device. */
  private async requestCinematicLimits() {
    const {parameters} = this.backend as unknown as BackendInternals
    if (!readCinematicGraphics() || parameters.device !== undefined || typeof navigator === 'undefined' || !('gpu' in navigator)) {
      return
    }
    // three requests the same GPU, so its device can get these limits.
    const adapter = await navigator.gpu.requestAdapter({powerPreference: parameters.powerPreference})
    if (adapter) {
      parameters.requiredLimits.maxSampledTexturesPerShaderStage = Math.min(cinematicSampledTextures, adapter.limits.maxSampledTexturesPerShaderStage)
    }
  }

  private startFrame() {
    const {frameId} = this.internals._nodes.nodeFrame
    if (this.frame === frameId) {
      return
    }
    this.frame = frameId
    this.culledCamera = null
    this.viewedCamera = null
    // A frame that admitted nothing and left nothing out had drawn everything already.
    this.warmedFrame = this.warming && this.warmupAdmissions === 0 && this.warmupPostponements === 0 ? frameId : -1
    if (this.warming) {
      this.warmup.frames++
      this.warmup.objects += this.warmupAdmissions
      this.warmup.buildMs += this.buildTime
    }
    if (this.streaming) {
      this.advanceStreaming()
    }
    this.warmupAdmissions = 0
    this.warmupPostponements = 0
    this.plannedBuildCost = 0
    this.buildTime = 0
    updateChangedMatrices(this.frameScene!, false)
  }

  /** The turns of the camera’s passes in this frame, planned as the first of them comes across an object to admit. */
  private turnsOf(camera: Camera, budget: number) {
    let turns = this.turns.get(camera)
    if (!turns) {
      turns = {
        cutoff: Number.POSITIVE_INFINITY,
        frame: this.frame,
        left: new Set,
        reserved: 0,
        viewpoint: this.viewpoint.clone(),
        within: 0,
      }
      // Building everything at once needs no turns.
      if (budget !== Number.POSITIVE_INFINITY) {
        this.findOut(turns)
      }
      this.turns.set(camera, turns)
    } else if (turns.frame !== this.frame) {
      this.planTurns(turns, camera, budget)
    }
    return turns
  }
}

export const createGalleryRenderer = (options: WebgpuRendererOptions) => new GalleryRenderer(options)
