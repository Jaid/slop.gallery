import type {LayerOptions} from './layer.ts'
import type {Node} from 'three/webgpu'

import {wireframeCoverage} from 'capture-session'
import {attribute, cameraNear, cameraProjectionMatrix, Fn, mix, modelViewMatrix, modelWorldMatrix, positionGeometry, uniform, varying, varyingProperty, vec2, vec4, viewportSize} from 'three/tsl'

import viewportLineWidth from '#src/lib/rendering/viewportLineWidth.ts'

import layerOpacity from './layerOpacity.ts'
import {useOverlayTuning} from './tuning.ts'

export type StrokeSpace = 'viewport' | 'world'

/** Fraction to trim from the first endpoint to the camera’s near plane before projecting. */
const trim = (z: Node<'float'>, otherZ: Node<'float'>) => z.add(cameraNear).max(0).div(z.sub(otherZ).max(1e-7)).min(1)

/** Shared by all drawings on one layer. Omitted width and style keep following the live controls. */
export default function createStroke(options: LayerOptions, space: StrokeSpace) {
  const {lineStyle, lineWidth} = options
  const halfWidth = uniform(0.5).onRenderUpdate(({renderer}) => viewportLineWidth(renderer!, lineWidth ?? useOverlayTuning.getState().lineWidth) / 2)
  const antialiased = uniform(true).onRenderUpdate(() => (lineStyle ?? useOverlayTuning.getState().lineStyle) === 'barycentric')
  // fwidth sums the horizontal and vertical derivatives: a diagonal’s antialiasing support extends up to √2 times farther.
  const radius = halfWidth.add(0.5).mul(Math.SQRT2)
  const linePoint = varyingProperty('vec3', 'overlayLinePoint')
  const side = varying(positionGeometry.x).setInterpolation('linear')
  // Absolute distance AFTER the derivative: differentiating abs(side) would give a seam down the center.
  const pixels = side.abs().div(side.fwidth().max(1e-7))
  const hardEdge = side.abs().mul(radius).lessThanEqual(halfWidth).select(1, 0)
  const coverage = antialiased.select(wireframeCoverage(pixels, halfWidth), hardEdge)
  const extrude = (ca: Node<'vec4'>, cb: Node<'vec4'>, atEnd: Node<'bool'>) => {
    const clip = atEnd.select(cb, ca)
    const direction = space === 'viewport' ? cb.xy.sub(ca.xy) : cb.xy.div(cb.w.max(cameraNear)).sub(ca.xy.div(ca.w.max(cameraNear)))
    const axis = direction.mul(viewportSize)
    const normal = vec2(axis.y.negate(), axis.x).div(axis.length().max(1e-7))
    const offset = normal.mul(positionGeometry.x).mul(radius.mul(2)).div(viewportSize).mul(clip.w)
    return vec4(clip.xy.add(offset), clip.zw)
  }
  /** Give each existing edge a narrow screen-space quad. Derivative coverage works even where a box has no visible face, without shading its interior or drawing diagonal edges. */
  const vertexNode = Fn(() => {
    const a = attribute<'vec3'>('instanceStart', 'vec3')
    const b = attribute<'vec3'>('instanceEnd', 'vec3')
    const atEnd = positionGeometry.y.greaterThan(0.5)
    if (space === 'viewport') {
      // Fractional viewport coordinates from the top left, independent of camera and render target size.
      const toClip = (p: Node<'vec3'>) => vec4(p.xy.mul(vec2(2, -2)).add(vec2(-1, 1)), 0.5, 1)
      return extrude(toClip(a), toClip(b), atEnd)
    }
    const va = modelViewMatrix.mul(vec4(a, 1))
    const vb = modelViewMatrix.mul(vec4(b, 1))
    const ta = trim(va.z, vb.z)
    const tb = trim(vb.z, va.z)
    const ca = cameraProjectionMatrix.mul(mix(va, vb, ta))
    const cb = cameraProjectionMatrix.mul(mix(vb, va, tb))
    linePoint.assign(modelWorldMatrix.mul(vec4(atEnd.select(mix(b, a, tb), mix(a, b, ta)), 1)).xyz)
    return extrude(ca, cb, atEnd)
  })()
  return {
    opacityNode: space === 'viewport' ? coverage : layerOpacity(coverage, linePoint, options),
    vertexNode,
  }
}
