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
  /** LED beat lamp resting state while playing (gray, low opacity). */
  beatLedRestingOpacity: 0.38,
  beatSubdivision: '#5AC8FA',
  beatBorderIdle: '#64748B',

  play: '#34C759',
  stop: '#FF453A',
  danger: '#FF3B30',

  /** Transport control glass tints (Quick Metronome play button). */
  transportGlassBase: 'rgba(37, 43, 51, 0.72)',
  transportGlassBorder: 'rgba(255, 255, 255, 0.14)',
  transportGlassHighlight: 'rgba(255, 255, 255, 0.06)',
  transportPlayTint: 'rgba(52, 199, 89, 0.28)',
  transportStopTint: 'rgba(255, 69, 58, 0.26)',
  transportIcon: '#FFFFFF',
  transportShadow: '#000000',

  overlay: 'rgba(0, 0, 0, 0.6)',

  tabBarBackground: '#1A1F26',
  tabBarBorder: '#2E3640',
} as const;
