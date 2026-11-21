import type {Node} from 'three/webgpu'

import {wireframeCoverage} from 'capture-session'
import {attribute, cameraNear, cameraPosition, cameraProjectionMatrix, cameraViewMatrix, Fn, mix, positionGeometry, uniform, varying, varyingProperty, vec2, vec3, vec4, viewportSize} from 'three/tsl'

import {useFenceDisplay} from '#src/lib/gallery/fenceDisplay.ts'
import viewportLineWidth from '#src/lib/rendering/viewportLineWidth.ts'

const halfWidth = uniform(0.5).onRenderUpdate(({renderer}) => viewportLineWidth(renderer!, useFenceDisplay.getState().lineWidth) / 2)
const antialiased = uniform(true).onRenderUpdate(() => useFenceDisplay.getState().lineStyle === 'barycentric')
// fwidth sums the horizontal and vertical derivatives: a diagonal’s antialiasing support extends up to √2 times farther.
const radius = halfWidth.add(0.5).mul(Math.SQRT2)
const linePoint = varyingProperty('vec3', 'fenceLinePoint')
const side = varying(positionGeometry.x).setInterpolation('linear')
// Absolute distance AFTER the derivative: differentiating abs(side) would give a seam down the center.
const pixels = side.abs().div(side.fwidth().max(1e-7))
const hardEdge = side.abs().mul(radius).lessThanEqual(halfWidth).select(1, 0)
// A meter vertically counts as five horizontally. Fade per pixel, so a long edge can be solid at one end and invisible at the other.
const distance = linePoint.sub(cameraPosition).mul(vec3(1, 5, 1)).length()
const opacity = distance.smoothstep(16, 100).oneMinus().pow(10)
export const strokeOpacity = opacity.mul(antialiased.select(wireframeCoverage(pixels, halfWidth), hardEdge))

/** Fraction to trim from the first endpoint to the camera’s near plane before projecting. */
const trim = (z: Node<'float'>, otherZ: Node<'float'>) => z.add(cameraNear).max(0).div(z.sub(otherZ).max(1e-7)).min(1)

/** Give each existing edge a narrow screen-space quad. Derivative coverage works even where a box has no visible face, without shading its interior or drawing diagonal edges. */
export const strokeVertex = Fn(() => {
  const a = attribute<'vec3'>('instanceStart', 'vec3')
  const b = attribute<'vec3'>('instanceEnd', 'vec3')
  const va = cameraViewMatrix.mul(vec4(a, 1))
  const vb = cameraViewMatrix.mul(vec4(b, 1))
  const ta = trim(va.z, vb.z)
  const tb = trim(vb.z, va.z)
  const ca = cameraProjectionMatrix.mul(mix(va, vb, ta))
  const cb = cameraProjectionMatrix.mul(mix(vb, va, tb))
  const atEnd = positionGeometry.y.greaterThan(0.5)
  linePoint.assign(atEnd.select(mix(b, a, tb), mix(a, b, ta)))
  const clip = atEnd.select(cb, ca)
  const axis = cb.xy.div(cb.w.max(cameraNear)).sub(ca.xy.div(ca.w.max(cameraNear))).mul(viewportSize)
  const normal = vec2(axis.y.negate(), axis.x).div(axis.length().max(1e-7))
  const offset = normal.mul(positionGeometry.x).mul(radius.mul(2)).div(viewportSize).mul(clip.w)
  return vec4(clip.xy.add(offset), clip.zw)
})()
