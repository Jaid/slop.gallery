import type {PortraitModelSubject} from '#src/lib/gallery/PortraitModel.ts'
import type {Portrait} from '#src/lib/gallery/types.ts'
import type StudioView from '#src/lib/rendering/studio/StudioView.ts'
import type {StagingOutcome} from './stagePortrait.ts'
import type {KeyboardEvent} from 'react'

import Branch from 'branch-component'
import clsx from 'clsx'
import {useEffect, useRef, useState} from 'react'

import {usePortraitFrame} from '#src/frames/index.ts'
import holdStudioView from '#src/lib/rendering/studio/sharedStudioView.ts'

import stagePortrait from './stagePortrait.ts'

import css from './style.module.sass'

export type PortraitViewerProps = {
  className?: string
  /** shows the model faint, like a work the player hasn’t interacted with yet */
  faint?: boolean
  /** what the model is of, for assistive technology */
  label: string
  portrait: Pick<Portrait, keyof PortraitModelSubject>
}

/** how showing the model of a work ended */
type Outcome = PortraitModelSubject & {progress: StagingOutcome}

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
 * The studio’s canvas covers the whole screen, above everything else, and lets the pointer through: the model stands on the stage as if the canvas were only as large as the stage, but whatever of it reaches past the stage, turned or close up, shows over the rest of the page.
 * A faint model fades as a whole: the canvas shows nothing but the model, so it takes the opacity instead of every material.
 * A glow behind the stage, reaching a little past it, keeps the outline of a dark frame apart from a dark scene behind the menu.
 */
export default function PortraitViewer({className, faint = false, label, portrait}: PortraitViewerProps) {
  const stage = useRef<HTMLDivElement>(null)
  const layer = useRef<HTMLDivElement>(null)
  const studio = useRef<StudioView>(undefined)
  const [outcome, setOutcome] = useState<Outcome>()
  const {canvasMaterial, height, source, width} = portrait
  const frame = usePortraitFrame(portrait.frame)
  // The model of another work is on its way until its own outcome is in.
  const progress = outcome !== undefined && outcome.canvasMaterial === canvasMaterial && outcome.frame === frame && outcome.height === height && outcome.source === source && outcome.width === width ? outcome.progress : 'loading'
  // The studio’s canvas lives on while this stage is not there, so it moves in and out.
  useEffect(() => {
    const element = stage.current!
    const overlay = layer.current!
    const {release, view} = holdStudioView()
    const {canvas} = view
    studio.current = view
    overlay.append(canvas)
    overlay.showPopover()
    const observer = new ResizeObserver(([entry]) => {
      const [{blockSize, inlineSize}] = entry.devicePixelContentBoxSize
      view.resize(inlineSize, blockSize)
    })
    observer.observe(canvas, {box: 'device-pixel-content-box'})
    // The stage moves with the menu’s layout and its scrolling, which nothing tells of at once, so the canvas looks it up every frame, before anything is drawn.
    let following = 0
    const follow = () => {
      following = requestAnimationFrame(follow)
      const bounds = canvas.getBoundingClientRect()
      const area = element.getBoundingClientRect()
      view.place({
        x: (area.x - bounds.x) / bounds.width,
        y: (area.y - bounds.y) / bounds.height,
        width: area.width / bounds.width,
        height: area.height / bounds.height,
      })
    }
    follow()
    // The page behind must not scroll along, which only a listener that isn’t passive can keep it from.
    const wheel = (event: WheelEvent) => {
      event.preventDefault()
      view.zoom(event.deltaY / 100 * zoomStep)
    }
    element.addEventListener('wheel', wheel, {passive: false})
    view.start()
    return () => {
      studio.current = undefined
      cancelAnimationFrame(following)
      observer.disconnect()
      element.removeEventListener('wheel', wheel)
      view.stop()
      canvas.remove()
      overlay.hidePopover()
      release()
    }
  }, [])
  // After the effect above, which brings the studio in.
  useEffect(() => {
    const subject = {
      canvasMaterial,
      frame,
      height,
      source,
      width,
    }
    return stagePortrait(studio.current!, subject, ended => setOutcome({
      ...subject,
      progress: ended,
    }))
  }, [canvasMaterial, frame, height, source, width])
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
    {/* The studio’s canvas, over the whole screen in the top layer. */}
    <div className={css.layer} aria-hidden='true' popover='manual' ref={layer} />
  </div>
}
