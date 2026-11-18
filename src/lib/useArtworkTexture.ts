import type {Texture} from 'three/webgpu'

import {useEffect, useState} from 'react'

import loadArtworkTexture from './loadArtworkTexture.ts'
import {trackLoadingPromise} from './loadingItems.ts'

type Asset = {
  promise: Promise<Texture<HTMLCanvasElement>>
  refs: number
  texture?: Texture<HTMLCanvasElement>
}
type QueuedLoad = {
  priority: number
  start: () => void
}

const assets = new Map<Blob | string, Asset>
const queuedLoads = new Map<Asset, QueuedLoad>
let flushing = false
let pending = 0
let blobs = 0
export const pendingImages = () => pending
/** what an artwork shows as in place of its image: while it loads and after it failed to */
export const artworkPlaceholders = {
  loading: '#ded6c5',
  failed: '#a17969',
} as const

export default function useArtworkTexture(source: Blob | string | null | undefined, priority = 0) {
  const [result, setResult] = useState<{
    failed: boolean
    texture: Texture<HTMLCanvasElement> | null
  }>({
    texture: null,
    failed: false,
  })
  useEffect(() => {
    if (!source) {
      setResult({
        texture: null,
        failed: false,
      })
      return
    }
    const entry = acquire(source, priority)
    let active = true
    setResult({
      texture: entry.texture ?? null,
      failed: false,
    })
    void entry.promise.then(texture => {
      if (active) {
        setResult({
          texture,
          failed: false,
        })
      }
    }).catch(() => {
      if (active) {
        setResult({
          texture: null,
          failed: true,
        })
      }
    })
    return () => {
      active = false
      release(source, entry)
    }
  }, [source])
  return result
}

/** Loads the artwork’s texture into the cache the artworks share and keeps it there until released, so whatever shows the artwork next finds it decoded; `texture` resolves with it. */
export function holdArtworkTexture(source: Blob | string, priority = 0) {
  const entry = acquire(source, priority)
  let held = true
  return {
    texture: entry.promise,
    release: () => {
      if (held) {
        held = false
        release(source, entry)
      }
    },
  }
}

/** The artwork as already decoded for the texture the artworks share, like a work the world shows, without loading it; undefined while no texture of it is ready. */
export function peekArtworkImage(source: Blob | string) {
  return assets.get(source)?.texture?.image
}

export function acquireArtworkTexture(source: Blob | string, priority = 0, load = loadArtworkTexture) {
  return acquire(source, priority, load)
}

function flushLoads() {
  flushing = false
  const items = queuedLoads.values().toArray().toSorted((a, b) => a.priority - b.priority)
  queuedLoads.clear()
  for (const item of items) {
    item.start()
  }
}
function acquire(source: Blob | string, priority = 0, load = loadArtworkTexture) {
  let asset = assets.get(source)
  if (!asset) {
    pending++
    let cancelled = false
    const deferred = Promise.withResolvers<Texture<HTMLCanvasElement>>()
    const promise = trackLoadingPromise(`artwork:${typeof source === 'string' ? source : (source as Partial<File>).name ?? `blob-${++blobs}`}`, deferred.promise.finally(() => {
      pending--
    }))
    const entry: Asset = {
      refs: 0,
      promise,
    }
    void promise.then(texture => {
      entry.texture = texture
    }).catch(error => {
      if (assets.get(source) === entry) {
        assets.delete(source)
      }
      if (!cancelled) {
        console.warn('Artwork texture failed to load:', source, error)
      }
    })
    assets.set(source, entry)
    queuedLoads.set(entry, {
      priority,
      start: () => {
        if (entry.refs === 0) {
          cancelled = true
          if (assets.get(source) === entry) {
            assets.delete(source)
          }
          deferred.reject(new Error('Cancelled before load'))
          return
        }
        void load(source).then(deferred.resolve, deferred.reject)
      },
    })
    if (!flushing) {
      flushing = true
      queueMicrotask(flushLoads)
    }
    asset = entry
  } else {
    const queued = queuedLoads.get(asset)
    if (queued && priority < queued.priority) {
      queued.priority = priority
    }
  }
  asset.refs++
  return asset
}
function release(source: Blob | string, entry: Asset) {
  entry.refs--
  queueMicrotask(() => {
    if (entry.refs !== 0) {
      return
    }
    if (assets.get(source) === entry) {
      assets.delete(source)
    }
    void entry.promise.then(texture => texture.dispose()).catch(() => {})
  })
}
