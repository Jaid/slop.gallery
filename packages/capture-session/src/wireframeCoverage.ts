import type {Node} from 'three/webgpu'

/** Coverage of an antialiased edge, from its distance in derivative-scaled screen pixels and half its requested width. */
export default function wireframeCoverage(distance: Node<'float'>, halfWidth: Node<'float'>) {
  return halfWidth.add(0.5).sub(distance).clamp()
}
