<script setup lang="ts">
/** 模块五：自动对焦与设备性能测试 —— 原理 / 模型声明 / 学习要点 */
import FoldSection from '@/components/ui/FoldSection.vue'
</script>

<template>
  <div class="theory">
    <FoldSection title="原理：清晰度评价函数为什么能对焦" title-en="Principle">
      <p>
        <strong>通俗解释：</strong>物体在焦平面上时边缘最锐利，图像里「明暗跳变」最多；
        一旦离焦，每个点都被摊成一个小模糊斑，边缘被抹平。所以只要统计图像里梯度有多「剧烈」，
        就能判断是否合焦 —— 这类统计量就叫清晰度评价函数（focus metric）。
      </p>
      <code class="formula">拉普拉斯方差：L = I(x±1,y)+I(x,y±1) − 4·I(x,y) ；score = Var(L)</code>
      <code class="formula">Tenengrad：score = mean(Gx² + Gy²)，G 由 Sobel 算子求得</code>
      <code class="formula">Brenner 梯度：score = mean([I(x+2,y) − I(x,y)]²)</code>
      <p>
        三者的关系：都是「梯度能量的某种度量」，因此都随离焦单调下降，峰都在焦平面。
        区别在于：二阶差分（Laplacian）对噪声最敏感；一阶梯度（Tenengrad）抗噪更均衡；
        Brenner 只看水平跨 2 像素的差分，计算最省。三者的<strong>绝对数值不可横向比较</strong>，
        但归一化后的曲线形状与峰位置应当一致。
      </p>
    </FoldSection>

    <FoldSection title="成像退化模型声明" title-en="Model disclaimer">
      <p>
        本模块的离焦用<strong>高斯模糊近似</strong>：σ = 模糊系数 × |z − z_focus|。
        这是<strong>图像退化近似模型，不是严格物理光学仿真</strong> ——
        真实离焦 PSF 是艾里斑随离焦演化的形态（会出环、旁瓣，甚至轴上零点），
        高斯核是各向同性的单调低通。
      </p>
      <p>
        选择高斯近似的原因：本模块考核的是「清晰度评价函数 + 搜索策略 + 重复性统计」这套
        <strong>工程测试流程</strong>，高斯退化在计算上可控且单调，便于验证算法本身是否正确。
        如果需要严格 PSF，请使用模块四的复光瞳 FFT 模型。
      </p>
      <code class="formula">成像链路：靶标 → 离焦高斯模糊 → 曝光（增益/偏置）→ 传感器高斯噪声（带种子）</code>
    </FoldSection>

    <FoldSection title="搜索策略：速度与精度的权衡" title-en="Search strategies">
      <ul>
        <li>
          <strong>全范围遍历</strong>：以固定步长扫过整个范围取最大 —— 最可靠，但捕获次数
          = 范围/步长 + 1。范围 6 mm、步长 0.1 mm 就是 61 次拍摄。
        </li>
        <li>
          <strong>粗调 + 精调</strong>：先用 4× 步长粗扫定位大致峰位，再在峰值附近 ±1 个粗步长内
          用细步长精扫 —— 捕获次数显著减少，精度仍可达一个细步长。这是工程上最常见的做法。
        </li>
        <li>
          <strong>山脊/爬山法</strong>（本项目未实现）：按梯度方向逐步逼近，捕获次数最少，
          但在噪声大、局部极值多的情况下容易走错方向——这也是为什么工业设备常用「先粗扫再精调」。
        </li>
      </ul>
      <p>
        注意：焦平面附近的评分曲线是<strong>平顶</strong>的（导数趋零），所以「误差 ≤ 一个步长」
        是正常且可接受的结论；想要更准就得减小步长或做亚步长插值（抛物线拟合）。
      </p>
    </FoldSection>

    <FoldSection title="准确度、重复性与稳定性" title-en="Accuracy, repeatability, stability">
      <p>这三个词在设备验收里含义不同，不能混用：</p>
      <ul>
        <li><strong>准确度（accuracy）</strong>：单次结果与<strong>真值</strong>的偏差 —— 本模块用 |搜索最佳 − 仿真真值| 表示。</li>
        <li><strong>重复性（repeatability）</strong>：同一条件多次测量彼此之间的一致性 —— 用标准差 / 最大误差表示。</li>
        <li><strong>稳定性（stability）</strong>：长时间或跨条件（温度、照度、振动）的一致性 —— 本平台不模拟时间漂移，只在文字层面说明其区别。</li>
      </ul>
      <p>
        工程上常用「准确度 + 重复性 + 成功率」三件套描述自动对焦性能：
        平均误差说明「准不准」，标准差说明「稳不稳」，成功率说明「可不可靠」。
      </p>
    </FoldSection>

    <FoldSection title="学习要点" title-en="Key points">
      <p><span class="q">Q：为什么不能只看一次对焦结果就下结论？</span></p>
      <p class="a">
        A：单次结果同时受噪声、平台定位误差、起始位置等因素影响，是随机量。只有重复 N 次并统计分布
        （均值 / 标准差 / 最大误差 / 成功率），才能说明设备的真实能力。
      </p>
      <p><span class="q">Q：评价函数选哪个更好？</span></p>
      <p class="a">
        A：噪声小、纹理细的场合 Tenengrad 通常最稳；追求速度可用 Brenner（只算水平方向）；
        Laplacian 方差实现最简单但对噪声最敏感。实测做法是用同一组数据比较三条曲线的
        「峰尖锐度」与「抗噪性」，而不是背结论。
      </p>
      <p><span class="q">Q：为什么同样的参数换一个随机种子结果会变？</span></p>
      <p class="a">
        A：因为噪声与定位误差都是随机的。本平台用带种子 PRNG，所以「同种子 + 同参数」必然复现同一结果，
        这正是仿真实验可复现性的要求；换种子相当于换一次实验条件。
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
