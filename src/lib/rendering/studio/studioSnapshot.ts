import type {Mesh, Object3D, Quaternion} from 'three/webgpu'

import {Vector3} from 'three/webgpu'

/** the square size of a studio snapshot in pixels */
export const snapshotSize = 1024
/** the square window in the middle of the snapshot that the object is framed into */
export const snapshotWindow = 960
/** vertical field of view of the studio camera in degrees, long enough to keep a small object from looking distorted */
export const snapshotFov = 35
/** CIE lightness, 0–1, of the two neutral grays an object is set against: the dark one for light objects, the light one for dark ones */
export const backdropLightness = {
  dark: 0.22,
  light: 0.88,
} as const
/** the backdrop when no opaque pixel could be measured in time; most props are darker than it */
export const fallbackBackdrop = backdropLightness.light

const vertex = new Vector3

/**
 * Where a camera of the orientation `rotation` has to stand to project every vertex of `object` (whose world matrices are current) into the middle `window` pixels of a square `size` pixel image with the vertical field of view `fov` (degrees), as close as possible and with the object centered; `undefined` for an object without vertices.
 *
 * In the camera’s frame, a vertex `v` is within the window iff `|v.x − p.x| ≤ k · (p.z − v.z)` with `k = window / size · tan(fov / 2)`, and likewise for y. For a given `p.z`, feasible `p.x` form the interval from `max(v.x + k · v.z) − k · p.z` to `min(v.x − k · v.z) + k · p.z`, which is non-empty from `p.z = (max(v.x + k · v.z) − min(v.x − k · v.z)) / 2k` on, where it is the single point halfway between the two. The silhouette of a mesh is spanned by its vertices, so the fit is exact: the farthest vertex touches the window’s edge. Vertex shaders that move the surface are not accounted for.
 */
export function frameObject(object: Object3D, rotation: Quaternion, {fov = snapshotFov, size = snapshotSize, window = snapshotWindow} = {}) {
  const inverse = rotation.clone().invert()
  const k = window / size * Math.tan(fov / 2 * Math.PI / 180)
  let maxX = -Infinity
  let minX = Infinity
  let maxY = -Infinity
  let minY = Infinity
  object.traverseVisible(child => {
    if (!(child as Partial<Mesh>).isMesh) {
      return
    }
    const positions = (child as Mesh).geometry.getAttribute('position')
    for (let index = 0; index < positions.count; index++) {
      vertex.fromBufferAttribute(positions, index).applyMatrix4(child.matrixWorld).applyQuaternion(inverse)
      maxX = Math.max(maxX, vertex.x + k * vertex.z)
      minX = Math.min(minX, vertex.x - k * vertex.z)
      maxY = Math.max(maxY, vertex.y + k * vertex.z)
      minY = Math.min(minY, vertex.y - k * vertex.z)
    }
  })
  if (!Number.isFinite(maxX + minX + maxY + minY)) {
    return
  }
  const position = new Vector3((maxX + minX) / 2, (maxY + minY) / 2, Math.max(maxX - minX, maxY - minY) / (2 * k))
  return position.applyQuaternion(rotation)
}

const linear = Float32Array.from({length: 256}, (_, value) => {
  const channel = value / 255
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
})

/** CIE L* of a linear luminance, as 0–1 */
export const lightnessOf = (luminance: number) => (luminance <= 216 / 24_389 ? luminance * 24_389 / 27 : 116 * Math.cbrt(luminance) - 16) / 100

/** a gray of the CIE lightness `lightness` (0–1) as a CSS color */
export function gray(lightness: number) {
  const l = lightness * 100
  const luminance = l <= 8 ? l * 27 / 24_389 : ((l + 16) / 116) ** 3
  const channel = luminance <= 0.0031308 ? luminance * 12.92 : 1.055 * luminance ** (1 / 2.4) - 0.055
  const value = Math.round(Math.min(1, Math.max(0, channel)) * 255)
  return `rgb(${value} ${value} ${value})`
}

/**
 * The average CIE lightness, 0–1, of the opaque pixels of straight-alpha sRGB `pixels`, weighted by alpha, or `undefined` when no pixel is visible.
 *
 * Rows are visited in an interleaved order (every `stride`th row per pass, starting at a different row each pass) and the scan stops once `budgetMs` have passed since `start`, so a late result is an estimate from a spread of rows rather than from the top of the image only. It takes about 2 ms for a 1024² image on a desktop.
 */
export function averageLightness(pixels: Uint8ClampedArray, width: number, height: number, {budgetMs = 10, start = performance.now(), stride = 8, now = () => performance.now()} = {}) {
  let luminance = 0
  let weight = 0
  for (let pass = 0; pass < stride; pass++) {
    for (let y = pass; y < height; y += stride) {
      const end = (y + 1) * width * 4
      for (let index = y * width * 4; index < end; index += 4) {
        const alpha = pixels[index + 3]
        if (!alpha) {
          continue
        }
        luminance += (0.2126 * linear[pixels[index]] + 0.7152 * linear[pixels[index + 1]] + 0.0722 * linear[pixels[index + 2]]) * alpha
        weight += alpha
      }
    }
    if (now() - start > budgetMs) {
      break
    }
  }
  return weight ? lightnessOf(luminance / weight) : undefined
}

/** the CIE lightness of the neutral backdrop for an object of the average lightness `lightness`: dark behind light objects, light behind dark ones and when nothing was measured */
export const backdropFor = (lightness: number | undefined) => (lightness === undefined ? fallbackBackdrop : (lightness > 0.5 ? backdropLightness.dark : backdropLightness.light))
