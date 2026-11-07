import type {AiSettings} from '../../src/lib/ai/settings.ts'
import type {PortraitFrameId} from '../../src/lib/frames/frameParameter.ts'
import type {FusionOptions, FusionSpec} from '../../src/lib/gallery/fusion/Fusion.ts'
import type FusionRecipe from '../../src/lib/gallery/fusion/FusionRecipe.ts'
import type {FusionTiming} from '../../src/lib/gallery/fusion/timing.ts'
import type {Portrait, ThrownItem} from '../../src/lib/gallery/types.ts'

import {beforeEach, expect, test} from 'bun:test'

import GalleryDirector from '../../src/lib/ai/GalleryDirector.ts'
import {readAiSettings} from '../../src/lib/ai/settings.ts'
import {arrivalFrame} from '../../src/lib/gallery/actions.ts'
import Fusion from '../../src/lib/gallery/fusion/Fusion.ts'
import {portalFrame} from '../../src/lib/gallery/fusion/portalFrame.ts'
import {nextTurn} from '../../src/lib/gallery/fusion/timing.ts'
import {transparentOrb} from '../../src/lib/gallery/orbs/index.ts'
import {useGallery} from '../../src/lib/gallery/store.ts'
import {environmentSeed} from '../../src/lib/gameSeed.ts'
import samplePortraits from './fixtures/portraits.ts'

