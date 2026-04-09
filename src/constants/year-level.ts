export const YEAR_LEVELS = [
  'Year 1',
  'Year 2',
  'Year 3',
  'Year 4',
  'Year 5',
  'Year 6',
  'Grade 11',
  'Grade 12',
] as const;

export type YearLevel = (typeof YEAR_LEVELS)[number];
