export type ChartPalette = {
  ink: string
  blue: string
  cyan: string
  green: string
  amber: string
  red: string
  slate: string
  pale: string
  axis: string
  grid: string
}

export const LIGHT_COLORS: ChartPalette = {
  ink: '#17212f',
  blue: '#3159e8',
  cyan: '#38a3ff',
  green: '#1b9c78',
  amber: '#e1a336',
  red: '#d65d63',
  slate: '#7a8798',
  pale: '#dfe5ef',
  axis: '#687588',
  grid: '#e7ebf1',
}

export const DARK_COLORS: ChartPalette = {
  ink: '#eef1f8',
  blue: '#6b8bf0',
  cyan: '#5cb6ff',
  green: '#3fc39a',
  amber: '#e8b25b',
  red: '#e17e83',
  slate: '#98a2b3',
  pale: '#2a3242',
  axis: '#8b96ab',
  grid: 'rgba(255, 255, 255, 0.09)',
}

/** Back-compat default for any call site not yet theme-aware. */
export const COLORS = LIGHT_COLORS
