import type {Drawing} from '#src/lib/overlay/drawing.ts'

import overlay from '#src/lib/overlay/index.ts'

/** WebMCP drawings belong to the running page; releasing the caller does not erase its mark. */
export default function addDrawing(drawing: Drawing) {
  const id = crypto.randomUUID()
  render(id, drawing)
  return {
    id,
    drawing,
  }
}

function render(name: string, drawing: Drawing) {
  const style = {
    color: drawing.color,
    layer: drawing.layer,
    name,
  }
  switch (drawing.type) {
    case 'box': { return overlay.addBox(drawing.min, drawing.max, style) }
    case 'circle': { return overlay.addCircle(drawing.center, drawing.radius, {
      ...style,
      normal: drawing.normal,
    }) }
    case 'line': { return overlay.addLine(drawing.from, drawing.to, style) }
    case 'point': { return overlay.addPoint(drawing.position, {
      ...style,
      radius: drawing.radius,
    }) }
    case 'triangle': { return overlay.addTriangle(drawing.a, drawing.b, drawing.c, style) }
  }
}
