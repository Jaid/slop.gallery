import hsl from 'okhsl'

import overlay from '#src/lib/overlay/index.ts'
import {defaultFade} from '#src/lib/overlay/layer.ts'

export const fences = overlay.addLayer({
  id: 'fences',
  color: hsl.integer(264.06, 100, 36.6),
  priority: 10,
  fade: defaultFade,
})
export const touching = overlay.addLayer({
  id: 'touching-fences',
  color: hsl.integer(29.2, 100, 56.8),
  priority: 11,
  fade: defaultFade,
})
