<script setup lang="ts">
/**
 * 左侧模块导航。
 * 未实现的模块保持可见但禁用，并标注「规划中」——不做无功能的假按钮。
 */
import { computed } from 'vue'
import type { ModuleMeta } from '@/modules/types'

const props = defineProps<{ modules: ModuleMeta[]; active: string }>()
const emit = defineEmits<{ (e: 'select', id: string): void }>()

const PHASE_LABELS: Record<number, string> = {
  1: '阶段一 · 几何光学与折射',
  2: '阶段二 · 衍射 / PSF / MTF',
  3: '阶段三 · 自动对焦与成像质量',
  4: '阶段四 · 报告与知识库',
}

const groups = computed(() => {
  const map = new Map<number, ModuleMeta[]>()
  for (const m of props.modules) {
    const list = map.get(m.phase) ?? []
    list.push(m)
    map.set(m.phase, list)
  }
  return [...map.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([phase, modules]) => ({ phase, label: PHASE_LABELS[phase] ?? `阶段 ${phase}`, modules }))
})
</script>

<template>
  <nav class="nav" aria-label="实验模块导航">
    <div v-for="group in groups" :key="group.phase" class="nav__group">
      <div class="nav__group-title">{{ group.label }}</div>
      <button
        v-for="m in group.modules"
        :key="m.id"
        class="nav__item"
        :class="{
          'nav__item--on': m.id === active,
          'nav__item--planned': m.status !== 'ready',
        }"
        :disabled="m.status !== 'ready'"
        :title="m.status === 'ready' ? m.summary : '该模块将在后续阶段实现'"
        @click="emit('select', m.id)"
      >
        <span class="nav__index">{{ m.index }}</span>
        <span class="nav__text">
          <span class="nav__title">{{ m.short }}</span>
          <span class="nav__en">{{ m.titleEn }}</span>
        </span>
        <span v-if="m.status !== 'ready'" class="nav__tag">规划中</span>
      </button>
    </div>

    <div class="nav__foot">
      <div class="xs muted">OptiLab v0.1.0 · 纯前端本地计算</div>
      <div class="xs muted">所有设备均为仿真，非商业光学设计软件</div>
    </div>
  </nav>
</template>

<style scoped>
.nav {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 8px 6px;
  background: var(--bg-panel);
  border-right: 1px solid var(--border-strong);
  overflow-y: auto;
  min-height: 0;
}

.nav__group-title {
  padding: 4px 8px 3px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-3);
}

.nav__item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 6px 8px;
  border-radius: var(--radius-sm);
  border-left: 2px solid transparent;
  text-align: left;
  color: var(--text-2);
  transition: background var(--t-fast), color var(--t-fast), border-color var(--t-fast);
}

.nav__item:hover:not(:disabled) {
  background: var(--bg-hover);
  color: var(--text-1);
}

.nav__item--on {
  background: var(--bg-active);
  border-left-color: var(--accent);
  color: var(--text-1);
}

.nav__item--planned {
  opacity: 0.44;
}

.nav__index {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  flex: none;
  border: 1px solid var(--border-strong);
  border-radius: 3px;
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--text-3);
}

.nav__item--on .nav__index {
  border-color: var(--accent);
  color: var(--accent-strong);
}

.nav__text {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1 1 auto;
}

.nav__title {
  font-size: var(--fs-sm);
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.nav__en {
  font-size: 9.5px;
  color: var(--text-3);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.nav__tag {
  flex: none;
  font-size: 9px;
  padding: 0 4px;
  border-radius: 2px;
  border: 1px solid var(--border-strong);
  color: var(--text-3);
}

.nav__foot {
  margin-top: auto;
  padding: 8px;
  border-top: 1px dashed var(--border);
  display: flex;
  flex-direction: column;
  gap: 2px;
  line-height: 1.35;
}

/* 窄屏：导航改为横向滚动条，避免占满首屏高度 */
@media (max-width: 900px) {
  .nav {
    flex-direction: row;
    align-items: center;
    gap: 4px;
    overflow-x: auto;
    overflow-y: hidden;
    padding: 6px 8px;
    border-right: none;
    border-bottom: 1px solid var(--border-strong);
  }

  .nav__group {
    display: flex;
    align-items: center;
    gap: 4px;
    flex: none;
  }

  .nav__group-title {
    display: none;
  }

  .nav__item {
    width: auto;
    flex: none;
    padding: 4px 9px;
    border-left: none;
    border-bottom: 2px solid transparent;
  }

  .nav__item--on {
    border-left: none;
    border-bottom-color: var(--accent);
  }

  .nav__index,
  .nav__en,
  .nav__foot {
    display: none;
  }
}
</style>
