---
title: Vue 3 从入门到实践
date: 2026-05-18
category: frontend
sort: 999
---



# Vue 3 从入门到实践

Vue 3 是由尤雨溪团队开发的渐进式 JavaScript 框架，用于构建用户界面。其核心特性包括 Composition API（组合式 API）、`<script setup>` 语法糖、TypeScript 原生支持和基于 Proxy 的高效响应式系统。Vue 3 以易上手、高性能和灵活的生态著称，适合从单页应用到企业级中后台的各类场景。

## 一、响应式数据与双向绑定

### 1.1 ref 和 reactive

Vue3 使用 ref 和 reactive 创建响应式数据：

```vue
<template>
  <div>
    <!-- ref 需要 .value 访问，模板中自动解包 -->
    <p>年龄：{{ age }}</p>
    <input type="text" v-model="name" />
    <p>姓名：{{ name }}</p>
    <button @click="increaseAge">增加一岁</button>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'

// ref：用于基本类型，也支持对象
const age = ref(25)
const name = ref('张三')

// reactive：仅用于对象/数组
const user = reactive({
  name: '李四',
  hobbies: ['读书', '跑步']
})

const increaseAge = () => {
  age.value++  // ref 必须 .value
  user.hobbies.push('编程')
}
</script>
```

### 1.2 v-model 双向绑定

```vue
<template>
  <!-- 基本用法 -->
  <input v-model="message" />
  <p>输入的内容：{{ message }}</p>

  <!-- 修饰符：.trim .number .lazy -->
  <input v-model.trim="message" />
  <input v-model.number="age" type="number" />
  
  <!-- 多行文本 -->
  <textarea v-model="description"></textarea>

  <!-- 复选框 -->
  <input type="checkbox" v-model="isAgree" /> 同意协议

  <!-- 单选 -->
  <input type="radio" value="男" v-model="gender" /> 男
  <input type="radio" value="女" v-model="gender" /> 女

  <!-- 下拉框 -->
  <select v-model="selectedCity">
    <option value="北京">北京</option>
    <option value="上海">上海</option>
  </select>
</template>

<script setup>
import { ref } from 'vue'

const message = ref('')
const age = ref(18)
const description = ref('')
const isAgree = ref(false)
const gender = ref('男')
const selectedCity = ref('北京')
</script>
```

### 1.3 defineModel（3.4+ 推荐）

Vue 3.4 引入 `defineModel` 宏，替代手写 props + emits 模式，一行声明即实现父子双向绑定。

#### 基本用法

```vue
<!-- 子组件 MyInput.vue -->
<template>
  <input v-model="modelValue" />
</template>

<script setup>
// 一行代替 defineProps + defineEmits
const modelValue = defineModel()
</script>
```

```vue
<!-- 父组件 -->
<template>
  <MyInput v-model="username" />
</template>

<script setup>
import { ref } from 'vue'
import MyInput from './MyInput.vue'

const username = ref('')
</script>
```

#### 多个 v-model + 类型与默认值

```vue
<!-- 子组件 -->
<script setup>
// v-model:firstName + v-model:lastName
const firstName = defineModel('firstName', { type: String, default: '' })
const lastName = defineModel('lastName', { type: String, default: '' })

// 在子组件中直接读写，自动 emit 更新
const reset = () => {
  firstName.value = ''
  lastName.value = ''
}
</script>

<template>
  <input v-model="firstName" placeholder="名" />
  <input v-model="lastName" placeholder="姓" />
  <button @click="reset">重置</button>
</template>
```

#### v-model 修饰符 + 自定义转换器

```vue
<!-- 子组件 -->
<script setup>
const [text, textModifiers] = defineModel('text', {
  set(value) {
    // 根据修饰符转换值
    if (textModifiers.capitalize) {
      return value.charAt(0).toUpperCase() + value.slice(1)
    }
    if (textModifiers.trim) {
      return value.trim()
    }
    return value
  }
})
</script>

<template>
  <input v-model="text" placeholder="带修饰符" />
</template>
```

