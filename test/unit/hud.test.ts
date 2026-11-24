import {afterAll, describe, expect, test} from 'bun:test'

import {createElement} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
import {BoxGeometry, Group, Mesh, MeshBasicMaterial, PlaneGeometry, Raycaster, Vector3} from 'three/webgpu'

import ArtworkOverlay from '#component/ArtworkOverlay'
import {lingerBarScale} from '#component/NarrationBars'
import NarrationIndicator, {NarrationIndicatorStack} from '#component/NarrationIndicator'

import portraitLabel, {isPortraitLabelHit, portraitLabelLayout} from '../../src/lib/gallery/portraitLabel.ts'
import samplePortraits from './fixtures/portraits.ts'

describe('title plate targeting', () => {
  const layout = portraitLabelLayout(2, 2)
  const portrait = new Group
  const label = new Group
  label.userData.portraitLabel = true
  label.position.y = layout.y
  const material = new MeshBasicMaterial
  const frame = new Mesh(new BoxGeometry(2.18, 2.18, 0.16), material)
  const backing = new Mesh(new BoxGeometry(layout.width, portraitLabel.height, portraitLabel.depth), material)
  const text = new Mesh(new PlaneGeometry(layout.titleWidth, 0.135), material)
  text.position.set(0, 0.047, 0.026)
  label.add(backing, text)
  portrait.add(frame, label)
  portrait.updateMatrixWorld(true)
  afterAll(() => {
    for (const mesh of [frame, backing, text]) {
      mesh.geometry.dispose()
    }
    material.dispose()
  })
  const target = (x: number, y: number) => {
    const ray = new Raycaster(new Vector3(x, y, 2), new Vector3(0, 0, -1), 0, 9)
    return ray.intersectObject(portrait, true)[0]
  }
  test('aiming at either lettering or the plate backing identifies the plate', () => {
    const lettering = target(0, layout.y + 0.047)
    expect(lettering.object).toBe(text)
    expect(isPortraitLabelHit(lettering.object, portrait)).toBe(true)
    const plate = target(layout.width / 2 - 0.01, layout.y - 0.12)
    expect(plate.object).toBe(backing)
    expect(isPortraitLabelHit(plate.object, portrait)).toBe(true)
  })
  test('the image, frame and empty space do not identify a title plate', () => {
    expect(isPortraitLabelHit(target(0, 0).object, portrait)).toBe(false)
    expect(isPortraitLabelHit(target(1.07, 0).object, portrait)).toBe(false)
    expect(target(0, layout.y - 0.4)).toBeUndefined()
  })
  test('preview labels are not readable artwork targets', () => {
    const preview = new Group
    preview.userData.portraitLabel = false
    const previewText = new Group
    preview.add(previewText)
    expect(isPortraitLabelHit(previewText, portrait)).toBe(false)
  })
})
describe('narration linger animation', () => {
  test('falls slowly at first, accelerates, and reaches zero at the deadline', () => {
    expect(lingerBarScale(0.8, 0)).toBe(0.8)
    const steps = Array.from({length: 11}, (_, i) => lingerBarScale(0.8, i / 10))
    const drops = steps.slice(1).map((scale, i) => steps[i] - scale)
    for (const [i, drop] of drops.entries()) {
      expect(drop).toBeGreaterThan(i ? drops[i - 1] : 0)
    }
    expect(lingerBarScale(0.8, 1)).toBe(0)
    expect(lingerBarScale(0.8, 2)).toBe(0)
  })
})
describe('contextual HUD', () => {
  test('the artwork overlay includes title, description, creator and year', () => {
    const p = {
      ...samplePortraits[0],
      year: 1924,
    }
    const html = renderToStaticMarkup(createElement(ArtworkOverlay, {portrait: p}))
    for (const value of [p.title, p.description, p.creator, p.year]) {
      expect(html).toContain(String(value))
    }
    expect(html).not.toContain('Undated')
  })
  test('year zero is not mistaken for a missing year', () => {
    const html = renderToStaticMarkup(createElement(ArtworkOverlay, {
      portrait: {
        ...samplePortraits[0],
        year: 0,
      },
    }))
    expect(html).toContain('<span>0</span>')
    expect(html).not.toContain('Undated')
  })
  test('a missing year is left out', () => {
    const html = renderToStaticMarkup(createElement(ArtworkOverlay, {portrait: samplePortraits[0]}))
    expect(html).toContain(`<span>${samplePortraits[0].creator}</span></p>`)
    expect(html).not.toContain('Undated')
    expect(html).not.toContain(' · ')
  })
  test('a work nobody told anything about has no overlay, and one being written about shows only what is written so far', () => {
    const {creator, description, title, ...untold} = samplePortraits[0]
    expect(renderToStaticMarkup(createElement(ArtworkOverlay, {portrait: untold}))).toBe('')
    const html = renderToStaticMarkup(createElement(ArtworkOverlay, {
      portrait: {
        ...untold,
        pending: true,
        title,
      },
    }))
    expect(html).toContain(`<h2>${title}</h2>`)
    expect(html).not.toContain(creator)
    expect(html).not.toContain(description)
    expect(html).not.toContain('<p')
  })
  test('recorded and provider audio show the real five-band visualization', () => {
    const html = renderToStaticMarkup(createElement(NarrationIndicator, {
      instanceId: 'story',
      status: 'playing',
      source: 'audio',
    }))
    expect(html).toContain('data-testid="narrator-avatar"')
    expect(html).toContain('data-testid="audio-bars"')
    expect(html.match(/<i>/g)).toHaveLength(5)
  })
  test('browser speech shows a static speaking icon, not a spectrum', () => {
    const html = renderToStaticMarkup(createElement(NarrationIndicator, {
      instanceId: 'browser-story',
      status: 'playing',
      source: 'browser',
    }))
    expect(html).toContain('data-testid="narrator-avatar"')
    expect(html).toContain('data-testid="narration-static"')
    expect(html).not.toContain('data-testid="audio-bars"')
    expect(html).not.toContain('<i>')
  })
  test('overlapping async narration renders as separate stacked indicator boxes', () => {
    const html = renderToStaticMarkup(createElement(NarrationIndicatorStack, {
      narrations: [
        {
          id: 'main',
          instanceId: 'main-instance',
          source: 'audio',
          status: 'playing',
          title: 'Main narration',
        },
        {
          id: 'parallel',
          instanceId: 'parallel-instance',
          source: 'audio',
          status: 'playing',
          title: 'Parallel narration',
        },
      ],
    }))
    expect(html).toContain('data-testid="narration-stack"')
    expect(html).not.toContain('Main narration')
    expect(html).not.toContain('Parallel narration')
    expect(html.match(/aria-label="Audio guide"/g)).toHaveLength(2)
    expect(html.match(/data-testid="narrator-avatar"/g)).toHaveLength(2)
    expect(html.match(/data-testid="audio-bars"/g)).toHaveLength(2)
  })
  test('preparing narration does not pretend to have audio measurements', () => {
    const html = renderToStaticMarkup(createElement(NarrationIndicator, {
      instanceId: 'story',
      status: 'preparing',
      source: null,
    }))
    expect(html).toContain('data-testid="narrator-avatar"')
    expect(html).not.toContain('data-testid="audio-bars"')
  })
})
for (const status of ['before', 'after'] as const) {
  test(`audio narrator keeps near-flat bars during ${status} silence`, () => {
    const html = renderToStaticMarkup(createElement(NarrationIndicator, {
      instanceId: `padded-${status}`,
      status,
      source: 'audio',
    }))
    expect(html).toContain('data-testid="audio-bars"')
    const scales = html.matchAll(/scaleY\(([\d.]+)\)/gu).map(([, scale]) => Number(scale)).toArray()
    if (status === 'before') {
      expect(scales).toHaveLength(5)
      for (const scale of scales) {
        expect(scale).toBeGreaterThan(0)
        expect(scale).toBeLessThan(0.1)
      }
    } else {
      // Lingering bars fall from wherever the playback left them.
      expect(scales).toEqual([])
    }
    expect(html).not.toContain('data-testid="narration-static"')
  })
}
