/** 数据卡类型（供模块与 StatGrid 共用，避免从 .vue 导出类型） */
export interface StatItem {
  label: string
  labelEn?: string
  value: string
  unit?: string
  tone?: 'accent' | 'ok' | 'warn' | 'err' | 'muted'
  note?: string
}
