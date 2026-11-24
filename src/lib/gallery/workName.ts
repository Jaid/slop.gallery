import type {Portrait} from './types.ts'

/** How a notice names a work: by its title in quotes, or as “the work” while it has none. */
export default function workName({title}: Pick<Portrait, 'title'>) {
  return title ? `“${title}”` : 'the work'
}
