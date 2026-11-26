<script setup lang="ts">
/** 参数面板：由 Schema 自动生成分组控件，右侧栏统一使用本组件 */
import ParamField from './ParamField.vue'
import type { ParamModel, ParamSection, ParamValue } from './params'

defineProps<{
  sections: ParamSection[]
  model: ParamModel
  title?: string
  subtitle?: string
}>()

const emit = defineEmits<{
  (e: 'update', key: string, value: ParamValue): void
  (e: 'invalid', message: string): void
}>()
</script>

<template>
  <aside class="panel panel--flush param-panel">
    <div class="panel__head">
      <span class="panel__title-cn">{{ title ?? '参数设置' }}</span>
      <span class="panel__sub">{{ subtitle ?? 'Parameters' }}</span>
      <span class="panel__spacer" />
      <slot name="actions" />
    </div>
    <div class="panel__body">
      <section v-for="section in sections" :key="section.title">
        <div class="section-title">
          {{ section.title }}
          <span v-if="section.titleEn" class="muted xs">· {{ section.titleEn }}</span>
        </div>
        <ParamField
          v-for="def in section.fields"
          :key="def.key"
          :def="def"
          :value="model[def.key] ?? ''"
          @update="(v: ParamValue) => emit('update', def.key, v)"
          @invalid="(msg: string) => emit('invalid', msg)"
        />
      </section>
      <slot name="footer" />
    </div>
  </aside>
</template>

<style scoped>
.param-panel {
  height: 100%;
  border-left: none;
}
</style>
