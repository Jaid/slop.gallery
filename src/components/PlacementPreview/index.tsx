import type PortraitFrame from '#src/frames/base/PortraitFrame.ts'

import {useFrame} from '@react-three/fiber'
import useDisposable from 'disposable-lifetime/react'
import {useMemo} from 'react'

import PortraitLabel from '#component/PortraitLabel'
import {useGallery} from '#src/lib/gallery.ts'
import portraitLabel, {portraitLabelLayout} from '#src/lib/gallery/portraitLabel.ts'
import useArtworkTexture from '#src/lib/useArtworkTexture.ts'

import PreviewVisual, {previewColors, previewOpacity} from './PreviewVisual.ts'

export default function PlacementPreview({width, height, frame, source, title, creator, pending}: {
  creator?: string
  /** the frame the work hangs in, whose image and front the preview lies just in front of */
  frame: PortraitFrame
  height: number
  pending?: boolean
  source?: Blob | string
  title?: string
  width: number
}) {
  const {texture} = useArtworkTexture(source)
  const valid = useGallery(s => s.placement?.valid === true)
  const inReach = useGallery(s => s.placement?.inReach === true)
  // The placard previews on the side it would hang, which flips when only the placard blocks a spot.
  const above = useGallery(s => s.placement?.labelAbove === true)
  const label = portraitLabelLayout(width, height, above)
  const visual = useDisposable(useMemo(() => new PreviewVisual(width, height, frame.reach, texture), [frame, height, texture, width]))
  useFrame((_, delta) => {
    const {placement} = useGallery.getState()
    visual.update(placement?.valid === true, delta, placement?.inReach === true)
  })
  return <>
    <mesh position={[0, 0, frame.imageDepth + 0.01]}>
      <planeGeometry args={[width, height]} />
      <primitive attach='material' object={visual.imageMaterial} />
    </mesh>
    <mesh position={[0, 0, frame.front + 0.01]}>
      <primitive attach='geometry' object={visual.border} />
      <primitive attach='material' object={visual.borderMaterial} />
    </mesh>
    <PortraitLabel
      above={above} creator={creator} height={height} pending={pending} preview={{
        color: valid ? previewColors.valid : previewColors.invalid,
        opacity: previewOpacity(inReach),
      }} title={title} width={width}
    />
    <mesh position={[0, label.y, portraitLabel.depth / 2 + 0.018]}>
      <primitive attach='geometry' object={visual.labelBorder} />
      <primitive attach='material' object={visual.labelBorderMaterial} />
    </mesh>
  </>
}
