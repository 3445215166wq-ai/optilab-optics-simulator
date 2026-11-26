<script setup lang="ts">
/**
 * 单个参数控件：滑杆 + 数值输入（range）、纯数值（number）、分段（segmented）、下拉（select）。
 * 输入合法性在这里兜底：非法文本会被拒绝并回退，超范围会被夹到边界。
 */
import { computed, ref, watch } from 'vue'
import { formatParamValue, type ParamDef, type ParamValue } from './params'

const props = defineProps<{ def: ParamDef; value: ParamValue }>()
const emit = defineEmits<{ (e: 'update', value: ParamValue): void; (e: 'invalid', message: string): void }>()

const draft = ref(formatParamValue(props.value, props.def))
const invalid = ref(false)

watch(
  () => props.value,
  (next) => {
    draft.value = formatParamValue(next, props.def)
  },
)

const numericDef = computed(() =>
  props.def.kind === 'range' || props.def.kind === 'number' ? props.def : null,
)

const sliderValue = computed(() => {
  const v = Number(props.value)
  return Number.isFinite(v) ? v : numericDef.value?.min ?? 0
})

function flashInvalid(message: string): void {
  invalid.value = true
  emit('invalid', message)
  window.setTimeout(() => {
    invalid.value = false
  }, 1400)
}

function commitText(): void {
  const def = numericDef.value
  if (!def) return
  const raw = Number(draft.value)
  if (draft.value.trim() === '' || !Number.isFinite(raw)) {
    flashInvalid(`${props.def.label}：请输入有效数值`)
    draft.value = formatParamValue(props.value, props.def)
    return
  }
  const clamped = Math.min(def.max, Math.max(def.min, raw))
  if (clamped !== raw) {
    flashInvalid(`${props.def.label}：已限制到 ${clamped} ${props.def.unit ?? ''}`.trim())
  }
  draft.value = formatParamValue(clamped, props.def)
  if (clamped !== Number(props.value)) emit('update', clamped)
}

function onSlider(event: Event): void {
  const raw = Number((event.target as HTMLInputElement).value)
  if (!Number.isFinite(raw)) return
  emit('update', raw)
}

function onSegmented(optionValue: ParamValue): void {
  if (optionValue !== props.value) emit('update', optionValue)
}

function onSelect(event: Event): void {
  const raw = (event.target as HTMLSelectElement).value
  const def = props.def
  if (def.kind !== 'select') return
  // 保持原始类型：数字选项回传 number
  const match = def.options.find((o) => String(o.value) === raw)
  if (match && match.value !== props.value) emit('update', match.value)
}
</script>

<template>
  <div class="field">
    <div class="field__top">
      <label class="field__label" :for="`p-${def.key}`">
        {{ def.label }}
        <span class="field__label-en">{{ def.labelEn }}</span>
      </label>

      <!-- 数值输入 -->
      <div v-if="numericDef" class="field__control">
        <input
          :id="`p-${def.key}`"
          v-model="draft"
          class="input input--num"
          :class="{ 'input--invalid': invalid }"
          type="text"
          inputmode="decimal"
          @change="commitText"
          @keydown.enter.prevent="commitText"
          @blur="commitText"
        />
        <span v-if="def.unit" class="field__unit">{{ def.unit }}</span>
      </div>

      <!-- 下拉 -->
      <div v-else-if="def.kind === 'select'" class="field__control" style="min-width: 128px">
        <select :id="`p-${def.key}`" class="select" :value="String(value)" @change="onSelect">
          <option v-for="o in def.options" :key="String(o.value)" :value="String(o.value)">
            {{ o.label }}
          </option>
        </select>
      </div>
    </div>

    <!-- 滑杆 -->
    <input
      v-if="def.kind === 'range'"
      class="slider"
      type="range"
      :min="def.min"
      :max="def.max"
      :step="def.step"
      :value="sliderValue"
      :aria-label="def.label"
      @input="onSlider"
    />

    <!-- 分段控件 -->
    <div v-if="def.kind === 'segmented'" class="seg" role="group" :aria-label="def.label">
      <button
        v-for="o in def.options"
        :key="String(o.value)"
        class="seg__item"
        :class="{ 'seg__item--on': o.value === value }"
        :title="o.title"
        @click="onSegmented(o.value)"
      >
        {{ o.label }}
      </button>
    </div>

    <p v-if="def.hint" class="field__hint" :class="{ 'field__hint--warn': invalid }">
      {{ def.hint }}
    </p>
  </div>
</template>
