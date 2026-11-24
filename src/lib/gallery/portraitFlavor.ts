import type {Portrait} from './types.ts'

/** Whether the narrator has anything to read about the work, which only its flavor text gives it, once written. */
export function isTellable<Work extends Pick<Portrait, 'description'>>(work: Work): work is Work & {description: string} {
  return Boolean(work.description)
}

/** Whether anyone told anything about the work: its title, description, creator or year. */
export function hasDetails({creator, description, title, year}: Pick<Portrait, 'creator' | 'description' | 'title' | 'year'>) {
  return Boolean(title || description || creator) || year !== undefined
}

/** Whether the work hangs with a placard: once it has a title or a creator to show, or while its flavor text is being written, but not as long as nobody writes it, like with AI off. */
export function hasPlacard({creator, pending, title}: Pick<Portrait, 'creator' | 'pending' | 'title'>) {
  return Boolean(title || creator || pending)
}
