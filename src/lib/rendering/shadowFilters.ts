import useGraphicsMode, {useGraphicsModeValue} from 'use-graphics-mode'
import {useShallow} from 'zustand/react/shallow'

import {isDevelopmentMode} from '../developmentMode.ts'
import {useCustomGraphics} from './customGraphics.ts'
import {getGraphicsProfile} from './graphicsMode.ts'
import {getShadowProps, tunableFilters} from './shadowFilterNodes.ts'

/**
 * Shadow props for a light whose map is `mapSize` texels wide in heavy graphics, scaled to the graphics mode.
 * The filter radius grows with the map, so a larger map keeps the penumbra’s width and only resolves it finer.
 * In heavy graphics with `?development`, the tuning panel sets the lookups and the radius.
 * A `softenable` point light’s shadow blurs wider whenever its shadow asks for it, see `softenShadow`.
 */
export function useShadowProps(mapSize: number, {isPoint = false, radius = 1, softenable = false}: {
  isPoint?: boolean
  radius?: number
  softenable?: boolean
} = {}) {
  const isHeavy = useGraphicsMode()
  const {lampShadowRadius, shadowMapScale, shadowSamples} = useGraphicsModeValue(getGraphicsProfile)
  const tuned = useCustomGraphics(useShallow(state => ({
    radius: state.lampShadowRadius,
    samples: state.lampShadowSamples,
  })))
  if (isDevelopmentMode && isHeavy) {
    return {
      'shadow-filterNode': isPoint ? (softenable ? tunableFilters.softPoint : tunableFilters.point) : tunableFilters.pcf,
      'shadow-filterSamples': tuned.samples,
      'shadow-mapSize': [mapSize * shadowMapScale, mapSize * shadowMapScale] as const,
      'shadow-radius': radius * tuned.radius,
    }
  }
  return getShadowProps({
    isPoint,
    mapSize: mapSize * shadowMapScale,
    radius: radius * (lampShadowRadius ?? shadowMapScale),
    samples: shadowSamples,
    softenable,
  })
}
