import {lossyJxlOptions} from 'media-encoding'

export async function encodeJxl(input: string, output: string) {
  await Bun.$`cjxl ${input} ${lossyJxlOptions()} ${output}`.quiet()
  return output
}
