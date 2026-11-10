import type {Placement, Portrait, Vec3} from './types.ts'

import {shiftVoices} from 'procedural-audio'

import world from '#src/worlds/current.ts'

import arrivalVoices, {arrivalGap} from '../audio/arrivalVoices.ts'
import {frameBack} from '../frames/base/PortraitFrame.ts'
import {defaultPortraitArea} from '../placement/portraitSlots.ts'
import {arrivalFrame, cameraPose, loadBlob, newPortrait, notify, playSound, wallRebound} from './actions.ts'
import {holdPoint, requestHanging} from './hanging/hangings.ts'
import {hangingAnimation} from './hanging/index.ts'
import {maximumPortraits, validateImage} from './imagePolicy.ts'
import {useGallery} from './store.ts'

/** how far out from where it would have hung an imported work that does not fit there flips off its wall, in meters: its back clear of the fronts of the works hung beside it, which it would fuse with on touching them */
const flipClearance = 0.03 - frameBack
/** how much further out each further work of the same import flips off, a little more than the deepest frame, so none starts inside another */
const flipSpacing = 0.12
/** how fast a work flipping off its wall turns its top toward the room at most, in radians per second; a tall one turns slower, so its bottom edge swinging back still leaves the wall at a fifth of the speed it flies out at */
const flipSpin = 4

/** an image with its size in pixels */
export type SizedImage = {
  height: number
  image: Blob
  width: number
}

/** The frame of an image in meters: its own aspect at an area of `area` cm². */
export function imageSize(width: number, height: number, area = defaultPortraitArea) {
  if (!(width > 0 && height > 0) || !Number.isFinite(width + height) || width * height > 64_000_000) {
    throw new Error('Choose an image with at most 64 million pixels.')
  }
  const ratio = width / height
  if (ratio < 1 / 12 || ratio > 12) {
    throw new Error('This image is too panoramic for a frame. Try a crop between 1:12 and 12:1.')
  }
  const squareMeters = area / 10_000
  return {
    width: Math.sqrt(squareMeters * ratio),
    height: Math.sqrt(squareMeters / ratio),
  }
}

/** The side in meters of the square an image dragged in previews as, before its shape is known: one at the portrait area it would take on the wall with the id `wallId` or dropped while the player is in the room with the id `room`. */
export function importPreviewSide(wallId: string | undefined, room: string) {
  return Math.sqrt(world.portraitArea(wallId, room) / 10_000)
}

/** The centered part of an image, as x, y, width and height, that is at most `limit` times as wide as tall or as tall as wide. */
export function centeredCrop(width: number, height: number, limit = 2) {
  const cropWidth = Math.min(width, height * limit)
  const cropHeight = Math.min(height, width * limit)
  return [(width - cropWidth) / 2, (height - cropHeight) / 2, cropWidth, cropHeight] as const
}

/** An image file, already validated, as an imported work keeps it: works wider than 2:1 or taller than 1:2 only their middle, at most 3072 px on its longer edge, on an opaque ground, with the size in pixels of the part it keeps. */
export async function importedImage(file: Blob): Promise<SizedImage> {
  const bitmap = await createImageBitmap(file)
  try {
    const crop = centeredCrop(bitmap.width, bitmap.height)
    const [, , width, height] = crop
    // Rejects images too large or too panoramic for a frame before encoding them.
    imageSize(width, height)
    const scale = Math.min(1, 3072 / Math.max(width, height))
    const canvas = new OffscreenCanvas(Math.max(1, Math.round(width * scale)), Math.max(1, Math.round(height * scale)))
    const context = canvas.getContext('2d')
    if (!context) {
      throw new Error('The image could not be decoded.')
    }
    context.fillStyle = '#f2eee3'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(bitmap, ...crop, 0, 0, canvas.width, canvas.height)
    return {
      image: await canvas.convertToBlob({
        type: 'image/webp',
        quality: 0.94,
      }),
      width,
      height,
    }
  } finally {
    bitmap.close()
  }
}

/** The title of a work imported from the file named `name`: its name without the extension, dashes and underscores as spaces. */
export function importedTitle(name: string) {
  return name.replace(/\.[^.]+$/, '').replaceAll(/[-_]/g, ' ').trim().slice(0, 150) || 'An untitled arrival'
}

