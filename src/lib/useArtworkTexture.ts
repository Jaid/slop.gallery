import type {Texture} from 'three/webgpu'

import {useEffect, useState} from 'react'

import loadArtworkTexture from './loadArtworkTexture.ts'
import {trackLoadingPromise} from './loadingItems.ts'

type Asset = {
  promise: Promise<Texture<HTMLCanvasElement>>
  refs: number
  texture?: Texture<HTMLCanvasElement>
}
const assets = new Map<Blob | string, Asset>
let pending = 0
let blobs = 0
export const pendingImages = () => pending

export default function useArtworkTexture(source: Blob | string | null | undefined) {
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
    const entry = acquire(source)
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
export function holdArtworkTexture(source: Blob | string) {
  const entry = acquire(source)
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

function acquire(source: Blob | string) {
  let asset = assets.get(source)
  if (!asset) {
    pending++
    const promise = trackLoadingPromise(`artwork:${typeof source === 'string' ? source : (source as Partial<File>).name ?? `blob-${++blobs}`}`, loadArtworkTexture(source).finally(() => {
      pending--
    }))
    asset = {
      refs: 0,
      promise,
    }
    const entry = asset
    void promise.then(texture => {
      entry.texture = texture
    }).catch(error => {
      if (assets.get(source) === entry) {
        assets.delete(source)
      }
      console.warn('Artwork texture failed to load:', source, error)
    })
    assets.set(source, asset)
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
