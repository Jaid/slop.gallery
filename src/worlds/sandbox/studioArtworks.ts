import type {Artwork} from '#src/lib/gallery/types.ts'

import chickenImage from '#root/assets/art/chicken.jxl' with {distance: '3', format: 'jxl', maximumLong: '2048'}
import {studioSlotRatio} from '#src/rooms/studio/slots.ts'

/** The works the Studio hangs in its one slot by default, apart from the gallery’s, as no other room has a slot of their ratio. */
const studioArtworks: Array<Artwork> = [
  {
    id: 'chicken',
    title: 'The Creation of Chick',
    creator: 'Michelangallo',
    description: 'A colossal sun of a rooster descends from the heavens to bestow the spark of life upon the smallest of his kind. The chick is still deciding whether it wants it.',
    source: chickenImage,
    ratio: studioSlotRatio,
  },
]

export default studioArtworks
