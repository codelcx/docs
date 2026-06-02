---
title: Nuxt 3 从入门到实践
date: 2026-05-22
category: frontend
sort: 998
description: Nuxt 3 核心特性、路由、数据获取与服务端渲染实战
---

# Nuxt 3 从入门到实践

Nuxt 3 是基于 Vue 3 的全栈元框架，内置文件路由、服务端渲染（SSR）、静态站点生成（SSG）、API 路由和自动导入等能力。通过 Nitro 服务引擎实现边缘部署，配合 `nuxi generate` 一键生成静态站点，适合构建从内容型网站到企业级全栈应用的各类项目。

## 一、项目创建与目录结构

### 1.1 创建项目

```bash
npx nuxi@latest init my-nuxt-app
cd my-nuxt-app
pnpm dev
```

### 1.2 最佳目录结构

Nuxt 3 约定优于配置，文件放入约定目录即自动生效。以下为推荐的中大型项目目录层级：

```
my-nuxt-app/
├── .nuxt/                  # 自动生成，开发时产物，勿手动修改
├── .output/                # 构建产物，部署时使用
├── assets/                 # 需编译的静态资源（SCSS、图片），通过 ~/assets/ 引用
│   ├── css/
│   │   └── main.css
│   └── images/
├── public/                 # 无需编译的静态资源，直接映射到根路径 /favicon.ico
│   └── favicon.ico
├── server/                 # Nitro 服务端，API 路由 + 数据库 + 中间件
│   ├── api/                # 文件即 API 端点 → /api/xxx
│   │   ├── posts.get.ts    # GET  /api/posts
│   │   ├── posts.post.ts   # POST /api/posts
│   │   └── posts/
│   │       └── [id].get.ts # GET  /api/posts/:id
│   ├── routes/             # 非 API 路由（webhook 回调、sitemap 等）
│   ├── middleware/         # 服务端中间件（日志、CORS、限流）
│   └── utils/              # 服务端工具函数（db 连接、加密）
├── pages/                  # 文件即路由，自动按目录层级生成 URL
│   ├── index.vue           # /
│   ├── about.vue           # /about
│   ├── blog/
│   │   ├── index.vue       # /blog
│   │   └── [id].vue        # /blog/:id
│   └── admin/
│       └── dashboard.vue   # /admin/dashboard
├── components/             # 自动导入，无需 import，按文件名使用 <FooBar />
│   ├── global/             # （任意子目录均自动导入）
│   │   └── AppHeader.vue
│   ├── common/
│   │   ├── BaseButton.vue
│   │   └── BaseModal.vue
│   └── business/
│       └── UserCard.vue
├── composables/            # 自动导入组合式函数，无需 export default
│   ├── useAuth.ts          # export const useAuth = () => {}
│   ├── useCart.ts          # export const useCart = () => {}
│   └── usePagination.ts
├── api/                    # 前端 API 请求层，按业务模块拆分
│   ├── auth/
│   │   └── index.ts        # 登录、注册、登出等认证相关 API
│   ├── posts/
│   │   ├── index.ts        # 文章列表、详情
│   │   └── comments.ts     # 评论相关 API（业务复杂时拆分为独立文件）
│   ├── users/
│   │   └── index.ts
│   ├── upload/
│   │   └── index.ts
│   ├── request.ts          # axios / $fetch 实例封装（拦截器、BaseURL、超时）
│   └── types.ts            # API 请求/响应的 TypeScript 类型定义
├── layouts/                # 页面布局，default.vue 为所有页面默认布局
│   ├── default.vue         # 全站默认布局（必须包含 <slot />）
│   ├── admin.vue           # definePageMeta({ layout: 'admin' })
│   └── auth.vue
├── middleware/              # 路由中间件
│   ├── auth.ts             # 命名中间件：页面通过 middleware: ['auth'] 引用
│   └── analytics.global.ts # 全局中间件：每次路由变化自动执行
├── plugins/                # Vue 应用插件，按字母顺序加载
│   ├── 01-api.ts           # 数字前缀控制加载顺序
│   ├── 02-auth.client.ts   # .client 后缀 → 仅客户端运行
│   └── 03-dayjs.ts
├── stores/                 # Pinia 状态管理（需安装 @pinia/nuxt）
│   └── user.ts
├── utils/                  # 纯工具函数（前端）
│   ├── format.ts
│   └── validate.ts
├── types/                  # TypeScript 类型定义
│   └── index.d.ts
├── app.vue                 # 应用根组件（可选，默认由 pages/ 驱动）
├── error.vue               # 全局错误页面
├── nuxt.config.ts          # Nuxt 核心配置
├── package.json
└── tsconfig.json
```

#### 自动导入约定一览

