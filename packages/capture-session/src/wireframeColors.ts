import hsl from 'okhsl'

/** Shared by the wireframe renderer and the flood that reveals it. */
export const wireframeColors = {
  line: hsl.integer(0, 0, 100),
  unhighlighted: hsl.integer(28.6, 99.9, 57.3),
  highlight: hsl.integer(260.6, 100, 55),
  seam: hsl.integer(248, 100, 83),
}
