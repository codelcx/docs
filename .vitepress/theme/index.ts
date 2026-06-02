import DefaultTheme from 'vitepress/theme'
import type { EnhanceAppContext } from 'vitepress'
import HomeCards from './components/HomeCards.vue'
import PostList from './components/PostList.vue'
import HomeLanding from './components/HomeLanding.vue'
import './style.css'

export default {
  extends: DefaultTheme,
  enhanceApp({ app }: EnhanceAppContext) {
    app.component('HomeCards', HomeCards)
    app.component('PostList', PostList)
    app.component('HomeLanding', HomeLanding)
  },
}
