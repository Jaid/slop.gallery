# media-encoding

The encoder settings that everything here encoding AV1 or JPEG XL shares, like films, snaps and the Knots’ previews, without the code that encodes, so a tool that only needs the settings pulls in nothing else.

```typescript
import {av1Crf, av1Preset, av1SvtParams, lossyJxlOptions, webmColorFilter} from 'media-encoding'

await Bun.$`cjxl frame.png ${lossyJxlOptions(1)} frame.jxl`
await Bun.$`ffmpeg -framerate 60 -i %03d.png -vf ${webmColorFilter} -c:v libsvtav1 -preset ${av1Preset} -crf ${av1Crf} -svtav1-params ${av1SvtParams} -pix_fmt yuv420p animation.webm`
```

- `av1Crf`, `av1Preset` and `av1SvtParams`: SVT-AV1’s quality, preset and parameters.
- `webmColorFilter`: the FFmpeg filter that turns display-encoded sRGB frames into full-range BT.709 YUV, tagged like the output.
- `lossyJxlOptions(distance, effort)`: the cjxl arguments for a lossy JPEG XL at `distance` (1 by default) and `effort` (`jxlEffort`, 10, by default), with `jxlBrotliEffort` and invisible pixels dropped.