| 目录 | 自动导入 | 导入方式 |
|------|---------|---------|
| `components/` | 是 | `<FileName />` 直接使用，无需 import |
| `composables/` | 是 | `useXxx()` 直接调用 |
| `pages/` | — | 文件路由，无需手动注册 |
| `server/api/` | — | 文件即接口，按路径访问 |
| `layouts/` | — | `default.vue` 自动生效，其余按名引用 |
| `middleware/` | — | `xxx.global.ts` 自动执行，其余按名引用 |
| `plugins/` | — | 放文件即加载，无需 nuxt.config 注册 |


## 二、路由

### 2.1 基础路由

```
pages/
  index.vue          → /
  about.vue          → /about
  blog/
    index.vue        → /blog
    [id].vue         → /blog/:id
```

```vue
<!-- pages/blog/[id].vue -->
<template>
  <div>
    <h2>文章详情</h2>
    <p>文章 ID：{{ route.params.id }}</p>
  </div>
</template>

<script setup>
const route = useRoute()
</script>
```

### 2.2 导航

```vue
<template>
  <nav>
    <!-- 推荐：NuxtLink 支持预加载 -->
    <NuxtLink to="/">首页</NuxtLink>
    <NuxtLink :to="{ name: 'blog-id', params: { id: '123' } }">
      文章 123
    </NuxtLink>
    <NuxtLink to="/about" no-prefetch>关于</NuxtLink>
  </nav>
</template>
```

### 2.3 路由中间件

