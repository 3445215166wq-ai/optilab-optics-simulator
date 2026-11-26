/**
 * ============================================================================
 * 预留：缺陷检测模型（ONNX）推理接口
 * ============================================================================
 *
 * 【当前状态：未接入任何真实模型】
 * 本文件只定义接口契约，不提供任何推理实现。
 * 因此在界面上：
 *   - 检测结果区显示「未接入模型」，不显示任何数字；
 *   - **不会生成任何准确率 / 漏检率 / 识别结果**（这是本项目的硬性红线）。
 *
 * 【将来接入方式】（保持与界面解耦）
 *   1. 用 onnxruntime-web 加载模型，实现 DetectorAdapter.run()；
 *   2. 输入约定：GrayImage（0..1 浮点）→ 按模型 inputShape 缩放/归一化；
 *   3. 输出约定：DetectionResult[]（类别、置信度、归一化框）；
 *   4. 统计检出率时需要**真实标注**（ground truth），否则只能做相对对比。
 *
 * 之所以现在就把接口写出来：成像质量 → 缺陷检出率 的联动分析是阶段四报告的核心卖点，
 * 先把槽位留好，避免以后为了加模型而改界面结构。
 * ============================================================================
 */

import type { GrayImage } from './image'

/** 归一化检测框（0..1，相对图像宽高） */
export interface DetectionBox {
  x: number
  y: number
  width: number
  height: number
}

export interface DetectionResult {
  label: string
  /** 置信度 0..1 */
  score: number
  box: DetectionBox
}

export interface DetectorStatus {
  /** 是否真正可用（当前恒为 false） */
  available: boolean
  /** 不可用原因（直接显示给用户） */
  reason: string
}

export interface DetectorAdapter {
  name: string
  inputShape: [number, number, number] | null
  status: DetectorStatus
  /** 执行推理；模型未接入时必须抛出明确错误，而不是返回假结果 */
  run(image: GrayImage): Promise<DetectionResult[]>
}

const NOT_INTEGRATED: DetectorStatus = {
  available: false,
  reason: '未接入检测模型：本平台不提供任何虚假的检测准确率 / 漏检率 / 识别结果',
}

/**
 * 创建检测适配器。
 * 目前返回一个「未接入」的占位实现：调用 run() 会抛出错误，
 * 界面据此显示空状态而不是编造数据。
 */
export function createDetectorAdapter(modelName = 'defect-detector'): DetectorAdapter {
  return {
    name: modelName,
    inputShape: null,
    status: NOT_INTEGRATED,
    async run() {
      throw new Error('检测模型未接入：请在 src/core/imaging/onnx.ts 中实现 DetectorAdapter.run()')
    },
  }
}

/** 供界面显示的一行状态说明 */
export function detectorStatusLine(adapter: DetectorAdapter): string {
  return adapter.status.available ? `已接入：${adapter.name}` : adapter.status.reason
}
