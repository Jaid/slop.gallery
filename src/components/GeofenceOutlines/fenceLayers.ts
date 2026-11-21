import overlay from '#src/lib/overlay/index.ts'

export const fences = overlay.addLayer({
  id: 'fences',
  color: '#0000ff',
  priority: 10,
})
export const touching = overlay.addLayer({
  id: 'touching-fences',
  color: '#ff0000',
  priority: 11,
})
