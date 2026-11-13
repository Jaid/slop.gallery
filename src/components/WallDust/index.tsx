import {useFrame} from '@react-three/fiber'
import useDisposable from 'disposable-lifetime/react'
import {useEffect, useMemo, useRef} from 'react'

import {isWorldClockPaused} from '#src/lib/frozenTime.ts'
import {useGallery} from '#src/lib/gallery.ts'
import {wallDust} from '#src/lib/gallery/hanging/HangingRun.ts'
import WallDustMesh from '#src/lib/gallery/hanging/WallDust.ts'

/** how long the dust is drawn after it mounts, in seconds, so its pipeline has compiled by the first hanging, as when heavy graphics are switched on in the middle of a game */
const warmup = 1

/** The dust works knock off their walls as they hang, in whichever world is loaded. It is drawn behind the loading screen and for a moment after it mounts, so its pipeline has compiled by the first hanging, and afterward only while dust is in the air. */
export default function WallDust() {
  const dust = useDisposable(useMemo(() => new WallDustMesh, []))
  const mounted = useRef(0)
  useEffect(() => {
    wallDust.current = dust
    return () => {
      if (wallDust.current === dust) {
        wallDust.current = null
      }
    }
  }, [dust])
  useFrame((_, delta) => {
    if (isWorldClockPaused()) {
      return
    }
    mounted.current += delta
    dust.advance(delta, mounted.current < warmup || !useGallery.getState().ready)
  })
  return <primitive object={dust} />
}
