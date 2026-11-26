# 架构说明 Architecture

## 1. 设计目标

| 目标 | 落地方式 |
| --- | --- |
| 光学算法可验证 | `src/core/**` 是纯函数库，不依赖 Vue / DOM，Vitest 直接在 Node 环境测试 |
| 可扩展（后续 5 个模块） | 模块注册表 + 「参数 Schema 驱动 UI」+ 「计算/绘图/编排」三层分离 |
| 结果可解释、不做假 | 所有面板数据来自 `core` 的返回值；预留的接口未接入真实模型时明确标注「未接入」 |
| 部署简单 | `base: './'` 相对路径产物，任意静态托管可用，无路由依赖 |

## 2. 目录结构

```
.
├─ index.html                    入口 HTML（含首帧主题脚本，避免深/浅色闪烁）
├─ vite.config.ts                Vite + Vitest 合并配置（base: './'）
├─ tsconfig.json                 strict / noUnusedLocals / verbatimModuleSyntax
├─ package.json
├─ README.md
├─ docs/
│  ├─ ARCHITECTURE.md            本文件
│  ├─ OPTICS.md                  光学原理与公式推导
│  ├─ TESTS.md                   单元测试与计算验证报告
│  └─ screenshots/               界面截图（README 引用）
└─ src/
   ├─ main.ts                   挂载入口：初始化主题 → 写启动日志 → mount
   ├─ App.vue                   应用外壳（品牌 / 顶栏 / 导航 / 主区 的网格布局）
   ├─ env.d.ts
   ├─ styles/
   │  ├─ tokens.css             设计令牌：深/浅两套 CSS 变量（颜色、字号、间距、布局尺寸）
   │  ├─ base.css               重置与全局排版
   │  └─ components.css         通用组件样式（面板/按钮/滑杆/数据卡/数据坞/日志…）
   ├─ core/                     ★ 纯计算层（无 Vue、无 DOM）
   │  ├─ units.ts               角度换算、clamp、数值判定
   │  ├─ constants.ts           物理常数（光速 m/s 与 mm/s）
   │  ├─ format.ts              仪器面板数值格式化（含 ∞ / 科学计数 / — 兜底）
   │  ├─ geometry.ts            Vec2、线段裁剪、niceStep、linspace
   │  ├─ rng.ts                 mulberry32 + Box–Muller 带种子 PRNG（后续噪声仿真用）
   │  ├─ optics/
   │  │  ├─ thinLens.ts         模块一：薄透镜成像 + 光线追迹
   │  │  ├─ thinLens.test.ts
   │  │  ├─ refraction.ts       模块二：折射/全反射/菲涅尔
   │  │  └─ refraction.test.ts
   │  ├─ format.test.ts / geometry.test.ts / rng.test.ts
   │  └─ (后续) optics/diffraction.ts、optics/psfMtf.ts、imaging/*
   ├─ render/                   ★ Canvas 绘制层（只画，不算物理）
   │  ├─ palette.ts             与 CSS 变量对齐的深/浅两套画布配色
   │  ├─ viewport.ts            世界 mm → 屏幕 px，自适应缩放 + 可标注的纵向拉伸
   │  ├─ draw.ts                Canvas 基元：网格坐标轴、箭头、标签胶囊、尺寸线、比例尺
   │  ├─ geoOpticsScene.ts      模块一场景（透镜符号、主光线、光锥、虚像延长线、物/像标注）
   │  └─ refractionScene.ts     模块二场景（介质底色、界面、法线、角度弧、临界角）
   ├─ components/
   │  ├─ layout/                AppBrand / AppTopbar / ModuleNav / ExperimentWorkspace
   │  └─ ui/                    CanvasStage / ChartPanel / ParamPanel / ParamField / StatGrid
   │                            LogConsole / FoldSection / params.ts（Schema 类型）/ statTypes.ts
   ├─ stores/
   │  ├─ theme.ts               主题状态 + localStorage + 画布调色板联动
   │  └─ log.ts                 实验日志（环形上限 400 条）+ useExperimentLog 节流记录
   └─ modules/                  ★ 模块编排层
      ├─ types.ts               ModuleMeta 类型
      ├─ registry.ts            模块注册表（ready / planned，导航据此渲染）
      ├─ geoOptics/             GeoOpticsModule.vue / params.ts / charts.ts / TheoryPanel.vue
      └─ refraction/            RefractionModule.vue / params.ts / charts.ts / TheoryPanel.vue
```

