import type {ThreeElements} from '@react-three/fiber'

import Branch from 'branch-component'
import {useMemo} from 'react'
import {useGraphicsModeValue} from 'use-graphics-mode'

import {fitted} from '#src/lib/fitLines.ts'
import {getGraphicsProfile} from '#src/lib/rendering/graphicsMode.ts'
import useLoadingElementTexture from '#src/lib/useLoadingElementTexture.ts'

import css from './style.module.sass'

/** a lit surface the text is painted on, like a card */
export type ElementTextSurface = {
  color: string
  roughness: number
}
type FaceProps = {
  /** the surface’s color behind the text; without one, the face stays see-through */
  background?: string
  color: string
  /** a CSS font-family value, so a generic family like sans-serif stays unquoted and a list of fallbacks works */
  fontFamily: string
  /** the text’s size before it is fitted, in the face’s pixels */
  fontSize: number
  fontWeight: number | string
  height: number
  /** how much of the face’s width the text may take */
  maxWidth: number
  text: string
  width: number
}
type ElementTextProps = Omit<ThreeElements['mesh'], 'children'> & {
  color?: string
  fontFamily?: string
  fontSize?: number
  fontWeight?: number | string
  height: number
  /** for text without a surface */
  materialProps?: Omit<ThreeElements['meshBasicNodeMaterial'], 'map'>
  maxWidth?: number
  /** the surface behind the text: its color fills the face and the text shades like it, opaque, so it reads as painted on the surface, which it is drawn onto with a depth bias, so it can lie right on it; without one, the text floats unlit and see-through */
  surface?: ElementTextSurface
  text: string
  width: number
}
const textureWidth = 1536

/** One centered line of text, shrunk until it fits. */
export function Face({background, color, fontFamily, fontSize, fontWeight, height, maxWidth, text, width}: FaceProps) {
  return <div
    className={css.face} style={{
      width,
      height,
      background,
    }}
  >
    <div
      className={css.line} style={{
        maxWidth: `${maxWidth * 100}%`,
        color,
        fontFamily,
        fontSize,
        fontWeight,
      }} {...fitted}
    >{text}</div>
  </div>
}

/** A line of text laid out as HTML, fitted into `width` × `height` meters; until it is rasterized, it is listed as the loading item `element-text:<text>` and hidden. */
const ElementText = ({color = '#ffffff', fontFamily = 'sans-serif', fontSize = 0.7, fontWeight = 400, height, maxWidth = 0.9, materialProps, surface, text, width, ...meshProps}: ElementTextProps) => {
  const {canvasTextureMipmaps: mipmaps} = useGraphicsModeValue(getGraphicsProfile)
  const background = surface?.color
  const texture = useLoadingElementTexture(`element-text:${text}`, useMemo(() => {
    const textureHeight = Math.max(64, Math.round(textureWidth * height / width))
    return {
      width: textureWidth,
      height: textureHeight,
      name: `Element text: ${text}`,
      mipmaps,
      render: () => <Face background={background} color={color} fontFamily={fontFamily} fontSize={Math.max(12, Math.floor(textureHeight * fontSize))} fontWeight={fontWeight} height={textureHeight} maxWidth={maxWidth} text={text} width={textureWidth} />,
    }
  }, [background, color, fontFamily, fontSize, fontWeight, height, maxWidth, mipmaps, text, width]))
  return <mesh {...meshProps} visible={Boolean(texture) && meshProps.visible !== false}>
    <planeGeometry args={[width, height]} />
    <Branch if={surface} else={<meshBasicNodeMaterial key={texture?.uuid ?? 'pending'} {...materialProps} depthWrite={false} map={texture} toneMapped={false} transparent />}><meshStandardNodeMaterial key={texture?.uuid ?? 'pending'} map={texture} polygonOffset polygonOffsetFactor={-1} polygonOffsetUnits={-1} roughness={surface?.roughness} /></Branch>
  </mesh>
}
export default ElementText
