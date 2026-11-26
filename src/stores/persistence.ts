/**
 * 本地持久化（localStorage）。
 *
 * 设计原则：
 *   1. **数据只落在用户自己的浏览器里**，不上传任何服务器 —— 这对工业图片尤其重要
 *      （被测件照片、图纸不会离开本机）；
 *   2. 所有读写都做异常包裹：隐私模式/配额满/停用存储时不能让界面崩掉，只是静默降级为不持久化；
 *   3. 带版本前缀，将来结构变化时可以安全弃用旧数据。
 */

const PREFIX = 'optilab.v1.'

function key(k: string): string {
  return PREFIX + k
}

/** 读取并解析 JSON；失败或不存在时返回 fallback */
export function loadJson<T>(k: string, fallback: T, validate?: (value: unknown) => boolean): T {
  try {
    const raw = localStorage.getItem(key(k))
    if (!raw) return fallback
    const parsed: unknown = JSON.parse(raw)
    if (validate && !validate(parsed)) {
      console.warn(`[OptiLab] 本地数据 ${k} 结构不匹配，已忽略`)
      return fallback
    }
    return parsed as T
  } catch (error) {
    console.warn(`[OptiLab] 读取本地数据 ${k} 失败：`, error)
    return fallback
  }
}

/** 写入 JSON；返回是否成功（配额满/被禁用时返回 false） */
export function saveJson(k: string, value: unknown): boolean {
  try {
    localStorage.setItem(key(k), JSON.stringify(value))
    return true
  } catch (error) {
    console.warn(`[OptiLab] 写入本地数据 ${k} 失败：`, error)
    return false
  }
}

export function removeKey(k: string): void {
  try {
    localStorage.removeItem(key(k))
  } catch {
    // 忽略
  }
}

/** 当前 OptiLab 占用的本地存储估算（KB） */
export function storageUsageKb(): number {
  try {
    let bytes = 0
    for (let i = 0; i < localStorage.length; i += 1) {
      const k = localStorage.key(i)
      if (!k || !k.startsWith(PREFIX)) continue
      bytes += k.length + (localStorage.getItem(k)?.length ?? 0)
    }
    return Math.round((bytes / 1024) * 10) / 10
  } catch {
    return 0
  }
}

/** 清空 OptiLab 自己的本地数据（不动其它站点数据） */
export function clearAll(): void {
  try {
    const keys: string[] = []
    for (let i = 0; i < localStorage.length; i += 1) {
      const k = localStorage.key(i)
      if (k && k.startsWith(PREFIX)) keys.push(k)
    }
    keys.forEach((k) => localStorage.removeItem(k))
  } catch {
    // 忽略
  }
}
