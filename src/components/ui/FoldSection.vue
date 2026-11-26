<script setup lang="ts">
/** 可折叠的原理 / 公式 / 学习要点区块 */
defineProps<{
  title: string
  titleEn?: string
  open?: boolean
}>()
</script>

<template>
  <details class="fold" :open="open">
    <summary class="fold__head">
      {{ title }}
      <span v-if="titleEn" class="muted xs" style="font-weight: 400">{{ titleEn }}</span>
    </summary>
    <div class="fold__body">
      <slot />
    </div>
  </details>
</template>
