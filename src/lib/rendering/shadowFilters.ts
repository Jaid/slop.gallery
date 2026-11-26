import {useShallow} from 'zustand/react/shallow'

import {isDevelopmentMode} from '../developmentMode.ts'
import {pipelineTuning} from '../worldTuning/PipelineTuningModule.ts'
import {graphicsProfile, isHeavyGraphics} from './graphicsMode.ts'
import {getShadowProps, tunableFilters} from './shadowFilterNodes.ts'

type ShadowPropsOptions = {
  isPoint?: boolean
  radius?: number
  softenable?: boolean
}

const {lampShadowRadius, shadowMapScale, shadowSamples} = graphicsProfile
function useTunedShadowProps(mapSize: number, {isPoint = false, radius = 1, softenable = false}: ShadowPropsOptions = {}) {
  const tuned = pipelineTuning.useValues(useShallow(state => ({
    radius: state.lampShadowRadius,
    samples: state.lampShadowSamples,
  })))
  return {
    'shadow-filterNode': isPoint ? (softenable ? tunableFilters.softPoint : tunableFilters.point) : tunableFilters.pcf,
    'shadow-filterSamples': tuned.samples,
    'shadow-mapSize': [mapSize * shadowMapScale, mapSize * shadowMapScale] as const,
    'shadow-radius': radius * tuned.radius,
  }
}
function staticShadowProps(mapSize: number, {isPoint = false, radius = 1, softenable = false}: ShadowPropsOptions = {}) {
  return getShadowProps({
    isPoint,
    mapSize: mapSize * shadowMapScale,
    radius: radius * (lampShadowRadius ?? shadowMapScale),
    samples: shadowSamples,
    softenable,
  })
}

/**
 * Shadow props for a light whose map is `mapSize` texels wide in heavy graphics, scaled to the graphics mode.
 * The filter radius grows with the map, so a larger map keeps the penumbra’s width and only resolves it finer.
 * In heavy graphics with `?development`, the world tuning sets the lookups and the radius.
 * A `softenable` point light’s shadow blurs wider whenever its shadow asks for it, see `softenShadow`.
 */
export const useShadowProps = isDevelopmentMode && isHeavyGraphics ? useTunedShadowProps : staticShadowProps
