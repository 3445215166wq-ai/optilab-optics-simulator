<script setup lang="ts">
/** 模块一：光学原理 / 公式 / 适用条件 / 学习要点（纯内容组件） */
import FoldSection from '@/components/ui/FoldSection.vue'
</script>

<template>
  <div class="theory">
    <FoldSection title="原理与公式" title-en="Principle & formulas">
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
        <strong>单位：</strong>本模块所有长度统一为 <strong>mm</strong>；F 数 N = |f|/D 与数值孔径 NA = n·sinθ
        都是无量纲量（本模型默认空气，n ≈ 1）。
        物方 NA ≈ sin(atan(D/2u))，像方 NA′ ≈ sin(atan(D/2|v|))，两者只在近轴条件下成立。
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
        当 F 数很小（大孔径）、视场很大或物距很小时，球差、彗差、场曲与衍射会显著偏离本模型，
        此时需要实际光线追迹与像差理论（以及阶段二的 PSF/MTF 分析），本平台不作商业级设计用途。
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

    <FoldSection title="学习要点" title-en="Key points">
      <p><span class="q">Q：物距恰好等于焦距时，像在哪里？</span></p>
      <p class="a">A：出射光线平行于光轴，像在无穷远，不存在有限像距；此时高斯公式分母为零，必须按极限讨论，工程上对应准直器工况。</p>
      <p><span class="q">Q：为什么实像一定倒立、虚像一定正立？</span></p>
      <p class="a">A：由 m = −v/u 可知：实像 v &gt; 0 ⇒ m &lt; 0 必倒立；虚像 v &lt; 0 ⇒ m &gt; 0 必正立。这是单薄透镜成像的必然结果。</p>
      <p><span class="q">Q：F 数是什么？它对工程意味着什么？</span></p>
      <p class="a">
        A：F 数（f-number）N = f/D，是相对孔径 D/f 的倒数，`F/#` 中的 # 即 number。N 越小，相对孔径越大：
        在相同物面亮度下像面照度近似 ∝ 1/N²，衍射受限的斑径也越小；但同时景深变浅、像差更难校正 ——
        机器视觉选镜头就是在这三者之间做权衡。
      </p>
      <p><span class="q">Q：名义 F 数与有效 F 数有什么区别？</span></p>
      <p class="a">
        A：名义 F 数 N = f/D 按无限共轭（物在无穷远）定义，是镜头铭牌上的值；实际工作中物在有限距离，
        真正决定像面照度与衍射斑尺寸的是有效（工作）F 数 N_eff = |v|/D；成实像时它可写成 N·(1 + |m|)，
        例如 1:1 成像（u = 2f）时 N_eff = 2N，照度约降到 1/4。两者只在无穷远成像时相等。
        虚像情形出射光是发散的，N_eff 只作为像方锥的等效量，上述 N·(1+|m|) 关系不再适用。
      </p>
      <p><span class="q">Q：数值孔径 NA 的定义里为什么有折射率？</span></p>
      <p class="a">
        A：NA = n·sinθ，n 是光线所在介质的折射率。空气中 n ≈ 1，所以常被省略；但在浸液物镜（油浸、水浸）
        中这项至关重要，NA 直接决定分辨率极限（≈0.61λ/NA）与集光能力（∝NA²）。
      </p>
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
