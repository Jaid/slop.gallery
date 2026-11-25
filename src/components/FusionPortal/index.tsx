import type Fusion from '#src/lib/gallery/fusion/Fusion.ts'

import {useFrame} from '@react-three/fiber'
import useDisposable from 'disposable-lifetime/react'
import {useLayoutEffect, useMemo} from 'react'

import {usePortraitFrame} from '#src/frames/index.ts'
import {bodyPose, flingPlayer} from '#src/lib/gallery.ts'
import {portalRebound, touchesPortal} from '#src/lib/gallery/fusion/portalFrame.ts'

import PortalShow from './PortalShow.ts'

/** A fusion’s portal, with its light, its sound and what orbits it, for as long as the fusion is open. The player breaks the fusion off by jumping into it, which throws them back the way they came; walking up to it does nothing, and neither does flying through it, out of the physics. */
export default function FusionPortal({fusion}: {fusion: Fusion}) {
  const show = useDisposable(useMemo(() => new PortalShow(fusion), [fusion]))
  const frame = usePortraitFrame(fusion.resultFrame)
  useLayoutEffect(() => show.rehearseFrame(frame), [frame, show])
  useFrame(({camera}) => {
    if (!bodyPose.flying && !bodyPose.grounded && touchesPortal(fusion.frame, bodyPose) && fusion.cancel()) {
      flingPlayer(portalRebound(fusion.frame, bodyPose))
    }
    show.update(fusion.elapsed(), camera)
  })
  return <primitive object={show.root} />
}
