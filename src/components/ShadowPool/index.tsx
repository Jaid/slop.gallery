import {useLayoutEffect} from 'react'

import {useShadowProps} from '#src/lib/rendering/shadowFilters.ts'
import {shadowPool} from '#src/lib/rendering/shadowPool.ts'

/**
 * Mounts the shadow pool’s lights at the scene’s root, which lets the pool lend them to lights asking for a shadow with `userData.shadow`.
 * The first `softenable` of them can blur their shadows wider than every lamp’s, each adding that blur to every lit material’s shader, so a scene only asks for as many as it has lights that may want it.
 */
export default function ShadowPool({softenable = 1}: {softenable?: number}) {
  const shadow = useShadowProps(1024, {isPoint: true})
  const soft = useShadowProps(1024, {
    isPoint: true,
    softenable: true,
  })
  // Before the first frame hands out the slots.
  useLayoutEffect(() => {
    const before = shadowPool.softenable
    shadowPool.softenable = softenable
    return () => {
      shadowPool.softenable = before
    }
  }, [softenable])
  return <>
    {shadowPool.slots.map((slot, index) => <primitive key={slot.name} object={slot} {...index < softenable ? soft : shadow} />)}
  </>
}
