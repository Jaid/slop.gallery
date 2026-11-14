import {loadBlob} from './gallery/actions.ts'
import {peekArtworkImage} from './useArtworkTexture.ts'

/** what makes the small image of an artwork */
export type ThumbnailMaker = (source: Source) => Promise<Blob>
/** what finds an artwork already decoded, or undefined where it isn’t */
export type DecodedArtworkLookup = (source: Source) => DecodedImage | undefined
type DecodedImage = HTMLCanvasElement | ImageBitmap
type Source = Blob | string
type Entry = {
  promise: Promise<string>
  url?: string
}

/** the length of a thumbnail’s longer side in pixels, enough for a cell of the collection’s grid on a dense screen */
export const thumbnailSize = 320

/**
 * The artwork’s thumbnail, see {@link encodeThumbnail}: drawn from where the world already decoded the artwork for a work it shows, and only decoded anew from its image otherwise.
 * @param decoded finds the artwork already decoded, in the textures the artworks share by default; it is only looked at, never loaded or held
 */
export async function makeThumbnail(source: Source, decoded: DecodedArtworkLookup = peekArtworkImage) {
  const image = decoded(source)
  if (image) {
    return encodeThumbnail(image)
  }
  const bitmap = await createImageBitmap(await loadBlob(source))
  try {
    return await encodeThumbnail(bitmap)
  } finally {
    bitmap.close()
  }
}

/** The decoded image scaled down to at most {@link thumbnailSize} on its longer side, as a small WebP. It is drawn before this returns, so the image may go right after. */
function encodeThumbnail(image: DecodedImage) {
  const scale = Math.min(1, thumbnailSize / Math.max(image.width, image.height))
  const canvas = new OffscreenCanvas(Math.max(1, Math.round(image.width * scale)), Math.max(1, Math.round(image.height * scale)))
  const context = canvas.getContext('2d')
  if (!context) {
    throw new Error('Could not create a 2D canvas context for a thumbnail.')
  }
  context.imageSmoothingQuality = 'high'
  context.drawImage(image, 0, 0, canvas.width, canvas.height)
  return canvas.convertToBlob({
    type: 'image/webp',
    quality: 0.9,
  })
}

/**
 * Small images of artworks as object URLs, each made once per artwork image and kept until {@link retain} lets go of it, so a menu that shows them again finds them ready instead of decoding every full-size image anew.
 */
export class ArtworkThumbnails {
  private readonly entries = new Map<Source, Entry>
  constructor(private readonly make: ThumbnailMaker = makeThumbnail) {}

  /** how many thumbnails are kept, made or still being made */
  get size() {
    return this.entries.size
  }

  /** The URL of the artwork’s thumbnail, made on the first call. A failure isn’t kept, so the next call tries again. */
  get(source: Source): Promise<string> {
    const known = this.entries.get(source)
    if (known) {
      return known.promise
    }
    const entry: Entry = {
      promise: this.make(source).then(image => {
        const url = URL.createObjectURL(image)
        // Let go of while it was being made.
        if (this.entries.get(source) === entry) {
          entry.url = url
        } else {
          URL.revokeObjectURL(url)
        }
        return url
      }),
    }
    this.entries.set(source, entry)
    entry.promise.catch(() => {
      if (this.entries.get(source) === entry) {
        this.entries.delete(source)
      }
    })
    return entry.promise
  }

  /** The URL of the artwork’s thumbnail if it is already made, without making it. */
  peek(source: Source) {
    return this.entries.get(source)?.url
  }

  /** Lets go of every thumbnail but those of the artworks given, like the ones still in the collection, and frees their images. */
  retain(sources: Iterable<Source>) {
    const kept = new Set(sources)
    for (const [source, entry] of this.entries) {
      if (kept.has(source)) {
        continue
      }
      this.entries.delete(source)
      if (entry.url) {
        URL.revokeObjectURL(entry.url)
      }
    }
  }
}

/** the thumbnails of the collection’s artworks */
const artworkThumbnails = new ArtworkThumbnails

export default artworkThumbnails
