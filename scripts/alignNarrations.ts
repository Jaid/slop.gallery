import {tmpdir} from 'node:os'
import path from 'node:path'
import {parseArgs} from 'node:util'

import fs from 'fs-extra'

import transcriptFor from '#src/lib/audio/transcript.ts'
import artworks from '#src/worlds/gallery/artworks.ts'

const root = path.resolve(import.meta.dir, '..')
const help = `Usage: bun scripts/alignNarrations.ts

Times the bundled portrait narrations letter by letter for their subtitles, with Meta’s MMS forced aligner, and writes src/worlds/gallery/narrationTimings.json.
Rerun it whenever a bundled narration or the title or description it reads changes; test/unit/narration-timings.test.ts notices stale entries.
Needs ffmpeg and uv on PATH; scripts/lib/mmsAlign.py brings its own CPU-only Torch.`
/**
 * Times the bundled portrait narrations letter by letter for their subtitles, with Meta’s MMS forced aligner (scripts/lib/mmsAlign.py, run through uv with its own CPU-only Torch), and writes src/worlds/gallery/narrationTimings.json: per artwork, the start and end of every character of the text it reads in one flat list, null for characters without a span. Word spans follow from them when the catalog loads.
 * Rerun it whenever a bundled narration or the title or description it reads changes; test/unit/narration-timings.test.ts notices stale entries.
 */
const main = async () => {
  const output = path.join(root, 'src/worlds/gallery/narrationTimings.json')
  const folder = await fs.mkdtemp(path.join(tmpdir(), 'align-narrations-'))
  try {
    const narrated = artworks.filter(artwork => artwork.narration)
    const items = await Promise.all(narrated.map(async artwork => {
      const samples = path.join(folder, `${artwork.id}.f32`)
      await Bun.$`ffmpeg -nostdin -v error -i ${artwork.narration!.audio} -map 0:a:0 -ac 1 -ar 16000 -f f32le ${samples}`
      return {
        id: artwork.id,
        samples,
        text: transcriptFor(artwork),
      }
    }))
    const aligned = await Bun.$`uv run --quiet --script ${path.join(root, 'scripts/lib/mmsAlign.py')} < ${Response.json(items)}`.json() as Array<{
      characters: Array<[number, number] | null>
      id: string
    }>
    // One artwork per line keeps the file small and its diffs readable.
    const lines = aligned.toSorted((a, b) => a.id.localeCompare(b.id)).map(({id, characters}) => `  ${JSON.stringify(id)}: ${JSON.stringify(characters.flatMap(span => span ?? [null, null]))}`)
    await Bun.write(output, `{\n${lines.join(',\n')}\n}\n`)
    return {
      count: aligned.length,
      output,
    }
  } finally {
    await fs.remove(folder)
  }
}

export default main

if (import.meta.main) {
  const {values} = parseArgs({
    args: Bun.argv.slice(2),
    options: {
      help: {
        type: 'boolean',
        short: 'h',
      },
    },
  })
  if (values.help) {
    console.log(help)
  } else {
    const {count, output} = await main()
    console.log(`Timed ${count} narrations → ${path.relative(root, output)}`)
  }
}
