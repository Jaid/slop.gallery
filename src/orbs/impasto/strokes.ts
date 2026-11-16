import {Vector3} from 'three/webgpu'

/** Pigments laid side by side, never blended to mud: warm ivory, cadmium, coral, ultramarine and teal. Repeated ivory strokes leave breathing room between the stronger colors. */
export const impastoPalette = ['#f3dfb1', '#e9aa32', '#df6848', '#304c9c', '#378b80', '#fff1d4'] as const

/** The little sculpture inside the glass, in orb radii: broad, thick dabs laid tangentially around a golden-angle spiral. Their long axes turn across the spiral like strokes laid by a palette knife. No point reaches the glass. */
export const impastoStrokes = Array.from({length: 20}, (_, index) => {
  const y = 1 - (index + 0.5) * 2 / 20
  const angle = index * Math.PI * (3 - Math.sqrt(5))
  const radial = Math.sqrt(1 - y * y)
  const normal = new Vector3(radial * Math.cos(angle), y, radial * Math.sin(angle))
  const tangent = new Vector3(-Math.sin(angle), 0, Math.cos(angle))
  const bitangent = new Vector3
  bitangent.crossVectors(normal, tangent)
  const turn = 0.5 + Math.sin(index * 2.7) * 0.4
  const along = tangent.clone().multiplyScalar(Math.cos(turn)).addScaledVector(bitangent, Math.sin(turn))
  const across = new Vector3
  across.crossVectors(normal, along)
  return {
    center: normal.clone().multiplyScalar(0.58 + Math.sin(index * 2.1) * 0.035),
    along,
    across,
    normal,
    radii: [0.34 + Math.sin(index * 1.7) * 0.025, 0.16 + Math.cos(index * 2.3) * 0.025, 0.115] as const,
    pigment: index % impastoPalette.length,
  }
})
