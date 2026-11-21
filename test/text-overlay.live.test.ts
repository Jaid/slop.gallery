import {expect, test} from 'bun:test'

import {callWebmcpTool} from 'capture-session/script'

import {openHeadlessGallery, resolveGallerySetup, waitForFrames} from '../scripts/lib/headlessGallery.ts'

test.skipIf(Bun.env.LIVE_TEST !== 'true')('HTML labels distinguish viewport pixels from a moving world point in an offset canvas', async () => {
  const setup = await resolveGallerySetup({
    target: Bun.env.LIVE_TARGET || 'dist',
    seed: '0',
    graphics: 'fast',
    room: 'lobby',
    world_reach: 'room',
    width: '960',
    height: '540',
    ratio: '1:1',
  })
  await using gallery = await openHeadlessGallery(setup, {cacheDir: 'node_modules/.vite-text-overlay'})
  const {page} = gallery
  const look = (x: number, yaw: number) => page.evaluate(([eye, angle]) => globalThis.slopGallery!.fly!({
    position: [eye, 2, 0],
    rotation: [0, angle, 0],
    fov: 90,
  }), [x, yaw])
  await look(0, 0)
  const text = '<b>3.80 m</b>'
  const add = async (position?: {
    x: number
    y: number
    z?: number
  }, anchor?: number) => (await callWebmcpTool(page, 'add_text_overlay', {
    text,
    position,
    anchor,
  }) as {id: string}).id
  const fixed = await add({
    x: 30,
    y: 55,
  }, 1)
  const centered = await add()
  const world = await add({
    x: 1,
    y: 3,
    z: -2,
  }, 9)
  const read = (id: string) => page.evaluate(key => {
    const label = document.querySelector<HTMLElement>(`[data-text-overlay="${key}"]`)!
    const {left, top, width, height} = label.getBoundingClientRect()
    return {
      left,
      top,
      right: left + width,
      bottom: top + height,
      cx: left + width / 2,
      cy: top + height / 2,
      hidden: label.hidden,
      children: label.childElementCount,
      text: label.textContent,
    }
  }, id)
  const bounds = await page.evaluate(() => {
    const {left, top, width, height} = document.querySelector('canvas')!.getBoundingClientRect()
    return {
      left,
      top,
      width,
      height,
    }
  })
  expect(bounds.left).toBeGreaterThan(0)
  expect(await read(fixed)).toMatchObject({
    left: 30,
    top: 55,
    text,
    children: 0,
  })
  const defaultLabel = await read(centered)
  expect(defaultLabel.cx).toBeCloseTo(480, 0)
  for (const [eye, fraction] of [[0, 0.75], [1, 0.5]]) {
    await look(eye, 0)
    await waitForFrames(page, 3)
    const projected = await read(world)
    expect(projected.hidden).toBe(false)
    expect(projected.right).toBeCloseTo(bounds.left + fraction * bounds.width, 0)
    expect(projected.bottom).toBeCloseTo(bounds.top + 0.25 * bounds.height, 0)
  }
  await look(1, Math.PI)
  await waitForFrames(page, 3)
  const turned = await read(world)
  expect(turned.hidden).toBe(true)
  expect(await read(fixed)).toMatchObject({
    top: 55,
    left: 30,
  })
  expect(await callWebmcpTool(page, 'clear_text_overlay', {})).toEqual({removed: 3})
  expect(await page.evaluate(() => document.querySelectorAll('[data-text-overlay]').length)).toBe(0)
  expect(await callWebmcpTool(page, 'clear_text_overlay', {})).toEqual({removed: 0})
}, 180_000)