```vue
<!-- 父组件 -->
<template>
  <!-- 修饰符通过 v-model:name.modifier 传递 -->
  <ChildComponent v-model:text.capitalize.trim="description" />
</template>
```

#### defineModel vs 传统写法对比

| 方式 | 代码量 | 支持修饰符 | 版本要求 |
|------|--------|-----------|---------|
| `defineModel()` | 1 行 | 是（内置） | Vue 3.4+ |
| `defineProps` + `defineEmits` | 3~5 行 | 需手动处理 | Vue 3.0+ |

## 二、组件通信

### 2.1 props / emits（父子通信）

```vue
<!-- 子组件 Child.vue -->
<template>
  <div>
    <h3>{{ title }}</h3>
    <p>计数：{{ count }}</p>
    <button @click="increment">增加</button>
    <button @click="sendToParent">发送给父组件</button>
  </div>
</template>

<script setup>
// 定义 props
const props = defineProps({
  title: {
    type: String,
    required: true,
    default: '默认标题'
  },
  count: {
    type: Number,
    default: 0
  }
})

// 定义 emits
const emit = defineEmits(['update', 'childEvent'])

const increment = () => {
  emit('update', props.count + 1)
}

const sendToParent = () => {
  emit('childEvent', '来自子组件的消息')
}
</script>
```

```vue
<!-- 父组件 Parent.vue -->
<template>
  <Child 
    title="计数器" 
    :count="parentCount"
    @update="handleUpdate"
    @childEvent="handleMessage"
  />
</template>

<script setup>
import { ref } from 'vue'
import Child from './Child.vue'

const parentCount = ref(0)

const handleUpdate = (newCount) => {
  parentCount.value = newCount
}

const handleMessage = (msg) => {
  console.log(msg)
}
</script>
```

### 2.2 provide / inject（跨层级通信）

```vue
<!-- 祖先组件 Ancestor.vue -->
<template>
  <div>
    <h2>祖先组件</h2>
    <button @click="changeTheme">切换主题</button>
    <Parent />
  </div>
</template>

<script setup>
import { ref, provide, readonly } from 'vue'
import Parent from './Parent.vue'

// 提供数据
const theme = ref('light')
const userInfo = reactive({
  name: '王小明',
  role: 'admin'
})

// 提供方法
const changeTheme = () => {
  theme.value = theme.value === 'light' ? 'dark' : 'light'
}

// provide 可以传递响应式数据
provide('theme', readonly(theme))  // 使用 readonly 防止被子组件修改
provide('user', userInfo)
provide('changeTheme', changeTheme)
</script>
```

```vue
<!-- 后代组件 GrandChild.vue -->
<template>
  <div :class="theme">
    <p>用户名：{{ user.name }}</p>
    <p>角色：{{ user.role }}</p>
    <button @click="changeTheme">改变主题</button>
  </div>
</template>

<script setup>
import { inject } from 'vue'

// 注入数据，可以设置默认值
const theme = inject('theme', 'light')
const user = inject('user')
const changeTheme = inject('changeTheme')
</script>
```

### 2.3 pinia 状态管理（跨组件通信）

```javascript
// stores/counter.js
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useCounterStore = defineStore('counter', () => {
  // state（用 ref）
  const count = ref(0)
  const user = ref(null)

  // getters（用 computed）
  const doubleCount = computed(() => count.value * 2)
  const formattedCount = computed(() => `当前计数：${count.value}`)

  // actions（普通函数）
  function increment() {
    count.value++
  }

  async function fetchUser(id) {
    const res = await fetch(`/api/user/${id}`)
    user.value = await res.json()
  }

  // 返回需要暴露的内容
  return {
    count,
    user,
    doubleCount,
    formattedCount,
    increment,
    fetchUser
  }
})
```

```vue
<!-- 任意组件中使用 -->
<template>
  <div>
    <p>计数：{{ store.count }}</p>
    <p>双倍：{{ store.doubleCount }}</p>
    <button @click="store.increment()">增加</button>
  </div>
</template>

<script setup>
import { useCounterStore } from '@/stores/counter'

const store = useCounterStore()

// 也可以解构，但需要 storeToRefs 保持响应性
import { storeToRefs } from 'pinia'
const { count, doubleCount } = storeToRefs(store)
const { increment } = store  // actions 可以直接解构
</script>
```

