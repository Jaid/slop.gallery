import type {Subprocess} from 'bun'
import {extname} from 'node:path'

import getFree from 'get-free'
import {av1Preset, av1SvtParams, webmColorFilter} from 'knot-materials/scripts/lib/encodeAnimation.ts'
import {lossyJxlOptions} from 'knot-materials/scripts/lib/encodeJxl.ts'

export const frameFormats = ['jxl', 'webm', 'mkv', 'png'] as const
export type FrameFormat = typeof frameFormats[number]
/** sound to go with the frames: interleaved 32-bit float samples of every channel, frame by frame, like a `VirtualAudioRecording` */
export type AudioTrack = {
  channels: number
  sampleRate: number
  samples: Float32Array
}
export type FrameSinkOptions = {
  /** whether `finish` will be handed an {@link AudioTrack}: WebM and Matroska carry it as Opus, the other formats get an Opus file of their own beside them (see {@link audioSidecar}) */
  audio?: boolean
  crf: number
  fps: number
  frameCount: number
  height: number
  jxlDistance: number
  output: string
  /** the size of the incoming frames when it differs from the output’s, like a canvas rendered at a higher scale; they get downsampled */
  source?: {
    height: number
    width: number
  }
  width: number
}
/** Receives tightly packed, top-to-bottom RGBA8 frames in order. */
export type FrameSink = {
  abort: () => void
  /** Ends the frames and writes everything out, with the sound if given. */
  finish: (audio?: AudioTrack) => Promise<void>
  write: (pixels: Uint8Array) => Promise<void>
}
export const frameFormat = (output: string) => {
  const format = extname(output).slice(1).toLowerCase()
  if (!frameFormats.includes(format as FrameFormat)) {
    throw new Error(`--output-file must end with one of: ${frameFormats.map(extension => `.${extension}`).join(', ')}.`)
  }
  return format as FrameFormat
}
/** whether the format holds sound along with its frames */
export const carriesAudio = (format: FrameFormat) => format === 'webm' || format === 'mkv'
/** where the sound of an output in a format that can’t hold it goes: an Opus file of the same name */
export const audioSidecar = (output: string) => `${output.slice(0, -extname(output).length)}.opus`
const rawInput = ({width, height, source}: FrameSinkOptions) => ['-f', 'rawvideo', '-pix_fmt', 'rgba', '-video_size', `${source?.width ?? width}x${source?.height ?? height}`]
const rawAudioInput = ({channels, sampleRate}: AudioTrack) => ['-f', 'f32le', '-ar', String(sampleRate), '-ac', String(channels), '-i', '-']
// Opus always runs at 48 kHz.
const opusOutput = ['-c:a', 'libopus', '-b:a', '160000', '-vbr', 'on', '-compression_level', '10', '-application', 'audio', '-ar', '48000']
// Lanczos in linear light, so thin highlights and bright edges keep their brightness instead of averaging darker in sRGB. The frames leave untagged like they came in, since cjxl rejects an APNG that carries the transfer tag.
const downsample = ({width, height, source}: FrameSinkOptions) => {
  if (!source || source.width === width && source.height === height) {
    return []
  }
  return [`zscale=tin=iec61966-2-1:t=linear,format=gbrpf32le,zscale=w=${width}:h=${height}:f=lanczos,zscale=tin=linear:t=iec61966-2-1,setparams=color_trc=unknown`]
}
const filters = (options: FrameSinkOptions, ...after: Array<string>) => {
  const chain = [...downsample(options), ...after]
  return chain.length ? ['-vf', chain.join(',')] : []
}
const ffmpeg = ['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y']
// SVT-AV1 prints its configuration banner regardless of ffmpeg’s log level.
const quietEnvironment = {
  ...process.env,
  SVT_LOG: '1',
}
const expectSuccess = async (process: Subprocess, name: string) => {
  const exitCode = await process.exited
  if (exitCode !== 0) {
    throw new Error(`${name} exited with code ${exitCode}.`)
  }
}
/** Runs ffmpeg with the track’s samples on stdin, which `args` read as the input `-` (see {@link rawAudioInput}). */
const encodeAudio = async (track: AudioTrack, args: Array<string>) => {
  const process = Bun.spawn([...ffmpeg, ...args], {
    stdin: new Uint8Array(track.samples.buffer, track.samples.byteOffset, track.samples.byteLength),
    stderr: 'inherit',
  })
  await expectSuccess(process, 'ffmpeg')
}
/** Writes the track to `output` as Opus. */
export const writeOpus = (track: AudioTrack, output: string) => encodeAudio(track, [...rawAudioInput(track), ...opusOutput, output])
const pipeSink = (processes: Array<[Subprocess<'pipe'>, string]>) => {
  const [[input]] = processes
  return {
    write: async (pixels: Uint8Array) => {
      await input.stdin.write(pixels)
      await input.stdin.flush()
    },
    finish: async () => {
      await input.stdin.end()
      await Promise.all(processes.map(([process, name]) => expectSuccess(process, name)))
    },
    abort: () => {
      for (const [process] of processes) {
        process.kill()
      }
    },
  }
}
/** A sink that writes its frames without sound and its sound, if it gets any, as an Opus file beside them. */
const withSidecar = (sink: ReturnType<typeof pipeSink>, {output}: FrameSinkOptions): FrameSink => ({
  ...sink,
  finish: async audio => {
    await sink.finish()
    if (audio) {
      await writeOpus(audio, audioSidecar(output))
    }
  },
})
/**
 * AV1 in WebM or Matroska, tagged like the knot inspection videos.
 * With sound, which only comes at the end, the frames go into a file beside the output first, which the sound is muxed with.
 */
