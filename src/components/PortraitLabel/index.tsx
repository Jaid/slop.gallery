import type {ElementTextSurface} from '#component/ElementText'
import type {Group} from 'three/webgpu'

import {useFrame} from '@react-three/fiber'
import Branch from 'branch-component'
import {useEffect, useEffectEvent, useRef, useState} from 'react'
import {Vector3} from 'three/webgpu'

import ElementText from '#component/ElementText'
import placardVoices from '#src/lib/audio/placardVoices.ts'
import {playSound} from '#src/lib/gallery.ts'
import formatByline from '#src/lib/gallery/formatByline.ts'
import PlacardRoll from '#src/lib/gallery/PlacardRoll.ts'
import portraitLabel, {portraitLabelLayout} from '#src/lib/gallery/portraitLabel.ts'

/** the painted card, which the text is painted on too, opaque, so a fusion’s warp, which bends the opaque scene, takes it along with the card */
const card: ElementTextSurface = {
  color: '#eee8d7',
  roughness: 0.6,
}

type Layout = ReturnType<typeof portraitLabelLayout>
type Preview = {
  color: string
  opacity: number
}
type PortraitLabelProps = {
  /** hangs the placard above the frame, for a low hang */
  above?: boolean
  creator?: string
  height: number
  /** whether its flavor text is being written, which leaves the card as it was until it is */
  pending?: boolean
  preview?: Preview
  title?: string
  width: number
  year?: number
}
/** what a card shows, either line possibly empty */
type Lettering = {
  byline: string
  heading: string
  /** both lines, which tells one lettering from another */
  key: string
}

const lettering = (title = '', byline = ''): Lettering => ({
  heading: title,
  byline,
  key: `${title}\n${byline}`,
})
const blank = lettering()
/** The lettering of a work’s card, blank without a title or a creator, since a year alone tells nothing worth a placard. */
const placardLettering = (title?: string, creator?: string, year?: number) => {
  if (!title && !creator) {
    return blank
  }
  return lettering(title, formatByline(creator, year))
}
/** how many cards have rolled, which tunes each roll’s sound a little apart */
let rolls = 0

/**
 * The placard of a work: its title over its creator and year on a painted card, or as a placement preview, the same on a tinted card. While its flavor text is being written, the card stays as it was, blank for a work that had none.
 * A hung card that gets new text later waits until it is rasterized, then rolls round its long axis, and the text goes on its face while that points to the wall, to the sound of `placardVoices` from where it hangs.
 */
export default function PortraitLabel({width, height, title, creator, year, pending, preview, above}: PortraitLabelProps) {
  const layout = portraitLabelLayout(width, height, above)
  const written = pending ? undefined : placardLettering(title, creator, year)
  if (preview) {
    const shown = written ?? blank
    return <group position={[0, layout.y, 0.015]} userData={{portraitLabel: false}}>
      <Board layout={layout} preview={preview} />
      <Face key={shown.key} layout={layout} lettering={shown} preview={preview} />
    </group>
  }
  return <group position={[0, layout.y, 0]} userData={{portraitLabel: true}}>
    <RollingCard layout={layout} written={written} />
  </group>
}

