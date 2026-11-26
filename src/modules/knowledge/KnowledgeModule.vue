<script setup lang="ts">
/**
 * 模块八：光学知识库
 *
 * 13 个知识点，每条与项目中真实实现的仿真模块对应；可按关键词检索、按类别筛选，
 * 并可从知识点直接跳到相关实验模块。
 */
import { computed, ref } from 'vue'
import CollapsibleSection from '@/components/ui/FoldSection.vue'
import {
  KNOWLEDGE_CATEGORIES,
  KNOWLEDGE_ENTRIES,
  searchKnowledge,
  type KnowledgeCategory,
  type KnowledgeEntry,
} from '@/knowledge/entries'
import { findModule } from '@/modules/registry'
import { useNavigation } from '@/stores/navigation'
import { pushLog } from '@/stores/log'

const MODULE_NAME = '知识库'

const query = ref('')
const category = ref<KnowledgeCategory | '全部'>('全部')
const selectedId = ref<string>(KNOWLEDGE_ENTRIES[0].id)

const { setActiveModule } = useNavigation()

const filtered = computed(() => {
  const byQuery = searchKnowledge(query.value)
  return category.value === '全部' ? byQuery : byQuery.filter((e) => e.category === category.value)
})

const selected = computed<KnowledgeEntry>(
  () => KNOWLEDGE_ENTRIES.find((e) => e.id === selectedId.value) ?? KNOWLEDGE_ENTRIES[0],
)

const relatedModuleTitle = computed(() => {
  const id = selected.value.relatedModule
  return id ? findModule(id)?.title ?? '' : ''
})

function jumpToModule(): void {
  const id = selected.value.relatedModule
  if (!id) return
  setActiveModule(id)
  pushLog('info', MODULE_NAME, `从知识点「${selected.value.title}」跳转到实验模块`)
}

function countOf(cat: KnowledgeCategory | '全部'): number {
  return cat === '全部'
    ? KNOWLEDGE_ENTRIES.length
    : KNOWLEDGE_ENTRIES.filter((e) => e.category === cat).length
}
</script>

<template>
  <div class="kb">
    <aside class="kb__list">
      <div class="kb__search">
        <input v-model="query" class="input kb__input" type="search" placeholder="检索知识点 / 公式 / 术语…" />
      </div>
      <div class="kb__cats">
        <button
          v-for="cat in (['全部', ...KNOWLEDGE_CATEGORIES] as const)"
          :key="cat"
          class="chip"
          :class="{ 'chip--on': category === cat }"
          @click="category = cat"
        >
          {{ cat }} {{ countOf(cat) }}
        </button>
      </div>
      <div class="kb__items">
        <button
          v-for="entry in filtered"
          :key="entry.id"
          class="kb-item"
          :class="{ 'kb-item--on': entry.id === selectedId }"
          @click="selectedId = entry.id"
        >
          <span class="kb-item__title">{{ entry.title }}</span>
          <span class="kb-item__en">{{ entry.titleEn }}</span>
          <span class="kb-item__cat">{{ entry.category }}</span>
        </button>
        <div v-if="!filtered.length" class="empty">没有匹配的知识点</div>
      </div>
    </aside>

    <section class="kb__detail">
      <header class="kb__head">
        <div>
          <h2 class="kb__title">{{ selected.title }}</h2>
          <div class="kb__title-en">{{ selected.titleEn }} · {{ selected.category }}</div>
        </div>
        <button
          v-if="selected.relatedModule"
          class="btn btn--sm btn--primary"
          :title="`打开实验模块：${relatedModuleTitle}`"
          @click="jumpToModule"
        >
          去实验：{{ relatedModuleTitle }}
        </button>
      </header>

      <div class="kb__body">
        <section class="kb__block kb__block--plain">
          <div class="kb__label">通俗解释 <span class="kb__label-en">Plain explanation</span></div>
          <p>{{ selected.plain }}</p>
        </section>

        <section class="kb__block">
          <div class="kb__label">专业定义 <span class="kb__label-en">Definition</span></div>
          <p>{{ selected.definition }}</p>
        </section>

        <section class="kb__block">
          <div class="kb__label">数学公式 <span class="kb__label-en">Formulas</span></div>
          <code v-for="f in selected.formulas" :key="f" class="formula">{{ f }}</code>
        </section>

        <section class="kb__block">
          <div class="kb__label">参数与单位 <span class="kb__label-en">Units</span></div>
          <p>{{ selected.units }}</p>
        </section>

        <section class="kb__block">
          <div class="kb__label">适用条件 <span class="kb__label-en">Conditions</span></div>
          <ul>
            <li v-for="c in selected.conditions" :key="c">{{ c }}</li>
          </ul>
        </section>

        <section class="kb__block">
          <div class="kb__label">工业应用 <span class="kb__label-en">Applications</span></div>
          <ul>
            <li v-for="a in selected.applications" :key="a">{{ a }}</li>
          </ul>
        </section>

        <CollapsibleSection title="常见问题与要点" title-en="Q & A">
          <template v-for="item in selected.questions" :key="item.q">
            <p><span class="q">Q：{{ item.q }}</span></p>
            <p class="a">A：{{ item.a }}</p>
          </template>
        </CollapsibleSection>
      </div>
    </section>
  </div>
