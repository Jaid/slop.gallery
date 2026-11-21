import type {Camera, Node, PerspectiveCamera, Renderer, Scene} from 'three/webgpu'

import {clamp, exp, exp2, float, max, mix, perspectiveDepthToViewZ, screenUV, step, texture, uniform, vec2, vec3, vec4} from 'three/tsl'
import {Color, DepthTexture, RenderTarget, Vector2, Vector3} from 'three/webgpu'

import FloodTriangles from './FloodTriangles.ts'
import {advanceWireframeFlood, wireframeFlood} from './wireframeFlood.ts'
import WireframeRenderPipeline from './WireframeRenderPipeline.ts'

/** meters from the camera at which the flood treats the sky as a dome */
const skyDistance = 30
// Triangles glow for a while after they flip, however fast the front moves, so the radius of the last moments is kept: glowRadii[i] is the radius i / (glowSamples − 1) of the glow duration ago.
const glowSamples = 16

/** The live `wireframeFlood` as a layer over a finished frame: a sphere that turns everything it reaches into wireframe, or back from it, with a glowing seam along its front. Draws the wireframe, and in triangle and combined mode every triangle’s distance, into targets of its own, so call draw() once per frame with the scene camera, right after the scene, and put compose() over the frame. Meant for headless rendering, as it draws the scene up to three extra times per frame. */
export default class WireframeFloodPass {
  private readonly camera: Camera
  // its depth decides the flood, because the wireframe fill draws every mesh opaque, the transparent water too, which a scene pass sees through
  private readonly floodTarget = new RenderTarget(1, 1, {depthTexture: new DepthTexture(1, 1)})
  private readonly glowRadii = Array.from<number>({length: glowSamples}).fill(0)
  private readonly radiusHistory: Array<{
    radius: number
    time: number
  }> = []
  private readonly renderer: Renderer
  private readonly scene: Scene
  private readonly size = new Vector2
  // with antialiasing, the wireframe is drawn a second time with 4× MSAA just for its colors, since the flood still reads the single-sampled depth
  private readonly smoothFloodTarget = new RenderTarget(1, 1, {samples: 4})
  // in triangle and combined mode, another pass gives every pixel the distance of the triangle it shows
  private readonly triangles = new FloodTriangles
  private readonly wireframe: WireframeRenderPipeline

  constructor(renderer: Renderer, scene: Scene, camera: Camera) {
    this.renderer = renderer
    this.scene = scene
    this.camera = camera
    this.wireframe = new WireframeRenderPipeline(renderer, scene, camera)
  }

