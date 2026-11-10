import type {Vec3} from '#src/lib/gallery.ts'

import {useAmbienceEmitter} from '#src/lib/audio/ambience/ambienceEmitters.ts'
import FountainAmbience from '#src/lib/audio/ambience/Fountain.ts'
import {lobbyFountain, lobbyFountainSpot} from '#src/lib/gallery/lobbyFountain.ts'
import slopGallery from '#src/worlds/gallery/index.ts'

/**
 * The model of the fountain that stands in the Lobby. Only that fountain’s model downloads, and every importer waits until it has loaded, so the Lobby mounts with its fountain in its very first frame without suspending.
 */
const Model = await lobbyFountain.loadModel()
/** where the fountain’s water sounds from, in the world: the mouth of its tallest jet */
const mouth = lobbyFountainSpot.map((value, axis) => value + lobbyFountain.mouth[axis]) as Vec3

/** The Lobby’s fountain, standing in the middle of the Lobby and sounding from its tallest jet’s mouth. */
export default function LobbyFountain() {
  useAmbienceEmitter(FountainAmbience, slopGallery.ambienceRooms('lobby', 'lobby-fountain'), mouth)
  return <Model id='lobby-fountain' position={lobbyFountainSpot} />
}
