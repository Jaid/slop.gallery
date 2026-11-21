import overlay from '#src/lib/overlay/index.ts'
import {defaultFade} from '#src/lib/overlay/layer.ts'

export const fences = overlay.addLayer({
  id: 'fences',
  color: '#0000ff',
  priority: 10,
  fade: defaultFade,
})
export const touching = overlay.addLayer({
  id: 'touching-fences',
  color: '#ff0000',
  priority: 11,
  fade: defaultFade,
})