  /**
   * The frame with the flood over it. Draws in a pass of its own, like an output quad with a camera of its own, so the scene camera comes in through uniforms.
   *
   * By pixel, each pixel’s world position comes back from the wireframe’s depth, so every surface, water included, flips where it stands, with a soft edge; by triangle, the triangle pass decides, and a triangle flips whole. A seam glows along the front: along the sphere’s border by pixel, on whole triangles by triangle, and both ways combined.
   */
  compose(frame: Node<'vec4'>): Node<'vec4'> {
    const {camera, glowRadii, triangles} = this
    const near = uniform(0.1).onRenderUpdate(() => (camera as PerspectiveCamera).near)
    const far = uniform(1000).onRenderUpdate(() => (camera as PerspectiveCamera).far)
    const depth = texture(this.floodTarget.depthTexture!, screenUV).x
    const viewZ = perspectiveDepthToViewZ(depth, near, far)
    const focalX = uniform(1).onRenderUpdate(() => camera.projectionMatrix.elements[0])
    const focalY = uniform(1).onRenderUpdate(() => camera.projectionMatrix.elements[5])
    const ndc = vec2(screenUV.x.mul(2).sub(1), float(1).sub(screenUV.y.mul(2)))
    const viewPosition = vec3(ndc.x.mul(viewZ.negate()).div(focalX), ndc.y.mul(viewZ.negate()).div(focalY), viewZ)
    const world = uniform(camera.matrixWorld).mul(vec4(viewPosition, 1)).xyz
    const origin = new Vector3
    // a circle measures only horizontally
    const axesValue = new Vector3
    const axes = uniform(axesValue).onRenderUpdate(() => axesValue.set(1, Number(wireframeFlood.shape === 'sphere'), 1))
    const floodOrigin = uniform(origin).onRenderUpdate(() => origin.fromArray(wireframeFlood.position))
    // the sky has no surface, so it floods as a dome around the camera
    const skyDirection = uniform(camera.matrixWorld).mul(vec4(ndc.x.div(focalX), ndc.y.div(focalY), -1, 0)).xyz.normalize()
    const skyPoint = uniform(camera.matrixWorld).mul(vec4(0, 0, 0, 1)).xyz.add(skyDirection.mul(skyDistance))
    const skyFloodDistance = skyPoint.sub(floodOrigin).mul(axes).length()
    const pixelDistance = mix(world.sub(floodOrigin).mul(axes).length(), skyFloodDistance, step(0.999999, depth))
    const triangle = texture(triangles.target.texture, screenUV)
    const triangleDistance = mix(skyFloodDistance, triangle.r, triangle.a)
    const byTriangle = uniform(0).onRenderUpdate(() => Number(wireframeFlood.mode !== 'pixel'))
    const distance = mix(pixelDistance, triangleDistance, byTriangle)
    const sphereSeam = uniform(0).onRenderUpdate(() => Number(wireframeFlood.mode !== 'triangle'))
    const radius = uniform(0).onRenderUpdate(() => wireframeFlood.radius)
    const seamWidth = uniform(0).onRenderUpdate(() => wireframeFlood.seamWidth ?? 0.06 + 0.12 * wireframeFlood.radius)
    // without a radius, nothing has flipped yet, and no seam shows
    const started = step(1e-6, radius)
    const inside = mix(clamp(radius.sub(distance).div(seamWidth.div(1.5)).add(0.5), 0, 1), step(distance, radius), byTriangle).mul(started)
    // disabled, no stale wireframe target may show
    const enabled = uniform(0).onRenderUpdate(() => Number(wireframeFlood.enabled))
    const out = uniform(0).onRenderUpdate(() => Number(wireframeFlood.direction === 'out'))
    const seamIntensity = uniform(0.9).onRenderUpdate(() => wireframeFlood.seamIntensity)
    const seamColorValue = new Color
    const seamColor = uniform(seamColorValue).onRenderUpdate(() => seamColorValue.set(wireframeFlood.seamColor ?? '#a8d4ff'))
    const sphereGlow = exp(pixelDistance.sub(radius).div(seamWidth).pow2().negate())
    // a triangle that flipped between two radius samples is that far into its glow, as a share of the glow duration
    const radii = glowRadii.map((_, index) => uniform(0).onRenderUpdate(() => glowRadii[index]))
    let glowing: Node<'float'> = float(0)
    let age: Node<'float'> = float(0)
    for (let index = 0; index < glowSamples - 1; index++) {
      const [newer, older] = [radii[index], radii[index + 1]]
      const within = float(1).sub(step(triangleDistance, older)).mul(step(triangleDistance, newer))
      glowing = glowing.add(within)
      age = age.add(within.mul(newer.sub(triangleDistance).div(max(newer.sub(older), 1e-6)).add(index).div(glowSamples - 1)))
    }
    // the glow starts at full strength the moment a triangle flips, drops steeply and then slows down, an exponential ease-out normalized to reach 0 at the end
    // the sky has no triangles to glow
    const triangleGlow = glowing.mul(triangle.a).mul(exp2(age.mul(-10)).sub(2 ** -10).div(1 - 2 ** -10))
    const sphereSeamGlow = sphereGlow.mul(sphereSeam).mul(seamIntensity).mul(started).mul(enabled)
    const triangleSeamGlow = triangleGlow.mul(byTriangle).mul(enabled)
    const wire = mix(texture(this.floodTarget.texture, screenUV), texture(this.smoothFloodTarget.texture, screenUV), uniform(0).onRenderUpdate(() => Number(wireframeFlood.antialiasing)))
    // a glowing triangle lights up in its line color and fades into what it flipped to
    const lineColorValue = new Color
    const lineColor = uniform(lineColorValue).onRenderUpdate(() => lineColorValue.set(wireframeFlood.color ?? (wireframeFlood.highlight.length > 0 ? '#ff1515' : '#40ff40')))
    const highlightLineColorValue = new Color
    const highlightLineColor = uniform(highlightLineColorValue).onRenderUpdate(() => highlightLineColorValue.set(wireframeFlood.highlightColor ?? '#2f7bff'))
    const triangleColor = mix(lineColor, highlightLineColor, triangle.g)
    // flooding in, the frame turns into wireframe; flooding out, the wireframe turns back into the frame
    const before = mix(frame.rgb, wire.rgb, out)
    const after = mix(wire.rgb, frame.rgb, out)
    const flooded = mix(frame.rgb, mix(before, mix(after, triangleColor, triangleSeamGlow), inside), enabled)
    return vec4(flooded.add(seamColor.mul(sphereSeamGlow)), 1)
  }

