<script setup lang="ts">
/** 计算结果数据卡网格 */
import type { StatItem } from './statTypes'

defineProps<{ items: StatItem[] }>()
</script>

<template>
  <div class="stat-grid">
    <div
      v-for="item in items"
      :key="item.label + (item.labelEn ?? '')"
      class="stat"
      :class="item.tone ? `stat--${item.tone}` : undefined"
    >
      <div class="stat__label">
        {{ item.label }}
        <span v-if="item.labelEn" class="stat__label-en">{{ item.labelEn }}</span>
      </div>
      <div class="stat__value">
        {{ item.value }}
        <span v-if="item.unit" class="stat__unit">{{ item.unit }}</span>
      </div>
      <div v-if="item.note" class="stat__note">{{ item.note }}</div>
    </div>
  </div>
</template>
