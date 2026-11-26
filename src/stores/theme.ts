/**
 * 主题状态：深色 / 浅色切换，并持久化到 localStorage。
 * 画布配色通过 getScenePalette 与主题联动，保证 HTML 与 Canvas 视觉一致。
 */
import { computed, reactive } from 'vue'
import { getScenePalette, type ScenePalette, type ThemeName } from '@/render/palette'

const STORAGE_KEY = 'optilab.theme'

const state = reactive<{ theme: ThemeName }>({ theme: 'dark' })

const theme = computed(() => state.theme)
const isDark = computed(() => state.theme === 'dark')
const palette = computed<ScenePalette>(() => getScenePalette(state.theme))

function apply(themeName: ThemeName): void {
  state.theme = themeName
  if (typeof document !== 'undefined') {
    document.documentElement.dataset.theme = themeName
  }
  try {
    localStorage.setItem(STORAGE_KEY, themeName)
  } catch {
    // 隐私模式下 localStorage 可能不可写，忽略即可（不影响功能）
  }
}

/** 应用启动时调用：读取持久化主题，未设置则跟随系统偏好 */
export function initTheme(): void {
  let next: ThemeName = 'dark'
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'dark' || saved === 'light') {
      next = saved
    } else if (typeof window !== 'undefined' && window.matchMedia) {
      next = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
    }
  } catch {
    next = 'dark'
  }
  state.theme = next
  if (typeof document !== 'undefined') {
    document.documentElement.dataset.theme = next
  }
}

export function setTheme(next: ThemeName): void {
  apply(next)
}

export function toggleTheme(): ThemeName {
  apply(state.theme === 'dark' ? 'light' : 'dark')
  return state.theme
}

export function useTheme() {
  return { theme, isDark, palette, setTheme, toggleTheme }
}
