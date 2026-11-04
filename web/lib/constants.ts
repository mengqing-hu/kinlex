// Plain values shared by server and client code, kept free of the validation library.

export const wordLevels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const
export type WordLevel = (typeof wordLevels)[number]
