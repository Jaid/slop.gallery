import type Fusion from '../gallery/fusion/Fusion.ts'
import type {FusionImpact, FusionSpec} from '../gallery/fusion/Fusion.ts'
import type {FusionMaking, FusionResultInfo, FusionResults} from '../gallery/fusion/resultSharing.ts'
import type {SizedImage} from '../gallery/ImageImporter.ts'
import type {Portrait, ThrownItem} from '../gallery/types.ts'
import type {OpenRouterAccess} from './openRouterAccess.ts'
import type {AiSettings} from './settings.ts'
import type {Span} from 'victoria-browser-client'

import {currentWorldId} from '#src/worlds/index.ts'

import PortraitNarration from '../audio/PortraitNarration.ts'
import downloadBlob, {fileTimestamp} from '../downloadBlob.ts'
import {arrivalFrame, loadBlob, notify} from '../gallery/actions.ts'
import FusionRecipe, {itemIngredient, portraitIngredient} from '../gallery/fusion/FusionRecipe.ts'
import {openFusion} from '../gallery/fusion/fusions.ts'
import {downloadedResults, includesResult, postedResults, webhookEndpoint, webhookForm} from '../gallery/fusion/resultSharing.ts'
import {encodeGeneratedImage, imageSize} from '../gallery/ImageImporter.ts'
import {validateImage} from '../gallery/imagePolicy.ts'
import {useGallery} from '../gallery/store.ts'
import FusionTrace from '../telemetry/FusionTrace.ts'
import {telemetry} from '../telemetry/index.ts'
import {modelImageType, toWebp} from './modelImage.ts'
import {hasAccess} from './openRouterAccess.ts'
import {tieredModel} from './settings.ts'

/** how many remains fusions have left in the world so far, which numbers their prop ids */
let remainsCount = 0

export default class GalleryDirector {
  /** which results of its fusions the director saves as downloads, see `?download` */
  protected downloads: FusionResults = downloadedResults
  readonly narrator: PortraitNarration
  /** which results of its fusions the director posts to {@link webhookEndpoint}, see `?webhook` */
  protected webhook: FusionResults = postedResults
  /** where the director posts the results of its fusions, see `?webhook_endpoint` */
  protected webhookEndpoint = webhookEndpoint
  private controller = new AbortController
  private flavors = new Map<string, symbol>
  /** the job tokens of the portraits this director’s fusions hold, by portrait id */
  private fusing = new Map<string, symbol>
  /** this director’s fusions in progress */
  private fusions = new Set<Fusion>
  /** the spans of the fusions in progress, with telemetry */
  private traces = new Map<Fusion, FusionTrace>
  constructor(private settings: AiSettings, private access: OpenRouterAccess) {
    this.narrator = new PortraitNarration(settings, access)
  }

  /** whether AI is on and can reach OpenRouter */
  private get usingAi() {
    return this.settings.ai && hasAccess(this.access)
  }

  dispose() {
    this.controller.abort()
    this.narrator.dispose()
    // Everything they hold snaps back before the fusions let go of the portraits.
    for (const fusion of this.fusions) {
      fusion.abort()
      this.traces.get(fusion)?.end()
    }
    this.fusions.clear()
    this.traces.clear()
    for (const [id, token] of this.fusing) {
      this.releaseFusion(id, token)
    }
    for (const [id, token] of this.flavors) {
      if (useGallery.getState().portraits.some(p => p.id === id && p.flavorJob === token)) {
        useGallery.getState().update(id, {
          pending: false,
          flavorJob: undefined,
        })
      }
    }
    this.flavors.clear()
  }