通过 `definePageMeta({ middleware: ['xxx'] })` 在页面中引用 `middleware/` 目录下的中间件。中间件在页面渲染前执行，用于权限校验、路由重定向等场景。详细用法见[中间件](#三中间件)章节。

## 三、中间件

路由中间件是导航守卫，在页面渲染前执行。Nuxt 会**自动加载** `middleware/` 目录下的所有文件，加载规则如下：

- **命名中间件**：`middleware/xxx.ts` — 需在页面中通过 `definePageMeta({ middleware: ['xxx'] })` 显式引用才生效
- **全局中间件**：`middleware/xxx.global.ts` — 无需引用，每次路由变化**自动执行**
- **执行顺序**：按文件名**字母顺序**依次执行，全局中间件先于命名中间件
- **适用场景**：权限校验、路由重定向、PV 埋点、页面标题设置

中间件可通过 `return navigateTo()` 阻止导航，或 `return abortNavigation()` 终止并显示错误。

### 3.1 命名中间件

```typescript
// middleware/auth.ts
export default defineNuxtRouteMiddleware((to) => {
  const token = useCookie('token')

  if (!token.value && to.path !== '/login') {
    return navigateTo('/login')
  }
})
```

```vue
<!-- 页面或布局中引用 -->
<script setup>
definePageMeta({
  middleware: ['auth']
})
</script>
```

### 3.2 全局中间件

文件名添加 `.global` 后缀，每次路由变化都会执行。

```typescript
// middleware/analytics.global.ts
export default defineNuxtRouteMiddleware((to, from) => {
  console.log('页面切换', from.path, '→', to.path)
  reportPageView(to.fullPath)
})
```

### 3.3 内联中间件

```vue
<script setup>
definePageMeta({
  middleware: [
    (to) => {
      if (to.params.id === '0') {
        return navigateTo('/')
      }
    },
    'auth'
  ]
})
</script>
```

### 3.4 角色权限守卫

```typescript
// middleware/role.ts
export default defineNuxtRouteMiddleware((to) => {
  const user = useUserStore()

  const roleGuard: Record<string, string[]> = {
    '/admin': ['admin'],
    '/editor': ['admin', 'editor']
  }

  const requiredRoles = roleGuard[to.path]
  if (requiredRoles && !requiredRoles.includes(user.role)) {
    return abortNavigation('权限不足')
  }
})
```

## 四、布局

布局是封装页面共享结构（页头、侧栏、页脚）的组件。Nuxt 会**自动加载** `layouts/` 目录下的所有 `.vue` 文件，加载规则如下：

- **默认布局**：`layouts/default.vue` — 所有未指定 `layout` 的页面**自动使用**此布局，无需任何配置
- **自定义布局**：`layouts/xxx.vue` — 在页面中通过 `definePageMeta({ layout: 'xxx' })` 按名称引用
- **禁用布局**：`definePageMeta({ layout: false })` — 该页面不使用任何布局
- **动态切换**：通过 `setPageLayout('xxx')` 在运行时切换布局
- **布局嵌套**：使用 `<NuxtLayout name="xxx">` 可嵌套多个布局

每个布局必须包含 `<slot />` 作为页面内容的渲染出口。

### 4.1 默认布局

```vue
<!-- layouts/default.vue -->
<template>
  <div class="app-layout">
    <AppHeader />
    <div class="main-content">
      <aside class="sidebar">
        <AppSidebar />
      </aside>
      <main class="page">
        <slot />
      </main>
    </div>
    <AppFooter />
  </div>
</template>

<style scoped>
.app-layout {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.main-content {
  display: flex;
  flex: 1;
}

.sidebar {
  width: 250px;
}

.page {
  flex: 1;
  padding: 20px;
}
</style>
```

### 4.2 自定义布局

```vue
<!-- layouts/admin.vue -->
<template>
  <div class="admin-layout">
    <AdminNav />
    <div class="admin-body">
      <slot />
    </div>
  </div>
</template>
```

```vue
<!-- pages/admin/dashboard.vue -->
<script setup>
definePageMeta({
  layout: 'admin'
})
</script>

<template>
  <div>
    <h1>后台仪表盘</h1>
  </div>
</template>
```

### 4.3 动态切换布局

```vue
<script setup>
const route = useRoute()

// 根据路由切换布局
if (route.path.startsWith('/admin')) {
  setPageLayout('admin')
}
</script>
```

### 4.4 具名插槽

```vue
<!-- layouts/default.vue -->
<template>
  <div>
    <header>
      <slot name="header">
        <DefaultHeader />
      </slot>
    </header>
    <div class="body">
      <slot />
    </div>
  </div>
</template>
```

```vue
<!-- pages/about.vue -->
<template>
  <NuxtLayout>
    <h2>关于我们</h2>

    <template #header>
      <h1>自定义标题</h1>
    </template>
  </NuxtLayout>
</template>
```

### 4.5 布局级守卫

```vue
<!-- layouts/auth.vue -->
<script setup>
const { isLoggedIn } = useAuth()

watchEffect(() => {
  if (isLoggedIn.value) {
    navigateTo('/')
  }
})
</script>

<template>
  <div class="auth-layout">
    <div class="auth-card">
      <slot />
    </div>
  </div>
</template>
```

## 五、插件

插件用于在 Vue 应用初始化时注册全局功能。Nuxt 会**自动扫描并加载** `plugins/` 目录下的所有文件，加载规则如下：

- **自动加载**：文件放入 `plugins/` 即生效，**无需**在 `nuxt.config.ts` 中手动注册
- **加载时机**：在 Vue 应用创建时、页面渲染之前执行，早于所有组件
- **加载顺序**：按文件名**字母顺序**依次加载，可通过文件名前缀（如 `01-xxx.ts`、`02-yyy.ts`）控制顺序
- **客户端专属**：`plugins/xxx.client.ts` — 仅在浏览器端运行，可访问 `window`、`document`
- **服务端专属**：`plugins/xxx.server.ts` — 仅服务端运行，可访问 `fs`、`process.env` 等 Node API
- **双向运行**：不加后缀的 `plugins/xxx.ts` 在服务端和客户端各执行一次

通过 `nuxtApp.provide(name, value)` 或 `return { provide: {} }` 向运行时上下文注入全局方法，组件中通过 `useNuxtApp().$xxx` 访问。

> **经验建议**：`plugins/` 中文件较多时，建议加数字前缀控制顺序，如 `01-api.ts`、`02-auth.ts`、`03-dayjs.ts`。

### 5.1 注册全局组件与指令

```typescript
// plugins/vue-components.ts
export default defineNuxtPlugin((nuxtApp) => {
  // 注册全局组件
  nuxtApp.vueApp.component('LazyLoad', defineAsyncComponent(
    () => import('~/components/LazyLoad.vue')
  ))

  // 注册全局指令
  nuxtApp.vueApp.directive('focus', {
    mounted(el) {
      el.focus()
    }
  })
})
```

### 5.2 nuxtApp.provide 注入全局方法

`nuxtApp` 是一个运行时上下文，可通过 `provide` 函数扩展它。注入的值和方法会在所有 composable 和组件中通过 `nuxtApp` 可用。

`provide` 函数接受 **name**（字符串）和 **value**（任意值）两个参数：

```typescript
// plugins/hello.ts
export default defineNuxtPlugin((nuxtApp) => {
  // 向 nuxtApp 上下文注入自定义方法
  nuxtApp.provide('hello', (name: string) => `Hello ${name}!`)
})
```

注入后，`$hello` 即成为 `nuxtApp` 上下文中新增加的自定义部分，在所有可访问 `nuxtApp` 的地方（组件、组合式函数、其他插件）都可用：

```typescript
// 组件或 composable 中
const nuxtApp = useNuxtApp()
console.log(nuxtApp.$hello('name')) // "Hello name!"
```

#### 简写形式

`defineNuxtPlugin` 支持通过 `return { provide: {} }` 一次性注册多个方法，效果等价于多次调用 `nuxtApp.provide(name, value)`：

```typescript
// plugins/api.ts
export default defineNuxtPlugin(() => {
  return {
    provide: {
      // key（如 api）会被自动加 $ 前缀 → nuxtApp.$api
      api: (url: string) => $fetch(`/api${url}`),
      formatDate: (date: Date) => new Intl.DateTimeFormat('zh-CN').format(date),
    }
  }
})
```

#### 在组合式函数中使用

**组合式函数（Composable）** 即 `composables/` 目录下的 `useXxx` 函数，用于封装可复用的逻辑。注入方法在其中与在组件中一样可用：

```typescript
// composables/usePosts.ts
export const usePosts = () => {
  const { $api, $formatDate } = useNuxtApp()

  const posts = ref([])
  const loading = ref(false)

  const fetchPosts = async () => {
    loading.value = true
    const { data } = await $api('/posts')
    posts.value = data
    loading.value = false
  }

  const formatTime = (date: Date) => $formatDate(date)

  return { posts, loading, fetchPosts, formatTime }
}
```

```typescript
// composables/useAuth.ts
export const useAuth = () => {
  const nuxtApp = useNuxtApp()

  const login = async (credentials: { email: string; password: string }) => {
    // 注入的方法挂在 nuxtApp 上
    const user = await nuxtApp.$api('/auth/login', {
      method: 'POST',
      body: credentials
    })
    return user
  }

  return { login }
}
```

#### 在组件中使用

```vue
<!-- 任意 .vue 组件 -->
<script setup>
const { $api, $formatDate } = useNuxtApp()

const { data } = await $api('/posts')
const today = $formatDate(new Date())
</script>

<template>
  <!-- 模板中可直接使用 $xxx，无需解构 -->
  <p>今天是 {{ $formatDate(new Date()) }}</p>
</template>
```

> **命名规则**：`provide` 的 key 名 → 自动加 `$` 前缀成为 `nuxtApp.$key`。`provide: { hello: fn }` 等价于 `nuxtApp.provide('hello', fn)`，使用时均为 `nuxtApp.$hello()`。`$` 前缀用于区分注入方法与组件自身的变量，避免命名冲突。

#### TypeScript 类型声明

```typescript
// types/plugins.d.ts
declare module '#app' {
  interface NuxtApp {
    $api: (url: string) => Promise<any>
    $formatDate: (date: Date) => string
  }
}

export {}
```

声明后在组件中访问 `$api` 即可获得完整的类型提示与自动补全。

### 5.3 服务端 / 客户端专属

```typescript
// plugins/analytics.client.ts  → 仅在客户端运行
export default defineNuxtPlugin(() => {
  window.gtag?.('config', 'GA-ID')
})

// plugins/db.server.ts  → 仅在服务端运行
export default defineNuxtPlugin(() => {
  const db = initDatabase(process.env.DATABASE_URL)
  return { provide: { db } }
})
```

### 5.4 第三方库集成

```typescript
// plugins/dayjs.ts
import dayjs from 'dayjs'
import 'dayjs/locale/zh-cn'

export default defineNuxtPlugin(() => {
  dayjs.locale('zh-cn')
  return {
    provide: {
      dayjs: (date?: dayjs.ConfigType) => dayjs(date)
    }
  }
})
```

## 六、数据获取

Nuxt 3 在服务端和客户端均可获取数据，核心是两个 composable：`useFetch` 和 `useAsyncData`。两者都会在服务端 SSR 阶段自动获取数据，并将结果序列化传递到客户端，避免重复请求。

| 特性 | useFetch | useAsyncData |
|------|----------|-------------|
| 底层 | 封装 `useAsyncData` + `$fetch` | 通用异步数据获取 |
| URL 支持 | 直接传 URL 字符串 | 需手动调用 `$fetch` 等方法 |
| 请求头代理 | 自动代理客户端 cookie / header 到服务端 | 需手动处理 |
| 使用场景 | 简单的 API 请求 | 多个请求聚合、复杂数据转换 |
| 响应拦截器 | 支持 `onRequest` / `onResponse` | 不支持，需在回调中自行处理 |

**返回值**（两者相同）：`{ data, pending, error, refresh, status }`

### 6.1 useFetch（推荐）

直接传入 API 路径，自动处理客户端到服务端的请求头代理，适合绝大多数数据获取场景。

#### 基本用法

```vue
<template>
  <div>
    <h2>文章列表</h2>
    <div v-if="status === 'pending'">加载中...</div>
    <div v-else-if="error">错误：{{ error.message }}</div>
    <ul v-else>
      <li v-for="post in data?.posts" :key="post.id">
        {{ post.title }}
      </li>
    </ul>
    <button @click="refresh()">刷新</button>
  </div>
</template>

<script setup>
// 立即执行（默认）- SSR 阶段在服务端获取
const { data, pending, error, refresh, status } = await useFetch('/api/posts')
</script>
```

#### 请求配置

```vue
<script setup>
const { data } = await useFetch('/api/posts/1', {
  // 查询参数
  query: { include: 'author', page: 1 },
  // 请求方法
  method: 'POST',
  // 请求体
  body: { title: '新文章' },
  // 自定义请求头
  headers: { Authorization: `Bearer ${token}` },
  // 基础 URL
  baseURL: 'https://api.example.com',
  // 结果类型转换（不影响服务端返回的原始类型）
  transform: (data) => data.posts,
  // 缓存 key - 相同 key 的多次调用复用结果
  key: 'post-detail',
})
</script>
```

#### 懒加载（lazy）- 手动触发

```vue
<template>
  <div>
    <input v-model="keyword" placeholder="输入关键词" />
    <button @click="execute()">搜索</button>
    <div v-if="pending">搜索中...</div>
    <ul v-else>
      <li v-for="item in data" :key="item.id">{{ item.name }}</li>
    </ul>
  </div>
</template>

<script setup>
const keyword = ref('')

const { data, pending, execute, refresh } = await useFetch('/api/search', {
  lazy: true,          // 不立即执行
  immediate: false,    // 等同效果
  query: computed(() => ({ q: keyword.value })),
  // 监听依赖变化自动重新请求
  watch: [keyword]
})
</script>
```

#### 请求 / 响应拦截器

```vue
<script setup>
const { data } = await useFetch('/api/posts', {
  // 请求发出前
  onRequest({ request, options }) {
    options.headers.set('x-client', 'nuxt')
  },
  // 请求出错
  onRequestError({ request, options, error }) {
    console.error('请求失败', error)
  },
  // 响应到达时
  onResponse({ response }) {
    console.log('状态码', response.status)
  },
  // 响应出错
  onResponseError({ response }) {
    if (response.status === 401) {
      navigateTo('/login')
    }
  }
})
</script>
```

#### 刷新策略

```vue
<script setup>
const { data, refresh } = await useFetch('/api/posts')

// 手动刷新（重新请求数据）
const handleRefresh = () => refresh()

// 监听数据变化自动刷新
watch(selectedCategory, () => {
  refresh()
})
</script>
```

### 6.2 useAsyncData

适用于需要聚合多个请求、对返回数据做复杂转换，或使用 `$fetch` 之外的其他请求库的场景。

#### 基本用法

```vue
<script setup>
// 第一个参数为唯一 key（必填），用于去重和缓存
const { data: stats, pending, error, refresh } = await useAsyncData(
  'dashboard-stats',
  async () => {
    const [users, orders, revenue] = await Promise.all([
      $fetch('/api/users/count'),
      $fetch('/api/orders/count'),
      $fetch('/api/revenue')
    ])

    // 多数据源聚合 + 转换
    return {
      users,
      orders,
      revenue,
      avgOrderValue: orders > 0 ? revenue / orders : 0
    }
  }
)
</script>
```

#### 配置选项

```vue
<script setup>
const { data } = await useAsyncData('cached-data',
  () => $fetch('/api/slow-query'),
  {
    // server: true  → 服务端执行，数据随 HTML 下发（默认）
    // server: false → 跳过服务端，仅客户端执行
    server: true,

    // lazy: true   → 不阻塞页面渲染，异步获取
    // lazy: false  → 阻塞导航，等数据返回再渲染（默认）
    lazy: false,

    // 缓存有效期（秒），默认 0 不缓存
    default: () => [],

    // 数据转换
    transform: (data) => data.list,

    // 立即执行
    immediate: true,

    // 监听依赖自动刷新
    watch: [page, category],

    // 去重 key：同 key 的多处调用共享同一份请求
    key: 'global-data',
  }
)
</script>
```

#### useAsyncData vs useFetch 选择建议

```
需要请求单个 API 接口？
 ├── 是 → useFetch（简洁，自动代理 header/cookie）
 └── 否 ↓
需要聚合多个请求、或复杂数据转换？
 ├── 是 → useAsyncData（灵活组合）
 └── 否 ↓
需要请求拦截器（onRequest/onResponse）？
 ├── 是 → useFetch
 └── 否 → 两者皆可
```

### 6.3 $fetch 服务端 API

```typescript
// server/api/posts.get.ts
export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const page = Number(query.page) || 1

  const posts = [
    { id: 1, title: 'Nuxt 3 入门指南' },
    { id: 2, title: 'Vue 3 响应式原理' },
    { id: 3, title: 'TypeScript 高级类型' }
  ]

  return {
    posts: posts.slice((page - 1) * 10, page * 10),
    total: posts.length,
    page
  }
})
```

```typescript
// server/api/posts/[id].get.ts
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const post = await db.post.findUnique({ where: { id: Number(id) } })

  if (!post) {
    throw createError({
      status: 404,
      message: '文章不存在'
    })
  }

  return post
})
```

## 七、状态管理

### 7.1 useState（内置）

```typescript
// composables/useCart.ts
export const useCart = () => {
  return useState('cart', () => ({
    items: [],
    total: 0
  }))
}
```

```vue
<!-- 组件中使用 -->
<template>
  <div>
    <p>购物车数量：{{ cart.items.length }}</p>
    <p>总价：¥{{ cart.total }}</p>
    <button @click="addItem">添加商品</button>
  </div>
</template>

<script setup>
const cart = useCart()

const addItem = () => {
  cart.value.items.push({ id: 1, name: '商品', price: 99 })
  cart.value.total += 99
}
</script>
```

### 7.2 Pinia 集成

```bash
pnpm add pinia @pinia/nuxt
```

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  modules: ['@pinia/nuxt']
})
```

```typescript
// stores/user.ts
import { defineStore } from 'pinia'

