import { createApp } from 'vue'
import App from './App.vue'
import './styles/tokens.css'
import './styles/base.css'
import './styles/components.css'
import { pushLog } from './stores/log'
import { initTheme } from './stores/theme'

initTheme()
pushLog('info', '系统', 'OptiLab 启动：全部光学计算在浏览器本地完成，无后端与外部 API 依赖')

createApp(App).mount('#app')