const defaults: AiSettings = readAiSettings()
const original = {
  ...useGallery.getState(),
  portraits: samplePortraits.map(p => ({...p})),
}
const a = new Blob(['hanging'], {type: 'image/webp'})
const b = new Blob(['thrown'], {type: 'image/webp'})
beforeEach(() => {
  useGallery.setState(original, true)
  useGallery.setState({
    sound: false,
    portraits: original.portraits.slice(0, 2).map((p, i) => ({
      ...p,
      id: i ? 'b' : 'a',
      source: i ? b : a,
      hung: !i,
      wallId: i ? undefined : p.wallId,
    })),
  })
})
/** a prop contributing its studio photograph */
const apple: ThrownItem = {
  id: 'prop-apple',
  title: 'the apple',
  ingredient: () => ({
    contributions: [
      {
        kind: 'image',
        image: Promise.resolve(new Blob(['apple'], {type: 'image/webp'})),
      },
    ],
  }),
}
/** an orb contributing a prompt and showing by a glow and an illustration of itself, which a success uses up */
const testOrb: ThrownItem = {
  id: 'prop-orb-test',
  title: 'Test Orb',
  consumable: true,
  ingredient: () => ({
    contributions: [
      {
        kind: 'instruction',
        instruction: 'Make it spooky.',
      },
    ],
    glow: '#8a3cff',
    look: '/orbs/test.jxl',
  }),
}
/** an orb without any contribution, like the Transparent Orb */
const clearOrb: ThrownItem = {
  id: 'prop-orb-clear',
  title: 'Clear Orb',
  consumable: true,
  ingredient: () => ({contributions: []}),
}
/** the item, contributing the frame too */
const framing = (item: ThrownItem, frame: PortraitFrameId): ThrownItem => ({
  ...item,
  ingredient: () => {
    const ingredient = item.ingredient()
    return {
      ...ingredient,
      contributions: [
        ...ingredient.contributions,
        {
          kind: 'frame',
          frame,
        },
      ],
    }
  },
})
const instant: FusionTiming = {
  intro: 0,
  lull: 0,
  image: 1,
  minimum: 0,
  climax: 0,
  afterglow: 0,
  fizzle: 0,
}
class TestDirector extends GalleryDirector {
  /** the shape the image model was asked for */
  aspect: number | undefined
  flavorResult = Promise.withResolvers<Partial<Portrait>>()
  /** keeps a result ready to show, like the gallery’s texture cache */
  hold: FusionOptions['hold']
  opened: Array<Fusion> = []
  partial: ((partial: Partial<Portrait>) => void) | undefined
  /** the recipe the result was asked to be made of, if one was asked for */
  recipe: FusionRecipe | undefined
  result = Promise.withResolvers<Blob>()
  /** the pixel size of the result */
  resultSize = [1024, 1024]
  /** what the image model was told to give up by */
  signal: AbortSignal | undefined
  constructor(settings: AiSettings, key: false | string, private timing = instant) {
    super(settings, {key})
  }
  protected override generate(recipe: FusionRecipe, signal: AbortSignal, aspect: number) {
    this.recipe = recipe
    this.signal = signal
    this.aspect = aspect
    // Like the image model, it waits for every image, like a prop’s photograph, which may fail.
    return recipe.images().then(() => this.sized())
  }
  protected override generateFlavor(_image: Blob, partial: (partial: Partial<Portrait>) => void) {
    this.partial = partial
    return this.flavorResult.promise
  }
  protected override openFusion(spec: FusionSpec) {
    const fusion = new Fusion(spec, {
      frame: portalFrame(spec.work, {
        floor: 0,
        room: 5,
        sides: [3, 3],
      }),
      timing: this.timing,
      hold: this.hold,
    })
    this.opened.push(fusion)
    return fusion
  }
  private async sized() {
    const image = await this.result.promise
    const [width, height] = this.resultSize
    return {
      image,
      width,
      height,
    }
  }
}
test('fusion keeps both originals until success and commits one change', async () => {
  const director = new TestDirector({
    ...defaults,
    ai: false,
  }, '')
  const job = director.fuse('a', 'b')
  expect(await director.recipe!.images()).toEqual([a, b])
  expect(director.recipe!.ingredients.map(ingredient => ingredient.kind)).toEqual(['portrait', 'portrait'])
  expect(useGallery.getState().portraits).toHaveLength(2)
  const fused = new Blob(['result'], {type: 'image/webp'})
  director.result.resolve(fused)
  await job
  expect(useGallery.getState().portraits).toHaveLength(1)
  expect(useGallery.getState().portraits[0].source).toBe(fused)
  director.dispose()
})
for (const partner of ['work', 'orb']) {
  test(`a fusion with a thrown ${partner} frames the result in its own shape at the area of the hung portrait’s frame`, async () => {
    useGallery.getState().update('a', {
      width: 3,
      height: 2,
    })
    const director = new TestDirector({
      ...defaults,
      ai: false,
    }, '')
    try {
      // Asked for 3:2, the model still made something squarer.
      director.resultSize = [1200, 1000]
      const job = partner === 'orb' ? director.fuseItem('a', testOrb) : director.fuse('a', 'b')
      director.result.resolve(new Blob(['result'], {type: 'image/webp'}))
      await job
      expect(director.aspect).toBe(1.5)
      const portrait = useGallery.getState().portraits.find(p => p.id === 'a')!
      expect(portrait.width / portrait.height).toBeCloseTo(1.2, 9)
      expect(portrait.width * portrait.height).toBeCloseTo(6, 9)
    } finally {
      director.dispose()
    }
  })
}
test('failed fusion releases both originals', async () => {
  const director = new TestDirector(defaults, 'test')
  const job = director.fuse('a', 'b')
  director.result.reject(new Error('Provider unavailable'))
  await job
  expect(useGallery.getState().portraits.map(p => p.source)).toEqual([a, b])
  expect(useGallery.getState().portraits.some(p => p.fusing || p.reserved)).toBe(false)
  director.dispose()
})
test('removing one original releases the survivor and ignores late success', async () => {
  const director = new TestDirector(defaults, 'test')
  const job = director.fuse('a', 'b')
  useGallery.getState().remove('a')
  director.result.resolve(new Blob(['late']))
  await job
  expect(useGallery.getState().portraits).toHaveLength(1)
  expect(useGallery.getState().portraits[0]).toMatchObject({
    id: 'b',
    reserved: false,
  })
  director.dispose()
})
test('canceling a director prevents late changes', async () => {
  const director = new TestDirector(defaults, 'test')
  const job = director.fuse('a', 'b')
  director.dispose()
  director.result.resolve(new Blob(['late']))
  await job
  expect(useGallery.getState().portraits.map(p => p.source)).toEqual([a, b])
})
test('streamed labels never overwrite a subsequent manual edit', async () => {
  const director = new TestDirector(defaults, 'test')
  const job = director.flavor(useGallery.getState().portraits[0])
  await Promise.resolve()
  director.partial?.({title: 'Streaming title'})
  expect(useGallery.getState().portraits[0].title).toBe('Streaming title')
  useGallery.getState().update('a', {
    title: 'My label',
    pending: false,
  })
  director.partial?.({title: 'Late stream'})
  director.flavorResult.resolve({title: 'Late final'})
  await job
  expect(useGallery.getState().portraits[0].title).toBe('My label')
  director.dispose()
})
test('streamed artwork years are retained and invalid provider years are ignored', async () => {
  const director = new TestDirector(defaults, 'test')
  try {
    const job = director.flavor(useGallery.getState().portraits[0])
    await Promise.resolve()
    director.partial?.({year: 1924})
    expect(useGallery.getState().portraits[0].year).toBe(1924)
    director.partial?.({year: 1924.5})
    expect(useGallery.getState().portraits[0].year).toBe(1924)
    director.partial?.({year: Infinity})
    expect(useGallery.getState().portraits[0].year).toBe(1924)
    director.flavorResult.resolve({year: 1925})
    await job
    expect(useGallery.getState().portraits[0].year).toBe(1925)
  } finally {
    director.dispose()
  }
})
test('obsolete fusion cleanup cannot cancel its replacement', async () => {
  const old = new TestDirector({
    ...defaults,
    ai: false,
  }, '')
  const obsolete = old.fuse('a', 'b')
  old.dispose()
  const replacement = new TestDirector({
    ...defaults,
    ai: false,
  }, '')
  try {
    const job = replacement.fuse('a', 'b')
    old.result.resolve(new Blob(['obsolete'], {type: 'image/webp'}))
    await obsolete
    expect(useGallery.getState().portraits[0].fusing).toBe(true)
    expect(useGallery.getState().portraits[1].reserved).toBe(true)
    const fused = new Blob(['replacement'], {type: 'image/webp'})
    replacement.result.resolve(fused)
    await job
    expect(useGallery.getState().portraits.map(p => p.source)).toEqual([fused])
  } finally {
    replacement.dispose()
  }
})
test('disposing a different director does not release another director’s label or fusion', async () => {
  const owner = new TestDirector(defaults, 'test')
  const unrelated = new TestDirector(defaults, 'test')
  const job = owner.fuse('a', 'b')
  unrelated.dispose()
  expect(useGallery.getState().portraits[0].fusing).toBe(true)
  owner.result.reject(new Error('test'))
  await job
  owner.dispose()
})
test('a thrown item fuses with the hung portrait and leaves the collection size alone', async () => {
  const director = new TestDirector({
    ...defaults,
    ai: false,
  }, '')
  const job = director.fuseItem('a', apple)
  expect(useGallery.getState().portraits[0].fusing).toBe(true)
  const [work, photograph] = await director.recipe!.images()
  expect(work).toBe(a)
  expect(await (photograph as Blob).text()).toBe('apple')
  const fused = new Blob(['result'], {type: 'image/webp'})
  director.result.resolve(fused)
  await job
  const portraits = useGallery.getState().portraits
  expect(portraits).toHaveLength(2)
  expect(portraits[0]).toMatchObject({
    id: 'a',
    source: fused,
    fusing: false,
    hung: false,
  })
  expect(portraits[0].description).toContain('struck by the apple')
  expect(portraits[1].source).toBe(b)
  director.dispose()
})
test('a thrown item cannot fuse with a loose, fusing or reserved portrait', async () => {
  const director = new TestDirector(defaults, 'test')
  await director.fuseItem('b', apple)
  expect(director.recipe).toBeUndefined()
  const job = director.fuseItem('a', apple)
  await director.fuseItem('a', apple)
  expect(useGallery.getState().portraits[0].fusionJob).toBeDefined()
  director.result.reject(new Error('Provider unavailable'))
  await job
  expect(useGallery.getState().portraits[0]).toMatchObject({
    source: a,
    fusing: false,
  })
  director.dispose()
})
test('a failing photograph releases the portrait', async () => {
  const director = new TestDirector(defaults, 'test')
  await director.fuseItem('a', {
    ...apple,
    ingredient: () => ({
      contributions: [
        {
          kind: 'image',
          image: Promise.reject(new Error('No GPU')),
        },
      ],
    }),
  })
  expect(useGallery.getState().portraits[0]).toMatchObject({
    source: a,
    fusing: false,
  })
  director.dispose()
})
test('a thrown orb contributes its prompt instead of a photograph, and its portal shows the photograph made of it in advance', async () => {
  const director = new TestDirector({
    ...defaults,
    ai: false,
  }, '')
  try {
    const job = director.fuseItem('a', testOrb)
    expect(useGallery.getState().portraits[0].fusing).toBe(true)
    const recipe = director.recipe!
    expect(await recipe.images()).toEqual([a])
    expect(recipe.instructions).toEqual(['Make it spooky.'])
    expect(recipe.text(1)).toBe('Make it spooky.')
    // The orb’s illustration only surfaces in the portal, tinted in its glow, and never goes to the image model.
    expect(director.opened[0].spec).toMatchObject({
      color: '#8a3cff',
      images: [a, '/orbs/test.jxl'],
      latches: ['charge', 'charge'],
    })
    const fused = new Blob(['spooky'], {type: 'image/webp'})
    director.result.resolve(fused)
    await job
    const [portrait] = useGallery.getState().portraits
    expect(portrait).toMatchObject({
      id: 'a',
      source: fused,
      fusing: false,
      hung: false,
    })
    expect(portrait.description).toContain('caught the Test Orb')
    expect(portrait.description).toContain('Tinted by hand in the Test Orb’s glow.')
  } finally {
    director.dispose()
  }
})
test('generated image admission failure preserves both originals', async () => {
  const director = new TestDirector({
    ...defaults,
    ai: false,
  }, '')
  try {
    const job = director.fuse('a', 'b')
    director.result.resolve(new Blob([new Uint8Array(25_000_001)], {type: 'image/webp'}))
    await job
    expect(useGallery.getState().portraits.map(p => p.source)).toEqual([a, b])
    expect(useGallery.getState().portraits.some(p => p.fusing || p.reserved)).toBe(false)
  } finally {
    director.dispose()
  }
})
const brief: FusionTiming = {
  intro: 0.02,
  lull: 0.02,
  image: 0.04,
  minimum: 0.15,
  climax: 0.05,
  afterglow: 0.05,
  fizzle: 0.05,
}
const sleep = (seconds: number) => new Promise(resolve => setTimeout(resolve, seconds * 1000))
test('the result flips out of the portal as a loose portrait, no sooner than the fusion’s minimum and climax', async () => {
  const director = new TestDirector({
    ...defaults,
    ai: false,
  }, '', brief)
  try {
    const {rotation} = useGallery.getState().portraits[0]
    const job = director.fuse('a', 'b')
    const fused = new Blob(['result'], {type: 'image/webp'})
    director.result.resolve(fused)
    await sleep(0.1)
    // The image is in, but the portal brews on until its minimum.
    expect(useGallery.getState().portraits.map(p => p.source)).toEqual([a, b])
    expect(director.opened[0].outcome).toEqual({
      kind: 'success',
      at: brief.minimum,
    })
    await job
    const [fusion] = director.opened
    expect(fusion.elapsed()).toBeGreaterThanOrEqual(brief.minimum + brief.climax)
    expect(fusion.emergedAt).toBeDefined()
    const [portrait] = useGallery.getState().portraits
    expect(portrait).toMatchObject({
      id: 'a',
      source: fused,
      hung: false,
      wallId: undefined,
      position: fusion.frame.center,
      rotation,
    })
    expect(portrait.velocity?.[1]).toBeGreaterThan(3)
    expect(Math.hypot(...portrait.spin!)).toBeGreaterThan(5)
    // The portal glows on after the result is out, then closes.
    expect(fusion.closed).toBe(false)
    await sleep(brief.afterglow + 0.12)
    expect(fusion.closed).toBe(true)
  } finally {
    director.dispose()
  }
})
test('whatever the player carries when the result flips out stays in hand', async () => {
  const director = new TestDirector({
    ...defaults,
    ai: false,
  }, '')
  try {
    const job = director.fuse('a', 'b')
    useGallery.setState({held: 'prop-apple'})
    director.result.resolve(new Blob(['result'], {type: 'image/webp'}))
    await job
    expect(useGallery.getState().portraits).toHaveLength(1)
    expect(useGallery.getState().held).toBe('prop-apple')
  } finally {
    director.dispose()
  }
})
test('a failure shows once the fusion fizzled out after its intro, without waiting for the minimum, then releases both originals', async () => {
  const director = new TestDirector(defaults, 'test', brief)
  try {
    const job = director.fuse('a', 'b')
    director.result.reject(new Error('Provider unavailable'))
    await sleep(0.01)
    expect(useGallery.getState().portraits.find(p => p.id === 'a')?.fusing).toBe(true)
    expect(director.opened[0].outcome).toEqual({
      kind: 'failure',
      at: brief.intro,
    })
    // It has fizzled out before a result would even have been due.
    await sleep(brief.minimum - director.opened[0].elapsed())
    expect(director.opened[0].closed).toBe(true)
    await job
    expect(director.opened[0].elapsed()).toBeGreaterThanOrEqual(brief.intro + brief.fizzle)
    expect(director.opened[0].closed).toBe(true)
    expect(useGallery.getState().portraits.some(p => p.fusing || p.reserved)).toBe(false)
    expect(useGallery.getState().notice).toContain('did not finish')
  } finally {
    director.dispose()
  }
})
test('jumping into the portal breaks the fusion off with a notice at once, gives up on the image and fails like a fusion that went wrong', async () => {
  const director = new TestDirector(defaults, 'test', brief)
  try {
    const job = director.fuse('a', 'b')
    await sleep(0.03)
    const [fusion] = director.opened
    expect(fusion.cancel()).toBe(true)
    expect(director.signal?.aborted).toBe(true)
    expect(useGallery.getState().notice).toBe('You canceled the fusion. Both originals are still here.')
    // It fails as the next turn of the images begins, without waiting for the minimum.
    expect(fusion.outcome).toEqual({
      kind: 'failure',
      at: nextTurn(fusion.canceledAt!, brief),
    })
    // The image model never answers, and the fusion doesn’t wait for it.
    await job
    expect(fusion.closed).toBe(true)
    expect(fusion.elapsed()).toBeGreaterThanOrEqual(fusion.outcome!.at + brief.fizzle)
    expect(useGallery.getState().portraits.map(p => p.source)).toEqual([a, b])
    expect(useGallery.getState().portraits.some(p => p.fusing || p.reserved)).toBe(false)
    expect(useGallery.getState().notice).toBe('You canceled the fusion. Both originals are still here.')
  } finally {
    director.dispose()
  }
})
test('broken off while its result is being made ready, the fusion keeps the original instead', async () => {
  const director = new TestDirector({
    ...defaults,
    ai: false,
  }, '', brief)
  try {
    director.hold = () => ({
      ready: sleep(0.06),
      release: () => {},
    })
    const job = director.fuse('a', 'b')
    director.result.resolve(new Blob(['result'], {type: 'image/webp'}))
    await sleep(0.03)
    const [fusion] = director.opened
    // The image is in, but not decoded yet.
    expect(fusion.outcome).toBeUndefined()
    expect(fusion.cancel()).toBe(true)
    await job
    expect(fusion.emergedAt).toBeUndefined()
    expect(useGallery.getState().portraits.map(p => p.source)).toEqual([a, b])
  } finally {
    director.dispose()
  }
})
test('a result made at once, like a local one without AI, can still be broken off until its climax begins, which keeps the original and hands the orb back', async () => {
  // Its climax is far off, however long the result takes to come in.
  const director = new TestDirector({
    ...defaults,
    ai: false,
  }, '', {
    ...brief,
    minimum: 30,
  })
  try {
    const job = director.fuseItem('a', testOrb)
    director.result.resolve(new Blob(['result'], {type: 'image/webp'}))
    const [fusion] = director.opened
    while (!fusion.outcome) {
      await sleep(0.01)
    }
    // The result is in, but its climax is still due.
    expect(fusion.outcome.kind).toBe('success')
    expect(fusion.elapsed()).toBeLessThan(fusion.outcome.at)
    expect(fusion.cancel()).toBe(true)
    expect(useGallery.getState().notice).toBe('You canceled the fusion. The original is still here.')
    await job
    expect(fusion.emergedAt).toBeUndefined()
    expect(useGallery.getState().portraits.find(p => p.id === 'a')?.source).toBe(a)
    expect(useGallery.getState().portraits.some(p => p.fusing || p.reserved)).toBe(false)
    expect(useGallery.getState().consumed).not.toContain(testOrb.id)
    expect(useGallery.getState().notice).toBe('You canceled the fusion. The original is still here.')
  } finally {
    director.dispose()
  }
})
test('the result wears the frame a thrown ingredient contributed wherever it arrives, and without one that of the room it arrives in, rolled as the portal opens', async () => {
  const items: Array<[ThrownItem, PortraitFrameId | undefined]> = [[framing(testOrb, 'lodge-tramp'), 'lodge-tramp'], [framing(apple, 'cell-coffer'), 'cell-coffer'], [testOrb, undefined], [apple, undefined]]
  for (const [item, frame] of items) {
    useGallery.setState(original, true)
    useGallery.setState({
      sound: false,
      portraits: [{
        ...original.portraits[0],
        id: 'a',
        source: a,
        hung: true,
      }],
    })
    const {position} = useGallery.getState().portraits[0]
    const director = new TestDirector({
      ...defaults,
      ai: false,
    }, '')
    try {
      const job = director.fuseItem('a', item)
      // Known long before the result, so the portal can have it ready.
      const [fusion] = director.opened
      const expected = frame ?? arrivalFrame(fusion.frame.center, position, 'a', environmentSeed)
      expect(fusion.resultFrame).toBe(expected)
      director.result.resolve(new Blob(['result'], {type: 'image/webp'}))
      await job
      const result = useGallery.getState().portraits.find(p => p.id === 'a')!
      expect(result.source).not.toBe(a)
      expect(result.frame).toBe(expected)
    } finally {
      director.dispose()
    }
  }
})
test('a success uses up a thrown orb, but not one the player caught again, nor anything else thrown', async () => {
  for (const [item, held, consumed] of [[testOrb, null, ['prop-orb-test']], [testOrb, 'prop-orb-test', []], [apple, null, []]] as const) {
    useGallery.setState({
      consumed: [],
      held,
    })
    useGallery.getState().update('a', {hung: true})
    const director = new TestDirector({
      ...defaults,
      ai: false,
    }, '')
    try {
      const job = director.fuseItem('a', item)
      expect(director.opened.at(-1)!.spec.partner).toEqual({
        kind: 'item',
        id: item.id,
        consumed: item === testOrb,
      })
      director.result.resolve(new Blob(['result'], {type: 'image/webp'}))
      await job
      expect(useGallery.getState().consumed).toEqual(consumed)
    } finally {
      director.dispose()
    }
  }
})
/** an orb like a themed one, whose success leaves its clear glass */
const filledOrb: ThrownItem = {
  ...testOrb,
  remains: transparentOrb,
}
test('the remains of a thrown orb enter the world in the portal’s middle as it opens and stay once the success used the orb up', async () => {
  useGallery.setState({
    consumed: [],
    remains: [],
  })
  const director = new TestDirector({
    ...defaults,
    ai: false,
  }, '')
  try {
    const job = director.fuseItem('a', filledOrb)
    const [fusion] = director.opened
    const id = fusion.spec.partner.remains!
    expect(id).toStartWith('prop-orb-test-remains-')
    expect(useGallery.getState().remains).toEqual([
      {
        id,
        orb: transparentOrb,
        position: fusion.frame.center,
      },
    ])
    director.result.resolve(new Blob(['result'], {type: 'image/webp'}))
    await job
    expect(useGallery.getState().consumed).toEqual(['prop-orb-test'])
    expect(useGallery.getState().remains.map(remains => remains.id)).toEqual([id])
    // Another orb’s remains are a prop of their own.
    useGallery.getState().update('a', {hung: true})
    const next = director.fuseItem('a', {
      ...filledOrb,
      id: 'prop-orb-test-2',
    })
    expect(director.opened[1].spec.partner.remains).not.toBe(id)
    director.result.resolve(new Blob(['result'], {type: 'image/webp'}))
    await next
    expect(useGallery.getState().remains).toHaveLength(2)
  } finally {
    director.dispose()
  }
})
const remainsEndings = {
  'a failed fusion': (director: TestDirector) => director.result.reject(new Error('Provider unavailable')),
  'a fusion broken off': (director: TestDirector) => director.opened[0].cancel(),
  'a success whose orb the player caught again': (director: TestDirector) => {
    useGallery.setState({held: filledOrb.id})
    director.result.resolve(new Blob(['result'], {type: 'image/webp'}))
  },
  'a fusion whose director is disposed': (director: TestDirector) => {
    director.dispose()
    director.result.resolve(new Blob(['late'], {type: 'image/webp'}))
  },
}
for (const [ending, end] of Object.entries(remainsEndings)) {
  test(`${ending} leaves no remains of the orb`, async () => {
    useGallery.setState({
      consumed: [],
      remains: [],
      held: null,
    })
    const director = new TestDirector(defaults, 'test', brief)
    const job = director.fuseItem('a', filledOrb)
    expect(useGallery.getState().remains).toHaveLength(1)
    end(director)
    await job
    expect(useGallery.getState().consumed).toEqual([])
    expect(useGallery.getState().remains).toEqual([])
    director.dispose()
  })
}
test('an item without remains, or one a success doesn’t use up, leaves none', async () => {
  for (const item of [testOrb, {
    ...apple,
    remains: transparentOrb,
  }]) {
    useGallery.setState({remains: []})
    useGallery.getState().update('a', {hung: true})
    const director = new TestDirector({
      ...defaults,
      ai: false,
    }, '')
    try {
      const job = director.fuseItem('a', item)
      expect(director.opened[0].spec.partner.remains).toBeUndefined()
      expect(useGallery.getState().remains).toEqual([])
      director.result.resolve(new Blob(['result'], {type: 'image/webp'}))
      await job
      expect(useGallery.getState().remains).toEqual([])
    } finally {
      director.dispose()
    }
  }
})
for (const ending of ['failed', 'broken off']) {
  test(`a ${ending} fusion leaves the orb in the world`, async () => {
    const director = new TestDirector(defaults, 'test', brief)
    try {
      const job = director.fuseItem('a', testOrb)
      if (ending === 'failed') {
        director.result.reject(new Error('Provider unavailable'))
      } else {
        director.opened[0].cancel()
      }
      await job
      expect(useGallery.getState().consumed).toEqual([])
      expect(useGallery.getState().portraits[0].source).toBe(a)
    } finally {
      director.dispose()
    }
  })
}
for (const ai of [false, true]) {
  test(`an item without any contribution leaves only the hung portrait’s image, so no image model is asked${ai ? ', even with AI' : ''} and the portrait itself comes back out of the portal, framed by the room it arrives in`, async () => {
    const before = useGallery.getState().portraits[0]
    useGallery.getState().update('a', {
      // the Halloween Orb’s, which no room wears
      frame: 'halloween-lantern',
      narration: {audio: '/narration.opus'},
    })
    useGallery.setState({consumed: []})
    const director = new TestDirector(ai ? defaults : {
      ...defaults,
      ai: false,
    }, ai ? 'test' : '', brief)
    try {
      const job = director.fuseItem('a', clearOrb)
      const [fusion] = director.opened
      // The portal shows the hung portrait alone, in its own colors.
      expect(fusion.spec.images).toEqual([a])
      expect(fusion.spec.color).toBeUndefined()
      expect(useGallery.getState().notice).toContain('contributes nothing to fuse')
      await job
      expect(director.recipe).toBeUndefined()
      // The fusion still plays out in full.
      expect(fusion.outcome?.kind).toBe('success')
      expect(fusion.result).toBe(a)
      expect(fusion.emergedAt).toBeGreaterThanOrEqual(brief.minimum + brief.climax)
      const portrait = useGallery.getState().portraits.find(p => p.id === 'a')!
      expect(portrait).toMatchObject({
        source: a,
        width: before.width,
        height: before.height,
        title: before.title,
        creator: before.creator,
        description: before.description,
        narration: {audio: '/narration.opus'},
        hung: false,
        fusing: false,
        position: fusion.frame.center,
      })
      expect(portrait.frame).toBe(arrivalFrame(portrait.position, before.position, 'a', environmentSeed))
      expect(portrait.frame).not.toBe('halloween-lantern')
      expect(useGallery.getState().consumed).toEqual(['prop-orb-clear'])
      expect(useGallery.getState().notice).toContain('came back as it went in')
    } finally {
      director.dispose()
    }
  })
}
test('disposing the director closes its fusions at once', async () => {
  const director = new TestDirector(defaults, 'test', brief)
  const job = director.fuse('a', 'b')
  director.dispose()
  const [fusion] = director.opened
  expect(fusion.closed).toBe(true)
  expect(fusion.outcome?.kind).toBe('abort')
  director.result.resolve(new Blob(['late'], {type: 'image/webp'}))
  await job
  expect(useGallery.getState().portraits.map(p => p.source)).toEqual([a, b])
})