/** The hung card, which shows the lettering it is mounted with right away and rolls to show any `written` later. */
function RollingCard({layout, written}: {
  layout: Layout
  written?: Lettering
}) {
  const [shown, setShown] = useState(() => written ?? blank)
  const [drawn, setDrawn] = useState<string>()
  const incoming = written && written.key !== shown.key ? written : undefined
  const turning = useRef<Group>(null)
  const faces = useRef(new Map<string, Group>)
  const roll = useRef<{
    lettering: Lettering
    motion: PlacardRoll
  }>(null)
  useFrame((_, delta) => {
    if (!roll.current && incoming && drawn === incoming.key) {
      roll.current = {
        lettering: incoming,
        motion: new PlacardRoll,
      }
      if (turning.current) {
        const {x, y, z} = turning.current.getWorldPosition(new Vector3)
        const index = rolls++
        playSound(placardVoices({
          variation: Math.sin(index * 2.39996),
          width: layout.width,
        }), `placard:${index}`, [x, y, z])
      }
    }
    const current = roll.current
    if (!current || !turning.current) {
      return
    }
    const {motion} = current
    const wasTurned = motion.turned
    const running = motion.update(delta)
    // Whole turns leave it as it hangs. It rocks round the wall’s normal after rolling, which keeps it as far off the wall as the roll alone.
    turning.current.rotation.set(running ? motion.angle : 0, 0, motion.tilt, 'ZYX')
    turning.current.position.set(0, motion.rise, motion.lift)
    if (motion.turned && !wasTurned) {
      // Swapped in this very frame, while the face points to the wall; the render that follows settles on the same.
      for (const [key, face] of faces.current) {
        face.visible = key === current.lettering.key
      }
      setShown(current.lettering)
    }
    if (!running) {
      roll.current = null
    }
  })
  return <group ref={turning}>
    <Board layout={layout} />
    {(incoming ? [shown, incoming] : [shown]).map(face => <group
      key={face.key} visible={face.key === shown.key} ref={group => {
        if (!group) {
          return
        }
        faces.current.set(face.key, group)
        return () => {
          faces.current.delete(face.key)
        }
      }}
    >
      <Face layout={layout} lettering={face} onDrawn={() => setDrawn(face.key)} />
    </group>)}
  </group>
}
/** The lines of a `lettering` on the card’s face, which calls `onDrawn` once every line is rasterized. Mount one per lettering. */
function Face({layout, lettering: {heading, byline}, onDrawn, preview}: {
  layout: Layout
  lettering: Lettering
  onDrawn?: () => void
  preview?: Preview
}) {
  const [headingDrawn, setHeadingDrawn] = useState(!heading)
  const [bylineDrawn, setBylineDrawn] = useState(!byline)
  const done = headingDrawn && bylineDrawn
  const drawnEvent = useEffectEvent(() => onDrawn?.())
  useEffect(() => {
    if (done) {
      drawnEvent()
    }
  }, [done])
  const textMaterial = preview ? {
    color: preview.color,
    opacity: preview.opacity * 0.95,
    fog: false,
  } : undefined
  // The text lies on the card’s face; painted on it, it leaves no step that the ambient occlusion or the reflections would find.
  const face = portraitLabel.depth / 2 + 0.0002
  return <>
    <Branch if={heading}><ElementText color={preview ? '#ffffff' : '#3d4035'} fontFamily='Georgia' fontSize={0.63} height={0.135} materialProps={textMaterial} name='portrait-label-title' position={[0, 0.047, face]} surface={preview ? undefined : card} text={heading} width={layout.titleWidth} onReady={() => setHeadingDrawn(true)} /></Branch>
    <Branch if={byline}><ElementText color={preview ? '#ffffff' : '#696653'} fontSize={0.64} height={0.085} materialProps={textMaterial} name='portrait-label-creator' position={[0, -0.065, face]} surface={preview ? undefined : card} text={byline} width={layout.creatorWidth} onReady={() => setBylineDrawn(true)} /></Branch>
  </>
}
/** The card itself: a translucent tint while it belongs to a placement preview, otherwise the painted card. */
function Board({layout, preview}: {
  layout: Layout
  preview?: Preview
}) {
  return <mesh castShadow={!preview} name='portrait-label'>
    <boxGeometry args={[layout.width, portraitLabel.height, portraitLabel.depth]} />
    <BoardMaterial preview={preview} />
  </mesh>
}
function BoardMaterial({preview}: {preview?: Preview}) {
  if (preview) {
    return <meshBasicNodeMaterial color={preview.color} depthWrite={false} fog={false} opacity={preview.opacity * 0.22} toneMapped={false} transparent />
  }
  return <meshStandardNodeMaterial color={card.color} roughness={card.roughness} />
}
