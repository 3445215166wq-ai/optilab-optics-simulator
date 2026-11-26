import type { Component } from 'vue'

/** 实验模块元信息（导航、顶栏与后续报告模块共用） */
export interface ModuleMeta {
  id: string
  /** 中文序号，用于导航左侧编号 */
  index: string
  title: string
  titleEn: string
  /** 导航中的短标题 */
  short: string
  /** 所属开发阶段 */
  phase: 1 | 2 | 3 | 4
  /** ready = 已实现；planned = 规划中（导航中禁用，点击无功能） */
  status: 'ready' | 'planned'
  /** 一句话说明（导航 tooltip） */
  summary: string
  component?: Component
}
