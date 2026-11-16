/** Reusable interactive models, retaining their original preview catalog numbers. */
const destructiblePlants = [
  {
    id: 'birdOfParadise',
    title: 'Bird of paradise',
    number: 33,
    pot: 'atelier',
  },
  {
    id: 'peaceLily',
    title: 'Peace lily',
    number: 34,
    pot: 'ivory',
  },
] as const
export type DestructiblePlantKind = typeof destructiblePlants[number]['id']

export default destructiblePlants
