import type {PortraitModelSubject} from '#src/lib/gallery/PortraitModel.ts'
import type StudioView from '#src/lib/rendering/studio/StudioView.ts'
import type {KeyboardEvent} from 'react'

import Branch from 'branch-component'
import clsx from 'clsx'
import {useEffect, useRef, useState} from 'react'

import PortraitModel from '#src/lib/gallery/PortraitModel.ts'
import holdStudioView from '#src/lib/rendering/studio/sharedStudioView.ts'

import css from './style.module.sass'

export type PortraitViewerProps = {
  className?: string
  /** shows the model faint, like a work the player hasn’t interacted with yet */
  faint?: boolean
  /** what the model is of, for assistive technology */
  label: string
  portrait: PortraitModelSubject
}

/** how showing the model of a work ended */
type Outcome = PortraitModelSubject & {progress: 'failed' | 'ready'}

/** how far a drag turns the model per pixel, in radians: about a full turn across the stage */
const dragSpeed = 0.008
/** how far an arrow key turns the model, in radians */
const keyStep = Math.PI / 24
/** how far one notch of the wheel, 100 pixels, or one press of + or − moves the camera, as a share of the distance it started at */
const zoomStep = 0.12
type Action = (view: StudioView) => void

const left: Action = view => view.turn(-keyStep, 0)
const right: Action = view => view.turn(keyStep, 0)
const closer: Action = view => view.zoom(-zoomStep)
const away: Action = view => view.zoom(zoomStep)
/** what the keys do to the view, by what they type */
const keys: Partial<Record<string, Action>> = {
  ArrowLeft: left,
  ArrowRight: right,
  ArrowUp: view => view.turn(0, keyStep),
  ArrowDown: view => view.turn(0, -keyStep),
  '+': closer,
  '=': closer,
  '-': away,
  Home: view => view.reset(),
}
/** what the keys that orbit a work in the world while holding V do here too, by where they lie on the keyboard */
const orbitKeys: Partial<Record<string, Action>> = {
  KeyA: left,
  KeyD: right,
  KeyW: closer,
  KeyS: away,
}

/**
 * A work as the object it is in the world, its image in its frame, on a stage of the page’s studio, see `StudioView`: in the studio’s own light instead of its room’s, with nothing around it.
 * Dragging turns it and the wheel moves closer and away, like the arrow keys and + and − do while it has the focus, or A, D, W and S like while holding V in the world; a double click or the Home key turns it back to its front.
 * A faint model fades as a whole: the stage shows nothing but the model, so the canvas takes the opacity instead of every material.
 * A glow behind the stage, reaching a little past it, keeps the outline of a dark frame apart from a dark scene behind the menu.
 */
export default function PortraitViewer({className, faint = false, label, portrait}: PortraitViewerProps) {
  const stage = useRef<HTMLDivElement>(null)
  const studio = useRef<StudioView>(undefined)
  const [outcome, setOutcome] = useState<Outcome>()
  const {frame, height, source, width} = portrait
  // The model of another work is on its way until its own outcome is in.
  const progress = outcome !== undefined && outcome.frame === frame && outcome.height === height && outcome.source === source && outcome.width === width ? outcome.progress : 'loading'
  // The studio’s canvas lives on while this stage is not there, so it moves in and out.
  useEffect(() => {
    const element = stage.current!
    const {release, view} = holdStudioView()
    studio.current = view
    element.prepend(view.canvas)
    const observer = new ResizeObserver(([entry]) => {
      const [{blockSize, inlineSize}] = entry.devicePixelContentBoxSize
      view.resize(inlineSize, blockSize)
    })
    observer.observe(element, {box: 'device-pixel-content-box'})
    // The page behind must not scroll along, which only a listener that isn’t passive can keep it from.
    const wheel = (event: WheelEvent) => {
      event.preventDefault()
      view.zoom(event.deltaY / 100 * zoomStep)
    }
    element.addEventListener('wheel', wheel, {passive: false})
    view.start()
    return () => {
      studio.current = undefined
      observer.disconnect()
      element.removeEventListener('wheel', wheel)
      view.stop()
      view.canvas.remove()
      release()
    }
  }, [])
  // After the effect above, which brings the studio in.
  useEffect(() => {
    const view = studio.current!
    const subject = {
      frame,
      height,
      source,
      width,
    }
    const model = new PortraitModel(subject)
    let current = true
    const settle = (ended: Outcome['progress']) => {
      if (current) {
        setOutcome({
          ...subject,
          progress: ended,
        })
      }
    }
    const shown = model.loaded.then(() => view.show(model.object, model.size)).then(onStage => {
      if (onStage) {
        settle('ready')
      }
    }, (error: unknown) => {
      console.warn('The model of a work could not be shown.', error)
      settle('failed')
    })
    return () => {
      current = false
      view.hide(model.object)
      // Whatever still compiles it has to finish first.
      void shown.finally(() => model.dispose()).catch(() => {})
    }
  }, [frame, height, source, width])
  const handleKey = (event: KeyboardEvent) => {
    const act = keys[event.key] ?? orbitKeys[event.code]
    if (!act || !studio.current || event.ctrlKey || event.metaKey || event.altKey) {
      return
    }
    event.preventDefault()
    act(studio.current)
  }
  return <div className={clsx(css.container, faint && css.faint, className)} data-progress={progress} data-testid='portrait-viewer'>
    <div
      className={css.stage} aria-label={label} aria-roledescription='3D model' role='application' tabIndex={0} ref={stage}
      // Not the browser’s own menu, whose “Save image as…” would hand out the picture of a work that still keeps to itself.
      onContextMenu={event => event.preventDefault()}
      onDoubleClick={() => studio.current?.reset()}
      onKeyDown={handleKey}
      onPointerDown={event => {
        if (event.button === 0) {
          event.currentTarget.setPointerCapture(event.pointerId)
        }
      }}
      onPointerMove={event => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          studio.current?.turn(-event.movementX * dragSpeed, event.movementY * dragSpeed)
        }
      }}
    >
      <Branch if={progress === 'failed'}><p className={css.failure}>This work can’t be shown as a model right now.</p></Branch>
    </div>
    {/* Below the stage, so the model never lies under it however close the camera gets. */}
    <p className={css.hint} aria-hidden='true'>Drag to turn · Scroll to zoom · Double-click to reset</p>
  </div>
}