## 3. 分层规则（Code Review 检查项）

1. **core 不得 import Vue / DOM**：保持可在 Node 测试、可迁移 Worker/WASM。
2. **core 返回结构化结果，不抛异常**：非法输入返回 `{ ok: false, errors: [...], ... }`，避免界面因一个 NaN 崩掉；同时也保证调用方必须显式处理非法分支。
3. **render 不得出现物理常数或公式**：只接受 `core` 的几何结果（线段、点、状态标记）。
4. **modules 不直接操作 Canvas API**：绘图一律通过 `render/*Scene.ts`。
5. **没有硬编码的「结果」数值**：面板数值、曲线、日志均由计算得到。示意图与近似模型必须在 UI 上显式标注。

## 4. 数据流

```
用户拖动滑杆
   │
   ▼
modules/<m>/params.ts 定义的 Schema ──► ParamField 校验/夹取 ──► reactive params
                                                                   │
                                            computed: core 计算 ───┤（纯函数，相同输入必得相同输出）
                                                   │               │
                    ┌──────────────────────────────┴──────┐        │
                    ▼                                     ▼        ▼
       render/drawXXXScene(ctx, size, result, opts, palette)   StatGrid / ECharts option / 日志
                    │
                    ▼
       CanvasStage 的 watchEffect：draw 内部读取到的响应式值一变就重绘（无需手写 watch 列表）
```

- **重绘触发**：`CanvasStage` 用一个 `watchEffect` 包裹 `props.draw(...)`，凡是 `draw` 过程中同步读取的响应式数据（params、computed 结果、主题调色板）都会被记录为依赖；Vue 在微任务中批量去重，因此连续改多个参数只重绘一次。
- **尺寸/DPR**：`ResizeObserver` → 重置 canvas 物理像素尺寸并 `ctx.setTransform(dpr,…)`，保证高分屏清晰；同时向父组件 emit `resize`，供「纵向放大 N×」这类需要画布尺寸的标注使用。
- **ECharts 惰性初始化**：图表位于底部数据坞的隐藏标签页中，隐藏时容器尺寸为 0；`ChartPanel` 用 `ResizeObserver` 在容器真正可见时才 `echarts.init`，避免 0×0 初始化。

## 5. 主题体系

- HTML 侧：`<html data-theme="dark|light">` + `tokens.css` 两组变量；`index.html` 内联脚本在首帧前根据 `localStorage` / 系统偏好写入该属性，消除闪烁。
- Canvas 侧：`render/palette.ts` 提供与 CSS 变量数值对齐的 `ScenePalette` 对象，由 `useTheme().palette` 计算属性下发。
- 两者同步点：`stores/theme.ts` 的 `apply()` 同时写 `data-theme` 与响应式状态。

## 6. 如何新增一个实验模块（后续阶段的步骤）

1. `src/core/optics/<name>.ts`：写纯函数 + 中文注释 + 明确单位、符号约定、边界条件；
2. `src/core/optics/<name>.test.ts`：用解析解/独立公式验证（见 `docs/TESTS.md` 的写法）；
3. `src/render/<name>Scene.ts`：场景绘制，必要时复用 `draw.ts` 基元与 `viewport.ts`；
4. `src/modules/<name>/params.ts`：默认值 + Schema（控件、单位、提示、范围）；
5. `src/modules/<name>/charts.ts`：ECharts option（数据来自 core 的扫描计算）；
6. `src/modules/<name>/<Name>Module.vue`：用 `ExperimentWorkspace` 的 4 个 slot 组装；
7. `src/modules/registry.ts`：把 `status` 改为 `ready` 并挂载组件；
8. 更新 `docs/OPTICS.md`、`docs/TESTS.md`、`README.md` 的功能表。

## 7. 性能考虑

- 场景绘制是单帧 O(光线数) 的 2D 图元绘制，参数量级 10²，直接同步绘制即可（一次重绘 < 2 ms）。
- 曲线扫描（220 / 180 采样点 × 小规模纯函数）只在参数变化时重算，`computed` 天然缓存。
- 后续衍射/PSF 需要 FFT（矩阵可达 512×512），计划：`computed` 结果缓存 + 必要时迁入 Web Worker，避免主线程卡顿。
- 未做虚拟滚动/懒加载，因为当前单页 DOM 节点规模在数百级。