</template>

<style scoped>
.kb {
  display: grid;
  grid-template-columns: 262px minmax(0, 1fr);
  height: 100%;
  min-height: 0;
  background: var(--bg-app);
}

.kb__list {
  display: flex;
  flex-direction: column;
  min-height: 0;
  border-right: 1px solid var(--border-strong);
  background: var(--bg-panel);
}

.kb__search {
  padding: 10px;
  border-bottom: 1px solid var(--border);
}

.kb__input {
  width: 100%;
  height: 28px;
  font-family: var(--font-sans);
}

.kb__cats {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  padding: 8px 10px;
  border-bottom: 1px solid var(--border);
}

.kb__items {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  padding: 6px;
}

.kb-item {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: baseline;
  gap: 2px 8px;
  width: 100%;
  padding: 7px 9px;
  border-radius: var(--radius-sm);
  border-left: 2px solid transparent;
  text-align: left;
  color: var(--text-2);
}

.kb-item:hover {
  background: var(--bg-hover);
  color: var(--text-1);
}

.kb-item--on {
  background: var(--bg-active);
  border-left-color: var(--accent);
  color: var(--text-1);
}

.kb-item__title {
  font-size: var(--fs-sm);
  font-weight: 500;
}

.kb-item__en {
  grid-column: 1 / 2;
  font-size: 9.5px;
  color: var(--text-3);
}

.kb-item__cat {
  grid-column: 2 / 3;
  grid-row: 1 / 2;
  font-size: 9px;
  padding: 0 4px;
  border: 1px solid var(--border-strong);
  border-radius: 2px;
  color: var(--text-3);
}

.kb__detail {
  display: flex;
  flex-direction: column;
  min-height: 0;
  min-width: 0;
}

.kb__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
  background: var(--bg-panel-2);
}

.kb__title {
  margin: 0;
  font-size: var(--fs-xl);
  font-weight: 600;
  color: var(--text-1);
}

.kb__title-en {
  font-size: var(--fs-xs);
  color: var(--text-3);
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.kb__body {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  padding: 14px 16px 22px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  max-width: 940px;
}

.kb__block {
  font-size: var(--fs-md);
  line-height: 1.65;
  color: var(--text-2);
}

.kb__block p {
  margin: 0;
}

.kb__block ul {
  margin: 4px 0 0;
  padding-left: 18px;
}

.kb__block li {
  margin: 2px 0;
}

.kb__block--plain {
  padding: 10px 12px;
  border-left: 3px solid var(--accent);
  background: var(--accent-soft);
  border-radius: var(--radius-sm);
  color: var(--text-1);
}

.kb__label {
  display: flex;
  align-items: baseline;
  gap: 6px;
  margin-bottom: 4px;
  font-size: var(--fs-xs);
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-3);
}

.kb__label-en {
  font-weight: 400;
  text-transform: none;
  letter-spacing: 0;
  opacity: 0.8;
}

@media (max-width: 1080px) {
  .kb {
    grid-template-columns: 1fr;
    grid-template-rows: auto minmax(0, 1fr);
  }

  .kb__list {
    border-right: none;
    border-bottom: 1px solid var(--border-strong);
    max-height: 38vh;
  }
}
</style>
