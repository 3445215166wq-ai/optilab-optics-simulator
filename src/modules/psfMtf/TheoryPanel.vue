<script setup lang="ts">
/** 模块四：PSF 与 MTF —— 原理 / 离焦的物理含义 / 适用条件 / 学习要点 */
import FoldSection from '@/components/ui/FoldSection.vue'
</script>

<template>
  <div class="theory">
    <FoldSection title="原理与公式" title-en="Principle & formulas">
      <p>
        <strong>通俗解释：</strong>PSF 是「一个理想点经过镜头后变成什么样」，MTF 是「不同粗细的条纹
        （不同空间频率）经过镜头后对比度还剩多少」。镜头再好也做不到一个点进去、一个点出来 ——
        孔径有限必然产生衍射，离焦则把能量进一步摊开，于是细节的对比度下降。
      </p>
      <code class="formula">复光瞳：P(ρ) = circ(ρ)·exp[i·2π·W₂₀·ρ²]，ρ = r/a ∈ [0,1]</code>
      <code class="formula">PSF = |FT{P}|² ，OTF = FT{PSF}/FT{PSF}(0) ，MTF = |OTF|</code>
      <code class="formula">
        衍射极限 MTF：MTF(t) = (2/π)[arccos t − t√(1−t²)]，t = ν/ν_c，ν_c = 1/(λN)
      </code>
      <p>
        <strong>单位：</strong>W₂₀ 以波长 λ 为单位（waves）；空间频率用 lp/mm（线对每毫米）；
        截止频率 ν_c = 1/(λN)；MTF50 是 MTF 降到 0.5 时的频率，是工业上常用的「有效分辨率」指标。
      </p>
    </FoldSection>

    <FoldSection title="离焦参数 W₂₀ 的物理含义" title-en="What W₂₀ means">
      <p>
        W₂₀ 是<strong>光瞳边缘相对光瞳中心多出来的光程差</strong>，单位是波长 λ。离焦使会聚波前从球面变成
        「更弯」或「更平」的曲面，误差沿半径按 ρ² 增长，所以相位因子里出现二次项。
      </p>
      <code class="formula">W₂₀ = Δz / (8·λ·N²) ⇒ Δz = 8·λ·N²·W₂₀ （Δz 为像面纵向偏移）</code>
      <p>
        代入经典结论：<strong>W₂₀ = 0.25 λ</strong> 对应 Δz = 2λN²，这正是一般所说的
        「焦深 ≈ ±2λN²」的四分之一波长判据。也就是说 W₂₀ 可以直接当作「离焦了多少个焦深单位」来读。
      </p>
      <p>
        <strong>值得注意的是：</strong>纯离焦 + 硬边圆孔时，轴上强度会随离焦周期性起伏，并在
        W₂₀ = 1λ、2λ… 处出现<strong>轴上零点</strong>（把 W₂₀ = 1 代入轴上振幅积分可得零）。
        因此 W₂₀ = 1λ 时斯特列尔比接近 0，这属于真实物理现象，不是数值错误。
      </p>
    </FoldSection>

    <FoldSection title="适用条件与局限" title-en="Conditions & limits">
      <ul>
        <li>只包含<strong>离焦</strong>一种像差：不含球差、彗差、像散、色差与制造误差；</li>
        <li>理想圆形硬边光瞳，均匀照明；光瞳边界用子采样面积占比近似，MTF 误差约 1%；</li>
        <li>近轴条件（小 NA）；未计入探测器像元 MTF（像元孔径的 sinc 因子）与采样重建；</li>
        <li>数值网格有限（默认 256²），PSF 尾部会周期性折叠，故只在对角线以内统计；</li>
        <li>本模块是数值模型演示，不能替代实测 MTF 报告（例如 ISO 12233 测量）。</li>
      </ul>
    </FoldSection>

    <FoldSection title="工业应用场景" title-en="Industrial applications">
      <ul>
        <li><strong>镜头验收：</strong>用 MTF（尤其 MTF50、在特定频率的 MTF 值）作为镜头规格与来料检验指标。</li>
        <li><strong>产线检测能力评估：</strong>被测特征的空间频率若落在 MTF 已很低的位置，对比度不足会直接导致漏检。</li>
        <li><strong>自动对焦：</strong>离焦使高频 MTF 迅速衰减 —— 这正是阶段三「清晰度评价函数」能工作的物理基础。</li>
        <li><strong>景深设计：</strong>用 W₂₀ 与焦深判据估算允许的物面起伏或平台定位误差。</li>
        <li><strong>与像元匹配：</strong>MTF 与像元 sinc 的乘积才是系统 MTF，选相机时要看两者是否匹配（避免过采样或欠采样）。</li>
      </ul>
    </FoldSection>

    <FoldSection title="学习要点" title-en="Key points">
      <p><span class="q">Q：为什么离焦主要伤高频，而低频几乎不变？</span></p>
      <p class="a">
        A：离焦把 PSF 展宽成更大的模糊斑，相当于做了一次低通滤波；粗条纹（低频）对这种尺度的小模糊不敏感，
        细条纹（高频）则直接被抹平。所以 W₂₀ 增大时 MTF 曲线在中高频先塌陷，而 MTF50 随之下降。
      </p>
      <p><span class="q">Q：MTF 曲线下的面积与 MTF50 哪个更有用？</span></p>
      <p class="a">
        A：面积反映整体成像能力（与图像锐度感相关），MTF50 更便于比较「能分辨多细」，工程上常用 MTF50 做快速判定。
        两者不能互相替代，评估时应同时看若干指定频率上的 MTF 值。
      </p>
      <p><span class="q">Q：为什么理想无像差时 MTF 也不能等于 1？</span></p>
      <p class="a">
        A：因为孔径有限必然衍射。即使完全没有像差，MTF 仍按 (2/π)(arccos t − t√(1−t²)) 从 1 单调降到截止频率处为 0，
        该曲线就是「衍射极限」，是任何同孔径系统的理论上限。
      </p>
      <p><span class="q">Q：增大 F 数（收小光圈）会让 MTF 更好吗？</span></p>
      <p class="a">
        A：取决于当前是像差受限还是衍射受限。像差受限时收小光圈能提高 MTF；但超过最佳 F 数后衍射成为主导，
        MTF 反而下降 —— 这正是「最佳光圈」的物理来源。本模块只含离焦一种像差，因此曲线会单调随 F 数变差（衍射主导）。
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
