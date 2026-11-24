import type {ElementTextSurface} from '#component/ElementText'

import Branch from 'branch-component'

import ElementText from '#component/ElementText'
import portraitLabel, {portraitLabelLayout} from '#src/lib/gallery/portraitLabel.ts'

/** the painted card, which the text is painted on too, opaque, so a fusion’s warp, which bends the opaque scene, takes it along with the card */
const card: ElementTextSurface = {
  color: '#eee8d7',
  roughness: 0.6,
}

type PortraitLabelProps = {
  /** hangs the placard above the frame, for a low hang */
  above?: boolean
  creator?: string
  height: number
  pending?: boolean
  preview?: {
    color: string
    opacity: number
  }
  title?: string
  width: number
}

/** The placard of a work: its title and creator on a painted card, along with a note while its flavor text is being written, or as a placement preview, the same on a tinted card, which is blank for a work with nothing to show. */
export default function PortraitLabel({width, height, title, creator, pending, preview, above}: PortraitLabelProps) {
  const layout = portraitLabelLayout(width, height, above)
  const textMaterial = preview ? {
    color: preview.color,
    opacity: preview.opacity * 0.95,
    fog: false,
  } : undefined
  // The text lies on the card’s face; painted on it, it leaves no step that the ambient occlusion or the reflections would find.
  const face = portraitLabel.depth / 2 + 0.0002
  const heading = title || (pending ? 'Finding the right words…' : '')
  const byline = [creator, pending && 'writing…'].filter(Boolean).join(' · ')
  return <group position={[0, layout.y, preview ? 0.015 : 0]} userData={{portraitLabel: !preview}}>
    <mesh castShadow={!preview} name='portrait-label'>
      <boxGeometry args={[layout.width, portraitLabel.height, portraitLabel.depth]} />
      <LabelBoardMaterial preview={preview} />
    </mesh>
    <Branch if={heading}><ElementText color={preview ? '#ffffff' : '#3d4035'} fontFamily='Georgia' fontSize={0.63} height={0.135} materialProps={textMaterial} name='portrait-label-title' position={[0, 0.047, face]} surface={preview ? undefined : card} text={heading} width={layout.titleWidth} /></Branch>
    <Branch if={byline}><ElementText color={preview ? '#ffffff' : '#696653'} fontSize={0.64} height={0.085} materialProps={textMaterial} name='portrait-label-creator' position={[0, -0.065, face]} surface={preview ? undefined : card} text={byline} width={layout.creatorWidth} /></Branch>
  </group>
}

/** A translucent tint while the label belongs to a placement preview, otherwise the painted card. */
function LabelBoardMaterial({preview}: Pick<PortraitLabelProps, 'preview'>) {
  if (preview) {
    return <meshBasicNodeMaterial color={preview.color} depthWrite={false} fog={false} opacity={preview.opacity * 0.22} toneMapped={false} transparent />
  }
  return <meshStandardNodeMaterial color={card.color} roughness={card.roughness} />
}
