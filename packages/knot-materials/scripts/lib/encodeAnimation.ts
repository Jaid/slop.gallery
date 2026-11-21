import {join} from 'node:path'

import {av1Crf, av1Preset, av1SvtParams, lossyJxlOptions, webmColorFilter} from 'media-encoding'

import {animationFps, animationFrames} from './renderSettings.ts'

const validateFrameCount = (frameCount: number) => {
  if (!Number.isSafeInteger(frameCount) || frameCount < 1) {
    throw new RangeError('Animation frame count must be a positive safe integer.')
  }
}

export type WebmAnimationOptions = {
  frameCount?: number
}

/** Encode the simple 120-frame inspection loops as animated JPEG XL. */
export async function encodeAnimatedJxl(directory: string, distance: number) {
  if (!Number.isFinite(distance) || distance < 0) {
    throw new RangeError('JPEG XL distance must be a finite non-negative number.')
  }
  // libjxl needs millisecond frame timestamps. Quantize cumulative timestamps
  // so 60 fps alternates 16/17 ms frames and totals exactly two seconds.
  const timing = `settb=1/1000,setpts=round(N*1000/${animationFps})`
  const finalDelay = (Math.round(animationFrames * 1000 / animationFps) - Math.round((animationFrames - 1) * 1000 / animationFps)) / 1000
  const pattern = join(directory, '%03d.png')
  const output = join(directory, 'animation.jxl')
  await Bun.$`ffmpeg -hide_banner -loglevel error -framerate ${animationFps} -start_number 0 -i ${pattern} -frames:v ${animationFrames} -vf ${timing} -enc_time_base 1:1000 -fps_mode passthrough -c:v apng -pix_fmt rgba -plays 0 -final_delay ${finalDelay} -f apng - | cjxl - ${lossyJxlOptions(distance)} ${output}`.quiet()
  return output
}

/** Encode numbered PNG frames directly to AV1/WebM at the shared 60 fps. */
export async function encodeWebm(directory: string, {frameCount = animationFrames}: WebmAnimationOptions = {}) {
  validateFrameCount(frameCount)
  const pattern = join(directory, '%03d.png')
  const output = join(directory, 'animation.webm')
  await Bun.$`ffmpeg -hide_banner -loglevel error -y -framerate ${animationFps} -start_number 0 -i ${pattern} -frames:v ${frameCount} -an -vf ${webmColorFilter} -c:v libsvtav1 -preset ${av1Preset} -crf ${av1Crf} -svtav1-params ${av1SvtParams} -pix_fmt yuv420p -color_range pc -colorspace bt709 -color_primaries bt709 -color_trc iec61966-2-1 -g ${frameCount} ${output}`.quiet()
  return output
}
