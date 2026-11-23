/** A Knot’s standing height is measured along its local x axis. */
export default function scaleKnotHull(vertices: Float32Array, height: number) {
  let bottom = Infinity
  let top = -Infinity
  for (let i = 0; i < vertices.length; i += 3) {
    bottom = Math.min(bottom, vertices[i])
    top = Math.max(top, vertices[i])
  }
  const scale = height / (top - bottom)
  return {
    scale,
    vertices: vertices.map(value => value * scale),
  }
}
