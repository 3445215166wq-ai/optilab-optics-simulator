<script setup lang="ts">
/** 顶栏：当前模块标题、阶段标识、仿真声明、主题切换 */
import { useTheme } from '@/stores/theme'
import type { ModuleMeta } from '@/modules/types'

defineProps<{ module: ModuleMeta | null }>()

const { isDark, toggleTheme } = useTheme()
</script>

<template>
  <header class="topbar">
    <div class="topbar__title">
      <span class="topbar__cn">{{ module?.title ?? 'OptiLab' }}</span>
      <span class="topbar__en">{{ module?.titleEn ?? '' }}</span>
    </div>
    <span v-if="module" class="badge badge--accent">阶段 {{ module.phase }}</span>
    <span class="topbar__spacer" />
    <span class="badge badge--warn" title="本平台中的设备、图像与测试数据全部由程序仿真生成，不代表真实设备性能">
      仿真设备 SIMULATED
    </span>
    <button class="btn btn--sm" :title="isDark ? '切换到浅色主题' : '切换到深色主题'" @click="toggleTheme()">
      {{ isDark ? '☀ 浅色' : '☾ 深色' }}
    </button>
  </header>
</template>

<style scoped>
.topbar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 12px;
  border-bottom: 1px solid var(--border-strong);
  background: var(--bg-panel);
  min-width: 0;
  overflow: hidden;
}

.topbar__title {
  display: flex;
  align-items: baseline;
  gap: 8px;
  min-width: 0;
}

.topbar__cn {
  font-size: var(--fs-lg);
  font-weight: 600;
  color: var(--text-1);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.topbar__en {
  font-size: var(--fs-xs);
  color: var(--text-3);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.topbar__spacer {
  flex: 1 1 auto;
}
</style>