### 2.4 slot 插槽

#### 默认插槽

```vue
<!-- 子组件 SlotCard.vue -->
<template>
  <div class="card">
    <div class="card-header">
      <slot name="header">默认标题</slot>
    </div>
    <div class="card-body">
      <!-- 默认插槽：不写 name 即为默认 -->
      <slot>默认内容</slot>
    </div>
    <div class="card-footer">
      <slot name="footer">
        <button>确定</button>
      </slot>
    </div>
  </div>
</template>
```

```vue
<!-- 父组件 -->
<template>
  <SlotCard>
    <!-- 具名插槽 -->
    <template #header>
      <h2>用户信息</h2>
    </template>

    <!-- 默认插槽内容 -->
    <p>姓名：张三</p>
    <p>年龄：25</p>

    <!-- 具名插槽 -->
    <template #footer>
      <button @click="save">保存</button>
      <button @click="cancel">取消</button>
    </template>
  </SlotCard>
</template>
```

#### 作用域插槽

```vue
<!-- 子组件 List.vue -->
<template>
  <ul>
    <li v-for="item in items" :key="item.id">
      <!-- 通过 slot 向父组件暴露数据 -->
      <slot name="item" :item="item" :index="index">
        {{ item.name }}
      </slot>
    </li>
  </ul>
</template>

<script setup>
const props = defineProps({
  items: {
    type: Array,
    required: true
  }
})
</script>
```

```vue
<!-- 父组件 -->
<template>
  <List :items="users">
    <template #item="{ item, index }">
      <div class="user-item">
        <span class="index">{{ index + 1 }}.</span>
        <span>{{ item.name }}</span>
        <span class="role">{{ item.role }}</span>
        <button @click="editUser(item)">编辑</button>
      </div>
    </template>
  </List>
</template>

<script setup>
import { ref } from 'vue'
import List from './List.vue'

const users = ref([
  { id: 1, name: '张三', role: '管理员' },
  { id: 2, name: '李四', role: '普通用户' }
])

const editUser = (user) => {
  console.log('编辑用户', user)
}
</script>
```

#### 动态插槽

```vue
<template>
  <DataTable :columns="columns" :data="tableData">
    <!-- 动态渲染列 -->
    <template v-for="col in columns" :key="col.key" #[`cell-${col.key}`]="{ row }">
      <span v-if="col.type === 'date'">{{ formatDate(row[col.key]) }}</span>
      <span v-else-if="col.type === 'status'">
        <span :class="row[col.key]">{{ statusMap[row[col.key]] }}</span>
      </span>
      <span v-else>{{ row[col.key] }}</span>
    </template>
  </DataTable>
</template>

<script setup>
const columns = [
  { key: 'name', title: '名称' },
  { key: 'createdAt', title: '创建时间', type: 'date' },
  { key: 'status', title: '状态', type: 'status' }
]

const formatDate = (date) => {
  return new Date(date).toLocaleDateString()
}

const statusMap = { active: '启用', inactive: '禁用' }
</script>
```

## 三、计算属性

### 3.1 基本用法

```vue
<template>
  <div>
    <input v-model="firstName" placeholder="名" />
    <input v-model="lastName" placeholder="姓" />
    
    <!-- 计算属性会自动更新 -->
    <p>全名：{{ fullName }}</p>
    <p>姓名长度：{{ fullNameLength }}</p>
    
    <!-- 购物车示例 -->
    <div v-for="item in cart" :key="item.id">
      {{ item.name }} - ¥{{ item.price }} x {{ item.quantity }}
    </div>
    <p>总价：¥{{ totalPrice }}</p>
    <p>商品数量：{{ totalQuantity }}</p>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

const firstName = ref('张')
const lastName = ref('三')

// 只读计算属性
const fullName = computed(() => {
  return firstName.value + lastName.value
})

const fullNameLength = computed(() => fullName.value.length)

// 购物车数据
const cart = ref([
  { id: 1, name: '苹果', price: 5, quantity: 2 },
  { id: 2, name: '香蕉', price: 3, quantity: 3 }
])

const totalPrice = computed(() => {
  return cart.value.reduce((sum, item) => sum + item.price * item.quantity, 0)
})

const totalQuantity = computed(() => {
  return cart.value.reduce((sum, item) => sum + item.quantity, 0)
})
</script>
```

