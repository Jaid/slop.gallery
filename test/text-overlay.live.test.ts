import {expect, test} from 'bun:test'

import {callWebmcpTool} from 'capture-session/script'

import {openHeadlessGallery, resolveGallerySetup, waitForFrames} from '../scripts/lib/headlessGallery.ts'

test.skipIf(Bun.env.LIVE_TEST !== 'true')('text labels project once into a shared, disposable container', async () => {
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
  }, anchor?: number) => callWebmcpTool(page, 'add_text_overlay', {
    text,
    position,
    anchor,
  })
  await add({
    x: 30,
    y: 55,
  }, 1)
  await add()
  const world = {
    x: 1,
    y: 3,
    z: -2,
  }
  expect(await add(world, 9)).toEqual({added: true})
  const read = (index: number) => page.evaluate(i => {
    const label = document.querySelectorAll<HTMLElement>('#gallery-text-overlay > div')[i]
    const {left, top, width, height} = label.getBoundingClientRect()
    return {
      left,
      top,
      right: left + width,
      bottom: top + height,
      cx: left + width / 2,
      children: label.childElementCount,
      text: label.textContent,
    }
  }, index)
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
  expect(await read(0)).toMatchObject({
    left: 30,
    top: 55,
    text,
    children: 0,
  })
  const defaultLabel = await read(1)
  expect(defaultLabel.cx).toBeCloseTo(480, 0)
  const projected = await read(2)
  expect(projected.right).toBeCloseTo(bounds.left + 0.75 * bounds.width, 0)
  expect(projected.bottom).toBeCloseTo(bounds.top + 0.25 * bounds.height, 0)
  await look(1, Math.PI)
  await waitForFrames(page, 3)
  expect(await read(2)).toEqual(projected)
  expect(await add(world)).toEqual({added: false})
  expect(await callWebmcpTool(page, 'clear_text_overlay', {})).toEqual({removed: 3})
  expect(await page.evaluate(() => !!document.querySelector('#gallery-text-overlay'))).toBe(false)
  expect(await callWebmcpTool(page, 'clear_text_overlay', {})).toEqual({removed: 0})
  expect(await add()).toEqual({added: true})
  expect(await read(0)).toEqual(defaultLabel)
}, 180_000)
