import type {CanvasMaterialId} from '#src/canvas_materials/index.ts'
import type {ImageSize} from '#src/canvas_materials/lib/canvasSurface.ts'
import type {ThreeElements} from '@react-three/fiber'
import type {Texture} from 'three/webgpu'

import {useFrame} from '@react-three/fiber'
import useDisposable from 'disposable-lifetime/react'
import hsl from 'okhsl'
import {useLayoutEffect, useMemo, useRef} from 'react'

import {canvasMaterials} from '#src/canvas_materials/index.ts'
import {startLoading} from '#src/lib/loadingItems.ts'
import useArtworkTexture, {artworkPlaceholders} from '#src/lib/useArtworkTexture.ts'

/** The image of an artwork, flat and unlit, or on the canvas material named once the image has loaded, its features as large in meters as the whole image spans `size`. A transparent one always shows flat. */
export default function DynamicImageMaterial({canvasMaterial, size, source, ...props}: Omit<ThreeElements['meshBasicNodeMaterial'], 'map'> & {
  canvasMaterial?: CanvasMaterialId
  size: ImageSize
  source?: Blob | string | null
}) {
  const {texture, failed} = useArtworkTexture(source)
  if (texture && canvasMaterial && !props.transparent) {
    return <CanvasImageMaterial height={size.height} kind={canvasMaterial} texture={texture} width={size.width} />
  }
  // Switching between opaque and transparent needs a fresh material, so the transparency is part of the key.
  return <meshBasicNodeMaterial key={`${texture?.uuid ?? 'loading'}-${String(props.transparent)}`} {...props} color={texture ? hsl.integer(0, 0, 100) : (failed ? artworkPlaceholders.failed : artworkPlaceholders.loading)} map={texture} />
}

/** The image on a material of its own of the canvas material, which goes with the image. */
function CanvasImageMaterial({height, kind, texture, width}: ImageSize & {
  kind: CanvasMaterialId
  texture: Texture
}) {
  const material = useDisposable(useMemo(() => canvasMaterials[kind].createMaterial(texture, {
    width,
    height,
  }), [kind, texture, width, height]))
  // Its pipeline only counts as loading once a frame tries to draw it, and the image is no longer loading by then, so the material counts as loading itself until that frame is over and captures don’t catch the frame empty.
  const loading = useRef<{
    frames: number
    loaded: () => void
  }>(undefined)
  useLayoutEffect(() => {
    const loaded = startLoading(`canvas-material:${kind}`)
    loading.current = {
      frames: 0,
      loaded,
    }
    return loaded
  }, [kind, material])
  useFrame(() => {
    const current = loading.current
    // Frame callbacks run before the frame draws, so the second one comes after the first frame that drew it.
    if (current && ++current.frames >= 2) {
      current.loaded()
      loading.current = undefined
    }
  })
  return <primitive attach='material' object={material} />
}
