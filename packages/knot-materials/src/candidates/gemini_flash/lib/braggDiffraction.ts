import type {Node} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float} from 'three/tsl'

/**
 * Bragg diffraction play-of-color for photonic crystals and precious opals.
 * Computes spectral wavelength selection from the lattice plane alignment with the half-vector.
 */
export function braggDiffraction(
  latticeNormal: Node<'vec3'>,
  halfVector: Node<'vec3'>,
  dSpacing: Node<'float'> | number,
  sharpness = 40,
) {
  const spacing = typeof dSpacing === 'number' ? float(dSpacing) : dSpacing
  const lambda = latticeNormal.dot(halfVector).clamp().mul(spacing)
  const redGate = lambda.sub(0.65).abs().mul(-sharpness).exp()
  const greenGate = lambda.sub(0.53).abs().mul(-sharpness).exp()
  const blueGate = lambda.sub(0.44).abs().mul(-sharpness).exp()
  return color(hsl.integer(23.5, 100, 57.8)).mul(redGate)
    .add(color(hsl.integer(147.4, 99.2, 81)).mul(greenGate))
    .add(color(hsl.integer(260.5, 100, 54)).mul(blueGate))
}