export const useUserStore = defineStore('user', () => {
  const user = ref(null)
  const isLoggedIn = computed(() => !!user.value)

  async function login(credentials: { email: string; password: string }) {
    const res = await $fetch('/api/auth/login', {
      method: 'POST',
      body: credentials
    })
    user.value = res.user
  }

  function logout() {
    user.value = null
    navigateTo('/login')
  }

  return { user, isLoggedIn, login, logout }
})
```

## 八、SEO 与 Meta

Nuxt 3 提供了完善的 SEO 能力：`useSeoMeta` 类型安全的 Meta 定义、`useHead` 完整 Head 控制，以及 `@nuxtjs/sitemap` 等模块自动生成 sitemap.xml 和 robots.txt。

### 8.1 useSeoMeta（推荐）

类型安全的 SEO Meta 定义，自动区分 `name` 和 `property`，防止手写错误，支持 100+ 属性。

```vue
<script setup>
useSeoMeta({
  // 基础 SEO
  title: 'Nuxt 3 从入门到实践',
  description: 'Nuxt 3 核心特性与实战教程，涵盖路由、数据获取、状态管理、SSR/SSG 等',
  ogTitle: 'Nuxt 3 从入门到实践',
  ogDescription: 'Nuxt 3 核心特性与实战教程',
  ogImage: 'https://example.com/og-image.png',
  ogType: 'website',
  ogUrl: 'https://example.com/nuxt',
  // Twitter Card
  twitterTitle: 'Nuxt 3 从入门到实践',
  twitterDescription: 'Nuxt 3 核心特性与实战教程',
  twitterCard: 'summary_large_image',
  twitterImage: 'https://example.com/og-image.png',
  // 搜索引擎索引
  robots: 'index, follow',
})
</script>
```

### 8.2 useHead（完整 Head 控制）

适合需要控制非 SEO 标签（link、script、htmlAttrs、bodyAttrs）的场景。

```vue
<script setup>
useHead({
  // titleTemplate：%s 会被子页面 title 替换
  titleTemplate: '%s - 技术文档博客',
  title: '首页',
  // meta
  meta: [
    { name: 'description', content: '技术文档博客' },
    { property: 'og:title', content: '首页 - 技术文档博客' },
    // 禁止百度转码
    { 'http-equiv': 'Cache-Control', content: 'no-siteapp' },
  ],
  // link
  link: [
    { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },
    { rel: 'canonical', href: 'https://example.com' },
    { rel: 'alternate', hreflang: 'en', href: 'https://example.com/en' },
  ],
  // script（支持 async / defer / type: module）
  script: [
    { src: 'https://www.googletagmanager.com/gtag/js', async: true },
    { innerHTML: `window.dataLayer = window.dataLayer || []; function gtag(){dataLayer.push(arguments);}` },
  ],
  // html / body 属性
  htmlAttrs: { lang: 'zh-CN' },
  bodyAttrs: { class: 'home-page' },
})
</script>
```

### 8.3 动态 SEO（文章详情页）

```vue
<script setup>
const route = useRoute()
const { data: post } = await useFetch(`/api/posts/${route.params.id}`)

