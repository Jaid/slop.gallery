import {useShadowProps} from '#src/lib/rendering/shadowFilters.ts'
import {shadowPool} from '#src/lib/rendering/shadowPool.ts'

/** Mounts the shadow pool’s lights at the scene’s root, which lets the pool lend them to lights asking for a shadow with `userData.shadow`. */
export default function ShadowPool() {
  const shadow = useShadowProps(1024, {isPoint: true})
  const softenable = useShadowProps(1024, {
    isPoint: true,
    softenable: true,
  })
  return <>
    {shadowPool.slots.map(slot => <primitive key={slot.name} object={slot} {...shadowPool.isSoftenable(slot) ? softenable : shadow} />)}
  </>
}
