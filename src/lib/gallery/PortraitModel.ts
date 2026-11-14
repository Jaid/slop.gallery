import type {StudioSubjectSize} from '../rendering/studio/studioFraming.ts'
import type {Portrait} from './types.ts'
import type {Texture} from 'three/webgpu'

import {Box3, Group, Mesh, MeshBasicNodeMaterial, PlaneGeometry, Vector3} from 'three/webgpu'

import {portraitFrame} from '#src/frames/index.ts'

import {artworkPlaceholders, holdArtworkTexture} from '../useArtworkTexture.ts'

/** what of a work its model shows */
export type PortraitModelSubject = Pick<Portrait, 'frame' | 'height' | 'source' | 'width'>
/** what loads an artwork’s texture and keeps it until released, like {@link holdArtworkTexture} */
export type ArtworkHolder = (source: Portrait['source']) => {
  release: () => void
  texture: Promise<Texture>
}

/**
 * A work as an object of its own apart from the world, for a renderer other than the world’s to show: its image in its frame, the two meshes a hung work is made of, around the middle of all they reach, which lies at {@link object}’s origin, facing +z.
 *
 * The frame’s materials are the ones every work in that frame shares. The image is a texture of its own from the artwork as the world already decoded it, so disposing the model frees it on that other renderer’s device without taking the world’s away.
 */
export default class PortraitModel {
  /** resolves once the image shows, or its placeholder for good where the artwork can’t be loaded */
  readonly loaded: Promise<void>
  /** the framed work, its middle at the origin */
  readonly object = new Group
  /** the box around the origin that holds all of the framed work, as far as its frame really reaches, ornaments included */
  readonly size: StudioSubjectSize
  private readonly artwork: ReturnType<ArtworkHolder>
  private disposed = false
  private readonly image: Mesh<PlaneGeometry, MeshBasicNodeMaterial>
  private readonly moulding: Mesh
  private texture: Texture | undefined

  /**
   * @param hold loads the artwork’s texture, from the textures the artworks share by default
   */
  constructor({frame: frameId, height, source, width}: PortraitModelSubject, hold: ArtworkHolder = holdArtworkTexture) {
    const frame = portraitFrame(frameId)
    this.moulding = new Mesh(frame.createGeometry(width, height), frame.materials)
    this.moulding.name = 'portrait-frame'
    // Unlit, like in the world, where the image shows as it is whatever light falls on its frame.
    this.image = new Mesh(new PlaneGeometry(width, height), new MeshBasicNodeMaterial({color: artworkPlaceholders.loading}))
    this.image.name = 'portrait-image'
    this.image.position.z = frame.imageDepth
    // What the frame names as its reach and its front says where its moulding ends, which ornaments can stand out of, so the geometry itself tells how far the framed work reaches.
    const {geometry} = this.moulding
    if (!geometry.boundingBox) {
      geometry.computeBoundingBox()
    }
    const bounds = new Box3
    bounds.copy(geometry.boundingBox!)
    bounds.expandByPoint(new Vector3(-width / 2, -height / 2, frame.imageDepth))
    bounds.expandByPoint(new Vector3(width / 2, height / 2, frame.imageDepth))
    const extent = bounds.getSize(new Vector3)
    const work = new Group
    work.add(this.moulding, this.image)
    bounds.getCenter(work.position).negate()
    this.object.name = 'portrait-model'
    this.object.add(work)
    this.size = {
      width: extent.x,
      height: extent.y,
      depth: extent.z,
    }
    this.artwork = hold(source)
    this.loaded = this.artwork.texture.then(texture => {
      if (this.disposed) {
        return
      }
      // Its own upload of the same decoded image.
      this.texture = texture.clone()
      this.texture.needsUpdate = true
      const {material} = this.image
      material.map = this.texture
      material.color.set('#ffffff')
      material.needsUpdate = true
    }, () => {
      this.image.material.color.set(artworkPlaceholders.failed)
    })
  }

  /** Frees the frame’s geometry and the image, on every renderer that showed them. The frame’s materials stay, as every work in that frame shares them. */
  dispose() {
    if (this.disposed) {
      return
    }
    this.disposed = true
    this.object.clear()
    this.moulding.geometry.dispose()
    this.image.geometry.dispose()
    this.image.material.dispose()
    this.texture?.dispose()
    this.artwork.release()
  }
}
