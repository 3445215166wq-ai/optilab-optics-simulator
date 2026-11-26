<script setup lang="ts">
/** 模块一：光学原理 / 公式 / 适用条件 / 面试要点（纯内容组件） */
import FoldSection from '@/components/ui/FoldSection.vue'
</script>

<template>
  <div class="theory">
    <FoldSection title="原理与公式" title-en="Principle & formulas" open>
      <p>
        <strong>通俗解释：</strong>凸透镜把从物点发散的球面波前「掰」回会聚状态，出射光线重新交于一点，
        这点就是实像；如果光线还没等会聚就被观察者截住（或本来就是发散的），人眼顺着光线反向看去，
        交点落在透镜后方，看起来「像在透镜后面」，这就是虚像。
      </p>
      <p>
        <strong>专业定义（近轴薄透镜）：</strong>忽略透镜厚度，把两次面折射等效为在主平面上的一次偏折；
        近轴条件下（sinθ ≈ tanθ ≈ θ）物像满足共轭关系。
      </p>
      <code class="formula">高斯成像公式  1/f = 1/u + 1/v   ⇒   v = f·u / (u − f)</code>
      <code class="formula">横向放大率    m = h′/h = −v/u</code>
      <code class="formula">牛顿公式      (u − f)(v − f) = f²</code>
      <p>
        <strong>符号约定：</strong>光线从左向右传播；u &gt; 0 表示物体在透镜左侧；凸透镜 f &gt; 0、凹透镜 f &lt; 0；
        v &gt; 0 为实像（透镜右侧），v &lt; 0 为虚像（透镜左侧）。m &lt; 0 表示倒立，m &gt; 0 表示正立。
      </p>
      <p>
        <strong>单位：</strong>本模块所有长度统一为 <strong>mm</strong>；F/#（相对孔径倒数）= |f| / D 为无量纲量；
        数值孔径 NA ≈ sin(θ) = (D/2) / √((D/2)² + u²)（近轴近似下用 tan 代替 sin）。
      </p>
    </FoldSection>

    <FoldSection title="四种成像情形与适用条件" title-en="Cases & conditions">
      <ul>
        <li><strong>u &gt; 2f</strong>：f &lt; v &lt; 2f，|m| &lt; 1 —— 缩小、倒立实像（相机、人眼）。</li>
        <li><strong>u = 2f</strong>：v = 2f，m = −1 —— 等大、倒立实像（1:1 成像、翻拍）。</li>
        <li><strong>f &lt; u &lt; 2f</strong>：v &gt; 2f，|m| &gt; 1 —— 放大、倒立实像（投影仪、显微物镜）。</li>
        <li><strong>u = f</strong>：v → ∞ —— 出射平行光，像在无穷远（准直器）。</li>
        <li><strong>u &lt; f</strong>：v &lt; 0，m &gt; 1 —— 放大、正立虚像（放大镜）。</li>
        <li><strong>凹透镜（f &lt; 0）</strong>：对任意实物 u &gt; 0 都有 v &lt; 0 且 |m| &lt; 1 —— 恒为正立缩小虚像。</li>
      </ul>
      <p>
        <strong>适用条件：</strong>单色光 / 近轴（小孔径、小视场）/ 薄透镜 / 无像差。
        当 F/# 很小（大孔径）或视场很大时，球差、彗差、场曲会显著偏离本模型，
        此时必须使用实际光线追迹与像差理论，本平台不作商业级设计用途。
      </p>
    </FoldSection>

    <FoldSection title="三条主光线作图法" title-en="Three principal rays">
      <ul>
        <li><strong>① 平行光轴光线：</strong>入射平行于光轴，出射后（或其反向延长线）通过像方焦点 F′。</li>
        <li><strong>② 过光心光线：</strong>通过透镜中心的近轴光线方向不改变（薄透镜主平面上偏折为零）。</li>
        <li><strong>③ 过物方焦点光线：</strong>入射光线（或其延长线）通过物方焦点 F，出射后平行于光轴。</li>
      </ul>
      <p>
        任意两条主光线的交点即像点；第三条可用于校验作图。图中细线是按通光口径采样得到的<strong>光锥</strong>，
        它们同样交于像点 —— 这正是「光锥成像」的几何含义，也解释了为什么口径只影响亮度而不影响（理想模型下的）像位置。
      </p>
    </FoldSection>

    <FoldSection title="面试要点" title-en="Interview Q&amp;A">
      <p><span class="q">Q：物距恰好等于焦距时，像在哪里？</span></p>
      <p class="a">A：出射光线平行于光轴，像在无穷远，不存在有限像距；此时高斯公式分母为零，必须按极限讨论，工程上对应准直器工况。</p>
      <p><span class="q">Q：为什么实像一定倒立、虚像一定正立？</span></p>
      <p class="a">A：由 m = −v/u 可知：实像 v &gt; 0 ⇒ m &lt; 0 必倒立；虚像 v &lt; 0 ⇒ m &gt; 0 必正立。这是单薄透镜成像的必然结果。</p>
      <p><span class="q">Q：F/# 是什么？它对工程意味着什么？</span></p>
      <p class="a">A：F/# = f/D，表示相对孔径的倒数。F/# 越小，进光量越大（∝ 1/F#²）、衍射极限分辨率越高，但景深越小、像差越难校正；机器视觉选镜头时 F/# 与景深、照度、衍射极限互相制约。</p>
      <p><span class="q">Q：物像共轭是什么意思？工程上有什么用？</span></p>
      <p class="a">A：满足 1/f = 1/u + 1/v 的 (u, v) 组合互为共轭，可互换物像位置而保持成像关系，这是光学系统「可逆性」的体现，也是双远心、齐焦设计的理论基础之一。</p>
      <p><span class="q">Q：近轴近似的适用边界在哪？</span></p>
      <p class="a">A：通常以孔径角与视场角很小时成立（sinθ ≈ θ 误差 &lt; 1%）。经验上 F/# &lt; 1 或视场半角 &gt; 10° 时就应引入实际光线追迹与像差分析。</p>
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
