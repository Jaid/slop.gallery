import type {FrameImpactSoundId} from '#src/lib/audio/frameImpacts.ts'
import type {SectionPoint} from '../FrameProfile.ts'
import type {BufferGeometry, Material} from 'three/webgpu'

import {MeshStandardNodeMaterial} from 'three/webgpu'

import {frameShapeAttribute, ornamentMember} from '../frameGeometry.ts'

/** how far behind the middle of a work its frame’s back lies, the same for every frame, so each hangs the same distance off its wall */
export const frameBack = -0.095
/** the most triangles a frame of any size may take */
export const frameTriangleBudget = 2048
/** how far a frame may reach out past its work’s edge at most, its mat included, which the clearance between hung works leaves room for */
export const maximumFrameReach = 0.15
/** how much of what a frame leaves in sight of its image fills a view of it, the rest lying just outside, so the antialiased rim of the sight edge stays out of the view’s outermost pixels */
const sightFill = 0.997

/**
 * A kind of frame works hang in: its moulding swept round the work, its ornaments and its materials, built for any size of work.
 *
 * A frame is laid out around the middle of its work, facing +z, its back at {@link frameBack}, and reaches {@link reach} out past the work’s edges. Its geometry holds one group per material, which are made once, when the first work wears the frame, and live as long as the page, like the shared gold.
 */
export default abstract class PortraitFrame {
  /** a sentence on what it looks like and what it is made of */
  abstract readonly description: string
  /** how far in front of the work’s middle the frame reaches at most */
  abstract readonly front: number
  /** how far in front of the work’s middle its image lies, recessed into the frame */
  abstract readonly imageDepth: number
  /** the id of the sound its work makes striking something, by what the frame is made of, shared with every frame of the same stuff: gilded wood unless it says otherwise */
  readonly impactSound: FrameImpactSoundId = 'gilt'
  /** how far the frame reaches out past the work’s edges, its mat included */
  abstract readonly reach: number
  /** the color the frame shows as, which its ghost takes while the player carries the work */
  abstract readonly tint: string
  abstract readonly title: string
  #held: Material | undefined
  #materials: Array<Material> | undefined
  #sight: Array<SectionPoint> | undefined

  /** the frame’s depth from its back to its front */
  get depth() {
    return this.front - frameBack
  }

  /** a single translucent material for the whole frame while the player carries its work */
  get heldMaterial() {
    this.#held ??= new MeshStandardNodeMaterial({
      color: this.tint,
      metalness: 0.2,
      roughness: 0.5,
      transparent: true,
      opacity: 0.3,
    })
    return this.#held
  }

  /** the materials of the frame’s groups, by their indices */
  get materials() {
    this.#materials ??= this.createMaterials()
    return this.#materials
  }

  /** the points of the moulding’s cross-section on the image’s plane and nearer the viewer, which hide the image’s edges from them, the same for a work of any size */
  private get sight() {
    if (!this.#sight) {
      const geometry = this.createGeometry(1, 1)
      const position = geometry.getAttribute('position')
      const shape = geometry.getAttribute(frameShapeAttribute)
      const points = new Map<string, SectionPoint>
      for (let index = 0; index < position.count; index++) {
        const [r, z] = [shape.getY(index), position.getZ(index)]
        if (shape.getX(index) < ornamentMember && z > this.imageDepth - 1e-6) {
          points.set(`${r}:${z}`, [r, z])
        }
      }
      geometry.dispose()
      this.#sight = points.values().toArray()
    }
    return this.#sight
  }

  /** The frame round a work of `width` × `height` meters, one group per material. */
  abstract createGeometry(width: number, height: number): BufferGeometry

  protected abstract createMaterials(): Array<Material>

  /**
   * How much of the image of a work of `width` × `height` meters shows in the frame from straight in front of its middle, `distance` meters from it: the moulding’s sight edge lies over the image’s edges, and what of it rises toward the viewer further in hides more of them the closer they look from. Ornaments reaching in over the image don’t count.
   */
  opening(width: number, height: number, distance: number) {
    const within = (half: number) => Math.min(half, ...this.sight.map(([r, z]) => (half + r) * distance / (distance - (z - this.imageDepth)))) * 2
    return {
      width: within(width / 2),
      height: within(height / 2),
    }
  }

  /** Half of what of the image of a work of `width` × `height` meters fills a view `aspect` times as wide as it is high from `distance` meters straight in front of its middle, along the tighter of the view’s sides, as far as the frame leaves it in sight, see {@link opening}. */
  viewedFill(width: number, height: number, aspect: number, distance: number) {
    const opening = this.opening(width, height, distance)
    return Math.max(opening.height, opening.width / aspect) / 2 * sightFill
  }

  /** How far straight in front of the middle of the image of a work of `width` × `height` meters a camera of the vertical field of view `fov` in degrees, `aspect` times as wide as it is high, stands for what the frame leaves in sight of the image to fill its view, see {@link viewedFill}, so none of the frame shows along the view’s tighter sides. */
  viewingDistance(width: number, height: number, aspect: number, fov: number) {
    const slope = Math.tan(fov * Math.PI / 360)
    // What the frame leaves in sight depends a little on how far the camera stands, which depends on what fills the view: a few rounds settle both.
    let distance = Math.max(height, width / aspect) / 2 / slope
    for (let round = 0; round < 8; round++) {
      distance = this.viewedFill(width, height, aspect, distance) / slope
    }
    return distance
  }
}
