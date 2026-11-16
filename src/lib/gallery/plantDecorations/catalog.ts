export const pots = [
  {
    id: 'atelier',
    title: 'Atelier clay',
    soilHeight: 0.57,
    soilRadius: 0.306,
    height: 0.67,
    radius: 0.37,
  },
  {
    id: 'ivory',
    title: 'Ivory flute',
    soilHeight: 0.68,
    soilRadius: 0.291,
    height: 0.76,
    radius: 0.342,
  },
  {
    id: 'celadon',
    title: 'Celadon pebble',
    soilHeight: 0.43,
    soilRadius: 0.323,
    height: 0.51,
    radius: 0.4,
  },
  {
    id: 'noir',
    title: 'Noir / brass',
    soilHeight: 0.72,
    soilRadius: 0.285,
    height: 0.8,
    radius: 0.335,
  },
] as const
export type PotKind = typeof pots[number]['id']

export const plants = [
  {
    id: 'philodendron',
    title: 'Split-leaf philodendron',
  },
  {
    id: 'fig',
    title: 'Fiddle-leaf fig',
  },
  {
    id: 'palm',
    title: 'Kentia palm',
  },
  {
    id: 'snake',
    title: 'Golden snake plant',
  },
  {
    id: 'rubber',
    title: 'Burgundy rubber plant',
  },
  {
    id: 'calathea',
    title: 'Calathea orbifolia',
  },
  {
    id: 'fern',
    title: 'Boston fern',
  },
  {
    id: 'jade',
    title: 'Jade bonsai',
  },
] as const
export type PlantKind = typeof plants[number]['id']

export function potDefinition(kind: PotKind) {
  return pots.find(pot => pot.id === kind)!
}
