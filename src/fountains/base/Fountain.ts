import type {Vec3} from 'math'
import type {ComponentType} from 'react'

/** what a fountain’s model takes from whoever stands it somewhere */
export type FountainModelProps = {
  /** the id it goes by where it stands, like `lobby-fountain`, which V-viewing and the wireframe highlight know it by */
  id: string
  /** where the middle of its foot stands on the floor, in the meters of whatever it is mounted in */
  position: Vec3
}
/** what draws a fountain: its stone, its water and its spray, with the collider of its stone, and lets V orbit it */
export type FountainModel = ComponentType<FountainModelProps>

/**
 * A kind of fountain. It is position-free: laid out around the middle of its foot, which stands on the floor, and whoever stands one somewhere decides where, like the Lobby.
 * The class only tells what the world needs to know of it without building it. Its model, with its geometry, its water and its materials, lies in its folder and only loads for whoever shows it.
 */
export default abstract class Fountain {
  /** a sentence on what it looks like and what it is made of */
  abstract readonly description: string
  /** how high its water rises over the floor it stands on, in meters: the apex of its tallest jet */
  abstract readonly height: number
  /** also the name of its folder */
  abstract readonly id: string
  /** where its water sounds from, from the middle of its foot: the mouth of its tallest jet */
  abstract readonly mouth: Vec3
  /** the farthest it reaches from its axis, in meters */
  abstract readonly radius: number
  abstract readonly title: string

  /** Loads its model, which nothing else of the fountain needs. */
  abstract loadModel(): Promise<FountainModel>
}
