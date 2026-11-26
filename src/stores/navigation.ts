/**
 * 当前激活模块（轻量全局导航状态）。
 *
 * 只存一个 id 字符串，不依赖模块注册表 —— 这样才能让「知识库 → 打开相关实验模块」
 * 这类跨模块跳转成立，而不会造成 registry ↔ module 的循环依赖。
 */
import { ref } from 'vue'

export const DEFAULT_ACTIVE_MODULE = 'geo-optics'

const activeModuleId = ref<string>(DEFAULT_ACTIVE_MODULE)

export function useNavigation() {
  return {
    activeModuleId,
    setActiveModule(id: string): void {
      activeModuleId.value = id
    },
  }
}
