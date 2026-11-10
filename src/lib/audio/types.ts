import type {Voice} from 'procedural-audio'

/** a recipe of the sound effect catalog */
export type SoundEffect = {
  id: string
  label: string
  voices: Array<Voice>
}
