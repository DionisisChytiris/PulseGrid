/** Studio Slate — performance / practice screens (Quick Metronome). */
export const studioColors = {
  background: '#0F1419',
  surface: '#1A1F26',
  surfaceElevated: '#252B33',
  border: '#2E3640',
  borderSubtle: '#232A33',

  textPrimary: '#F1F5F9',
  textSecondary: '#94A3B8',
  textMuted: '#64748B',

  accent: '#3B9EFF',
  accentMutedBg: '#1E3A5F',

  beatActive: '#3B9EFF',
  beatAccent: '#FF9F0A',
  beatInactive: '#475569',
  beatInactivePlaying: '#64748B',
  beatSubdivision: '#5AC8FA',
  beatBorderIdle: '#64748B',

  play: '#34C759',
  stop: '#FF453A',
  danger: '#FF3B30',

  overlay: 'rgba(0, 0, 0, 0.6)',

  tabBarBackground: '#1A1F26',
  tabBarBorder: '#2E3640',
} as const;

/** Warm light surfaces — editing screens (Songs). */
export const editColors = {
  background: '#F8FAFC',
  surface: '#FFFFFF',
  border: '#E2E8F0',
  textPrimary: '#0F172A',
  textSecondary: '#64748B',
} as const;