### 3.2 可写计算属性

```vue
<template>
  <div>
    <input v-model="fullName" placeholder="全名" />
    <p>名：{{ firstName }}</p>
    <p>姓：{{ lastName }}</p>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

const firstName = ref('张')
const lastName = ref('三')

// 可写计算属性
const fullName = computed({
  // getter
  get() {
    return firstName.value + lastName.value
  },
  // setter
  set(newValue) {
    // 简单解析逻辑
    if (newValue.length > 0) {
      firstName.value = newValue[0]
      lastName.value = newValue.slice(1)
    }
  }
})
</script>
```

### 3.3 computed 对比 methods

```vue
<template>
  <div>
    <!-- computed 会缓存结果 -->
    <p>计算属性：{{ expensiveComputed }}</p>
    <p>方法调用：{{ expensiveMethod() }}</p>
    
    <!-- 每次重新渲染都会重新执行 -->
    <button @click="count++">点击：{{ count }}</button>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

const count = ref(0)

// 计算属性：只有依赖变化时才重新计算
const expensiveComputed = computed(() => {
  console.log('computed 执行')
  return count.value * 2
})

// 方法：每次调用都会执行
const expensiveMethod = () => {
  console.log('method 执行')
  return count.value * 2
}
</script>
```

## 四、生命周期与侦听器

### 4.1 生命周期钩子

```vue
<template>
  <div>{{ message }}</div>
</template>

<script setup>
import { ref, onMounted, onUpdated, onUnmounted, onBeforeMount, onBeforeUpdate, onBeforeUnmount } from 'vue'

const message = ref('Hello')

// 组件挂载前
onBeforeMount(() => {
  console.log('组件即将挂载')
})

// 组件挂载后（常用：API 请求、DOM 操作）
onMounted(() => {
  console.log('组件已挂载')
  // 发起 API 请求
  fetchData()
})

// 数据更新前
onBeforeUpdate(() => {
  console.log('组件即将更新')
})

// 数据更新后
onUpdated(() => {
  console.log('组件已更新')
})

// 组件卸载前（常用：清理定时器、取消订阅）
onBeforeUnmount(() => {
  console.log('组件即将卸载')
  // 清理工作
  clearInterval(timer)
})

// 组件卸载后
onUnmounted(() => {
  console.log('组件已卸载')
})

const fetchData = async () => {
  // 模拟 API 请求
  const res = await fetch('https://api.example.com/data')
  // 处理数据...
}
</script>
```

### 4.2 侦听器 watch / watchEffect

```vue
<template>
  <div>
    <input v-model="keyword" placeholder="搜索关键词" />
    <input v-model="user.name" placeholder="用户名" />
    <button @click="user.age++">年龄 +1 ({{ user.age }})</button>
  </div>
</template>

<script setup>
import { ref, reactive, watch, watchEffect } from 'vue'

const keyword = ref('')
const user = reactive({
  name: '张三',
  age: 25
})

// 1. 监听单个 ref
watch(keyword, (newVal, oldVal) => {
  console.log(`关键词从 ${oldVal} 变为 ${newVal}`)
  // 防抖搜索
  debounceSearch(newVal)
})

// 2. 监听 reactive 属性（需要 getter 函数）
watch(() => user.name, (newName, oldName) => {
  console.log(`用户名改变：${oldName} -> ${newName}`)
})

// 3. 监听多个源
watch([keyword, () => user.age], ([newKeyword, newAge], [oldKeyword, oldAge]) => {
  console.log('关键词或年龄发生了变化')
})

// 4. 深度监听
watch(user, (newVal) => {
  console.log('user 对象内部变化', newVal)
}, { deep: true, immediate: true })  // immediate: 立即执行一次

// 5. watchEffect：自动收集依赖，立即执行
watchEffect(() => {
  // 这里用到的响应式数据变化时都会重新执行
  console.log(`搜索：${keyword.value}，用户：${user.name}`)
})

// 停止监听
const stopWatch = watch(keyword, () => {})
// 适时调用 stopWatch()

const debounceSearch = (val) => {
  // 实现防抖搜索逻辑
}
</script>
```