/** A provider’s output as a work keeps it: in whatever shape it came, at most 3072 px on its longer edge, on an opaque ground. */
export async function encodeGeneratedImage(source: Blob) {
  const bitmap = await createImageBitmap(source)
  try {
    imageSize(bitmap.width, bitmap.height)
    const scale = Math.min(1, 3072 / Math.max(bitmap.width, bitmap.height))
    const canvas = new OffscreenCanvas(Math.max(1, Math.round(bitmap.width * scale)), Math.max(1, Math.round(bitmap.height * scale)))
    const context = canvas.getContext('2d')!
    context.fillStyle = '#eee8d7'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    return await canvasImage(canvas)
  } finally {
    bitmap.close()
  }
}

/** The local stand-in for a fusion of several images: a cut-paper collage in the shape of the first, which every further one covers from a wavy cut on, each cut further right, the cuts gilded. */
export async function compositeImages(sources: ReadonlyArray<Blob | string>) {
  if (!sources.length) {
    throw new Error('A collage needs at least one image.')
  }
  const bitmaps: Array<ImageBitmap> = []
  try {
    for (const source of sources) {
      bitmaps.push(await createImageBitmap(await loadBlob(source)))
    }
    const [base, ...others] = bitmaps
    const scale = Math.min(1, 2048 / Math.max(base.width, base.height))
    const canvas = new OffscreenCanvas(Math.max(1, Math.round(base.width * scale)), Math.max(1, Math.round(base.height * scale)))
    const context = canvas.getContext('2d')!
    context.drawImage(base, 0, 0, canvas.width, canvas.height)
    const {width: w, height: h} = canvas
    // Cut k of n images runs around k/n of the width, swinging out less the more images share it.
    const cut = (index: number) => {
      const middle = (index + 1) / bitmaps.length
      const swing = 0.9 / bitmaps.length
      const slant = 0.04 / bitmaps.length
      context.moveTo(w * (middle - slant), 0)
      context.bezierCurveTo(w * (middle + swing), h * 0.3, w * (middle - swing), h * 0.7, w * (middle + slant), h)
    }
    for (const [index, image] of others.entries()) {
      context.save()
      context.beginPath()
      cut(index)
      context.lineTo(w, h)
      context.lineTo(w, 0)
      context.closePath()
      context.clip()
      const fit = Math.max(w / image.width, h / image.height)
      context.drawImage(image, (w - image.width * fit) / 2, (h - image.height * fit) / 2, image.width * fit, image.height * fit)
      context.restore()
    }
    context.strokeStyle = '#d6b779'
    context.lineWidth = Math.max(2, w * 0.003)
    for (const index of others.keys()) {
      context.beginPath()
      cut(index)
      context.stroke()
    }
    return await canvasImage(canvas)
  } finally {
    for (const bitmap of bitmaps) {
      bitmap.close()
    }
  }
}

/** The local stand-in for the instructions an ingredient contributes, like an orb’s prompt: the image washed in the ingredient’s glow and darkened toward its edges by it. */
export async function tintImage(source: Blob | string, color: string) {
  const bitmap = await createImageBitmap(await loadBlob(source))
  try {
    const scale = Math.min(1, 2048 / Math.max(bitmap.width, bitmap.height))
    const canvas = new OffscreenCanvas(Math.max(1, Math.round(bitmap.width * scale)), Math.max(1, Math.round(bitmap.height * scale)))
    const context = canvas.getContext('2d')!
    const {width: w, height: h} = canvas
    context.drawImage(bitmap, 0, 0, w, h)
    context.globalCompositeOperation = 'color'
    context.globalAlpha = 0.5
    context.fillStyle = color
    context.fillRect(0, 0, w, h)
    context.globalCompositeOperation = 'multiply'
    context.globalAlpha = 1
    const vignette = context.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.hypot(w, h) / 2)
    vignette.addColorStop(0, 'white')
    vignette.addColorStop(1, color)
    context.fillStyle = vignette
    context.fillRect(0, 0, w, h)
    return await canvasImage(canvas)
  } finally {
    bitmap.close()
  }
}

async function canvasImage(canvas: OffscreenCanvas): Promise<SizedImage> {
  return {
    image: await canvas.convertToBlob({
      type: 'image/webp',
      quality: 0.94,
    }),
    width: canvas.width,
    height: canvas.height,
  }
}

export default class ImageImporter {
  /** how many works have arrived so far, which tunes each one’s sound */
  private arrivals = 0
  private disposed = false
  /** when the last work’s arrival sounds, in seconds of `performance.now()` */
  private lastArrival = Number.NEGATIVE_INFINITY
  private queue = Promise.resolve()

  constructor(private readonly onImport: (portrait: Portrait) => void) {}
  dispose() {
    this.disposed = true
  }