// 响应式 SEO：数据返回后自动更新
useSeoMeta({
  title: () => post.value?.title || '文章详情',
  ogTitle: () => post.value?.title,
  description: () => post.value?.excerpt || '',
  ogDescription: () => post.value?.excerpt,
  ogImage: () => post.value?.coverImage || '/default-og.png',
  ogType: 'article',
  // 文章发布时间
  articlePublishedTime: () => post.value?.createdAt,
  articleModifiedTime: () => post.value?.updatedAt,
})

// 仅服务端渲染的 meta（搜索引擎爬虫可见）
if (import.meta.server) {
  useSeoMeta({
    robots: 'index, follow',
  })
}
</script>
```

### 8.4 Sitemap 自动生成

安装 `@nuxtjs/sitemap` 模块，自动为所有页面生成 sitemap.xml。

```bash
pnpm add @nuxtjs/sitemap
```

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  modules: ['@nuxtjs/sitemap'],

  sitemap: {
    // 站点基础 URL（必填）
    siteUrl: 'https://example.com',
    // 自动发现 pages/ 和 server/ 路由
    autoLastmod: true,
    // 默认优先级
    defaults: {
      changefreq: 'weekly',
      priority: 0.7,
    },
    // 排除路径
    exclude: [
      '/admin/**',
      '/login',
    ],
  }
})
```

