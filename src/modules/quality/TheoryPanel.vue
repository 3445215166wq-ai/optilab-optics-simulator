<script setup lang="ts">
/** 模块六：工业视觉成像质量测试 —— 原理 / 指标含义 / 模型声明 / 学习要点 */
import FoldSection from '@/components/ui/FoldSection.vue'
</script>

<template>
  <div class="theory">
    <FoldSection title="退化模型（按物理顺序）" title-en="Degradation chain">
      <p>
        本模块把「成像质量下降」拆成可独立控制的几项，并按物理顺序依次作用：
      </p>
      <code class="formula">
        场景照度(光照不均) → 对比度(反照率) → 光学模糊(离焦/运动) → 曝光(增益/偏置) → 传感器噪声
      </code>
      <ul>
        <li><strong>离焦模糊</strong>：高斯模糊近似，σ 与离焦量成正比（<strong>图像退化近似模型</strong>，非严格 PSF）。</li>
        <li><strong>运动模糊</strong>：沿设定方向的线段 PSF 卷积，长度 = 曝光时间内像移的像素数。</li>
        <li><strong>光照不均</strong>：余弦暗角模型（中心亮、边缘暗），模拟镜头暗角或环形光源照度分布。</li>
        <li><strong>曝光不足/过度</strong>：<code>out = in·gain + offset</code> 后截断到 [0,1]；过曝即高光截断，信息<strong>不可恢复</strong>。</li>
        <li><strong>高斯噪声</strong>：带种子 PRNG，σ 固定时可完全复现。</li>
        <li><strong>对比度下降</strong>：围绕中灰 0.5 缩放，模拟雾化、脏污、低反差照明。</li>
      </ul>
    </FoldSection>

    <FoldSection title="质量指标的含义与陷阱" title-en="Metrics">
      <code class="formula">平均亮度 = mean(I) ；RMS 对比度 = stdDev(I)</code>
      <code class="formula">MSE = mean[(I_ref − I_test)²] ；PSNR = 10·log₁₀(1²/MSE) dB</code>
      <code class="formula">
        SSIM = [(2μxμy+C₁)(2σxy+C₂)] / [(μx²+μy²+C₁)(σx²+σy²+C₂)]，11×11 高斯窗
      </code>
      <p>
        <strong>陷阱一：PSNR 高不等于看起来清晰。</strong>PSNR 是逐像素误差，对「整体亮度偏移」很敏感，
        但对「模糊」却不那么敏感 —— 轻度模糊的 PSNR 可能仍有 30 dB 以上，而人眼已经觉得糊了。
      </p>
      <p>
        <strong>陷阱二：SSIM 对亮度/对比度变化更宽容。</strong>SSIM 把亮度、对比度、结构分开看，
        因此「整体变暗但结构还在」时 SSIM 下降幅度小于「被噪声污染」的情形 —— 这与人的主观感受更一致。
      </p>
      <p>
        <strong>陷阱三：清晰度指标没有绝对单位。</strong>Laplacian / Tenengrad / Brenner 的数值依赖图像内容与尺寸，
        只能<b>在同一图像的不同退化之间比较</b>，不能跨图像比较。
      </p>
    </FoldSection>

    <FoldSection title="缺陷检测接口（当前未接入）" title-en="Detection interface">
      <p>
        平台预留了 ONNX 推理接口（<code>src/core/imaging/onnx.ts</code>），用于将来分析
        「成像质量 → 缺陷检出率」的关系。但<strong>当前没有接入任何真实模型</strong>，因此：
      </p>
      <ul>
        <li>不显示任何检测框、类别或置信度；</li>
        <li><strong>不生成任何检测准确率 / 漏检率 / 误检率</strong> —— 这类数字必须有真实模型与标注数据支撑；</li>
        <li>接口调用会显式抛错，界面据此显示「未接入」空状态。</li>
      </ul>
      <p>
        接入步骤：用 onnxruntime-web 加载模型 → 实现 <code>DetectorAdapter.run()</code> →
        用带标注的样本统计检出率。没有标注就只能做相对对比（如同一条缺陷在不同退化下的置信度变化）。
      </p>
    </FoldSection>

    <FoldSection title="学习要点" title-en="Key points">
      <p><span class="q">Q：为什么工业视觉要先测成像质量，再谈算法？</span></p>
      <p class="a">
        A：检测算法的上限由图像决定。若关键缺陷的空间频率已落在系统 MTF 的低谷，或对比度低于噪声水平，
        再强的网络也只能靠「猜」。所以项目流程通常是：照明与光学 → 成像质量（MTF/对比度/噪声/照度均匀性）
        → 算法。
      </p>
      <p><span class="q">Q：过曝为什么比欠曝更糟？</span></p>
      <p class="a">
        A：过曝会把高光像素压到上限（截断），细节信息永久丢失；欠曝虽然信噪比差，但通过提高增益/延长曝光
        （在本仿真里就是调大 gain）还能部分找回。当然欠曝叠加噪声后同样会损失细节，只是在信息论上
        「截断」比「加噪」更不可逆。
      </p>
      <p><span class="q">Q：怎样用本模块做一次像样的质量评估？</span></p>
      <p class="a">
        A：先用「理想成像」建立基线，然后一次只改一个退化项（批量扫描就是干这个），记录 SSIM/PSNR/清晰度随
        参数的变化曲线，找到指标开始明显下跌的拐点 —— 这个拐点就是系统的「质量预算」。
      </p>
    </FoldSection>
  </div>
</template>

<style scoped>
.theory {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
</style>