## 五、模板引用（ref）

通过 `ref` 属性获取 DOM 元素或子组件实例。

### 5.1 DOM 元素引用

```vue
<template>
  <input ref="inputRef" type="text" placeholder="输入内容" />
  <button @click="focusInput">聚焦输入框</button>
</template>

<script setup>
import { ref, onMounted } from 'vue'

// 变量名必须与模板 ref 属性值相同
const inputRef = ref(null)

const focusInput = () => {
  inputRef.value?.focus()  // 可选链操作符
}

onMounted(() => {
  // 确保 DOM 已渲染后访问
  console.log(inputRef.value)
})
</script>
```

### 5.2 组件引用

通过 ref 获取子组件实例，配合 `defineExpose` 调用子组件暴露的方法。

```vue
<template>
  <ChildComponent ref="childRef" />
  <button @click="callChildMethod">调用子组件方法</button>
  <p>子组件计数：{{ childRef?.count }}</p>
</template>

<script setup>
import { ref } from 'vue'
import ChildComponent from './ChildComponent.vue'

const childRef = ref(null)

const callChildMethod = () => {
  childRef.value?.someMethod()
  childRef.value?.increment()
}
</script>
```

### 5.3 v-for 中的引用

列表渲染中使用函数绑定获取多个元素。

```vue
<template>
  <div
    v-for="item in list"
    :key="item.id"
    :ref="(el) => setItemRef(el, item.id)"
  >
    {{ item.name }}
  </div>
</template>

<script setup>
import { ref } from 'vue'

const list = ref([
  { id: 1, name: '项目一' },
  { id: 2, name: '项目二' },
])

// 以对象存储多个引用，key 为 item.id
const itemRefs = ref({})

const setItemRef = (el, id) => {
  if (el) {
    itemRefs.value[id] = el
  }
}

const scrollToItem = (id) => {
  itemRefs.value[id]?.scrollIntoView({ behavior: 'smooth' })
}
</script>
```

### 5.4 useTemplateRef（3.5+ 推荐）

Vue 3.5 引入 `useTemplateRef`，提供类型安全的模板引用，替代手动 `ref(null)` + `ref="xxx"` 的隐式匹配。

```vue
<script setup>
import { useTemplateRef, onMounted } from 'vue'

// 通过字符串 key 匹配模板 ref，自动推断类型
const inputRef = useTemplateRef('input')
const childRef = useTemplateRef('child')

onMounted(() => {
  inputRef.value?.focus()
  childRef.value?.someMethod()
})
</script>

<template>
  <input ref="input" type="text" placeholder="输入内容" />
  <ChildComponent ref="child" />
</template>
```

```vue
<!-- TypeScript：显式指定 DOM 元素类型 -->
<script setup lang="ts">
const el = useTemplateRef<HTMLInputElement>('el')
</script>
```

| 方式 | 类型安全 | 版本 |
|------|---------|------|
| `ref(null)` + 同名变量 | 需手动声明类型 | 3.0+ |
| `useTemplateRef('key')` | 自动推断 | 3.5+ |

## 六、组合式 API 最佳实践