### 8.5 动态 URL 加入 Sitemap

通过服务端 API 将数据库中的文章、产品等动态 URL 注入 sitemap：

```typescript
// server/api/__sitemap__/urls.ts
import { defineSitemapEventHandler } from '#imports'
import type { SitemapUrl } from '#sitemap/types'

export default defineSitemapEventHandler(async () => {
  const posts = await db.post.findMany({
    select: { slug: true, updatedAt: true }
  })

  return posts.map((post) => ({
    loc: `/blog/${post.slug}`,
    lastmod: post.updatedAt,
    changefreq: 'weekly',
    priority: 0.8,
  } satisfies SitemapUrl))
})
```

### 8.6 多 Sitemap（按内容类型拆分）

大型站点可按内容类型拆分为多个 sitemap，自动生成 sitemap 索引：

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  sitemap: {
    sitemaps: {
      posts: {
        includeAppSources: true,
        include: ['/blog/**'],
        defaults: { priority: 0.8, changefreq: 'daily' },
      },
      products: {
        sources: ['/api/__sitemap__/urls/products'],
        chunks: 5000, // 每文件最多 5000 条 URL
      },
      pages: {
        includeAppSources: true,
        exclude: ['/blog/**', '/admin/**'],
      },
    }
  }
})
```

### 8.7 Robots.txt

配合 sitemap 模块自动生成，也可手动配置：

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  nitro: {
    prerender: {
      crawlLinks: true,
      routes: ['/sitemap.xml', '/robots.txt'],
    },
  },
  // robots.txt 规则（需 @nuxtjs/robots 或 server route 实现）
})
```

