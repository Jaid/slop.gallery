/** the ids of every stone there is, the default seed’s first; `index.ts` holds the material of each, which lives in the folder of its id */
export const stoneIds = ['sawn', 'statuario', 'porphyry', 'larvikite', 'weser', 'verdantique', 'alabaster', 'estremoz'] as const
/** the id of one of the stones */
export type StoneId = typeof stoneIds[number]

/** Whether the value is the id of a stone. */
export const isStoneId = (value: unknown): value is StoneId => (stoneIds as ReadonlyArray<unknown>).includes(value)
