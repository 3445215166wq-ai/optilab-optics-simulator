<script setup lang="ts">
/** 应用外壳：品牌区 + 顶栏 + 左侧模块导航 + 主工作区 */
import { computed } from 'vue'
import AppBrand from '@/components/layout/AppBrand.vue'
import AppTopbar from '@/components/layout/AppTopbar.vue'
import ModuleNav from '@/components/layout/ModuleNav.vue'
import { MODULES, findModule } from '@/modules/registry'
import { pushLog } from '@/stores/log'
import { useNavigation } from '@/stores/navigation'

const { activeModuleId: activeId, setActiveModule } = useNavigation()
const active = computed(() => findModule(activeId.value))

function select(id: string): void {
  const target = findModule(id)
  if (!target || target.status !== 'ready') return
  if (activeId.value === id) return
  setActiveModule(id)
  pushLog('info', '系统', `切换到「${target.title} / ${target.titleEn}」`)
}
</script>

<template>
  <div class="app">
    <div class="app__brand"><AppBrand /></div>
    <div class="app__topbar"><AppTopbar :module="active" /></div>
    <div class="app__nav">
      <ModuleNav :modules="MODULES" :active="activeId" @select="select" />
    </div>
    <main class="app__main">
      <component :is="active?.component" v-if="active?.component" :key="active.id" />
    </main>
  </div>
</template>

<style scoped>
.app {
  display: grid;
  grid-template-columns: var(--nav-w) minmax(0, 1fr);
  grid-template-rows: var(--topbar-h) minmax(0, 1fr);
  grid-template-areas:
    'brand topbar'
    'nav main';
  height: 100dvh;
  width: 100%;
  overflow: hidden;
  background: var(--bg-app);
}

.app__brand {
  grid-area: brand;
  min-width: 0;
}

.app__topbar {
  grid-area: topbar;
  min-width: 0;
}

.app__nav {
  grid-area: nav;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}

.app__main {
  grid-area: main;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

@media (max-width: 900px) {
  .app {
    grid-template-columns: 1fr;
    grid-template-rows: var(--topbar-h) auto auto minmax(0, 1fr);
    grid-template-areas:
      'topbar'
      'brand'
      'nav'
      'main';
    height: auto;
    min-height: 100dvh;
    overflow: auto;
  }

  .app__brand {
    border-right: none;
    border-bottom: none;
  }
}
</style>
