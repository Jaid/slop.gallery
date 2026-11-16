/** Reusable interactive models of potted plants. */
const destructiblePlants = [
  {
    id: 'birdOfParadise',
    title: 'Bird of paradise',
    pot: 'atelier',
  },
  {
    id: 'peaceLily',
    title: 'Peace lily',
    pot: 'ivory',
  },
] as const
export type DestructiblePlantKind = typeof destructiblePlants[number]['id']

export default destructiblePlants
