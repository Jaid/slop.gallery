# deltable

Markdown tables of counts, like file sizes or triangles per room, that tell how the counts changed since a base, like the previous revision in a CI report.

```typescript
import Deltable from 'deltable'

const deltable = new Deltable({
  idHeaderTitle: 'group',
  headers: {
    fileBytes: 'text bytes',
    effectiveBytes: 'effective bytes',
  },
  total: true,
})

const markdown = deltable.render({
  values: {
    'main/source': {
      files: 902,
      fileBytes: 3_625_235,
      effectiveBytes: 2_003_690,
    },
    'main/scripts': {
      files: 14,
      fileBytes: 86_857,
      effectiveBytes: 58_535,
    },
  },
  base: {
    'main/source': {
      files: 903,
      fileBytes: 3_627_848,
      effectiveBytes: 2_005_610,
    },
    'main/scripts': {
      files: 14,
      fileBytes: 86_857,
      effectiveBytes: 58_535,
    },
  },
})
```

Every column with a count that differs from the base splits into a count and a delta subcolumn under its title, like `−1` or `+2613`. An unchanged count leaves its delta cell empty, just as a count of 0 leaves its own cell empty unless `zeroValue` says otherwise. Markdown has no cells spanning columns, so a table with any change is rendered as HTML, which GitHub displays in comments, readmes and Actions job summaries. Without a base or without any change, the table stays plain markdown.

Rows keep the order of `values`, followed by rows only `base` has, which count 0 now. Columns appear in the order their keys first appear. A missing row or count counts as 0. JavaScript puts object keys that are array indices, like `'7'`, before all others, so such row IDs come first.

## Options

| Option | Default | Description |
| --- | --- | --- |
| `idHeaderTitle` | `''` | the title of the cell above the row IDs |
| `valueHeaderTitle` | `'count'` | the title of a changed column’s subcolumn with its counts |
| `deltaHeaderTitle` | `'delta'` | the title of a changed column’s subcolumn with its deltas |
| `headers` | `{}` | the titles of the columns by their keys; a column without one is titled by its key |
| `total` | `false` | whether a row with the sums of every column closes the table |
| `totalTitle` | `'total'` | the ID of the row with the sums, rendered bold |
| `zeroValue` | `''` | what a count of 0 shows as |

Counts from 10 000 on split their thousands by narrow no-break spaces, and negative numbers use a real minus. The same formatting is exported as `formatCount` and `formatDelta`.
