// Sample notes that type themselves out beside the auth forms, showing what Campi is for.
export type SampleNote = { crumbs: string; title: string; lines: string[] }

export const BIOLOGY_NOTE: SampleNote = {
  crumbs: 'Biology / Unit 3',
  title: 'Cellular respiration',
  lines: [
    'Glycolysis splits glucose into two pyruvate, net 2 ATP.',
    'The Krebs cycle runs in the [[mitochondria]], twice per glucose.',
    'Most ATP comes from the [[electron transport chain]].',
  ],
}

export const PHYSICS_NOTE: SampleNote = {
  crumbs: 'Physics / Mechanics',
  title: 'Forces and motion',
  lines: [
    'Net force equals mass times acceleration: F = ma.',
    '[[Momentum]] is conserved when no external force acts.',
    'Kinetic energy grows with the square of [[velocity]].',
  ],
}
