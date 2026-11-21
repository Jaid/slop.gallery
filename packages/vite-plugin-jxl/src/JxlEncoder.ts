import {createHash, randomUUID} from 'node:crypto'
import {join} from 'node:path'

import fs from 'fs-extra'
import makeBase64 from 'make-base64'

/** how an image becomes JXL */
export type JxlEncoding = {
  /** Butteraugli distance, from 0 (lossless) to 25 */
  distance: number
  /** cjxl’s effort, from 1 to 11, where 11 is an expert option */
  effort: number
  /** the length in pixels the image’s longer side is scaled down to if it is longer */
  maximumLong?: number
  /** the number of pixels the image is scaled down to if it has more, keeping its aspect ratio */
  maximumPixels?: number
}

export type JxlEncoderOptions = {
  /** cjxl’s executable */
  cjxlPath?: string
  /** where the encoded images are kept, by a hash of their source and encoding */
  folder: string
  /** ImageMagick’s executable, which decodes and scales the sources */
  magickPath?: string
}

// Part of every cache key, so that a change to how images are encoded misses every image encoded before it.
const pipelineVersion = 3
const jpegPattern = /\.jpe?g$/iu
// Everything a JXL file can carry besides the image, its color profile and its orientation, which cjxl takes from the Exif before stripping it.
const stripMetadata = ['-x', 'strip=exif', '-x', 'strip=xmp', '-x', 'strip=jumbf']

/** the size an image of the given size is scaled down to so that it fits the encoding’s limits, or undefined if it fits already */
export const getTargetSize = (width: number, height: number, {maximumLong = Infinity, maximumPixels = Infinity}: Pick<JxlEncoding, 'maximumLong' | 'maximumPixels'>) => {
  const scale = Math.min(maximumLong / Math.max(width, height), Math.sqrt(maximumPixels / (width * height)))
  if (scale >= 1) {
    return
  }
  // Rounded down, so that neither limit is exceeded, with a little leeway for a scale that lands on a whole number.
  return {
    width: Math.max(1, Math.floor(width * scale + 1e-9)),
    height: Math.max(1, Math.floor(height * scale + 1e-9)),
  }
}

/** Encodes images to JXL through ImageMagick and cjxl, once per source and encoding. */
export default class JxlEncoder {
  readonly cjxlPath: string
  readonly folder: string
  readonly magickPath: string
  private readonly pending = new Map<string, Promise<string>>

  constructor(options: JxlEncoderOptions) {
    this.folder = options.folder
    this.cjxlPath = options.cjxlPath ?? 'cjxl'
    this.magickPath = options.magickPath ?? 'magick'
  }

  /** Resolves with the file of the image encoded as JXL, which only gets encoded if the cache does not hold it yet. */
  async encode(file: string, encoding: JxlEncoding) {
    const source = await fs.readFile(file)
    const key = createHash('sha256')
      .update(JSON.stringify({
        pipelineVersion,
        distance: encoding.distance,
        effort: encoding.effort,
        maximumLong: encoding.maximumLong,
        maximumPixels: encoding.maximumPixels,
      }))
      .update(source)
      .digest()
    // The first 48 bits keep cache names short; collisions are unlikely at this scale.
    const output = join(this.folder, `${makeBase64(key).slice(0, 8)}.jxl`)
    let job = this.pending.get(output)
    if (!job) {
      job = this.encodeOnce(file, output, encoding)
      this.pending.set(output, job)
      job.catch(() => this.pending.delete(output))
    }
    return job
  }

  private async encodeOnce(file: string, output: string, encoding: JxlEncoding) {
    if (await fs.pathExists(output)) {
      return output
    }
    await fs.ensureDir(this.folder)
    // Written beside the cache entry first, so that an interrupted encoding never leaves a broken one.
    const partial = `${output}.${randomUUID()}.partial`
    try {
      const result = await this.run(file, partial, encoding)
      if (result.exitCode !== 0 || !Bun.file(partial).size) {
        throw new Error(`Could not encode ${file} as JXL (exit code ${result.exitCode}): ${result.stderr.toString().trim()}`)
      }
      await fs.move(partial, output, {overwrite: true})
    } finally {
      await fs.remove(partial)
    }
    return output
  }

  /** the ImageMagick options that scale the image down to fit the encoding’s limits, none if it fits already */
  private async getResizeOptions(input: string, encoding: JxlEncoding): Promise<Array<string>> {
    if (encoding.maximumLong === undefined && encoding.maximumPixels === undefined) {
      return []
    }
    const identified = await Bun.$`${this.magickPath} identify -ping -format ${'%w %h %z'} ${input}`.nothrow().quiet()
    const [width, height, depth] = identified.stdout.toString().trim().split(' ').map(Number)
    if (identified.exitCode !== 0 || !width || !height) {
      throw new Error(`Could not read the size of ${input}: ${identified.stderr.toString().trim()}`)
    }
    const target = getTargetSize(width, height, encoding)
    if (!target) {
      return []
    }
    // Averaged down in linear light, so that thin highlights and bright edges keep their brightness, with a Lanczos that is sharpened to make up for its softening, like scripts/snap.ts does. The size is the stored one, as the orientation only applies afterwards.
    return ['-depth', '16', '-colorspace', 'RGB', '-filter', 'LanczosSharp', '-distort', 'Resize', `${target.width}x${target.height}!`, '-colorspace', 'sRGB', '-depth', String(depth || 8)]
  }

  private async run(file: string, output: string, encoding: JxlEncoding) {
    const options = ['--effort', String(encoding.effort), '--brotli_effort', '11', ...encoding.effort > 10 ? ['--allow_expert_options'] : [], ...stripMetadata]
    // Only the first frame.
    const input = `${file}[0]`
    const resize = await this.getResizeOptions(input, encoding)
    // cjxl takes a JPEG as it is and keeps its pixels without loss, which beats decoding it. What it would need to restore the JPEG file itself goes, as it holds the stripped metadata.
    if (!resize.length && encoding.distance === 0 && jpegPattern.test(file)) {
      return Bun.$`${this.cjxlPath} ${file} ${options} --lossless_jpeg 1 --allow_jpeg_reconstruction 0 ${output}`.nothrow().quiet()
    }
    // Upright, as an uncompressed PNG, which cjxl reads the quickest.
    return Bun.$`${this.magickPath} ${input} ${resize} -auto-orient -define png:compression-level=0 -define png:compression-filter=0 png:- | ${this.cjxlPath} - ${options} --distance ${encoding.distance} ${output}`.nothrow().quiet()
  }
}
