import type {Portrait} from '#src/lib/gallery.ts'
import type {ComponentProps} from 'react'
import type {WebgpuRendererOptions} from 'three-fiber-game'

import {Canvas} from '@react-three/fiber'
import Branch from 'branch-component'
import clsx from 'clsx'
import {useEffect, useRef, useState} from 'react'
import {WebgpuRenderer} from 'three-fiber-game'
import {ACESFilmicToneMapping} from 'three/webgpu'

import Icon from '#component/Icon'
import {isTextInput, useGallery} from '#src/lib/gallery.ts'
import {portraitRoom} from '#src/lib/gallery/portraitRoom.ts'
import {studioEnvironment} from '#src/lib/materials/metal.ts'
import {snapshotFov} from '#src/lib/rendering/studioSnapshot.ts'
import world from '#src/worlds/current.ts'

import SpectationStudio from './Studio.tsx'

import css from './style.module.sass'

export type PortraitSpectationProps = {
  /** Called once the player asks to go back to the pause menu, by its button or by the Escape key; stop rendering the view then. */
  onClose: () => void
  portrait: Portrait
  /** the id the heading carries, so the menu around the view can name itself after it while the view stands in for its own heading */
  titleId?: string
}
type StudioRenderer = {dispose: () => Promise<void>}

/** The spectation view’s renderer of its own: the world’s canvas stands frozen under the Escape key’s pause menu, so this one has to draw the orbit itself, clear over the studio behind it. */
const createStudioRenderer = (options: WebgpuRendererOptions) => new WebgpuRenderer({
  ...options,
  alpha: true,
  antialias: true,
})

/**
 * A work of the collection close up, in place of the pause menu’s map and main columns: above, the work itself as a 3D object in a generic studio on a canvas of its own, which the player orbits by dragging and zooms by scrolling; below, its title, flavor text, creator, year and the room it is currently in.
 * A work the player hasn’t interacted with yet shows the same, only its model stays faint: its canvas, which holds nothing else, is transparent but for the model and is simply shown at reduced opacity over the studio’s backdrop.
 */
export default function PortraitSpectation({onClose, portrait: p, titleId}: PortraitSpectationProps) {
  const heading = useRef<HTMLHeadingElement>(null)
  const renderer = useRef<StudioRenderer>(null)
  const [ready, setReady] = useState(false)
  const [view, setView] = useState(0)
  const held = useGallery(state => state.held === p.id)
  const playerRoom = useGallery(state => state.room)
  const known = Boolean(p.interacted)
  // A work in the player’s hands is wherever the player is, which its body, hanging disabled where it was taken from, no longer tells.
  const room = portraitRoom(p) ?? (held ? world.roomById(playerRoom) : undefined)
  useEffect(() => {
    heading.current?.focus({preventScroll: true})
  }, [p.id])
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      // A menu still open over the view takes the key for itself first; a tooltip hint just closes along with the view.
      if (event.key !== 'Escape' || event.defaultPrevented || isTextInput(event.target) || document.querySelector('[popover="auto"]:popover-open')) {
        return
      }
      event.preventDefault()
      onClose()
    }
    globalThis.addEventListener('keydown', closeOnEscape)
    return () => globalThis.removeEventListener('keydown', closeOnEscape)
  }, [onClose])
  // The canvas’ own renderer and its GPU device go with the view; Fiber stopping its loop leaves both behind.
  useEffect(() => () => {
    renderer.current?.dispose().catch(() => {})
  }, [])
  return <section className={css.container} aria-labelledby={titleId} data-interacted={known} data-portrait={p.id} data-testid='portrait-spectation'>
    <div className={css.stage}>
      <div className={clsx(css.canvas, !known && css.faded)} data-faded={!known} data-testid='portrait-spectation-canvas'>
        <Canvas
          camera={{
            fov: snapshotFov,
            position: [0, 0, 4],
          }} frameloop='always' renderer={createStudioRenderer as ComponentProps<typeof Canvas>['renderer']} onCreated={state => {
            renderer.current = state.renderer
            state.renderer.toneMapping = ACESFilmicToneMapping
            state.renderer.setClearColor(0, 0)
            // The softly lit studio its surfaces mirror, like the gallery’s other metalwork.
            state.scene.environment = studioEnvironment
            setReady(true)
          }}
        ><SpectationStudio portrait={p} view={view} /></Canvas>
      </div>
      <Branch not={ready}><p className={css.loading}>Preparing the studio…</p></Branch>
      <button className={clsx(css.stageButton, css.back)} type='button' onClick={onClose}><Icon name='back' size={16} /><span>Back</span></button>
      <button className={clsx(css.stageButton, css.reset)} type='button' onClick={() => setView(current => current + 1)}>Reset view</button>
      <p className={css.hint}>Drag to orbit · Scroll to zoom</p>
    </div>
    <div className={css.details}>
      <p className={css.status}>{known ? 'Interacted with' : 'Not interacted with yet'}</p>
      <h1 id={titleId} className={css.title} tabIndex={-1} ref={heading}>{p.title}</h1>
      <Branch if={p.description} else={<p className={clsx(css.description, css.missing)}>No flavor text yet.</p>}><p className={css.description}>{p.description}</p></Branch>
      <dl className={css.facts}>
        <div><dt>Creator</dt><dd>{p.creator}</dd></div>
        <div><dt>Year</dt><dd>{p.year ?? 'Undated'}</dd></div>
        <div><dt>Current room</dt><dd data-testid='portrait-spectation-room'>{room?.title ?? 'Between rooms'}</dd></div>
      </dl>
    </div>
  </section>
}
