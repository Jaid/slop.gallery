export const av1Crf = 30
export const av1Preset = 5
export const av1SvtParams = 'lp=6:enable-variance-boost=1:film-grain=0:tune=0:input-depth=8'

// PNG readback already contains display-encoded sRGB. Convert those RGB bytes
// with the BT.709 matrix into full-range YUV, without another transfer.
// Tag the filtered frames as well as the output: CLI tags alone do not ensure
// that the AV1 bitstream and WebM container describe the same color encoding.
export const webmColorFilter = [
  'scale=in_range=pc:out_range=pc:out_color_matrix=bt709',
  'format=yuv420p',
  'setparams=range=full:color_primaries=bt709:color_trc=iec61966-2-1:colorspace=bt709',
].join(',')
