import type {EncodedImageType} from '../reencodeImage.ts'
import type {Portrait} from './types.ts'

import {modelImageType, toWebp} from '../ai/modelImage.ts'
import downloadBlob from '../downloadBlob.ts'
import reencodeImage from '../reencodeImage.ts'
import {loadBlob} from './actions.ts'

/** the formats a work’s image leaves the gallery in */
export type PortraitImageFormat = 'png' | 'webp'
/** how a work’s image is encoded anew */
export type PortraitImageEncoder = (image: Blob) => Promise<Blob>
type FormatDescription = {
  encode: PortraitImageEncoder
  type: EncodedImageType
}

const formats: Record<PortraitImageFormat, FormatDescription> = {
  png: {
    type: 'image/png',
    encode: image => reencodeImage(image, 'image/png'),
  },
  // lossy, like the WebP a fusion’s result is shared as, since PNG is the lossless choice
  webp: {
    type: 'image/webp',
    encode: toWebp,
  },
}
/** what file names may not contain on one system or another: control characters and the characters Windows reserves */
const forbiddenCharacters = /[\p{Cc}"*/:<>?\\|]+/gu
/** the longest name before the extension, in characters, which leaves every file system room for the extension */
const maximumNameLength = 120
const graphemes = new Intl.Segmenter(undefined, {granularity: 'grapheme'})
/** A name without the dots and spaces at its end, which Windows takes none of. */
const withoutTrailingDots = (name: string) => name.replace(/[\s.]+$/u, '')

/** The file name a work’s image is saved under: its title without anything file names may not contain, or “Untitled” if nothing is left of it, with the format as its extension. */
export function portraitFileName({title}: Pick<Portrait, 'title'>, format: PortraitImageFormat) {
  const name = withoutTrailingDots(Array.from(graphemes.segment(withoutTrailingDots(title.normalize('NFC').replaceAll(forbiddenCharacters, ' ').replaceAll(/\s+/gu, ' ').trim())), ({segment}) => segment).slice(0, maximumNameLength).join(''))
  return `${name || 'Untitled'}.${format}`
}

/**
 * A work’s image, without its frame, as a file of the format: the image as the gallery keeps it where it already is one, so nothing is lost by encoding it again, and encoded anew from it otherwise, like the JXL of a default work.
 * Media types can’t be trusted to tell, so the file’s signature does.
 * @param encode how to encode it anew, by the browser by default
 */
export async function portraitImage({source}: Pick<Portrait, 'source'>, format: PortraitImageFormat, encode: PortraitImageEncoder = formats[format].encode): Promise<Blob> {
  const {type} = formats[format]
  const image = await loadBlob(source)
  if (modelImageType(await image.slice(0, 12).bytes()) === type) {
    return image.type === type ? image : new Blob([image], {type})
  }
  return encode(image)
}

/** Saves a work’s image as a download of the format, named after the work, and resolves with the file’s name. */
export async function exportPortrait(portrait: Pick<Portrait, 'source' | 'title'>, format: PortraitImageFormat) {
  const fileName = portraitFileName(portrait, format)
  downloadBlob(await portraitImage(portrait, format), fileName)
  return fileName
}

/**
 * Puts a work’s image on the clipboard as a PNG, the one image format every application pastes.
 * Call it right from the player’s click: the clipboard takes the image as a promise, so the click still counts by the time the image is encoded.
 */
export async function copyPortrait(portrait: Pick<Portrait, 'source'>) {
  await navigator.clipboard.write([new ClipboardItem({'image/png': portraitImage(portrait, 'png')})])
}
