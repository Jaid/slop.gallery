import Carving from './Carving.ts'
import carveLog from './face.ts'
import carveFigure from './figure.ts'

export default function carvingGeometry() {
  const carving = new Carving
  carveLog(carving)
  carveFigure(carving)
  const total = carving.hulls.reduce((sum, hull) => sum + hull.volume, 0)
  return {
    geometry: carving.finish(),
    hulls: carving.hulls.map(({points, volume}) => ({
      points,
      share: volume / total,
    })),
  }
}
