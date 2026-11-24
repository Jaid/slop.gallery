/** Who made a work and when as one line of a plate, like “Jane Doe · 1924”, either left out where nobody knows, and empty where both are. */
export default function formatByline(creator?: string, year?: number) {
  return [creator || undefined, year].filter(part => part !== undefined).join(' · ')
}
