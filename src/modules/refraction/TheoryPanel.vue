<script setup lang="ts">
/** 模块二：光学原理 / 公式 / 适用条件 / 学习要点 */
import FoldSection from '@/components/ui/FoldSection.vue'
</script>

<template>
  <div class="theory">
    <FoldSection title="原理与公式" title-en="Principle & formulas" open>
      <p>
        <strong>通俗解释：</strong>光从一种介质进入另一种介质时，由于光速改变，波前方向随之偏折（折射）；
        同时界面总会把一部分光反射回去。入射角越大，折射光越「贴」着界面走；当光线从光密介质射向光疏介质时，
        大到某个角度就再也「挤」不出去，能量 100% 反射回来 —— 这就是<strong>全反射</strong>。
      </p>
      <code class="formula">反射定律  θ₁′ = θ₁</code>
      <code class="formula">折射定律（Snell）  n₁·sinθ₁ = n₂·sinθ₂</code>
      <code class="formula">临界角  θc = arcsin(n₂ / n₁)   （仅 n₁ &gt; n₂ 时存在）</code>
      <code class="formula">布儒斯特角  θB = arctan(n₂ / n₁)   （p 偏振反射率为 0）</code>
      <p>
        <strong>单位：</strong>角度以度（°）显示、内部以弧度计算；折射率为相对真空的无量纲量；
        介质中光速 v = c/n（m/s），介质中波长 λ = λ₀/n（nm）。
      </p>
    </FoldSection>

    <FoldSection title="菲涅尔公式与能量分配" title-en="Fresnel & energy">
      <code class="formula">rs = (n₁cosθ₁ − n₂cosθ₂) / (n₁cosθ₁ + n₂cosθ₂)</code>
      <code class="formula">rp = (n₂cosθ₁ − n₁cosθ₂) / (n₂cosθ₁ + n₁cosθ₂)</code>
      <code class="formula">R = (Rs + Rp)/2 ，T = 1 − R   （无吸收介质能量守恒）</code>
      <p>
        正入射时退化为经典形式 R = ((n₁−n₂)/(n₁+n₂))²。图中<strong>光线线宽与实际反射率 / 透射率成正比</strong>：
        全反射时折射光线消失、反射光线最粗，这就是「数据驱动」的可视化而非装饰效果。
      </p>
      <p>
        <strong>适用条件：</strong>理想平面界面、各向同性无吸收介质、折射率取标称常数（未计入色散与吸收），
        不考虑表面粗糙度散射、镀膜多层干涉与倏逝波能量。
      </p>
    </FoldSection>

    <FoldSection title="工业应用场景" title-en="Industrial applications">
      <ul>
        <li><strong>光纤通信 / 内窥镜：</strong>纤芯折射率大于包层，靠全反射把光约束在纤芯内传输（数值孔径 NA = √(n₁²−n₂²)）。</li>
        <li><strong>棱镜式分光与转向：</strong>45°–90°–45° 直角棱镜利用全反射替代镀银反射镜，降低损耗。</li>
        <li><strong>暗场 / 明场照明：</strong>暗场照明利用大角度掠射，让缺陷散射光进入成像系统而直面反射光不入镜，可提升颗粒与划伤对比度。</li>
        <li><strong>晶圆 / 玻璃表面检测：</strong>表面微小起伏会引起反射角偏移，是激光三角测量与干涉检测的物理基础。</li>
        <li><strong>偏振检测：</strong>布儒斯特角处 p 偏振反射率为零，可用于镀膜厚度与折射率测量、消除反光。</li>
      </ul>
    </FoldSection>

    <FoldSection title="学习要点" title-en="Key points">
      <p><span class="q">Q：什么时候会发生全反射？为什么水中的气泡看起来是亮的？</span></p>
      <p class="a">A：光由光密介质射向光疏介质且入射角大于临界角时。气泡壁面处光线从水射向空气，大角度入射发生全反射，把水中的光「关」在气泡界面内并射向观察者，因此看起来发亮。</p>
      <p><span class="q">Q：临界角如何计算？玻璃到空气大概多少？</span></p>
      <p class="a">A：θc = arcsin(n₂/n₁)。BK7 玻璃 (n≈1.5168) 到空气约 41.3°，水到空气约 48.6°，金刚石到空气仅约 24.4°，因此钻石「火彩」强。</p>
      <p><span class="q">Q：正入射时反射率是多少？为什么镜头要镀膜？</span></p>
      <p class="a">A：R = ((n₁−n₂)/(n₁+n₂))²。玻璃/空气界面约 4%，一个 10 片镜片的镜头累计损失可达 30% 以上并产生杂散光，因此需要单层或多层增透膜。</p>
      <p><span class="q">Q：反射率和角度是单调关系吗？</span></p>
      <p class="a">A：s 偏振反射率随角度单调递增；p 偏振先降到 0（布儒斯特角）再上升。所以自然光反射率曲线在布儒斯特角附近有个「弯折」，这也是偏振片起偏的原理。</p>
      <p><span class="q">Q：机器视觉里折射知识有什么用？</span></p>
      <p class="a">A：例如透明件（玻璃、镜片）检测需要偏振+掠射照明抑制反光；测量系统中需校正光楔与平板玻璃引入的像位移；远心镜头的设计也要控制界面折射。</p>
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
