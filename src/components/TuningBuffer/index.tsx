import {useEffect, useRef} from 'react'

import {useTuningBuffer} from '#src/lib/worldTuning/tuningBuffer.ts'

import css from './style.module.sass'

/** The frame from before the latest world tuning tweak, over the live view while Space is held over the world tuning panel. */
export default function TuningBuffer() {
  const frame = useTuningBuffer(state => state.frame)
  const showing = useTuningBuffer(state => state.showing)
  const canvas = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    if (!canvas.current || !frame) {
      return
    }
    canvas.current.width = frame.width
    canvas.current.height = frame.height
    canvas.current.getContext('2d')!.putImageData(new ImageData(frame.pixels, frame.width, frame.height), 0, 0)
  }, [frame])
  return <canvas className={css.buffer} aria-hidden hidden={!showing || !frame} ref={canvas} />
}