  dispose() {
    this.wireframe.dispose()
    this.floodTarget.dispose()
    this.smoothFloodTarget.dispose()
    this.triangles.dispose()
  }

  /** Advances the flood and draws its targets into the renderer, unless there is nothing to show. */
  draw() {
    const {camera, renderer, scene, size, triangles, wireframe} = this
    advanceWireframeFlood()
    if (!wireframeFlood.enabled || wireframeFlood.direction === 'in' && wireframeFlood.radius <= 0) {
      return
    }
    this.sampleRadiusHistory()
    wireframe.highlight = wireframeFlood.highlight
    wireframe.color = wireframeFlood.color ?? undefined
    wireframe.highlightColor = wireframeFlood.highlightColor ?? undefined
    wireframe.background = wireframeFlood.background ?? undefined
    wireframe.angleIndicatorStrength = wireframeFlood.angleIndicatorStrength
    wireframe.lineStyle = wireframeFlood.lineStyle
    wireframe.lineWidth = wireframeFlood.lineWidth
    renderer.getDrawingBufferSize(size)
    this.floodTarget.setSize(size.x, size.y)
    const previous = renderer.getRenderTarget()
    try {
      renderer.setRenderTarget(this.floodTarget)
      wireframe.draw()
      if (wireframeFlood.antialiasing) {
        this.smoothFloodTarget.setSize(size.x, size.y)
        renderer.setRenderTarget(this.smoothFloodTarget)
        wireframe.draw()
      }
      if (wireframeFlood.mode !== 'pixel') {
        triangles.target.setSize(size.x, size.y)
        renderer.setRenderTarget(triangles.target)
        triangles.anchor = wireframeFlood.anchor
        triangles.shape = wireframeFlood.shape
        triangles.draw(renderer, scene, camera, wireframeFlood.position, wireframeFlood.highlight)
      }
    } finally {
      renderer.setRenderTarget(previous)
    }
  }

  private sampleRadiusHistory() {
    const {glowRadii, radiusHistory} = this
    const now = performance.now() / 1000
    const {radius, glowDuration} = wireframeFlood
    // a shrinking radius starts a new flood
    if (radius < (radiusHistory.at(-1)?.radius ?? 0)) {
      radiusHistory.length = 0
    }
    radiusHistory.push({
      radius,
      time: now,
    })
    while (radiusHistory.length > 2 && radiusHistory[1].time < now - glowDuration) {
      radiusHistory.shift()
    }
    for (let index = 0; index < glowSamples; index++) {
      const time = now - glowDuration * index / (glowSamples - 1)
      const after = radiusHistory.findIndex(entry => entry.time >= time)
      if (after <= 0) {
        // before the history began, nothing had flipped, not even a triangle right at the position
        glowRadii[index] = after === 0 && radiusHistory[0].time === time ? radiusHistory[0].radius : -1e-6
        continue
      }
      const {radius: from, time: fromTime} = radiusHistory[after - 1]
      const {radius: to, time: toTime} = radiusHistory[after]
      glowRadii[index] = from + (to - from) * (time - fromTime) / (toTime - fromTime)
    }
  }
}
