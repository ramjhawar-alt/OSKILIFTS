import type { TextStyle } from 'react-native';

/**
 * OSKILIFTS design tokens. Dark and Berkeley-centred: deep navy surfaces (Berkeley Blue
 * pushed toward black), California Gold for the main action and highlights, Lawrence
 * cyan as the cool "tech" accent. Everything new is styled from here, never with raw hex.
 */
export const colors = {
  bg: '#050B16',
  bgRaised: '#081426',
  surface: '#0C1B33',
  surfaceHi: '#12284D',
  border: 'rgba(255,255,255,0.09)',
  borderStrong: 'rgba(255,255,255,0.18)',

  text: '#F4F7FB',
  textMuted: '#9FB0C8',
  textFaint: '#66788F',

  gold: '#FDB515',
  goldDeep: '#E09A00',
  goldSoft: 'rgba(253,181,21,0.14)',
  berkeleyBlue: '#003262',
  cyan: '#00B0DA',
  cyanSoft: 'rgba(0,176,218,0.14)',

  success: '#34D399',
  successSoft: 'rgba(52,211,153,0.14)',
  warning: '#FBBF24',
  danger: '#F87171',
  dangerSoft: 'rgba(248,113,113,0.14)',

  onGold: '#1A1203',
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28, xxxl: 40 } as const;

export const radius = { sm: 10, md: 16, lg: 22, xl: 30, pill: 999 } as const;

/** Type scale. Heavy weights and tight tracking on display text give it the "futuristic" feel. */
export const type = {
  display: { fontSize: 36, fontWeight: '800', letterSpacing: -0.8 } as TextStyle,
  title: { fontSize: 26, fontWeight: '800', letterSpacing: -0.4 } as TextStyle,
  heading: { fontSize: 18, fontWeight: '700', letterSpacing: -0.2 } as TextStyle,
  body: { fontSize: 15, fontWeight: '500' } as TextStyle,
  small: { fontSize: 13, fontWeight: '500' } as TextStyle,
  eyebrow: { fontSize: 11, fontWeight: '800', letterSpacing: 2, textTransform: 'uppercase' } as TextStyle,
  stat: { fontSize: 40, fontWeight: '800', letterSpacing: -1, fontVariant: ['tabular-nums'] } as TextStyle,
};

/** A soft coloured glow (iOS/web shadow; Android falls back to elevation). */
export function glow(color: string, strength = 0.5, size = 18) {
  return {
    shadowColor: color,
    shadowOpacity: strength,
    shadowRadius: size,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  } as const;
}

/** Minimum comfortable touch target (Apple HIG: 44pt). */
export const TOUCH = 48;

/** The standard card look, for components that style their own wrapper. */
export const cardBase = {
  backgroundColor: colors.surface,
  borderRadius: radius.lg,
  borderWidth: 1,
  borderColor: colors.border,
  padding: space.lg,
  gap: space.md,
} as const;
