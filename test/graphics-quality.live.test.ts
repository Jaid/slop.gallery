import type {WorldAnalysis} from '../src/lib/webmcp/analyzeWorld.ts'

import {expect, test} from 'bun:test'

import {callWebmcpTool} from 'capture-session/script'

import {openHeadlessGallery, resolveGallerySetup, waitForGallery} from '../scripts/lib/headlessGallery.ts'

test.skipIf(Bun.env.LIVE_TEST !== 'true')('the menu remembers the next preset without changing the live scene; permalinks navigate instead', async () => {
  const setup = await resolveGallerySetup({
    target: Bun.env.LIVE_TARGET ?? 'dist',
    seed: '0',
    room: 'cell',
    graphics: 'fast',
    development: 'true',
    paused: 'true',
    width: '800',
    height: '600',
  })
  setup.search.delete('graphics')
  await using gallery = await openHeadlessGallery(setup, {cacheDir: 'node_modules/.vite-graphics-quality'})
  const {page} = gallery
  const button = '[aria-label="Heavy graphics"]'
  const selected = async () => {
    await page.waitForSelector(button, {visible: true})
    return page.$eval(`${button} small`, element => element.textContent)
  }
  const saved = () => page.evaluate(() => localStorage.getItem('slop-gallery-graphics'))
  // Check the world itself, not a second settings label. The Cell’s shadow-casting moon never mounts in Fast.
  const hasMoon = async () => (await callWebmcpTool(page, 'analyze_world') as WorldAnalysis).globalLights.some(light => light.path.split('/').at(-1) === 'moon')
  expect(await selected()).toBe('Fast')
  expect(await saved()).toBeNull()
  expect(await hasMoon()).toBe(false)
  const first = await page.evaluate(() => performance.timeOrigin)
  await page.click(button)
  expect(await selected()).toBe('Heavy')
  expect(await saved()).toBe('heavy')
  await page.click(button)
  expect(await selected()).toBe('Fast')
  expect(await saved()).toBe('fast')
  await page.click(button)
  await page.keyboard.press('o')
  await page.waitForSelector(button, {hidden: true})
  await page.keyboard.press('o')
  expect(await selected()).toBe('Heavy')
  expect(await page.evaluate(() => performance.timeOrigin)).toBe(first)
  const link = new URL(page.url())
  expect(link.searchParams.has('graphics')).toBe(false)
  expect(await hasMoon()).toBe(false)
  await page.reload({waitUntil: 'domcontentloaded'})
  await waitForGallery(page)
  expect(await selected()).toBe('Heavy')
  expect(await hasMoon()).toBe(true)
  link.searchParams.set('graphics', 'heavy')
  link.hash = 'cell'
  await page.goto(link.href, {waitUntil: 'domcontentloaded'})
  await waitForGallery(page)
  await page.waitForSelector(button, {visible: true})
  await Promise.all([page.waitForNavigation({waitUntil: 'domcontentloaded'}), page.click(button)])
  await waitForGallery(page)
  link.searchParams.set('graphics', 'fast')
  expect(page.url()).toBe(link.href)
  expect(await saved()).toBe('heavy')
  expect(await selected()).toBe('Fast')
  expect(await hasMoon()).toBe(false)
  // A packed fragment wins over the query, so the button rewrites it in place and loads the page again, without leaving an entry behind that shares the new page’s document.
  const encoder = new TextEncoder
  const packed = new URL(link)
  packed.searchParams.delete('graphics')
  packed.hash = `data:${encoder.encode(JSON.stringify({graphics: 'fast'})).toBase64({
    alphabet: 'base64url',
    omitPadding: true,
  })}`
  await page.goto(packed.href, {waitUntil: 'domcontentloaded'})
  await waitForGallery(page)
  await page.waitForSelector(button, {visible: true})
  const fragmentPage = await page.evaluate(() => performance.timeOrigin)
  await Promise.all([page.waitForNavigation({waitUntil: 'domcontentloaded'}), page.click(button)])
  await waitForGallery(page)
  expect(await page.evaluate(() => performance.timeOrigin)).not.toBe(fragmentPage)
  expect(await selected()).toBe('Heavy')
  expect(await hasMoon()).toBe(true)
  // Back leaves for the page before the permalink, a document of its own, instead of showing the Fast permalink over the Heavy renderer.
  await page.goBack({waitUntil: 'domcontentloaded'})
  await waitForGallery(page)
  expect(page.url()).toBe(link.href)
  expect(await selected()).toBe('Fast')
  expect(await hasMoon()).toBe(false)
  expect(await saved()).toBe('heavy')
}, 240_000)
