/** the ids of every canvas material there is; `index.ts` holds one of each, which lives in the folder of its id */
export const canvasMaterialIds = ['linen', 'impasto', 'nacre', 'rag', 'wax', 'baryta', 'moire', 'silverplate', 'trichrome', 'isogilt', 'prism-sweep', 'intaglio-rare', 'craquelure', 'azulejo', 'guilloche', 'diamond-dust'] as const
/** the id of one of the canvas materials */
export type CanvasMaterialId = typeof canvasMaterialIds[number]

/** Whether the value is the id of a canvas material. */
export const isCanvasMaterialId = (value: unknown): value is CanvasMaterialId => (canvasMaterialIds as ReadonlyArray<unknown>).includes(value)
