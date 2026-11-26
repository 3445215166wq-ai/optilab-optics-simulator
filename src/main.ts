import { createApp } from 'vue'
import App from './App.vue'
import './styles/tokens.css'
import './styles/base.css'
import './styles/components.css'
import { hydrateRecords } from './stores/experiments'
import { hydrateLog, pushLog } from './stores/log'
import { clearAll, storageUsageKb } from './stores/persistence'
import { initTheme } from './stores/theme'

initTheme()

// 先把上一次会话保存在本机的日志与实验记录恢复出来（数据从不离开本机）
const restoredLogs = hydrateLog()
const restoredRecords = hydrateRecords()

pushLog('info', '系统', 'OptiLab 启动：全部光学计算在浏览器本地完成，无后端与外部 API 依赖')
if (restoredLogs > 0 || restoredRecords > 0) {
  pushLog(
    'info',
    '系统',
    `已从本机恢复 ${restoredRecords} 条实验记录、${restoredLogs} 条日志（占用 ${storageUsageKb()} KB，可用「测试报告 → 导出 JSON」备份）`,
  )
}

// 供控制台/调试使用：一键清空本机数据
;(window as unknown as Record<string, unknown>).optilabClearLocalData = (): void => {
  clearAll()
  pushLog('warn', '系统', '已清空本机保存的日志与实验记录')
}

createApp(App).mount('#app')
