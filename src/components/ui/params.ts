/**
 * 参数面板的声明式 Schema。
 * 每个实验模块只需声明自己的参数表，UI 控件、单位、提示与合法性检查自动生成，
 * 避免为每个模块重复编写表单代码，也保证全站交互一致。
 */

export type ParamValue = string | number

export interface BaseDef {
  /** 参数键名，与模块 params 对象一致 */
  key: string
  /** 中文标签 */
  label: string
  /** 英文标签（专业术语对照） */
  labelEn: string
  /** 单位（显示在输入框右侧） */
  unit?: string
  /** 参数说明 / 适用条件提示 */
  hint?: string
}

export interface RangeDef extends BaseDef {
  kind: 'range'
  min: number
  max: number
  step: number
  /** 显示小数位（默认按步长推断） */
  digits?: number
}

export interface NumberDef extends BaseDef {
  kind: 'number'
  min: number
  max: number
  step?: number
  digits?: number
}

export interface SegmentedDef extends BaseDef {
  kind: 'segmented'
  options: Array<{ value: ParamValue; label: string; title?: string }>
}

export interface SelectDef extends BaseDef {
  kind: 'select'
  options: Array<{ value: ParamValue; label: string }>
}

export type ParamDef = RangeDef | NumberDef | SegmentedDef | SelectDef

export interface ParamSection {
  title: string
  titleEn?: string
  fields: ParamDef[]
}

export type ParamModel = Record<string, ParamValue>

/** 按步长推断合适的小数位：step=0.001 → 3 位 */
export function decimalsForStep(step: number | undefined): number {
  if (!step || !Number.isFinite(step) || step <= 0) return 0
  const digits = Math.ceil(-Math.log10(step))
  return Math.max(0, Math.min(4, digits))
}

/** 把数值格式化为输入框文本 */
export function formatParamValue(value: ParamValue, def: ParamDef): string {
  if (typeof value === 'string') return value
  if (!Number.isFinite(value)) return ''
  const digits =
    'digits' in def && def.digits !== undefined
      ? def.digits
      : decimalsForStep('step' in def ? def.step : undefined)
  return value.toFixed(digits)
}
