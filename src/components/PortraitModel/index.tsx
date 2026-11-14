import type {Portrait} from '#src/lib/gallery.ts'

import useDisposable from 'disposable-lifetime/react'
import {useMemo} from 'react'

import DynamicImageMaterial from '#component/DynamicImageMaterial'
import {portraitFrame} from '#src/frames/index.ts'

/** The actual frame and image, without the world’s body, label or interactions, also shown in the pause menu’s studio. Shared frame materials belong to the frame catalog, not to this instance. */
export default function PortraitModel({held = false, portrait: p}: {
  held?: boolean
  portrait: Pick<Portrait, 'frame' | 'height' | 'source' | 'width'>
}) {
  const frame = portraitFrame(p.frame)
  const geometry = useDisposable(useMemo(() => frame.createGeometry(p.width, p.height), [frame, p.width, p.height]))
  return <>
    {/* Only held works fade in the world; the studio fades its whole canvas instead. */}
    <mesh castShadow geometry={geometry} material={held ? frame.heldMaterial : frame.materials} name='portrait-frame' receiveShadow />
    {/* The frame’s backing blocks light from the front, the image blocks it from behind. */}
    <mesh castShadow name='portrait-image' position={[0, 0, frame.imageDepth]}><planeGeometry args={[p.width, p.height]} /><DynamicImageMaterial opacity={held ? 0.3 : 1} source={p.source} toneMapped={false} transparent={held} /></mesh>
  </>
}