  async flavor(portrait: Portrait) {
    if (this.controller.signal.aborted) {
      return
    }
    if (!this.usingAi) {
      this.narrator.ready(portrait.id)
      return
    }
    const token = Symbol(portrait.id)
    this.flavors.set(portrait.id, token)
    const source = portrait.source
    const current = () => !this.controller.signal.aborted && this.flavors.get(portrait.id) === token && useGallery.getState().portraits.some(p => p.id === portrait.id && p.source === source && p.pending && p.flavorJob === token)
    useGallery.getState().update(portrait.id, {
      pending: true,
      flavorJob: token,
    })
    try {
      const update = (partial: Partial<Portrait>) => {
        if (!current()) {
          return
        }
        const patch: Partial<Portrait> = {}
        if (typeof partial.title === 'string' && partial.title.trim()) {
          patch.title = partial.title.slice(0, 300)
        }
        if (typeof partial.creator === 'string' && partial.creator.trim()) {
          patch.creator = partial.creator.slice(0, 200)
        }
        if (typeof partial.description === 'string' && partial.description.trim()) {
          patch.description = partial.description.slice(0, 5000)
        }
        if (typeof partial.year === 'number' && Number.isSafeInteger(partial.year)) {
          patch.year = partial.year
        }
        useGallery.getState().update(portrait.id, patch)
      }
      const generate = async () => this.generateFlavor(await loadBlob(source), update, AbortSignal.any([this.controller.signal, AbortSignal.timeout(90_000)]))
      update(await (telemetry ? telemetry.wrap('gallery.ai.flavor', generate, {attributes: {model: tieredModel(this.settings.text_model, this.settings.ai_tier)}}) : generate()))
    } catch {
      if (current()) {
        notify('The curator is unavailable. Your artwork is safe.')
      }
    } finally {
      if (current()) {
        useGallery.getState().update(portrait.id, {
          pending: false,
          flavorJob: undefined,
        })
        this.narrator.ready(portrait.id)
      }
      if (this.flavors.get(portrait.id) === token) {
        this.flavors.delete(portrait.id)
        if (useGallery.getState().portraits.some(p => p.id === portrait.id && p.flavorJob === token)) {
          useGallery.getState().update(portrait.id, {flavorJob: undefined})
        }
      }
    }
  }

  /** Fuses the hung portrait `first` with the loose portrait `second`, whose image it contributes, which struck it as `impact` says. */
  async fuse(first: string, second: string, impact?: FusionImpact) {
    if (this.controller.signal.aborted) {
      return
    }
    const s = useGallery.getState()
    const a = s.portraits.find(p => p.id === first)
    const b = s.portraits.find(p => p.id === second)
    if (!a?.hung || !b || b.hung || first === second || a.fusing || b.reserved || this.fusing.has(first) || this.fusing.has(second)) {
      return
    }
    const token = Symbol('fusion')
    this.fusing.set(first, token)
    this.fusing.set(second, token)
    s.update(first, {
      fusing: true,
      fusionJob: token,
      pending: false,
    })
    s.update(second, {
      reserved: true,
      fusionJob: token,
      pending: false,
    })
    const current = () => {
      const portraits = useGallery.getState().portraits
      return !this.controller.signal.aborted && portraits.some(p => p.id === first && p.source === a.source && p.fusing && p.fusionJob === token) && portraits.some(p => p.id === second && p.source === b.source && p.reserved && p.fusionJob === token)
    }
    const recipe = new FusionRecipe([portraitIngredient(a), portraitIngredient(b)])
    const fusion = this.startFusion({
      work: a,
      partner: {
        kind: 'portrait',
        id: second,
      },
      images: recipe.looks,
      latches: recipe.latches,
      effects: recipe.effects,
      impact,
    }, recipe)
    try {
      await this.brew(a, fusion, recipe, current, {
        canceled: 'You canceled the fusion. Both originals are still here.',
        description: `“${a.title}” met “${b.title}”. Neither had planned to share a frame.`,
        failure: 'The fusion did not finish. Both originals are still here. Check the image model or try again.',
        remove: second,
      })
    } finally {
      this.endFusion(fusion)
      // One original may have been removed mid-request. Release the survivor as well.
      this.releaseFusion(first, token)
      this.releaseFusion(second, token)
      // dispose() can abort while the fusion is awaited, which the narrowing from the early return above cannot see.
      if (!(this.controller.signal.aborted as boolean)) {
        this.narrator.ready(first)
      }
    }
  }

