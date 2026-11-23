import type {Placement, Portrait, Vec3} from './types.ts'

import {shiftVoices} from 'procedural-audio'

import {frameBack} from '#src/frames/base/PortraitFrame.ts'
import world from '#src/worlds/current.ts'

import arrivalVoices, {arrivalGap} from '../audio/arrivalVoices.ts'
import {defaultPortraitArea} from '../placement/portraitSlots.ts'
import worldClock from '../worldClock.ts'
import {arrivalFrame, bodyPose, cameraPose, loadBlob, newPortrait, notify, playSound, wallRebound} from './actions.ts'
import {holdPoint, requestHanging} from './hanging/hangings.ts'
import {hangingAnimation} from './hanging/index.ts'
import {maximumArtworkEdge, maximumPortraits, validateImport} from './imagePolicy.ts'
import {useGallery} from './store.ts'

/** how far out from where it would have hung an imported work that does not fit there flips off its wall, in meters: its back clear of the fronts of the works hung beside it, which it would fuse with on touching them */
const flipClearance = 0.03 - frameBack
/** how much further out each further work of the same import flips off its wall or lands in front of the player, a little more than the deepest frame, so none starts inside another */
const arrivalSpacing = 0.12
/** how far in front of the player’s body a work dropped at their feet stands up, in meters past their capsule */
const feetClearance = 0.3
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
  if (!(width > 0 && height > 0) || !Number.isFinite(width + height)) {
    throw new Error('Choose an image with valid dimensions.')
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

/** Where the square an image dragged in previews as would hang, aimed along `direction` from `origin` while the player is in the room with the id `room`: at the portrait area of the room owning the wall it is aimed at, which the ray hits whatever the size. */
export function importPreviewPlacement(origin: Vec3, direction: Vec3, room: string, portraits: ReadonlyArray<Portrait>) {
  const aim = (side: number) => world.placement.findPlacement(origin, direction, side, side, portraits)
  const droppedSide = importPreviewSide(undefined, room)
  const placement = aim(droppedSide)
  const hungSide = placement && importPreviewSide(placement.wallId, room)
  return hungSide && hungSide !== droppedSide ? aim(hungSide) : placement
}

/** The centered part of an image, as x, y, width and height, that is at most `limit` times as wide as tall or as tall as wide. */
export function centeredCrop(width: number, height: number, limit = 2) {
  const cropWidth = Math.min(width, height * limit)
  const cropHeight = Math.min(height, width * limit)
  return [(width - cropWidth) / 2, (height - cropHeight) / 2, cropWidth, cropHeight] as const
}

/** An image file, already validated, as an imported work keeps it: works wider than 2:1 or taller than 1:2 only their middle, at most 4096 px on its longer edge, on an opaque ground, with the size in pixels of the part it keeps. An SVG is drawn at exactly 4096 px on its longer edge, whatever its own size. */
export async function importedImage(file: Blob): Promise<SizedImage> {
  const decoded = await decodeImage(file)
  try {
    const crop = centeredCrop(decoded.width, decoded.height)
    const [, , width, height] = crop
    // Validate cropped dimensions before encoding.
    imageSize(width, height)
    const fit = maximumArtworkEdge / Math.max(width, height)
    const scale = decoded.vector ? fit : Math.min(1, fit)
    const canvas = new OffscreenCanvas(Math.max(1, Math.round(width * scale)), Math.max(1, Math.round(height * scale)))
    const context = canvas.getContext('2d')
    if (!context) {
      throw new Error('The image could not be decoded.')
    }
    context.fillStyle = '#f2eee3'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(decoded.source, ...crop, 0, 0, canvas.width, canvas.height)
    return {
      image: await canvas.convertToBlob({
        type: 'image/webp',
        quality: 0.94,
      }),
      width,
      height,
    }
  } finally {
    decoded.close()
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
    const scale = Math.min(1, maximumArtworkEdge / Math.max(bitmap.width, bitmap.height))
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

/** Where a work `height` meters tall lands that hangs nowhere: standing on the floor right in front of the feet of the player, whose `body` is a capsule, facing them, the `index`th of the same import further out than those before, but never through the wall they face, from where it topples over. */
export function atFeet(pose: {
  direction: Vec3
  position: Vec3
}, body: {
  center: Vec3
  radius: number
}, height: number, index = 0) {
  const level = Math.hypot(pose.direction[0], pose.direction[2])
  // Looking straight down, the view has no heading, which the work then takes as north.
  const [dx, dz] = level > 1e-6 ? [pose.direction[0] / level, pose.direction[2] / level] : [0, -1]
  const wall = world.wallDistance(pose.position, [dx, 0, dz]) - 0.45
  const distance = Math.max(body.radius + 0.1, Math.min(body.radius + feetClearance + index * arrivalSpacing, wall))
  const x = body.center[0] + dx * distance
  const z = body.center[2] + dz * distance
  return {
    position: [x, world.placement.floorHeight([x, body.center[1], z]) + height / 2 + 0.02, z] as Vec3,
    rotation: Math.atan2(-dx, -dz),
  }
}

/** An image file decoded for drawing, with its size in pixels. An SVG, which createImageBitmap does not take, decodes into an image element instead, which draws it sharp at any size; in one, it runs no scripts and loads nothing. */
async function decodeImage(file: Blob) {
  if (file.type !== 'image/svg+xml') {
    const bitmap = await createImageBitmap(file)
    return {
      source: bitmap as CanvasImageSource,
      width: bitmap.width,
      height: bitmap.height,
      vector: false,
      close: () => bitmap.close(),
    }
  }
  const url = URL.createObjectURL(file)
  const element = new Image
  element.src = url
  try {
    await element.decode()
  } catch (error) {
    URL.revokeObjectURL(url)
    throw error
  }
  if (!(element.naturalWidth && element.naturalHeight)) {
    URL.revokeObjectURL(url)
    throw new Error('This SVG has no size of its own. Give its root a width and a height.')
  }
  return {
    source: element as CanvasImageSource,
    width: element.naturalWidth,
    height: element.naturalHeight,
    vector: true,
    close: () => URL.revokeObjectURL(url),
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
  /** when the last work’s arrival sounds, in seconds of the world’s clock, which the sound engine’s runs in step with */
  private lastArrival = Number.NEGATIVE_INFINITY
  private queue = Promise.resolve()

  constructor(private readonly onImport: (portrait: Portrait) => void) {}
  dispose() {
    this.disposed = true
  }

  /** Brings in up to 12 images, each hung where `aimed` if it fits there, flipped off that wall if only the square previewing it fit, or else standing at the player’s feet (see {@link atFeet}). Under the pause menu, they go straight into the collection: aiming at nothing in the frozen scene, they wait at the player’s feet, already known to the player, who brought them in. */
  import(files: Array<File>, aimed?: {
    direction: Vec3
    origin: Vec3
  }) {
    const collecting = worldClock.frozen
    const target = collecting ? undefined : aimed
    // Capture the drop location before decoding; walking must not move an in-flight import.
    const pose = {
      position: [...cameraPose.position] as Vec3,
      direction: [...cameraPose.direction] as Vec3,
    }
    const body = {
      center: [...bodyPose.center] as Vec3,
      radius: bodyPose.radius,
    }
    const {room, portraits} = useGallery.getState()
    // What the preview showed as the images were dropped: a square in place of each one’s shape, still unknown then.
    const previewed = target && importPreviewPlacement(target.origin, target.direction, room, portraits)
    this.queue = this.queue.catch(() => {}).then(async () => {
      if (this.disposed) {
        return
      }
      let flips = 0
      let drops = 0
      for (const file of files.slice(0, 12)) {
        try {
          validateImport(file)
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
          // It only flips off its wall where its preview promised it would hang.
          const flip = place && !place.valid && previewed?.valid ? place : null
          if (!place?.valid && !flip) {
            size = dropped
          }
          const p = newPortrait(source, title, size.width, size.height, pose)
          if (collecting) {
            p.interacted = true
          }
          if (place?.valid) {
            Object.assign(p, {
              position: place.position,
              rotation: place.rotation,
              wallId: place.wallId,
              labelAbove: place.labelAbove === true ? true : undefined,
              hung: true,
            })
          } else if (flip) {
            // In its own shape it does not fit where it was aimed, which the square previewing it could not tell: it flips off the wall back into the room as the player’s body bounces off a work it knocked down, its top tipping toward the room, each one after the first further out, clear of the one before.
            const normal = [Math.sin(flip.rotation), Math.cos(flip.rotation)] as const
            const out = flipClearance + flips * arrivalSpacing
            const turn = Math.min(flipSpin, wallRebound.out * 0.8 / (size.height / 2))
            Object.assign(p, {
              position: [flip.position[0] + normal[0] * out, flip.position[1], flip.position[2] + normal[1] * out],
              rotation: flip.rotation,
              velocity: [normal[0] * wallRebound.out, wallRebound.lift, normal[1] * wallRebound.out],
              spin: [normal[1] * turn, 0.6, -normal[0] * turn],
            })
            flips++
          } else {
            Object.assign(p, atFeet(pose, body, size.height, drops))
            drops++
          }
          // Where it hangs or lands decides its frame, which may be another room’s than the player’s, through a doorway.
          p.frame = arrivalFrame(p.position, pose.position, p.id)
          s.add(p)
          if (p.hung) {
            requestHanging(p.id, p.position, p.rotation, holdPoint(pose))
          }
          this.arrive(p.hung)
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
    const now = worldClock.now() / 1000
    const delay = hung ? 0 : Math.max(0, this.lastArrival + arrivalGap - now)
    this.lastArrival = Math.max(this.lastArrival, now + delay)
    const index = this.arrivals++
    playSound(shiftVoices(arrivalVoices(hung, Math.sin(index * 2.39996), hung ? hangingAnimation.impact : undefined), delay), `arrival:${index}`)
  }
}
