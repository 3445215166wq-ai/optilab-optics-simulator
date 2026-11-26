/**
 * 画布配色。
 * 说明：Canvas 无法直接使用 CSS 变量，因此这里按主题给出与 tokens.css 对齐的
 * 颜色常量表，保证 HTML 面板与画布视觉一致。
 */

export type ThemeName = 'dark' | 'light'

export interface ScenePalette {
  bg: string
  gridLine: string
  gridLineStrong: string
  axis: string
  textPrimary: string
  textSecondary: string
  textMuted: string
  accent: string
  chipBg: string
  chipBorder: string
  /* 光学元件 */
  lensFill: string
  lensStroke: string
  surface: string
  normal: string
  /* 光线 */
  rayIncident: string
  rayRefracted: string
  rayReflected: string
  rayCenter: string
  rayBundle: string
  rayVirtual: string
  rayBlocked: string
  /** 光锥光束填充（5%~10% 透明度的淡色面，位于所有光线之下） */
  rayBeamFill: string
  /* 物像标记 */
  objectArrow: string
  imageArrow: string
  imageVirtual: string
  marker: string
  /* 介质底色 */
  medium1Tint: string
  medium2Tint: string
}

const DARK: ScenePalette = {
  bg: '#080d13',
  gridLine: 'rgba(120,160,195,0.085)',
  gridLineStrong: 'rgba(120,160,195,0.18)',
  axis: '#4a6274',
  textPrimary: '#dbe6f1',
  textSecondary: '#9db1c3',
  textMuted: '#6b8199',
  accent: '#3f9be0',
  chipBg: 'rgba(13,20,28,0.86)',
  chipBorder: 'rgba(120,160,195,0.28)',
  lensFill: 'rgba(79,192,141,0.14)',
  lensStroke: '#4fc08d',
  surface: '#8fb4d0',
  normal: '#93a9bc',
  rayIncident: '#e8b64c',
  rayRefracted: '#4fc08d',
  rayReflected: '#4e9fe0',
  rayCenter: '#b386e8',
  rayBundle: '#7fa8cc',
  rayVirtual: '#7e8fa3',
  rayBlocked: '#e0665a',
  rayBeamFill: 'rgba(127,168,204,0.075)',
  objectArrow: '#e8b64c',
  imageArrow: '#4e9fe0',
  imageVirtual: '#b386e8',
  marker: '#9db1c3',
  medium1Tint: 'rgba(84,140,190,0.10)',
  medium2Tint: 'rgba(53,179,129,0.11)',
}

const LIGHT: ScenePalette = {
  bg: '#e9eff5',
  gridLine: 'rgba(30,70,110,0.075)',
  gridLineStrong: 'rgba(30,70,110,0.16)',
  axis: '#8ba0b3',
  textPrimary: '#14202b',
  textSecondary: '#48607a',
  textMuted: '#7a8fa5',
  accent: '#1f78bd',
  chipBg: 'rgba(255,255,255,0.9)',
  chipBorder: 'rgba(30,70,110,0.22)',
  lensFill: 'rgba(23,121,92,0.12)',
  lensStroke: '#17795c',
  surface: '#5d7f9c',
  normal: '#6a8199',
  rayIncident: '#b5811a',
  rayRefracted: '#17795c',
  rayReflected: '#1c6fae',
  rayCenter: '#7a4bb5',
  rayBundle: '#5b87ad',
  rayVirtual: '#7d8fa1',
  rayBlocked: '#bb3b30',
  rayBeamFill: 'rgba(70,120,165,0.075)',
  objectArrow: '#b5811a',
  imageArrow: '#1c6fae',
  imageVirtual: '#7a4bb5',
  marker: '#48607a',
  medium1Tint: 'rgba(84,140,190,0.09)',
  medium2Tint: 'rgba(23,121,92,0.10)',
}

export function getScenePalette(theme: ThemeName): ScenePalette {
  return theme === 'light' ? LIGHT : DARK
}
