import type {ThreeElements} from '@react-three/fiber'

import Branch from 'branch-component'
import {loadCanvasFonts} from 'canvas-textures'
import {useMemo} from 'react'
import {useGraphicsModeValue} from 'use-graphics-mode'

import {getGraphicsProfile} from '#src/lib/rendering/graphicsMode.ts'
import useLoadingCanvasTexture from '#src/lib/useLoadingCanvasTexture.ts'

/** a lit surface the text is painted on, like a card */
export type CanvasTextSurface = {
  color: string
  roughness: number
}
type CanvasTextProps = Omit<ThreeElements['mesh'], 'children'> & {
  color?: string
  fontFamily?: string
  fontSize?: number
  fontWeight?: number | string
  height: number
  /** for text without a surface */
  materialProps?: Omit<ThreeElements['meshBasicNodeMaterial'], 'map'>
  maxWidth?: number
  /** the surface behind the text: its color fills the canvas and the text shades like it, opaque, so it reads as painted on the surface, which it is drawn onto with a depth bias, so it can lie right on it; without one, the text floats unlit and see-through */
  surface?: CanvasTextSurface
  text: string
  width: number
}
const textureWidth = 1536
/** A line of text drawn on a canvas, fitted into `width` × `height` meters; until it is drawn, it is listed as the loading item `canvas-text:<text>` and hidden. */
const CanvasText = ({color = '#ffffff', fontFamily = 'sans-serif', fontSize = 0.7, fontWeight = 400, height, maxWidth = 0.9, materialProps, surface, text, width, ...meshProps}: CanvasTextProps) => {
  const {canvasTextureMipmaps: mipmaps} = useGraphicsModeValue(getGraphicsProfile)
  const background = surface?.color
  const texture = useLoadingCanvasTexture(`canvas-text:${text}`, useMemo(() => ({
    width: textureWidth,
    height: Math.max(64, Math.round(textureWidth * height / width)),
    name: `Canvas text: ${text}`,
    mipmaps,
    prepare: () => loadCanvasFonts([
      {
        font: `${fontWeight} 16px "${fontFamily}"`,
        text,
      },
    ]),
    draw(context: CanvasRenderingContext2D) {
      const canvas = context.canvas
      if (background) {
        context.fillStyle = background
        context.fillRect(0, 0, canvas.width, canvas.height)
      }
      const requestedPx = Math.max(12, Math.floor(canvas.height * fontSize))
      context.font = `${fontWeight} ${requestedPx}px "${fontFamily}"`
      const measured = context.measureText(text).width || 1
      const targetWidth = canvas.width * maxWidth
      const fittedPx = Math.max(10, Math.floor(requestedPx * Math.min(1, targetWidth / measured)))
      context.font = `${fontWeight} ${fittedPx}px "${fontFamily}"`
      context.fillStyle = color
      context.textAlign = 'center'
      context.textBaseline = 'middle'
      context.fillText(text, canvas.width / 2, canvas.height / 2)
    },
  }), [background, color, fontFamily, fontSize, fontWeight, height, maxWidth, mipmaps, text, width]))
  return <mesh {...meshProps} visible={Boolean(texture) && meshProps.visible !== false}>
    <planeGeometry args={[width, height]} />
    <Branch if={surface} else={<meshBasicNodeMaterial key={texture?.uuid ?? 'pending'} {...materialProps} depthWrite={false} map={texture} toneMapped={false} transparent />}><meshStandardNodeMaterial key={texture?.uuid ?? 'pending'} map={texture} polygonOffset polygonOffsetFactor={-1} polygonOffsetUnits={-1} roughness={surface?.roughness} /></Branch>
  </mesh>
}
export default CanvasText
