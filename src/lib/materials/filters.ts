import type {Node} from 'three/webgpu'

import {cameraViewMatrix, clamp, faceDirection, float, normalView, positionView, vec4} from 'three/tsl'

type Float = Node<'float'>

/** Pixel-filtered coverage of the region where the signed distance `d` (meters) is negative. */
export const inside = (d: Float) => clamp(float(0.5).sub(d.div(d.fwidth().max(0.00001))), 0, 1)
/** Coverage of the region where `d` (meters) is negative, filtered over `width` meters, the footprint of a pixel, for distances that jump between neighboring pixels, like those to features picked per cell, whose own derivatives would smear a line along every cell edge. */
export const insideBy = (d: Float, width: Float) => clamp(float(0.5).sub(d.div(width.max(0.00001))), 0, 1)
/** Filtered coverage of a band of half-width `halfWidth` around the zero set of `d`; bands thinner than a pixel fade to their average instead of crawling. */
export const line = (d: Float, halfWidth: number) => inside(d.abs().sub(halfWidth)).mul(float(halfWidth * 2).div(d.fwidth().max(0.00001)).min(1))
/** 1 while features of `size` meters span several pixels of the footprint, fading to 0 before they could alias. */
export const visibleDetail = (footprint: Float, size: number) => footprint.smoothstep(size * 0.15, size * 0.6).oneMinus()
/** Converts a world-space shading normal to the view-space normal a node material expects. */
export const worldNormalToView = (normal: Node<'vec3'>) => cameraViewMatrix.mul(vec4(normal, 0)).xyz.normalize()

/**
 * View-space normal of a surface displaced by a procedural `height` in meters.
 *
 * The built-in `bumpMap` differentiates by re-sampling textures at offset UVs, so procedural heights come out flat. This uses Mikkelsen’s surface gradient with the screen-space derivatives of the height instead, which works for any node and scales with the true surface size.
 */
export const heightNormal = (height: Float) => {
  const sigmaX = positionView.dFdx()
  const sigmaY = positionView.dFdy()
  const r1 = sigmaY.cross(normalView)
  const r2 = normalView.cross(sigmaX)
  const determinant = sigmaX.dot(r1).mul(faceDirection)
  const gradient = determinant.sign().mul(height.dFdx().mul(r1).add(height.dFdy().mul(r2)))
  return determinant.abs().mul(normalView).sub(gradient).normalize()
}
