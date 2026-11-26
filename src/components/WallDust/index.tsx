import {useFrame} from '@react-three/fiber'
import useDisposable from 'disposable-lifetime/react'
import {useEffect, useMemo} from 'react'

import {useGallery} from '#src/lib/gallery.ts'
import {wallDust} from '#src/lib/gallery/hanging/HangingRun.ts'
import WallDustMesh from '#src/lib/gallery/hanging/WallDust.ts'

/** The dust works knock off their walls as they hang, in whichever world is loaded. It is drawn behind the loading screen, so its pipeline has compiled by the first hanging, and afterward only while dust is in the air. */
export default function WallDust() {
  const dust = useDisposable(useMemo(() => new WallDustMesh, []))
  useEffect(() => {
    wallDust.current = dust
    return () => {
      if (wallDust.current === dust) {
        wallDust.current = null
      }
    }
  }, [dust])
  useFrame((_, delta) => {
    dust.advance(delta, !useGallery.getState().ready)
  })
  return <primitive object={dust} />
}
