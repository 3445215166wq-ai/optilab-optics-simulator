<script setup lang="ts">
/** 左上角品牌区：项目标识 + 中英文名 */
</script>

<template>
  <div class="brand">
    <svg class="brand__mark" viewBox="0 0 32 32" aria-hidden="true">
      <line x1="2" y1="16" x2="30" y2="16" stroke="currentColor" stroke-width="1" stroke-dasharray="2 2" opacity="0.5" />
      <path d="M10 6c5 4 5 16 0 20c-5-4-5-16 0-20z" fill="rgba(79,192,141,0.18)" stroke="#4fc08d" stroke-width="1.4" />
      <line x1="2" y1="9" x2="10" y2="12" stroke="#e8b64c" stroke-width="1.2" />
      <line x1="2" y1="23" x2="10" y2="20" stroke="#e8b64c" stroke-width="1.2" />
      <line x1="14" y1="11" x2="30" y2="6" stroke="#e8b64c" stroke-width="1.2" />
      <line x1="14" y1="21" x2="30" y2="26" stroke="#e8b64c" stroke-width="1.2" />
    </svg>
    <div class="brand__text">
      <div class="brand__name">OptiLab</div>
      <div class="brand__sub">交互式光学成像仿真平台</div>
    </div>
  </div>
</template>

<style scoped>
.brand {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 12px;
  border-right: 1px solid var(--border);
  border-bottom: 1px solid var(--border-strong);
  background: var(--bg-panel);
  min-width: 0;
}

.brand__mark {
  width: 24px;
  height: 24px;
  flex: none;
  color: var(--text-2);
}

.brand__text {
  min-width: 0;
}

.brand__name {
  font-size: 15px;
  font-weight: 700;
  letter-spacing: 0.04em;
  color: var(--text-1);
  line-height: 1.15;
}

.brand__sub {
  font-size: 10px;
  color: var(--text-3);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
