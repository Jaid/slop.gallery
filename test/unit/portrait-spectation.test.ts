import type {Portrait, Vec3} from '../../src/lib/gallery/types.ts'

import {afterEach, beforeAll, describe, expect, spyOn, test} from 'bun:test'

import {createElement, Suspense} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
import {GraphicsModeProvider} from 'use-graphics-mode'

import Menu from '#component/Menu'
import PortraitSpectation from '#component/PortraitSpectation'

import {readAiSettings} from '../../src/lib/ai/settings.ts'
import portraitObjects from '../../src/lib/gallery/portraitObjects.ts'
import portraitRoom from '../../src/lib/gallery/portraitRoom.ts'
import {usePortraitSpectation} from '../../src/lib/gallery/portraitSpectation.ts'
import {useGallery} from '../../src/lib/gallery/store.ts'
import pauseMenu from '../../src/lib/pauseMenu.ts'
import slopGallery from '../../src/worlds/gallery/index.ts'
import samplePortraits from './fixtures/portraits.ts'

type PortraitObject = Parameters<typeof portraitObjects.set>[1]

const initial = {...useGallery.getInitialState()}
const [goose, orange] = samplePortraits
/** a point in the middle of the room with the id, a little above its floor */
const inside = (id: Parameters<typeof slopGallery.room>[0]): Vec3 => {
  const room = slopGallery.room(id)
  return [room.center[0], room.floorY + 1, room.center[1]]
}
/** a point no room’s fence holds */
const nowhere: Vec3 = [900, 0, 900]
/** The work as the world shows it right now: at the position, belonging to the room, if any, that the world last had it in. */
const place = (id: string, position: Vec3, room?: string) => {
  const [x, y, z] = position
  portraitObjects.set(id, Object.assign(Object.create(null) as PortraitObject, {
    body: {
      translation: () => ({
        x,
        y,
        z,
      }),
    },
    group: {userData: room === undefined ? {} : {room}},
  }))
}
/** The pause menu’s markup while it is in the stage. Server rendering reads the stores’ initial states. */
const renderMenu = (stage: 'pause' | 'unfocus' = 'pause') => {
  const snapshot = spyOn(pauseMenu, 'getServerSnapshot').mockReturnValue({
    stage,
    locked: false,
  })
  try {
    return renderToStaticMarkup(createElement(GraphicsModeProvider, {
      isHeavy: true,
      onChange: () => {},
      children: createElement(Menu, {
        available: true,
        params: readAiSettings(),
        setParams: () => {},
      }),
    }))
  } finally {
    snapshot.mockRestore()
  }
}
const renderSpectation = (portrait: Portrait) => renderToStaticMarkup(createElement(PortraitSpectation, {portrait}))
/** The text of the element with the test id. */
const textOf = (html: string, testId: string) => {
  const pattern = new RegExp(`data-testid="${testId}"[^>]*>([^<]*)<`, 'u')
  return pattern.exec(html)?.[1]
}
/** The classes of the stage a work’s model stands on. */
const stageClasses = (html: string) => /class="([^"]*)"[^>]*data-testid="portrait-viewer"/u.exec(html)![1].split(' ')
beforeAll(async () => {
  // The world’s minimap loads lazily: rendering it once starts the download, so the pause stage below renders it in place.
  renderToStaticMarkup(createElement(Suspense, null, createElement(slopGallery.Minimap, {lower: false})))
  await import('#component/GalleryMinimap')
})
afterEach(() => {
  Object.assign(useGallery.getInitialState(), initial)
  Object.assign(usePortraitSpectation.getInitialState(), {id: null})
  usePortraitSpectation.setState({id: null})
  portraitObjects.clear()
})
describe('which work the pause menu shows up close', () => {
  test('a click shows a work, a click on another one shows that one, and a click on the one shown puts the view away', () => {
    const {toggle} = usePortraitSpectation.getState()
    expect(usePortraitSpectation.getState().id).toBeNull()
    toggle('goose')
    expect(usePortraitSpectation.getState().id).toBe('goose')
    toggle('orange')
    expect(usePortraitSpectation.getState().id).toBe('orange')
    toggle('orange')
    expect(usePortraitSpectation.getState().id).toBeNull()
    toggle('goose')
    usePortraitSpectation.getState().close()
    expect(usePortraitSpectation.getState().id).toBeNull()
  })
  test('going on playing puts the view away, so the next pause starts with the map', () => {
    const snapshot = spyOn(pauseMenu, 'getSnapshot')
    // The menu tells whoever follows it; nothing else of it is in reach of a test.
    const publish = (locked: boolean) => {
      snapshot.mockReturnValue({
        stage: 'pause',
        locked,
      })
      for (const listener of (pauseMenu as unknown as {listeners: Set<() => void>}).listeners) {
        listener()
      }
    }
    try {
      usePortraitSpectation.getState().toggle('goose')
      // Anything else the menu tells, like the stage it is in, keeps the view.
      publish(false)
      expect(usePortraitSpectation.getState().id).toBe('goose')
      publish(true)
      expect(usePortraitSpectation.getState().id).toBeNull()
    } finally {
      snapshot.mockRestore()
    }
  })
})
describe('the pause menu with a work up close', () => {
  test('shows the work in place of its map and its middle, beside the collection', () => {
    Object.assign(useGallery.getInitialState(), {
      ready: true,
      portraits: [{
        ...goose,
        interacted: true,
      }, orange],
    })
    const map = renderMenu()
    expect(map).toContain('data-testid="minimap"')
    expect(map).toContain('id="enter-gallery"')
    expect(map).not.toContain('data-testid="portrait-spectation"')
    Object.assign(usePortraitSpectation.getInitialState(), {id: goose.id})
    const html = renderMenu()
    expect(html).toMatch(/<article\b[^>]*data-portrait="goose"[^>]*data-testid="portrait-spectation"/u)
    expect(html).toContain('data-testid="portrait-viewer"')
    expect(html).not.toContain('data-testid="minimap"')
    expect(html).not.toContain('id="enter-gallery"')
    expect(html).not.toContain('Mute audio')
    expect(html).not.toContain('OpenRouter')
    // The menu is named after the work now, by the one heading it has.
    expect(html).toContain('aria-labelledby="menu-title"')
    expect(html.match(/id="menu-title"/gu)).toHaveLength(1)
    expect(html).toContain(`<h1 id="menu-title">${goose.title}</h1>`)
    // The collection stays where it was, after the view, with the work marked.
    expect(html.indexOf('data-testid="portrait-spectation"')).toBeLessThan(html.indexOf('data-testid="portrait-collection"'))
    expect(html).toMatch(/<button\b[^>]*aria-pressed="true"[^>]*data-portrait="goose"/u)
    expect(html).toMatch(/<button\b[^>]*aria-pressed="false"[^>]*data-portrait="orange"/u)
  })
  test('gives the map back once the work has left the world, like one a fusion used up', () => {
    Object.assign(useGallery.getInitialState(), {portraits: [orange]})
    Object.assign(usePortraitSpectation.getInitialState(), {id: goose.id})
    const html = renderMenu()
    expect(html).not.toContain('data-testid="portrait-spectation"')
    expect(html).toContain('data-testid="minimap"')
    expect(html).toContain('id="enter-gallery"')
  })
  test('the menu of a lost focus shows no work up close, like it shows no collection', () => {
    Object.assign(useGallery.getInitialState(), {portraits: [goose]})
    Object.assign(usePortraitSpectation.getInitialState(), {id: goose.id})
    const html = renderMenu('unfocus')
    expect(html).not.toContain('data-testid="portrait-spectation"')
    expect(html).not.toContain('data-testid="portrait-collection"')
    expect(html).toContain('id="enter-gallery"')
  })
  test('a work shown up close has no tooltip, which would tell the same beside it', () => {
    const known = {
      ...goose,
      interacted: true,
    }
    Object.assign(useGallery.getInitialState(), {portraits: [known]})
    expect(renderMenu()).toMatch(/<button\b[^>]*data-portrait="goose"[^>]*interestfor=/u)
    Object.assign(usePortraitSpectation.getInitialState(), {id: goose.id})
    const html = renderMenu()
    expect(html).not.toContain('interestfor=')
    expect(html).not.toContain('data-testid="portrait-tooltip"')
  })
})
describe('a work up close', () => {
  test('tells its title, description, creator, year and room once the player has interacted with it', () => {
    const html = renderSpectation({
      ...goose,
      interacted: true,
      year: 1924,
    })
    expect(html).toContain('data-interacted="true"')
    expect(html).toContain(`<h1 id="menu-title">${goose.title}</h1>`)
    expect(html).toContain(goose.description)
    expect(html).toContain(`<dt>Creator</dt><dd>${goose.creator}</dd>`)
    expect(html).toContain('<dt>Year</dt><dd>1924</dd>')
    expect(textOf(html, 'portrait-room')).toBe('Lobby')
    // Its model stands above all of that, named after it, at full strength.
    expect(html.indexOf('data-testid="portrait-viewer"')).toBeLessThan(html.indexOf('id="menu-title"'))
    expect(html).toContain(`aria-label="“${goose.title}” in its frame"`)
    expect(html).toContain('aria-label="Back to the map"')
  })
  test('tells a missing year apart from year zero', () => {
    const known = {
      ...goose,
      interacted: true,
    }
    expect(renderSpectation(known)).toContain('<dt>Year</dt><dd>Undated</dd>')
    expect(renderSpectation({
      ...known,
      year: 0,
    })).toContain('<dt>Year</dt><dd>0</dd>')
  })
  test('a work the player hasn’t interacted with yet shows faint and keeps everything but its room to itself', () => {
    const known = renderSpectation({
      ...goose,
      interacted: true,
    })
    const html = renderSpectation(goose)
    expect(html).toContain('data-interacted="false"')
    expect(html).toContain('<h1 id="menu-title">Untouched work</h1>')
    expect(html).toContain('aria-label="An untouched work in its frame"')
    for (const secret of [goose.title, goose.description, goose.creator, 'Creator', 'Year', 'Undated']) {
      expect(html).not.toContain(secret)
    }
    expect(textOf(html, 'portrait-room')).toBe('Lobby')
    // Only the untouched work’s stage carries the class that fades its model.
    expect(stageClasses(html)).toHaveLength(stageClasses(known).length + 1)
    expect(stageClasses(known).every(name => stageClasses(html).includes(name))).toBe(true)
  })
})
describe('the room a work is in', () => {
  test('a hung work is in the room of its wall, whatever fence its position lies in', () => {
    expect(portraitRoom(goose)?.id).toBe('lobby')
    // Hung on a wall of the Lobby right where another room’s fence begins.
    expect(portraitRoom({
      ...goose,
      position: inside('sienna'),
    })?.id).toBe('lobby')
    expect(slopGallery.portraitRoom(goose, nowhere)?.id).toBe('lobby')
  })
  test('a loose work is in the room around it, where its body is right now rather than where it last came to rest', () => {
    const loose = {
      ...goose,
      hung: false,
      wallId: undefined,
      position: inside('lobby'),
    }
    expect(portraitRoom(loose)?.id).toBe('lobby')
    // Thrown into the Sienna, still flying.
    place(loose.id, inside('sienna'))
    expect(portraitRoom(loose)?.id).toBe('sienna')
    // A wall it once hung on says nothing about where it lies.
    expect(portraitRoom({
      ...loose,
      wallId: 'lobby-north',
    })?.id).toBe('sienna')
    // Down on the lower floor.
    place(loose.id, inside('oculus'))
    expect(portraitRoom(loose)?.title).toBe('Oculus')
  })
  test('a loose work between rooms stays with the room the world last had it in, or with none', () => {
    const loose = {
      ...goose,
      hung: false,
      wallId: undefined,
      position: nowhere,
    }
    expect(slopGallery.roomAt(nowhere)).toBeUndefined()
    expect(portraitRoom(loose)).toBeUndefined()
    place(loose.id, nowhere, 'vesper')
    expect(portraitRoom(loose)?.id).toBe('vesper')
    // A room of another world, or anything else that names no room here, counts as none.
    place(loose.id, nowhere, 'arena')
    expect(portraitRoom(loose)).toBeUndefined()
    expect(renderSpectation(loose)).toContain('>Between rooms<')
  })
})
