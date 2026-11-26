<script setup lang="ts">
/** 模块三：衍射与分辨率 —— 原理 / 适用条件 / 工业应用 / 学习要点 */
import FoldSection from '@/components/ui/FoldSection.vue'
</script>

<template>
  <div class="theory">
    <FoldSection title="原理与公式" title-en="Principle & formulas">
      <p>
        <strong>通俗解释：</strong>光通过一个有限大小的圆孔后不会「直着走过去」，而会在焦平面上摊开成一个中心亮、
        周围一圈圈明暗环的图案（艾里斑）。孔径越小、波长越长，摊得越开 —— 这就是为什么光圈收得越小照片越「糊」，
        也是为什么显微镜和高分辨率检测设备都在追求大数值孔径与短波长。
      </p>
      <code class="formula">强度分布：I(r) = I₀·[2J₁(v)/v]² ，v = π·D·r/(λ·f) = π·r/(λ·N)</code>
      <code class="formula">第一暗环（艾里半径）：r₁ = 1.2197·λ·N ≈ 1.22·λ·N</code>
      <code class="formula">瑞利判据：Δ = r₁ = 1.22·λ·N （两像点间距小于它就无法分辨）</code>
      <code class="formula">非相干截止频率：f_c = 1/(λ·N) ≈ 2NA/λ  [lp/mm]</code>
      <p>
        <strong>数值孔径：</strong>NA = n·sinθ，像方 NA′ ≈ D/(2f) = 1/(2N)；物方与像方满足光学不变量
        NA_obj = |m|·NA′。
      </p>
      <p>
        <strong>单位：</strong>λ 用 nm 输入、内部换算为 mm；N 无量纲；r₁、Δ 用 μm 显示；f_c 用 lp/mm。
      </p>
    </FoldSection>

    <FoldSection title="物方参数与像方参数必须分开" title-en="Object side vs image side">
      <p>
        「分辨率 = 1.22λN」这个式子里的长度默认是<strong>像方</strong>（传感器平面）的量。
        把被摄物平面上的分辨率也说成 1.22λN 是常见错误 —— 两者差一个放大率：
      </p>
      <code class="formula">物方艾里半径 = 1.22·λ·N / |m| ，物方截止频率 = |m| / (λ·N)</code>
      <p>
        例如 20× 显微物镜：像方艾里半径 5.4 μm，物方只有 0.27 μm —— 高倍物镜能看到更细的结构，
        并不是因为衍射变小了，而是因为同样的衍射斑对应了更小的物方尺度。
      </p>
      <p>
        <strong>工程含义：</strong>判断系统是否«衍射受限»要把艾里半径与<strong>像元尺寸</strong>比较：
        艾里半径远大于像元时，再减小像元也不会提高实际分辨率（只会过采样）。
      </p>
    </FoldSection>

    <FoldSection title="适用条件与局限" title-en="Conditions & limits">
      <ul>
        <li>理想<strong>圆形孔径</strong>、均匀照明、无像差的<strong>夫琅禾费</strong>（焦平面/远场）衍射；</li>
        <li>近轴条件：NA ≈ 1/(2N) 只在孔径角较小时成立（N 接近 1 时误差可达 3% 以上）；</li>
        <li>截止频率 f_c = 1/(λN) 是<strong>非相干</strong>成像的结论；相干成像（如激光照明）的截止频率只有一半；</li>
        <li>未包含：像差、镀膜与偏振、探测器像元 MTF、采样与重建算法、部分相干照明；</li>
        <li>本模块是解析模型演示，不能替代光学设计软件或实际 MTF 测试报告。</li>
      </ul>
    </FoldSection>

    <FoldSection title="工业应用场景" title-en="Industrial applications">
      <ul>
        <li><strong>机器视觉镜头选型：</strong>先算 1.22λN 与像元尺寸比，判断是「像元受限」还是「衍射受限」，再决定是否值得上更高像素相机。</li>
        <li><strong>缺陷检测：</strong>能分辨的最小缺陷尺寸受衍射极限约束，短波长 + 大 NA 是提升检测能力的主线。</li>
        <li><strong>显微与半导体检测：</strong>高倍物镜的物方分辨率才是「能看多细」的真指标；浸液（n &gt; 1）用来等效放大 NA。</li>
        <li><strong>光刻：</strong>分辨率 ∝ λ/NA，因此业界持续使用更短波长与更高 NA（浸没式、EUV）。</li>
        <li><strong>照明设计：</strong>小孔（大 N）带来的衍射展宽会影响暗场与共聚焦系统的信噪比与光通量平衡。</li>
      </ul>
    </FoldSection>

    <FoldSection title="学习要点" title-en="Key points">
      <p><span class="q">Q：为什么艾里斑半径正比于 F 数？</span></p>
      <p class="a">
        A：F 数越大表示孔径相对焦距越小，光瞳对波前的「限制」越强，衍射展开越大。公式 r₁ = 1.22λN 说明这与焦距本身无关，
        只取决于「波长 / 孔径角」这个比值。
      </p>
      <p><span class="q">Q：瑞利判据与艾里半径是同一个东西吗？</span></p>
      <p class="a">
        A：数值上相同（都以第一暗环为准），但含义不同：艾里半径描述单点的衍射尺度，瑞利判据把它当作「两点刚好可分辨」的门限。
        实践中还有 Sparrow 判据等更宽松/严格的标准。
      </p>
      <p><span class="q">Q：为什么切到对数纵轴才看得见「一圈圈暗环」？</span></p>
      <p class="a">
        A：艾里斑第一副极大的强度只有峰值的 1.75%，第二副极大仅 0.42%，线性坐标下它们几乎贴着横轴；
        对数坐标能同时显示主瓣与振铃，这也是光学图样常用的显示方式。
      </p>
      <p><span class="q">Q：衍射受限时，换更小像元的相机会有提升吗？</span></p>
      <p class="a">
        A：不会实质提升分辨率。当艾里半径明显大于像元尺寸时系统是衍射受限的，图像只会被过采样，细节不会增加，
        反而因像元变小牺牲灵敏度与信噪比。
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