  /**
   * Fuses the hung portrait `portrait` with the thrown `item`, which struck it as `impact` says, and whatever it contributes: a studio photograph of it by default, an orb’s prompt or nothing at all, which leaves the portrait as it was. The item stays in the room, unless a success uses it up, like an orb.
   * What the item leaves of itself once used up, like a themed orb’s clear glass, enters the world as the portal opens, hidden in the portal until it flips out after the result, so it is built and compiled by then; it leaves the world again unless the success used the item up.
   */
  async fuseItem(portrait: string, item: ThrownItem, impact?: FusionImpact) {
    if (this.controller.signal.aborted) {
      return
    }
    const s = useGallery.getState()
    const a = s.portraits.find(p => p.id === portrait)
    if (!a?.hung || a.fusing || a.reserved || this.fusing.has(portrait)) {
      return
    }
    const token = Symbol('fusion')
    this.fusing.set(portrait, token)
    s.update(portrait, {
      fusing: true,
      fusionJob: token,
      pending: false,
    })
    const current = () => !this.controller.signal.aborted && useGallery.getState().portraits.some(p => p.id === portrait && p.source === a.source && p.fusing && p.fusionJob === token)
    // Asked for once the portrait is reserved, like a prop’s studio photograph, which is taken now.
    const ingredient = itemIngredient(item.title, item.ingredient())
    const recipe = new FusionRecipe([portraitIngredient(a), ingredient])
    const remains = item.consumable && item.remains ? {
      id: `${item.id}-remains-${++remainsCount}`,
      orb: item.remains,
    } : undefined
    const fusion = this.startFusion({
      work: a,
      partner: {
        kind: 'item',
        id: item.id,
        consumed: item.consumable ?? false,
        ...item.orb ? {orb: true} : {},
        ...remains ? {remains: remains.id} : {},
      },
      images: recipe.looks,
      latches: recipe.latches,
      effects: recipe.effects,
      impact,
      color: recipe.glow,
    }, recipe)
    if (remains) {
      useGallery.setState(state => ({
        remains: [
          ...state.remains,
          {
            ...remains,
            position: [...fusion.frame.center],
          },
        ],
      }))
    }
    for (const look of recipe.pendingLooks) {
      void look.then(image => fusion.addImage(image), () => {})
    }
    if (recipe.unchanged) {
      notify(`The ${item.title} contributes nothing to fuse “${a.title}” with. It will come back as it went in.`)
    } else {
      notify(this.usingAi ? `The alchemy is underway. “${a.title}” stays safe until it succeeds.` : `A local ${recipe.handmade} is taking shape. No AI and no upload.`)
    }
    const photographed = ingredient.contributions.some(contribution => contribution.kind === 'image')
    try {
      await this.brew(a, fusion, recipe, current, {
        canceled: 'You canceled the fusion. The original is still here.',
        consume: item.consumable ? item.id : undefined,
        description: photographed ? `“${a.title}” was struck by ${item.title}. Neither had planned to share a frame.` : `“${a.title}” caught the ${item.title} and was never quite the same.`,
        failure: 'The fusion did not finish. The original is still here. Check the image model or try again.',
      })
    } finally {
      this.endFusion(fusion)
      this.releaseFusion(portrait, token)
      // Only a success that used the item up leaves its remains.
      if (remains && !useGallery.getState().consumed.includes(item.id)) {
        useGallery.setState(state => ({remains: state.remains.filter(entry => entry.id !== remains.id)}))
      }
      if (!(this.controller.signal.aborted as boolean)) {
        this.narrator.ready(portrait)
      }
    }
  }

  /** Makes the result of `recipe`, asking the image model for the shape `aspect` (width divided by height) of the hung portrait, or locally without AI. */
  protected async generate(recipe: FusionRecipe, signal: AbortSignal, aspect: number): Promise<SizedImage> {
    if (!this.usingAi) {
      return recipe.local()
    }
    const {default: FusionGenerator} = await import('./FusionGenerator.ts')
    const fusionGenerator = new FusionGenerator(this.access, this.settings.image_model, this.settings.ai_tier)
    const result = await fusionGenerator.generate(await recipe.content(), {
      aspect,
      signal,
    })
    return encodeGeneratedImage(result)
  }
  protected async generateFlavor(image: Blob, onPartial: (partial: Partial<Portrait>) => void, signal: AbortSignal): Promise<Partial<Portrait>> {
    const {default: FlavorGenerator} = await import('./FlavorGenerator.ts')
    const effort = ['high', 'low', 'medium', 'minimal', 'none'].includes(this.settings.text_model_effort) ? this.settings.text_model_effort : 'low'
    const flavorGenerator = new FlavorGenerator(this.access, tieredModel(this.settings.text_model, this.settings.ai_tier), effort as 'low')
    return flavorGenerator.generate(image, onPartial, signal)
  }

  /** Opens the portal that shows a fusion, which `endFusion` ends. */
  protected openFusion(spec: FusionSpec) {
    return openFusion(spec)
  }

