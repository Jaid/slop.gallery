import type PortraitFrame from '#src/frames/base/PortraitFrame.ts'
import type {ReactNode} from 'react'

import useDisposable from 'disposable-lifetime/react'
import {useMemo} from 'react'

/** The two visible meshes of a portrait. Its image material goes on a plane measured in meters, recessed into the frame’s sight. */
export default function FramedImage({children, frame, height, held = false, width}: {
  children: ReactNode
  frame: PortraitFrame
  height: number
  held?: boolean
  width: number
}) {
  const geometry = useDisposable(useMemo(() => frame.createGeometry(width, height), [frame, width, height]))
  return <>
    <mesh castShadow geometry={geometry} material={held ? frame.heldMaterial : frame.materials} name='portrait-frame' receiveShadow />
    {/* Shadows draw back faces only: the backing board blocks the lights in front of the work and the image those behind it. */}
    <mesh castShadow name='portrait-image' position-z={frame.imageDepth}><planeGeometry args={[width, height]} />{children}</mesh>
  </>
}