  import(files: Array<File>, target?: {
    direction: Vec3
    origin: Vec3
  }) {
    // Capture the drop location before decoding; walking must not move an in-flight import.
    const pose = {
      position: [...cameraPose.position] as Vec3,
      direction: [...cameraPose.direction] as Vec3,
    }
    const {room} = useGallery.getState()
    this.queue = this.queue.catch(() => {}).then(async () => {
      if (this.disposed) {
        return
      }
      let count = 0
      let flips = 0
      for (const file of files.slice(0, 12)) {
        try {
          validateImage(file)
          if (useGallery.getState().portraits.length >= maximumPortraits) {
            throw new Error('The collection is full. Remove a work to make room.')
          }
          const {image: source, width: cropWidth, height: cropHeight} = await importedImage(file)
          // dispose() can run during decoding, which the narrowing from the check above cannot see.
          if (this.disposed as boolean) {
            break
          }
          // Dropped into the room, a work takes the portrait area of the player’s room.
          const dropped = imageSize(cropWidth, cropHeight, world.portraitArea(undefined, room))
          const title = importedTitle(file.name)
          const s = useGallery.getState()
          let size = dropped
          let place: Placement | null = null
          if (target) {
            const aim = ({width, height}: typeof size) => world.placement.findPlacement(target.origin, target.direction, width, height, s.portraits)
            place = aim(size)
            // Aimed at a wall, it takes the portrait area of the room owning the wall, which the ray hits whatever the size.
            const hungArea = place && world.portraitArea(place.wallId, room)
            if (hungArea && hungArea !== world.portraitArea(undefined, room)) {
              size = imageSize(cropWidth, cropHeight, hungArea)
              place = aim(size)
            }
          }
          if (!place?.inReach) {
            size = dropped
          }
          const p = newPortrait(source, title, size.width, size.height, pose)
          if (place?.valid) {
            Object.assign(p, {
              position: place.position,
              rotation: place.rotation,
              wallId: place.wallId,
              labelAbove: place.labelAbove === true ? true : undefined,
              hung: true,
            })
          } else if (place?.inReach) {
            // In its own shape it does not fit where it was aimed, which the square previewing it could not tell: it flips off the wall back into the room as the player’s body bounces off a work it knocked down, its top tipping toward the room, each one after the first further out, clear of the one before.
            const normal = [Math.sin(place.rotation), Math.cos(place.rotation)] as const
            const out = flipClearance + flips * flipSpacing
            const turn = Math.min(flipSpin, wallRebound.out * 0.8 / (size.height / 2))
            Object.assign(p, {
              position: [place.position[0] + normal[0] * out, place.position[1], place.position[2] + normal[1] * out],
              rotation: place.rotation,
              velocity: [normal[0] * wallRebound.out, wallRebound.lift, normal[1] * wallRebound.out],
              spin: [normal[1] * turn, 0.6, -normal[0] * turn],
            })
            flips++
          } else {
            const distance = Math.min(1.6, Math.max(0.25, world.wallDistance(pose.position, pose.direction) - 0.35))
            p.position = [pose.position[0] + pose.direction[0] * distance, Math.max(world.placement.floorHeight([pose.position[0] + pose.direction[0] * distance, pose.position[1], pose.position[2] + pose.direction[2] * distance]) + 0.8, pose.position[1] + pose.direction[1] * distance + count * 0.15), pose.position[2] + pose.direction[2] * distance]
          }
          // Where it hangs or lands decides its frame, which may be another room’s than the player’s, through a doorway.
          p.frame = arrivalFrame(p.position, pose.position, p.id)
          s.add(p)
          if (p.hung) {
            requestHanging(p.id, p.position, p.rotation, holdPoint(pose))
          }
          this.arrive(p.hung)
          count++
          this.onImport(p)
        } catch (error) {
          notify(Error.isError(error) ? `${file.name}: ${error.message}` : 'That image could not be imported.')
        }
      }
    })
    return this.queue
  }

  /** Sounds a work arriving, each tuned a little apart: one hung right away as its hanging slaps it onto its wall, one dropped into the room at least {@link arrivalGap} after the one before. */
  private arrive(hung: boolean) {
    const now = performance.now() / 1000
    const delay = hung ? 0 : Math.max(0, this.lastArrival + arrivalGap - now)
    this.lastArrival = Math.max(this.lastArrival, now + delay)
    const index = this.arrivals++
    playSound(shiftVoices(arrivalVoices(hung, Math.sin(index * 2.39996), hung ? hangingAnimation.impact : undefined), delay), `arrival:${index}`)
  }
}