  /** Posts the WebP `webp` of a fusion’s result, named `fileName`, to `endpoint` as the multipart form of `webhookForm`. Rejects unless the endpoint answers with a 2xx status within a minute, which also takes CORS headers that let the page read the answer. */
  protected async postResult(webp: Blob, fileName: string, info: FusionResultInfo, endpoint: string) {
    const response = await fetch(endpoint, {
      method: 'POST',
      body: webhookForm(webp, fileName, currentWorldId, info),
      // Not the director’s signal: a result that flipped out is the player’s, even once the director is replaced, like by a settings change.
      signal: AbortSignal.timeout(60_000),
    })
    if (!response.ok) {
      throw new Error(`The webhook answered with ${[response.status, response.statusText].filter(Boolean).join(' ')}.`)
    }
  }

  /** The result `image` of a fusion as a WebP: as it is where it is one already, like every new image, otherwise re-encoded, like a default work’s JXL that came back unchanged. */
  protected async resultWebp(image: Blob | string) {
    const blob = await loadBlob(image)
    return modelImageType(await blob.slice(0, 12).bytes()) === 'image/webp' ? blob : toWebp(blob)
  }

  /** Saves the WebP `webp` of a fusion’s result as the download `fileName`. */
  protected saveResult(webp: Blob, fileName: string) {
    downloadBlob(webp, fileName)
  }

  /**
   * Makes the result of `recipe` while `fusion` shows it and, if `current` still holds afterward, replaces the hung portrait `a` with it, dropping the portrait `remove` and using up the prop `consume`.
   * Where the recipe leaves `a` unchanged, as nothing but its own image was contributed, no image model is asked: `a` itself comes back out of the portal as it went in.
   * The result flips out of the portal as a loose portrait once the fusion’s climax is over; a failure shows once the fusion fizzled out, like one the player broke off by jumping into its portal, which gives up on the image at once.
   * A new image’s frame takes its shape, whatever the model made of the shape it was asked for, at the area of `a`’s frame. The result wears the frame the fusion rolled as its portal opened.
   * As it flips out, the result is also saved as a download and posted to the webhook where `?download` and `?webhook` ask for results made the way it was.
   */
  private async brew(a: Portrait, fusion: Fusion, recipe: FusionRecipe, current: () => boolean, {canceled, consume, description, failure, remove}: {
    /** the notice right as the player breaks the fusion off */
    canceled: string
    /** the id of a prop the success uses up */
    consume?: string
    /** how the description of a new portrait tells how it came to be */
    description: string
    failure: string
    remove?: string
  }) {
    // The fizzle the player saw coming on breaking the fusion off goes without a notice of its own.
    const failed = async () => {
      if (current()) {
        await fusion.fail()
        if (current() && !fusion.signal.aborted) {
          notify(failure)
        }
      }
    }
    // Broken off, the fusion tells so at once and stops waiting, even for a model that doesn’t listen to the signal.
    const broken = Promise.withResolvers<never>()
    // Broken off after the result came in, like a local one, nothing races it any more.
    broken.promise.catch(() => {})
    const breakOff = () => {
      if (current()) {
        notify(canceled)
      }
      broken.reject(fusion.signal.reason)
    }
    fusion.signal.addEventListener('abort', breakOff, {once: true})
    const trace = this.traces.get(fusion)
    const making: FusionMaking = recipe.unchanged ? 'unchanged' : (this.usingAi ? 'ai' : recipe.handmade)
    let fused: Pick<Portrait, 'height' | 'source' | 'width'> | undefined
    if (!recipe.unchanged) {
      try {
        // Image models take 15–40 s for most fusions, but now and then over 100 s.
        const signal = AbortSignal.any([this.controller.signal, fusion.signal, AbortSignal.timeout(180_000)])
        const generate = async (span?: Span) => {
          const {image, width, height} = await this.generate(recipe, signal, a.width / a.height)
          span?.setAttributes({
            width,
            height,
          })
          validateImage(image)
          return {
            source: image,
            ...imageSize(width, height, a.width * a.height * 10_000),
          }
        }
        fused = await Promise.race([trace ? trace.generate(generate) : generate(), broken.promise])
      } catch (error) {
        trace?.fail(error)
        await failed()
        return
      }
      if (!current()) {
        return
      }
    }
    await fusion.succeed(fused?.source ?? a.source)
    if (!current()) {
      return
    }
    // Broken off while the result was still being decoded.
    if (fusion.outcome?.kind !== 'success') {
      await failed()
      return
    }
    // It flips out of the portal loose, for the player to hang wherever they like.
    const released: Portrait = {
      ...a,
      ...fusion.launch(),
      frame: fusion.resultFrame,
      fusing: false,
      fusionJob: undefined,
      flavorJob: undefined,
      pending: false,
      hung: false,
      wallId: undefined,
      labelAbove: undefined,
      orientation: undefined,
    }
    const fusedAt = new Date
    // A new portrait, unless it is the hung portrait itself.
    const result: Portrait = fused ? {
      ...released,
      ...fused,
      narration: undefined,
      imported: true,
      title: 'An unexpected collaboration',
      creator: 'You · accidental alchemist',
      year: fusedAt.getFullYear(),
      description: `${description} ${this.usingAi ? 'An AI-assisted collaboration.' : recipe.localDescription}`.slice(0, 5000),
    } : released
    const state = useGallery.getState()
    // The result arrives seconds after the throw; whatever the player carries by then stays in hand.
    const {held, placement} = state
    try {
      state.commit(state.portraits.filter(p => p.id !== remove).map(p => (p.id === a.id ? result : p)))
    } catch (error) {
      trace?.fail(error)
      notify(failure)
      return
    }
    // A prop the success uses up is gone, unless the player caught it again before the portal took hold of it.
    useGallery.setState(({consumed}) => ({
      held,
      placement,
      consumed: consume && held !== consume ? [...consumed, consume] : consumed,
    }))
    fusion.emerge()
    void this.shareResult(result.source, {
      making,
      date: fusedAt,
      ingredients: recipe.ingredients.map(ingredient => ingredient.title),
    }).catch((error: unknown) => console.warn('The fusion result could not be shared.', error))
    if (!fused) {
      notify(`“${a.title}” came back as it went in.`)
      return
    }
    void this.flavor(result).catch(() => notify('The label could not be prepared.'))
  }

