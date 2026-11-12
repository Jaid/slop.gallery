/** marks a single line of a face to be shrunk until it fits its box; the line needs `white-space: nowrap` and a width limit */
export const fitted = {'data-fit': ''}

/** whether a face holds lines that {@link fitLines} looks at */
export const hasFittedLines = (face: Element) => face.querySelector('[data-fit]') !== null

/** Shrinks the font of every marked line of a laid out face that came out wider than its box, for names of any length. */
export default function fitLines(face: Element) {
  for (const line of face.querySelectorAll<HTMLElement>('[data-fit]')) {
    if (line.scrollWidth > line.clientWidth) {
      line.style.fontSize = `${Math.floor(Number.parseFloat(getComputedStyle(line).fontSize) * line.clientWidth / line.scrollWidth)}px`
    }
  }
}