const av1Sink = (options: FrameSinkOptions): FrameSink => {
  const {output} = options
  const extension = extname(output)
  const video = options.audio ? `${output.slice(0, -extension.length)}.video${extension}` : output
  const sink = pipeSink([[Bun.spawn([...ffmpeg, ...rawInput(options), '-framerate', String(options.fps), '-i', '-', '-an', ...filters(options, webmColorFilter), '-c:v', 'libsvtav1', '-preset', String(av1Preset), '-crf', String(options.crf), '-svtav1-params', av1SvtParams, '-pix_fmt', 'yuv420p', '-color_range', 'pc', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'iec61966-2-1', video], {
    stdin: 'pipe',
    stderr: 'inherit',
    env: quietEnvironment,
  }), 'ffmpeg']])
  return {
    ...sink,
    finish: async audio => {
      await sink.finish()
      if (video === output) {
        return
      }
      try {
        if (audio) {
          await encodeAudio(audio, ['-i', video, ...rawAudioInput(audio), '-map', '0:v', '-map', '1:a', '-c:v', 'copy', ...opusOutput, output])
        } else {
          await Bun.write(output, Bun.file(video))
        }
      } finally {
        await Bun.file(video).delete()
      }
    },
    abort: () => {
      sink.abort()
      if (video !== output) {
        Bun.file(video).delete().catch(() => {})
      }
    },
  }
}
/** Animated JPEG XL through an APNG pipe, like the knot preview loops. */
const jxlSink = (options: FrameSinkOptions): FrameSink => {
  const {fps, frameCount} = options
  // libjxl needs millisecond frame timestamps. Quantized cumulative timestamps keep the total duration exact.
  const timing = `settb=1/1000,setpts=round(N*1000/${fps})`
  const finalDelay = (Math.round(frameCount * 1000 / fps) - Math.round((frameCount - 1) * 1000 / fps)) / 1000
  const apng = Bun.spawn([...ffmpeg, ...rawInput(options), '-framerate', String(fps), '-i', '-', ...filters(options, timing), '-enc_time_base', '1:1000', '-fps_mode', 'passthrough', '-c:v', 'apng', '-pix_fmt', 'rgb24', '-plays', '0', '-final_delay', String(finalDelay), '-f', 'apng', '-'], {
    stdin: 'pipe',
    stdout: 'pipe',
    stderr: 'inherit',
  })
  const cjxl = Bun.spawn(['cjxl', '-', ...lossyJxlOptions(options.jxlDistance), options.output], {
    stdin: apng.stdout,
    stdout: 'ignore',
    stderr: 'pipe',
  })
  const sink = pipeSink([[apng, 'ffmpeg']])
  return withSidecar({
    ...sink,
    finish: async () => {
      await sink.finish()
      const exitCode = await cjxl.exited
      if (exitCode !== 0) {
        const stderr = new Response(cjxl.stderr)
        const details = await stderr.text()
        throw new Error(`cjxl exited with code ${exitCode}: ${details}`)
      }
    },
    abort: () => {
      sink.abort()
      cjxl.kill()
    },
  }, options)
}
/** One PNG per frame. Each takes the next free name after the given path: shot.png becomes shot_001.png, shot_002.png, … */
const pngSink = (options: FrameSinkOptions): FrameSink => {
  const base = options.output.slice(0, -'.png'.length)
  const pad = String(options.frameCount).length
  let current: Subprocess | undefined
  return withSidecar({
    write: async pixels => {
      const name = await getFree(base, async candidate => Bun.file(`${candidate}.png`).exists(), {
        consistent: true,
        pad,
      })
      current = Bun.spawn([...ffmpeg, ...rawInput(options), '-i', '-', ...filters(options), '-frames:v', '1', '-pix_fmt', 'rgb24', `${name}.png`], {
        stdin: pixels,
        stderr: 'inherit',
      })
      await expectSuccess(current, 'ffmpeg')
    },
    finish: async () => {},
    abort: () => current?.kill(),
  }, options)
}
export const createFrameSink = (format: FrameFormat, options: FrameSinkOptions): FrameSink => {
  switch (format) {
    case 'jxl': { return jxlSink(options) }
    case 'webm':
    case 'mkv': { return av1Sink(options) }
    case 'png': { return pngSink(options) }
  }
}