  private endFusion(fusion: Fusion) {
    this.fusions.delete(fusion)
    this.traces.get(fusion)?.end()
    this.traces.delete(fusion)
    fusion.finish()
  }

  private releaseFusion(id: string, token: symbol) {
    if (this.fusing.get(id) !== token) {
      return
    }
    this.fusing.delete(id)
    if (useGallery.getState().portraits.some(p => p.id === id && p.fusionJob === token)) {
      useGallery.getState().update(id, {
        fusing: false,
        reserved: false,
        fusionJob: undefined,
      })
    }
  }

  /** Shares the result `image` of a fusion as `?download` and `?webhook` ask for results made the way it was, as `<world>-fusion-<timestamp>-<making>.webp`: saved as a download and posted to the webhook. A failure only warns on the console. */
  private async shareResult(image: Blob | string, info: FusionResultInfo) {
    const download = includesResult(info.making, this.downloads)
    const post = includesResult(info.making, this.webhook)
    if (post && !this.webhookEndpoint) {
      console.warn('?webhook asks to post the fusion result, but ?webhook_endpoint gives no HTTP(S) URL to post it to.')
    }
    const {webhookEndpoint: endpoint} = this
    if (!download && !(post && endpoint)) {
      return
    }
    const fileName = `${currentWorldId}-fusion-${fileTimestamp(info.date)}-${info.making}.webp`
    let webp: Blob
    try {
      webp = await this.resultWebp(image)
    } catch (error) {
      console.warn('The fusion result could not be encoded as WebP.', error)
      return
    }
    if (download) {
      this.saveResult(webp, fileName)
      console.info(`Fusion result saved as ${fileName}.`)
    }
    if (post && endpoint) {
      const {origin} = new URL(endpoint)
      try {
        await this.postResult(webp, fileName, info, endpoint)
        console.info(`Fusion result ${fileName} posted to ${origin}.`)
      } catch (error) {
        console.warn(`The fusion result ${fileName} could not be posted to ${origin}.`, error)
      }
    }
  }

  /** Opens the portal of a fusion of `recipe` and rolls the frame its result will wear right away, so the portal has it ready by the end: the frame an ingredient contributed, otherwise that of the room the portal releases the result into. */
  private startFusion(spec: FusionSpec, recipe: FusionRecipe) {
    const fusion = this.openFusion(spec)
    fusion.resultFrame = recipe.frame ?? arrivalFrame(fusion.launch().position, spec.work.position, spec.work.id)
    this.fusions.add(fusion)
    if (telemetry) {
      const {partner} = spec
      this.traces.set(fusion, new FusionTrace(telemetry, fusion, {
        recipe,
        items: partner.kind === 'item' ? [{
          id: partner.id,
          consumed: partner.consumed ?? false,
        }] : [],
        attributes: {
          mode: this.usingAi ? 'ai' : 'local',
          aspect: spec.work.width / spec.work.height,
          room: useGallery.getState().room,
        },
      }))
    }
    return fusion
  }
}
