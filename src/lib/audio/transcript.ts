/** what the narrator reads for a work: its title as a sentence of its own, if it has one, then its description */
export default function transcriptFor(story: {
  description: string
  title?: string
}) {
  const description = story.description.trim()
  const sentence = `${description}${/[!.?]$/.test(description) ? '' : '.'}`
  return story.title ? `${story.title.replace(/[!.?]$/, '')}. ${sentence}` : sentence
}