通过 Nitro 服务端路由手动实现 robots.txt：

```typescript
// server/routes/robots.txt.ts
export default defineEventHandler(() => {
  return `User-agent: *
Allow: /
Disallow: /admin/
Sitemap: https://example.com/sitemap.xml
`
})
```

### 8.8 JSON-LD 结构化数据

```vue
<script setup>
useHead({
  script: [
    {
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: post.value?.title,
        description: post.value?.excerpt,
        datePublished: post.value?.createdAt,
        dateModified: post.value?.updatedAt,
        author: {
          '@type': 'Person',
          name: '作者名',
        },
      }),
    },
  ],
})
</script>
```

### 8.9 全局 SEO 默认值

在 `app.vue` 或 `layouts/default.vue` 中设置全局默认值，子页面通过 `title` 覆盖：

```vue
<!-- app.vue -->
<script setup>
useHead({
  titleTemplate: (title) => {
    return title ? `${title} - 技术文档博客` : '技术文档博客'
  }
})

useSeoMeta({
  ogSiteName: '技术文档博客',
  ogLocale: 'zh_CN',
  twitterSite: '@yourtwitter',
  robots: 'index, follow',
})
</script>
```

## 九、渲染模式

Nuxt 3 支持 SSR、SSG、CSR、ISR 四种渲染模式。

### 9.1 SSR（服务端渲染，默认）

每次请求在服务端生成 HTML，适合内容频繁变动的页面。

```vue
<!-- pages/ssr.vue - 默认即为 SSR -->
<template>
  <div>
    <h2>实时数据</h2>
    <p>当前时间：{{ new Date().toLocaleString() }}</p>
  </div>
</template>

<script setup>
const { data } = await useFetch('/api/latest')
</script>
```

### 9.2 SSG（静态站点生成）

构建时预渲染所有页面为静态 HTML。

#### nuxt.config.ts 预渲染配置

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  nitro: {
    prerender: {
      routes: ['/', '/about', '/blog'],
      crawlLinks: true
    }
  }
})
```

#### 动态路由预渲染

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  nitro: {
    prerender: {
      routes: async () => {
        const posts = await $fetch('/api/posts')
        return posts.map((post: any) => `/blog/${post.id}`)
      },
      crawlLinks: true
    }
  }
})
```

#### 页面级预渲染钩子

```vue
<!-- pages/blog/[id].vue -->
<script setup>
const route = useRoute()

const { data: post } = await useAsyncData(
  `post-${route.params.id}`,
  () => $fetch(`/api/posts/${route.params.id}`)
)
</script>

<template>
  <article>
    <h1>{{ post?.title }}</h1>
    <div v-html="post?.content"></div>
  </article>
</template>
```

#### 生成静态站点

```bash
npx nuxi generate  # 输出到 .output/public/
npx nuxi preview   # 本地预览
```

### 9.3 CSR Only（仅客户端渲染）

```vue
<!-- pages/admin.vue -->
<script setup>
definePageMeta({ ssr: false })
</script>
```

### 9.4 ISR（增量静态再生）

```vue
<script setup>
const { data } = await useAsyncData('cached-page', () => {
  return $fetch('/api/data')
}, {
  swr: true,
  staleTTL: 3600
})
</script>
```