```vue
<template>
  <div>
    <h2>{{ title }}</h2>
    <input v-model="searchTerm" placeholder="搜索..." />
    <ul>
      <li v-for="item in filteredList" :key="item.id">
        {{ item.name }}
      </li>
    </ul>
    <p v-if="loading">加载中...</p>
    <p v-else-if="error">错误：{{ error }}</p>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'

// 将相关逻辑封装成组合式函数
function useSearch(list, searchKey = 'name') {
  const searchTerm = ref('')
  
  const filteredList = computed(() => {
    if (!searchTerm.value) return list.value
    return list.value.filter(item =>
      item[searchKey].toLowerCase().includes(searchTerm.value.toLowerCase())
    )
  })
  
  return { searchTerm, filteredList }
}

function useFetch(url) {
  const data = ref(null)
  const loading = ref(false)
  const error = ref(null)
  
  const fetchData = async () => {
    loading.value = true
    error.value = null
    
    try {
      const response = await fetch(url)
      if (!response.ok) throw new Error('请求失败')
      data.value = await response.json()
    } catch (err) {
      error.value = err.message
    } finally {
      loading.value = false
    }
  }
  
  onMounted(fetchData)
  
  return { data, loading, error, refetch: fetchData }
}

// 使用组合式函数
const { data: items, loading, error } = useFetch('/api/items')
const { searchTerm, filteredList } = useSearch(items)

const title = ref('商品列表')
</script>
```

## 七、编译宏（3.3+ 新特性）

Vue 3.3+ 引入多个 `<script setup>` 编译宏，减少样板代码。

### 7.1 defineOptions 声明组件选项

无需额外 `<script>` 块即可声明 `inheritAttrs`、`name` 等选项。

```vue
<script setup>
defineOptions({
  name: 'CustomButton',
  inheritAttrs: false,
})
</script>

<template>
  <button v-bind="$attrs">
    <slot />
  </button>
</template>
```

### 7.2 defineSlots 类型化插槽

为插槽提供 TypeScript 类型检查。

```vue
<script setup lang="ts">
const slots = defineSlots<{
  default(props: { msg: string }): any
  header(props: { title: string }): any
}>()
</script>

<template>
  <header>
    <slot name="header" title="页面标题" />
  </header>
  <main>
    <slot msg="Hello" />
  </main>
</template>
```

父组件使用时会获得完整的类型提示：

```vue
<!-- 父组件 -->
<template>
  <MyLayout>
    <template #header="{ title }">
      <!-- title 自动推断为 string -->
      <h1>{{ title }}</h1>
    </template>

    <template #default="{ msg }">
      <!-- msg 自动推断为 string -->
      <p>{{ msg }}</p>
    </template>
  </MyLayout>
</template>
```

### 7.3 defineExpose 暴露组件方法

`<script setup>` 组件默认封闭，需 `defineExpose` 显式暴露属性和方法给父组件访问。

```vue
<script setup>
import { ref } from 'vue'

const count = ref(0)
const inputRef = ref(null)

const focus = () => inputRef.value?.focus()
const reset = () => { count.value = 0 }
const increment = () => { count.value++ }

// 仅暴露方法，不暴露内部状态
defineExpose({
  focus,
  reset,
  increment,
  count, // 也可暴露响应式数据
})
</script>

<template>
  <input ref="inputRef" />
  <span>计数：{{ count }}</span>
</template>
```

```vue
<!-- 父组件通过 ref 调用子组件暴露的方法 -->
<script setup>
import { ref } from 'vue'
import ChildComp from './ChildComp.vue'

const child = ref()

const callChild = () => {
  child.value.focus()
  child.value.increment()
  console.log(child.value.count)
}
</script>

<template>
  <ChildComp ref="child" />
  <button @click="callChild">调用子组件方法</button>
</template>
```

### 7.4 编译宏版本速查

| 宏 | 引入版本 | 作用 |
|----|---------|------|
| `defineProps` | 3.0 | 声明 props |
| `defineEmits` | 3.0 | 声明 emits |
| `defineExpose` | 3.0 | 暴露组件公开接口 |
| `defineOptions` | 3.3 | 声明组件选项（name、inheritAttrs） |
| `defineSlots` | 3.3 | 插槽类型声明 |
| `defineModel` | 3.4 | 双向绑定简化 |
| `useTemplateRef` | 3.5 | 类型安全的模板引用 |