### 9.5 混合渲染

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  ssr: true,

  routeRules: {
    '/': { prerender: true },
    '/products': { swr: 3600 },
    '/products/**': { swr: 3600 },
    '/blog': { isr: 3600 },
    '/blog/**': { isr: true },
    '/admin/**': { ssr: false },
    '/api/**': { cors: true },
    '/old-page': { redirect: '/new-page' }
  },

  nitro: {
    prerender: {
      crawlLinks: true,
      routes: ['/', '/about']
    }
  }
})
```

## 十、错误处理

### 10.1 全局错误页面

项目根目录放置 `error.vue`。

```vue
<!-- error.vue -->
<template>
  <div class="error-page">
    <div class="error-content">
      <h1>{{ error.status }}</h1>
      <p class="error-message">{{ error.message }}</p>
      <p v-if="error.status === 404" class="error-tip">页面不存在或已被删除</p>
      <div class="error-actions">
        <button @click="handleClearError">返回首页</button>
        <button v-if="error.status !== 404" @click="handleReload">刷新重试</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import type { NuxtError } from '#app'

const props = defineProps<{
  error: NuxtError
}>()

useHead({
  title: `${props.error.status} - ${props.error.message}`
})

const handleClearError = () => clearError({ redirect: '/' })

const handleReload = () => {
  clearError()
  navigateTo(window.location.href, { replace: true })
}
</script>
```

### 10.2 服务端抛出错误

```typescript
// server/api/posts/[id].get.ts
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')

  if (!id || !/^\d+$/.test(id)) {
    throw createError({
      status: 400,
      statusText: '参数错误',
      message: '文章 ID 必须为数字'
    })
  }

  const session = await getUserSession(event)
  if (!session?.user) {
    throw createError({
      status: 401,
      message: '请先登录'
    })
  }

  const post = await db.post.findUnique({ where: { id: Number(id) } })

  if (!post) {
    throw createError({
      status: 404,
      message: '文章不存在'
    })
  }

  return post
})
```

### 10.3 NuxtErrorBoundary 错误边界

```vue
<template>
  <div>
    <h2>仪表盘</h2>

    <NuxtErrorBoundary>
      <DashboardChart />

      <template #error="{ error, clearError }">
        <div class="widget-error">
          <p>图表加载失败：{{ error.message }}</p>
          <button @click="clearError">重试</button>
        </div>
      </template>
    </NuxtErrorBoundary>

    <FooterInfo />
  </div>
</template>
```

### 10.4 客户端错误处理

```vue
<script setup>
const route = useRoute()
const globalError = useError()

const { data, error, refresh } = await useFetch(`/api/posts/${route.params.id}`)

if (error.value) {
  if (error.value.statusCode === 404) {
    throw createError({
      status: 404,
      message: '文章不存在',
      fatal: true
    })
  }
  console.error('数据加载失败', error.value)
}
</script>
```

### 10.5 插件全局拦截

```typescript
// plugins/error-handler.ts
export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.hook('vue:error', (err, instance, info) => {
    console.error('[Vue Error]', err, info)
  })

  nuxtApp.hook('app:error', (error) => {
    console.error('[Nuxt Error]', error)
  })
})
```

### 10.6 onErrorCaptured 组件级捕获

```vue
<script setup>
onErrorCaptured((err, instance, info) => {
  console.error('子组件错误', err.message, info)
  return false
})
</script>
```

### 10.7 API 请求错误封装

```typescript
// composables/useApi.ts
export function useApi<T>(url: string, options?: any) {
  const toast = useToast()

  const { data, pending, error, refresh } = useFetch<T>(url, {
    ...options,
    onResponseError({ response }) {
      switch (response.status) {
        case 401:
          toast.error('登录已过期，请重新登录')
          navigateTo('/login')
          break
        case 403:
          toast.error('没有访问权限')
          break
        case 500:
          toast.error('服务器异常，请稍后重试')
          break
        default:
          toast.error(response._data?.message || '请求失败')
      }
    }
  })

  return { data, pending, error, refresh }
}
```

## 十一、nuxt.config.ts 核心配置

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  compatibilityDate: '2026-05-01',

  runtimeConfig: {
    apiSecret: process.env.API_SECRET,
    public: {
      apiBase: process.env.API_BASE || 'http://localhost:3000'
    }
  },

  css: ['~/assets/css/main.css'],

  modules: [
    '@pinia/nuxt',
    '@nuxt/image',
    '@vueuse/nuxt'
  ],

  typescript: {
    strict: true,
    shim: false
  },

  devtools: { enabled: true },

  routeRules: {
    '/': { prerender: true },
    '/blog/**': { isr: true },
    '/admin/**': { ssr: false },
    '/api/**': { cors: true }
  },

  nitro: {
    compressPublicAssets: true,
    prerender: {
      crawlLinks: true,
      routes: ['/', '/about']
    }
  },

  vite: {
    css: {
      preprocessorOptions: {
        scss: {
          additionalData: '@use "~/assets/scss/_variables.scss" as *;'
        }
      }
    }
  }
})
```
