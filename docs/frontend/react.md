---
title: React 18 从入门到实践
date: 2026-05-19
category: frontend
sort: 997
---


# React 18 从入门到实践

React 是由 Meta（Facebook）开源的声明式 UI 库，以组件化、虚拟 DOM 和 Hooks 编程模型为核心。React 18 引入并发渲染机制（Concurrent Features），支持自动批处理、Suspense 数据获取、useTransition 等特性，在保证交互流畅的同时提升复杂应用的性能和用户体验。

## 一、响应式数据与双向绑定

### 1.1 useState 基础
React 使用 useState 创建状态，通过 setter 函数更新：

```jsx
import { useState } from 'react'

function App() {
  // 基本用法
  const [age, setAge] = useState(25)
  const [name, setName] = useState('张三')
  
  // 对象状态
  const [user, setUser] = useState({
    name: '李四',
    hobbies: ['读书', '跑步']
  })
  
  const increaseAge = () => {
    setAge(age + 1)  // 直接使用新值
  }
  
  const addHobby = () => {
    setUser({
      ...user,  // 必须展开原有属性
      hobbies: [...user.hobbies, '编程']
    })
  }
  
  return (
    <div>
      <p>年龄：{age}</p>
      <input 
        type="text" 
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <p>姓名：{name}</p>
      <button onClick={increaseAge}>增加一岁</button>
    </div>
  )
}
```

### 1.2 useReducer（复杂状态逻辑）

当状态逻辑包含多个子值、或下一个状态依赖前一个状态时，`useReducer` 比 `useState` 更清晰——将所有状态更新逻辑集中到 reducer 函数中。

```jsx
import { useReducer } from 'react'

// 定义 action 类型和 reducer
function todoReducer(state, action) {
  switch (action.type) {
    case 'add':
      return [...state, { id: Date.now(), text: action.text, done: false }]
    case 'toggle':
      return state.map(todo =>
        todo.id === action.id ? { ...todo, done: !todo.done } : todo
      )
    case 'remove':
      return state.filter(todo => todo.id !== action.id)
    default:
      return state
  }
}

function TodoApp() {
  const [todos, dispatch] = useReducer(todoReducer, [])

  return (
    <div>
      <button onClick={() => dispatch({ type: 'add', text: '新任务' })}>
        添加
      </button>
      {todos.map(todo => (
        <div key={todo.id}>
          <span style={{ textDecoration: todo.done ? 'line-through' : 'none' }}>
            {todo.text}
          </span>
          <button onClick={() => dispatch({ type: 'toggle', id: todo.id })}>
            切换
          </button>
          <button onClick={() => dispatch({ type: 'remove', id: todo.id })}>
            删除
          </button>
        </div>
      ))}
    </div>
  )
}
```

#### 配合 immer 简化不可变更新

`immer` 允许以**可变写法**更新状态，自动生成不可变副本，告别手动 `...spread`：

```bash
pnpm add immer use-immer
```

```jsx
import { useImmerReducer } from 'use-immer'

function todoReducer(draft, action) {
  switch (action.type) {
    case 'add':
      draft.push({ id: Date.now(), text: action.text, done: false })
      break
    case 'toggle': {
      const todo = draft.find(t => t.id === action.id)
      if (todo) todo.done = !todo.done     // 直接赋值，无需展开
      break
    }
    case 'remove':
      return draft.filter(todo => todo.id !== action.id)
  }
}

function TodoApp() {
  const [todos, dispatch] = useImmerReducer(todoReducer, [])
  // dispatch 用法完全相同
}
```

| 方式 | 适用场景 |
|------|---------|
| `useState` | 简单值、独立状态 |
| `useReducer` | 多关联状态、复杂更新逻辑、需要 dispatch 传递给子组件 |
| `useImmerReducer` | 深层嵌套对象的不可变更新 |

### 1.3 表单双向绑定
```jsx
import { useState } from 'react'

function FormDemo() {
  const [form, setForm] = useState({
    message: '',
    age: 18,
    description: '',
    isAgree: false,
    gender: '男',
    selectedCity: '北京'
  })
  
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }))
  }
  
  return (
    <div>
      {/* 文本输入 */}
      <input 
        name="message"
        value={form.message}
        onChange={handleChange}
        placeholder="输入内容"
      />
      
      {/* 数字输入 */}
      <input 
        name="age"
        type="number"
        value={form.age}
        onChange={handleChange}
      />
      
      {/* 多行文本 */}
      <textarea 
        name="description"
        value={form.description}
        onChange={handleChange}
      />
      
      {/* 复选框 */}
      <input 
        type="checkbox"
        name="isAgree"
        checked={form.isAgree}
        onChange={handleChange}
      /> 同意协议
      
      {/* 单选框 */}
      <label>
        <input 
          type="radio" 
          name="gender" 
          value="男"
          checked={form.gender === '男'}
          onChange={handleChange}
        /> 男
      </label>
      
      {/* 下拉框 */}
      <select 
        name="selectedCity"
        value={form.selectedCity}
        onChange={handleChange}
      >
        <option value="北京">北京</option>
        <option value="上海">上海</option>
      </select>
      
      <p>输入的内容：{form.message}</p>
    </div>
  )
}
```

### 1.4 自定义受控组件
```jsx
// 子组件 MyInput.jsx
function MyInput({ value, onChange, placeholder }) {
  return (
    <input 
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
    />
  )
}

// 父组件
function Parent() {
  const [username, setUsername] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  
  return (
    <div>
      <MyInput 
        value={username}
        onChange={setUsername}
        placeholder="用户名"
      />
      
      {/* 多个字段 */}
      <MyInput value={firstName} onChange={setFirstName} />
      <MyInput value={lastName} onChange={setLastName} />
    </div>
  )
}
```

## 二、组件通信
### 2.1 props 父子通信
```jsx
// 子组件 Child.jsx
function Child({ title, count, onUpdate, onChildEvent }) {
  const increment = () => {
    onUpdate(count + 1)
  }
  
  const sendToParent = () => {
    onChildEvent('来自子组件的消息')
  }
  
  return (
    <div>
      <h3>{title}</h3>
      <p>计数：{count}</p>
      <button onClick={increment}>增加</button>
      <button onClick={sendToParent}>发送给父组件</button>
    </div>
  )
}

// 设置默认值
Child.defaultProps = {
  title: '默认标题',
  count: 0
}

// 父组件
function Parent() {
  const [parentCount, setParentCount] = useState(0)
  
  const handleUpdate = (newCount) => {
    setParentCount(newCount)
  }
  
  const handleMessage = (msg) => {
    console.log(msg)
  }
  
  return (
    <Child 
      title="计数器"
      count={parentCount}
      onUpdate={handleUpdate}
      onChildEvent={handleMessage}
    />
  )
}
```

### 2.2 Context 跨层级通信
```jsx
import { createContext, useContext, useState } from 'react'

// 创建 Context
const ThemeContext = createContext()
const UserContext = createContext()

// 祖先组件
function Ancestor() {
  const [theme, setTheme] = useState('light')
  const [user, setUser] = useState({
    name: '王小明',
    role: 'admin'
  })
  
  const changeTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light')
  }
  
  return (
    // 提供数据
    <ThemeContext.Provider value={{ theme, changeTheme }}>
      <UserContext.Provider value={user}>
        <div>
          <h2>祖先组件</h2>
          <button onClick={changeTheme}>切换主题</button>
          <Parent />
        </div>
      </UserContext.Provider>
    </ThemeContext.Provider>
  )
}

// 中间组件
function Parent() {
  return <GrandChild />
}

// 后代组件
function GrandChild() {
  // 使用 Context
  const { theme, changeTheme } = useContext(ThemeContext)
  const user = useContext(UserContext)
  
  return (
    <div className={theme}>
      <p>用户名：{user.name}</p>
      <p>角色：{user.role}</p>
      <p>当前主题：{theme}</p>
      <button onClick={changeTheme}>改变主题</button>
    </div>
  )
}
```

### 2.3 Zustand 状态管理
```jsx
// store/counterStore.js
import { create } from 'zustand'

const useCounterStore = create((set, get) => ({
  count: 0,
  user: null,
  
  // 计算属性（通过 getter 实现）
  get doubleCount() {
    return get().count * 2
  },
  
  // Actions
  increment: () => set((state) => ({ count: state.count + 1 })),
  decrement: () => set((state) => ({ count: state.count - 1 })),
  
  fetchUser: async (id) => {
    const res = await fetch(`/api/user/${id}`)
    const user = await res.json()
    set({ user })
  }
}))

// 任意组件中使用
function CounterComponent() {
  const { count, doubleCount, increment, decrement } = useCounterStore()
  
  return (
    <div>
      <p>计数：{count}</p>
      <p>双倍：{doubleCount}</p>
      <button onClick={increment}>增加</button>
      <button onClick={decrement}>减少</button>
    </div>
  )
}
```

### 2.4 props.children 与 render props

#### props.children（类似默认插槽）

```jsx
// 子组件 Card.jsx
function Card({ children, header, footer }) {
  return (
    <div className="card">
      <div className="card-header">
        {header || <h3>默认标题</h3>}
      </div>
      <div className="card-body">
        {children || <p>默认内容</p>}
      </div>
      <div className="card-footer">
        {footer || <button>确定</button>}
      </div>
    </div>
  )
}

// 父组件
function Parent() {
  return (
    <Card
      header={<h2>用户信息</h2>}
      footer={
        <>
          <button onClick={save}>保存</button>
          <button onClick={cancel}>取消</button>
        </>
      }
    >
      <p>姓名：张三</p>
      <p>年龄：25</p>
    </Card>
  )
}
```

#### render props（类似作用域插槽）

```jsx
// 子组件 List.jsx
function List({ items, renderItem }) {
  return (
    <ul>
      {items.map((item, index) => (
        <li key={item.id}>
          {renderItem ? renderItem(item, index) : item.name}
        </li>
      ))}
    </ul>
  )
}

// 父组件
function UserList() {
  const [users, setUsers] = useState([
    { id: 1, name: '张三', role: '管理员' },
    { id: 2, name: '李四', role: '普通用户' }
  ])

  const editUser = (user) => {
    console.log('编辑用户', user)
  }

  return (
    <List
      items={users}
      renderItem={(item, index) => (
        <div className="user-item">
          <span className="index">{index + 1}.</span>
          <span>{item.name}</span>
          <span className="role">{item.role}</span>
          <button onClick={() => editUser(item)}>编辑</button>
        </div>
      )}
    />
  )
}
```

#### 动态列渲染

```jsx
function DataTable({ columns, data, renderCell }) {
  return (
    <table>
      <thead>
        <tr>
          {columns.map(col => (
            <th key={col.key}>{col.title}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.map((row, i) => (
          <tr key={i}>
            {columns.map(col => (
              <td key={col.key}>
                {renderCell
                  ? renderCell(col.key, row, col)
                  : row[col.key]
                }
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function TableDemo() {
  const columns = [
    { key: 'name', title: '名称' },
    { key: 'createdAt', title: '创建时间', type: 'date' },
    { key: 'status', title: '状态', type: 'status' }
  ]

  const statusMap = { active: '启用', inactive: '禁用' }

  const renderCell = (key, row, col) => {
    switch (col.type) {
      case 'date':
        return new Date(row[key]).toLocaleDateString()
      case 'status':
        return (
          <span className={row[key]}>
            {statusMap[row[key]]}
          </span>
        )
      default:
        return row[key]
    }
  }

  return (
    <DataTable columns={columns} data={tableData} renderCell={renderCell} />
  )
}
```

## 三、组件进阶

### 3.1 受控组件 vs 非受控组件

**受控组件**：表单值由 React state 管理，唯一数据源。**非受控组件**：表单值由 DOM 自身维护，通过 ref 按需读取。

```jsx
// 受控组件：value + onChange 接管表单
function ControlledInput() {
  const [value, setValue] = useState('')
  return <input value={value} onChange={e => setValue(e.target.value)} />
}

// 非受控组件：defaultValue 初始值，ref 读取当前值
function UncontrolledInput() {
  const ref = useRef(null)
  const handleSubmit = () => console.log(ref.current.value)
  return (
    <>
      <input defaultValue="默认值" ref={ref} />
      <button onClick={handleSubmit}>提交</button>
    </>
  )
}
```

| 方式 | 数据源 | 实时校验 | 适用场景 |
|------|--------|---------|---------|
| 受控 | React state | 容易 | 需要实时反馈、动态表单 |
| 非受控 | DOM | 需手动 | 简单表单、文件上传、与第三方 DOM 库集成 |

### 3.2 传送门（createPortal）

将子组件渲染到 DOM 树中父组件以外的位置，常用于弹窗、下拉菜单、Tooltip——视觉上在某个容器内，但 DOM 上挂载到 `document.body` 末端，避免 `overflow: hidden` 裁剪和 `z-index` 层级问题。

```jsx
import { createPortal } from 'react-dom'

function Modal({ children, onClose }) {
  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        {children}
        <button onClick={onClose}>关闭</button>
      </div>
    </div>,
    document.body   // 渲染到 body 末尾，脱离当前组件层级
  )
}

function App() {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ overflow: 'hidden', height: 200 }}>
      <button onClick={() => setOpen(true)}>打开弹窗</button>
      {open && <Modal onClose={() => setOpen(false)}>
        <h2>弹窗内容</h2>
        <p>不会被父级 overflow 裁剪</p>
      </Modal>}
    </div>
  )
}
```

### 3.3 异步组件（lazy + Suspense）

`React.lazy` 实现组件级别的代码分割，仅在首次渲染时才加载对应 JS 文件。必须包裹在 `Suspense` 中，加载期间显示 fallback。

```jsx
import { lazy, Suspense } from 'react'

// 组件在用到时才动态 import
const Dashboard = lazy(() => import('./Dashboard'))
const Settings = lazy(() => import('./Settings'))

function App() {
  const [tab, setTab] = useState('dashboard')

  return (
    <div>
      <button onClick={() => setTab('dashboard')}>仪表盘</button>
      <button onClick={() => setTab('settings')}>设置</button>

      <Suspense fallback={<div>加载中...</div>}>
        {tab === 'dashboard' ? <Dashboard /> : <Settings />}
      </Suspense>
    </div>
  )
}
```

```jsx
// 多个异步组件共用 Suspense，或嵌套独立 Suspense
<Suspense fallback={<Skeleton />}>
  <AsyncPanelA />
  <Suspense fallback={<Spinner />}>
    <AsyncPanelB />   {/* 独立加载，不影响 PanelA */}
  </Suspense>
</Suspense>
```

### 3.4 高阶组件（HOC）

高阶组件是一个**函数**，接收一个组件，返回一个新组件——用于抽取多个组件共有的逻辑（权限校验、日志埋点、数据注入）。

```jsx
// 高阶组件：为任意组件注入 loading 状态
function withLoading(WrappedComponent) {
  return function Enhanced(props) {
    const [loading, setLoading] = useState(false)

    const wrappedProps = {
      ...props,
      loading,
      setLoading,
    }

    return (
      <div>
        {loading && <div className="spinner">加载中...</div>}
        <WrappedComponent {...wrappedProps} />
      </div>
    )
  }
}

// 使用 HOC 包装普通组件
function Profile({ user, loading, setLoading }) {
  useEffect(() => {
    setLoading(true)
    fetchUser().finally(() => setLoading(false))
  }, [])

  return <div>{user?.name}</div>
}

const ProfileWithLoading = withLoading(Profile)
```

```jsx
// 权限校验 HOC
function withAuth(WrappedComponent) {
  return function Authenticated(props) {
    const { isLoggedIn, user } = useAuth()

    if (!isLoggedIn) {
      return <Navigate to="/login" replace />
    }

    return <WrappedComponent {...props} user={user} />
  }
}

const Dashboard = withAuth(function Dashboard({ user }) {
  return <h1>欢迎回来，{user.name}</h1>
})
```

> HOC 在 Hooks 出现前是复用逻辑的主要方式；如今 Hooks（`useAuth`、`useFetch`）可替代多数 HOC 场景，但修改渲染结果（如条件渲染 `<Navigate>`）仍是 HOC 的优势。

## 四、计算属性
### 4.1 useMemo 基础用法
```jsx
import { useState, useMemo } from 'react'

function ShoppingCart() {
  const [firstName, setFirstName] = useState('张')
  const [lastName, setLastName] = useState('三')
  const [cart, setCart] = useState([
    { id: 1, name: '苹果', price: 5, quantity: 2 },
    { id: 2, name: '香蕉', price: 3, quantity: 3 }
  ])
  
  // useMemo 缓存计算结果
  const fullName = useMemo(() => {
    return firstName + lastName
  }, [firstName, lastName])
  
  const fullNameLength = useMemo(() => {
    return fullName.length
  }, [fullName])
  
  const totalPrice = useMemo(() => {
    console.log('计算总价')
    return cart.reduce((sum, item) => sum + item.price * item.quantity, 0)
  }, [cart])
  
  const totalQuantity = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.quantity, 0)
  }, [cart])
  
  const addToCart = () => {
    setCart([...cart, { id: Date.now(), name: '橙子', price: 4, quantity: 1 }])
  }
  
  return (
    <div>
      <input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
      <input value={lastName} onChange={(e) => setLastName(e.target.value)} />
      <p>全名：{fullName}</p>
      <p>姓名长度：{fullNameLength}</p>
      
      <h3>购物车</h3>
      {cart.map(item => (
        <div key={item.id}>
          {item.name} - ¥{item.price} x {item.quantity}
        </div>
      ))}
      <p>总价：¥{totalPrice}</p>
      <p>商品数量：{totalQuantity}</p>
      <button onClick={addToCart}>添加商品</button>
    </div>
  )
}
```

### 4.2 useMemo vs 普通计算
```jsx
function CompareDemo() {
  const [count, setCount] = useState(0)
  const [other, setOther] = useState(0)
  
  // useMemo：只有依赖变化才重新计算
  const expensiveMemo = useMemo(() => {
    console.log('useMemo 执行')
    return count * 2
  }, [count])
  
  // 普通计算：每次渲染都执行
  const expensiveNormal = (() => {
    console.log('普通计算执行')
    return count * 2
  })()
  
  return (
    <div>
      <p>useMemo 结果：{expensiveMemo}</p>
      <p>普通计算结果：{expensiveNormal}</p>
      <button onClick={() => setCount(count + 1)}>增加 count</button>
      <button onClick={() => setOther(other + 1)}>增加其他状态</button>
    </div>
  )
}
```

## 五、生命周期与副作用

React 组件从创建到销毁经历三个阶段：**挂载**（首次渲染→插入 DOM）、**更新**（state/props 变化→重新渲染）、**卸载**（从 DOM 中移除）。函数组件没有类似 Vue 的 `onMounted` 声明式生命周期钩子，而是通过 Hooks 在不同时机执行逻辑。

### 5.1 生命周期对照（Vue → React）

| Vue 3 | React 函数组件 | 说明 |
|-------|---------------|------|
| `setup()` / `onCreated` | 组件函数体顶层代码 | 组件初始化时执行一次，此时 DOM 尚未生成 |
| `onBeforeMount` | 无直接对应 | 渲染前执行，React 中极少需要 |
| `onMounted` | `useEffect(() => {}, [])` | DOM 插入后异步执行 |
| `onBeforeUpdate` | 无直接对应 | — |
| `onUpdated` | `useEffect(() => {})` | 每次渲染后异步执行 |
| `onBeforeUnmount` | `useEffect(() => { return cleanup }, [])` | 组件移除前执行清理 |
| `onUnmounted` | `useEffect(() => { return cleanup }, [])` | 同上 |
| — | `useLayoutEffect` | 浏览器绘制前**同步**执行（Vue 无对应） |

下面是常见场景的 Vue ↔ React 对照：

```jsx
// Vue 写法                              // React 写法
onMounted(() => {                          useEffect(() => {
  fetchData()                                fetchData()
})                                         }, [])

onUnmounted(() => {                        useEffect(() => {
  clearInterval(timer)                       return () => clearInterval(timer)
})                                         }, [])

const state = ref(0)                       const [state, setState] = useState(0)
watch(state, (val) => {                    useEffect(() => {
  console.log(val)                           console.log(state)
})                                         }, [state])
```

### 5.2 useEffect 基础
```jsx
import { useState, useEffect } from 'react'

function LifecycleDemo() {
  const [count, setCount] = useState(0)
  const [data, setData] = useState(null)
  
  // 1. 组件挂载后执行（相当于 componentDidMount）
  useEffect(() => {
    console.log('组件已挂载')
    fetchData()
    
    // 清理函数（相当于 componentWillUnmount）
    return () => {
      console.log('组件即将卸载')
      clearInterval(timer)
    }
  }, []) // 空依赖数组，只执行一次
  
  // 2. 依赖变化时执行（相当于 componentDidUpdate）
  useEffect(() => {
    console.log(`count 改变为：${count}`)
    document.title = `点击了 ${count} 次`
  }, [count]) // 依赖 count
  
  // 3. 每次渲染都执行（谨慎使用）
  useEffect(() => {
    console.log('每次渲染都会执行')
  })
  
  // 4. 数据获取示例
  const fetchData = async () => {
    try {
      const response = await fetch('https://api.example.com/data')
      const result = await response.json()
      setData(result)
    } catch (error) {
      console.error('请求失败', error)
    }
  }
  
  return (
    <div>
      <p>计数：{count}</p>
      <button onClick={() => setCount(count + 1)}>增加</button>
      {data && <pre>{JSON.stringify(data, null, 2)}</pre>}
    </div>
  )
}
```

### 5.3 useEffect 高级用法
```jsx
import { useState, useEffect, useRef } from 'react'

function AdvancedEffect() {
  const [keyword, setKeyword] = useState('')
  const [user, setUser] = useState({ name: '张三', age: 25 })
  const [searchResults, setSearchResults] = useState([])
  
  // 1. 防抖搜索
  useEffect(() => {
    const timer = setTimeout(() => {
      if (keyword) {
        console.log(`搜索：${keyword}`)
        // 执行搜索
        performSearch(keyword)
      }
    }, 500)
    
    return () => clearTimeout(timer)
  }, [keyword])
  
  // 2. 监听对象属性变化（需要深度比较）
  useEffect(() => {
    console.log(`用户名改变：${user.name}`)
  }, [user.name]) // 只依赖对象的某个属性
  
  // 3. 使用 useRef 避免重新执行
  const isFirstRender = useRef(true)
  
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      console.log('首次渲染')
    } else {
      console.log('更新渲染')
    }
  })
  
  // 4. 监听窗口事件
  useEffect(() => {
    const handleResize = () => {
      console.log('窗口大小改变', window.innerWidth)
    }
    
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])
  
  const performSearch = (val) => {
    // 模拟搜索
    setSearchResults([`结果1：${val}`, `结果2：${val}`])
  }
  
  return (
    <div>
      <input 
        value={keyword}
        onChange={(e) => setKeyword(e.target.value)}
        placeholder="搜索关键词"
      />
      <input 
        value={user.name}
        onChange={(e) => setUser({ ...user, name: e.target.value })}
        placeholder="用户名"
      />
      <button onClick={() => setUser({ ...user, age: user.age + 1 })}>
        年龄 +1 ({user.age})
      </button>
      
      <ul>
        {searchResults.map((result, i) => (
          <li key={i}>{result}</li>
        ))}
      </ul>
    </div>
  )
}
```

### 5.4 useLayoutEffect（同步副作用）

与 `useEffect` 签名相同，但在浏览器**绘制之前同步执行**。适合需要读取 DOM 布局信息后立即修改、避免闪烁的场景（如测量元素尺寸、滚动到指定位置）。

```jsx
import { useState, useRef, useLayoutEffect } from 'react'

function Tooltip({ children }) {
  const ref = useRef(null)
  const [position, setPosition] = useState({ x: 0, y: 0 })

  useLayoutEffect(() => {
    const rect = ref.current.getBoundingClientRect()
    setPosition({ x: rect.right, y: rect.top })  // 在绘制前计算好位置
  }, [])

  return (
    <>
      <span ref={ref}>{children}</span>
      <div style={{ left: position.x, top: position.y }}>提示</div>
    </>
  )
}
```

> 绝大多数场景用 `useEffect` 即可。仅在需要避免视觉闪烁时才用 `useLayoutEffect`——它会阻塞浏览器绘制，影响性能。

### 5.5 useInsertionEffect（CSS-in-JS 专用）

在 DOM 变更前、`useLayoutEffect` 之前执行，专供 CSS-in-JS 库（styled-components、emotion）插入样式标签，避免 `useLayoutEffect` 中读取布局时样式尚未注入的问题。普通应用代码不应使用。

## 六、引用（useRef）
```jsx
import { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react'

// 子组件暴露方法
const ChildComponent = forwardRef((props, ref) => {
  const localRef = useRef()
  
  useImperativeHandle(ref, () => ({
    focus: () => {
      localRef.current.focus()
    },
    getValue: () => {
      return localRef.current.value
    },
    customMethod: () => {
      console.log('子组件的自定义方法')
    }
  }))
  
  return <input ref={localRef} placeholder="子组件输入框" />
})

function RefDemo() {
  // 1. DOM 元素引用
  const inputRef = useRef(null)
  
  // 2. 组件引用
  const childRef = useRef(null)
  
  // 3. 存储可变值（不触发重新渲染）
  const intervalRef = useRef()
  const renderCount = useRef(0)
  
  const [count, setCount] = useState(0)
  
  // 记录渲染次数
  renderCount.current++
  
  const focusInput = () => {
    inputRef.current?.focus()
  }
  
  const callChildMethod = () => {
    childRef.current?.focus()
    console.log('子组件值：', childRef.current?.getValue())
    childRef.current?.customMethod()
  }
  
  const startTimer = () => {
    intervalRef.current = setInterval(() => {
      setCount(c => c + 1)
    }, 1000)
  }
  
  const stopTimer = () => {
    clearInterval(intervalRef.current)
  }
  
  // v-for 中的引用管理
  const [items, setItems] = useState([
    { id: 1, name: '项目1' },
    { id: 2, name: '项目2' }
  ])
  const itemRefs = useRef({})
  
  const setItemRef = (el, id) => {
    if (el) {
      itemRefs.current[id] = el
    }
  }
  
  const scrollToItem = (id) => {
    itemRefs.current[id]?.scrollIntoView({ behavior: 'smooth' })
  }
  
  useEffect(() => {
    // 组件挂载时自动聚焦
    inputRef.current?.focus()
    
    return () => {
      // 清理定时器
      clearInterval(intervalRef.current)
    }
  }, [])
  
  return (
    <div>
      <h3>DOM 引用</h3>
      <input ref={inputRef} type="text" placeholder="输入内容" />
      <button onClick={focusInput}>聚焦输入框</button>
      
      <h3>组件引用</h3>
      <ChildComponent ref={childRef} />
      <button onClick={callChildMethod}>调用子组件方法</button>
      
      <h3>存储可变值</h3>
      <p>计数：{count}</p>
      <p>组件已渲染 {renderCount.current} 次</p>
      <button onClick={startTimer}>开始计时</button>
      <button onClick={stopTimer}>停止计时</button>
      
      <h3>列表引用</h3>
      {items.map(item => (
        <div 
          key={item.id}
          ref={(el) => setItemRef(el, item.id)}
          style={{ height: 100, margin: 10, background: '#f0f0f0' }}
        >
          {item.name}
          <button onClick={() => scrollToItem(item.id)}>滚动到此项</button>
        </div>
      ))}
    </div>
  )
}
```

## 七、自定义 Hooks
```jsx
import { useState, useEffect, useCallback, useMemo } from 'react'

// 1. 封装搜索逻辑
function useSearch(items, searchKey = 'name') {
  const [searchTerm, setSearchTerm] = useState('')
  
  const filteredItems = useMemo(() => {
    if (!searchTerm) return items
    return items.filter(item =>
      item[searchKey].toLowerCase().includes(searchTerm.toLowerCase())
    )
  }, [items, searchTerm, searchKey])
  
  return { searchTerm, setSearchTerm, filteredItems }
}

// 2. 封装数据请求
function useFetch(url, options = {}) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  
  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    
    try {
      const response = await fetch(url, options)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const result = await response.json()
      setData(result)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [url, options])
  
  useEffect(() => {
    fetchData()
  }, [fetchData])
  
  return { data, loading, error, refetch: fetchData }
}

// 3. 封装本地存储
function useLocalStorage(key, initialValue) {
  const [storedValue, setStoredValue] = useState(() => {
    try {
      const item = window.localStorage.getItem(key)
      return item ? JSON.parse(item) : initialValue
    } catch (error) {
      console.log(error)
      return initialValue
    }
  })
  
  const setValue = (value) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value
      setStoredValue(valueToStore)
      window.localStorage.setItem(key, JSON.stringify(valueToStore))
    } catch (error) {
      console.log(error)
    }
  }
  
  return [storedValue, setValue]
}

// 4. 封装防抖
function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value)
  
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)
    
    return () => clearTimeout(handler)
  }, [value, delay])
  
  return debouncedValue
}

// 使用自定义 Hooks 的组件
function ProductList() {
  const [products, setProducts] = useState([])
  const { data, loading, error } = useFetch('/api/products')
  
  // 同步数据
  useEffect(() => {
    if (data) setProducts(data)
  }, [data])
  
  // 使用搜索 Hook
  const { searchTerm, setSearchTerm, filteredItems } = useSearch(products, 'title')
  
  // 使用防抖
  const debouncedSearch = useDebounce(searchTerm, 300)
  
  // 使用本地存储
  const [viewMode, setViewMode] = useLocalStorage('viewMode', 'grid')
  
  useEffect(() => {
    if (debouncedSearch) {
      console.log('执行搜索API', debouncedSearch)
    }
  }, [debouncedSearch])
  
  if (loading) return <div>加载中...</div>
  if (error) return <div>错误：{error}</div>
  
  return (
    <div>
      <input 
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        placeholder="搜索商品..."
      />
      
      <div>
        <button onClick={() => setViewMode('grid')}>网格视图</button>
        <button onClick={() => setViewMode('list')}>列表视图</button>
        <p>当前视图：{viewMode}</p>
      </div>
      
      <div className={viewMode}>
        {filteredItems.map(product => (
          <div key={product.id}>
            <h3>{product.title}</h3>
            <p>价格：¥{product.price}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
```

## 八、性能优化

React 默认在父组件更新时递归渲染所有子组件。以下手段可跳过不必要的渲染，提升应用性能。

### 8.1 React.memo 避免子组件重渲染

`React.memo` 是高阶组件，对 props 进行浅比较，相同则跳过渲染。

```jsx
const TodoItem = memo(({ todo, onToggle }) => {
  console.log('TodoItem 渲染', todo.id)
  return (
    <li>
      <input
        type="checkbox"
        checked={todo.completed}
        onChange={() => onToggle(todo.id)}
      />
      <span style={{ textDecoration: todo.completed ? 'line-through' : 'none' }}>
        {todo.text}
      </span>
    </li>
  )
})

// 自定义比较函数（默认浅比较）
const ExpensiveItem = memo(
  ({ item }) => <div>{item.name}</div>,
  (prevProps, nextProps) => prevProps.item.id === nextProps.item.id
)
```

### 8.2 useCallback 缓存函数引用

每次渲染都会创建新的函数，导致子组件的 `memo` 失效。`useCallback` 在依赖不变时返回同一个函数引用。

```jsx
function TodoList() {
  const [todos, setTodos] = useState([
    { id: 1, text: '学习 React', completed: false },
  ])
  const [newTodo, setNewTodo] = useState('')

  // 依赖为空 → 函数引用永不改变
  const handleToggle = useCallback((id) => {
    setTodos(prev =>
      prev.map(todo =>
        todo.id === id ? { ...todo, completed: !todo.completed } : todo
      )
    )
  }, [])

  // 使用 setState 的函数形式避免依赖 state
  const handleAdd = useCallback(() => {
    if (!newTodo.trim()) return
    setTodos(prev => [...prev, { id: Date.now(), text: newTodo, completed: false }])
    setNewTodo('')
  }, [newTodo])

  return (
    <div>
      <input value={newTodo} onChange={e => setNewTodo(e.target.value)} />
      <button onClick={handleAdd}>添加</button>
      <ul>
        {todos.map(todo => (
          <TodoItem key={todo.id} todo={todo} onToggle={handleToggle} />
        ))}
      </ul>
    </div>
  )
}
```

### 8.3 useMemo 缓存计算结果

```jsx
function TodoStats({ todos, filter }) {
  // 仅 todos 或 filter 变化时才重新计算
  const filtered = useMemo(() => {
    if (filter === 'active') return todos.filter(t => !t.completed)
    if (filter === 'completed') return todos.filter(t => t.completed)
    return todos
  }, [todos, filter])

  const stats = useMemo(() => ({
    total: todos.length,
    completed: todos.filter(t => t.completed).length,
  }), [todos])

  return (
    <ul>
      {filtered.map(todo => <li key={todo.id}>{todo.text}</li>)}
    </ul>
  )
}
```

### 8.4 性能优化决策流程

```
组件渲染慢？
 ├─ 是 → 用 React.memo 包裹，检查是否有非原始类型 props
 │       ├─ 对象/数组 → 用 useMemo 包裹
 │       └─ 回调函数 → 用 useCallback 包裹
 └─ 否 → 不要过早优化，保持代码简洁
```

### 8.5 useMemo / useCallback 的代价

两者本身也有性能开销（缓存内存 + 依赖比较），仅在以下场景使用：

| 场景 | 不用 | 用 |
|------|------|-----|
| 简单计算 `a + b` | 直接计算 | 不划算 |
| 传递给 memo 组件的回调 | 会导致 memo 失效 | 用 useCallback |
| 大数组过滤/排序 | 每次渲染重复执行 | 用 useMemo |
| useEffect 依赖的对象 | 每次新引用触发 effect | 用 useMemo |

## 九、React 18 新特性

React 18 引入了并发渲染机制，使 UI 更新可中断、可恢复，核心是"区分紧急与非紧急更新"。

### 9.1 useTransition 标记非紧急更新

将状态更新标记为"非紧急"（Transition），React 会在完成紧急更新后才处理。输入框保持流畅，搜索结果可延迟渲染。

```jsx
import { useState, useTransition } from 'react'

function SearchPage() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  // isPending：非紧急更新处理中时为 true
  const [isPending, startTransition] = useTransition()

  const handleChange = (e) => {
    const value = e.target.value
    setQuery(value) // 紧急更新（输入框立即响应）

    startTransition(() => {
      // 非紧急更新（可被中断）
      const filtered = bigList.filter(item => item.includes(value))
      setResults(filtered)
    })
  }

  return (
    <div>
      <input value={query} onChange={handleChange} />
      {isPending && <span>搜索中...</span>}
      <ul>
        {results.map((r, i) => <li key={i}>{r}</li>)}
      </ul>
    </div>
  )
}
```

### 9.2 useDeferredValue 延迟状态值

与 `useTransition` 相似，但适用于无法控制 setState 的场景（如 props 传入的值）。

```jsx
import { useState, useDeferredValue, useMemo } from 'react'

function SlowList({ keyword }) {
  // keyword 变化后，deferredKeyword 保持旧值直到渲染完成
  const deferredKeyword = useDeferredValue(keyword)

  const items = useMemo(() => {
    return bigList.filter(item => item.includes(deferredKeyword))
  }, [deferredKeyword])

  return (
    <ul>
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  )
}

function Parent() {
  const [keyword, setKeyword] = useState('')
  return (
    <div>
      <input value={keyword} onChange={e => setKeyword(e.target.value)} />
      <SlowList keyword={keyword} />
    </div>
  )
}
```

### 9.3 自动批处理（Automatic Batching）

React 18 将多个状态更新合并为一次渲染，不再限于事件处理函数，Promise、setTimeout 中也自动生效。

```jsx
function BatchDemo() {
  const [count, setCount] = useState(0)
  const [flag, setFlag] = useState(false)

  // React 17：事件处理函数中批处理，setTimeout 中不批处理
  // React 18：所有场景均自动批处理

  const handleClick = () => {
    setCount(c => c + 1)  // ─┐
    setFlag(f => !f)      // ─┘ 合并为一次渲染
  }

  // 如需退出批处理：flushSync
  const handleForce = () => {
    flushSync(() => setCount(c => c + 1)) // 立即渲染
    flushSync(() => setFlag(f => !f))     // 再次渲染
  }

  return (
    <button onClick={handleClick}>
      计数：{count}，状态：{String(flag)}
    </button>
  )
}
```

### 9.4 Suspense 增强

React 18 中 Suspense 支持并发特性，可配合 `startTransition` 避免加载时回退到 fallback。

```jsx
import { Suspense, lazy } from 'react'

const Dashboard = lazy(() => import('./Dashboard'))

function App() {
  return (
    <Suspense fallback={<div>加载中...</div>}>
      <Dashboard />
    </Suspense>
  )
}
```

### 9.5 useId 生成唯一 ID

为无障碍属性和服务端渲染生成稳定的唯一 ID，避免 SSR 水合不匹配。

```jsx
function FormField({ label }) {
  const id = useId()

  return (
    <div>
      <label htmlFor={id}>{label}</label>
      <input id={id} type="text" />
    </div>
  )
}
```

### 9.6 useSyncExternalStore 订阅外部 Store

安全地订阅外部状态（Redux、Zustand 非 React 层实现），在并发渲染中保持一致性。

```jsx
import { useSyncExternalStore } from 'react'

// 订阅浏览器 API（如网络状态）
function useOnlineStatus() {
  return useSyncExternalStore(
    (callback) => {
      window.addEventListener('online', callback)
      window.addEventListener('offline', callback)
      return () => {
        window.removeEventListener('online', callback)
        window.removeEventListener('offline', callback)
      }
    },
    () => navigator.onLine, // 客户端快照
    () => true              // 服务端快照（SSR 默认值）
  )
}

function App() {
  const isOnline = useOnlineStatus()
  return <div>{isOnline ? '在线' : '离线'}</div>
}
```

### 9.7 createRoot 替代 ReactDOM.render

```jsx
// React 17
ReactDOM.render(<App />, document.getElementById('root'))

// React 18
import { createRoot } from 'react-dom/client'
const root = createRoot(document.getElementById('root'))
root.render(<App />)
```

### 9.8 特性对比速查

| 特性 | 作用 | React 17 | React 18 |
|------|------|----------|----------|
| 批处理 | 合并 setState | 仅事件函数内 | 所有场景 |
| useTransition | 标记非紧急更新 | 无 | 新增 |
| useDeferredValue | 延迟状态更新 | 无 | 新增 |
| useId | 稳定唯一 ID | 无 | 新增 |
| useSyncExternalStore | 外部 Store 订阅 | 无 | 新增 |
| Suspense | 代码分割 + 数据获取 | 仅客户端 | 支持 SSR |
| createRoot | 渲染入口 | ReactDOM.render | createRoot |

## 十、React 19 新特性

React 19（2024.12 发布）围绕表单处理、异步数据获取和开发体验做了大幅改进，核心新增四个 Hook 和一个简化的 ref 机制。

### 10.1 use() — 读取 Promise 和 Context

`use()` 可在组件或 Hook 中读取 Promise 和 Context，**支持条件调用**（`useContext` 做不到）。与 `Suspense` 配合实现声明式数据获取。

```jsx
import { use, Suspense } from 'react'

// 读取 Promise：Suspense 边界在 resolve 前显示 fallback
function MessageList({ messagesPromise }) {
  const messages = use(messagesPromise)
  return <ul>{messages.map(m => <li key={m.id}>{m.text}</li>)}</ul>
}

// 条件读取 Context（useContext 无法在条件中使用）
function Button({ showTheme }) {
  if (showTheme) {
    const theme = use(ThemeContext)
    return <button className={theme}>主题按钮</button>
  }
  return <button>默认按钮</button>
}
```

### 10.2 useActionState（替代 useFormState）

管理表单提交状态，`dispatch` 可直接作为 `<form>` 的 `action` 属性。返回值包含 `isPending` 表示提交中。

```jsx
import { useActionState } from 'react'

async function submitAction(prevState, formData) {
  const name = formData.get('name')
  await saveToServer(name)
  return { message: `保存成功：${name}` }
}

function MyForm() {
  const [state, formAction, isPending] = useActionState(submitAction, null)

  return (
    <form action={formAction}>
      <input name="name" placeholder="姓名" />
      <button disabled={isPending}>
        {isPending ? '提交中...' : '提交'}
      </button>
      {state?.message && <p>{state.message}</p>}
    </form>
  )
}
```

### 10.3 useFormStatus — 读取父表单提交状态

子组件无需 prop 即可感知父 `<form>` 是否正在提交，适合抽离提交按钮组件。

```jsx
import { useFormStatus } from 'react-dom'

function SubmitButton() {
  const { pending, data, method, action } = useFormStatus()

  return (
    <button type="submit" disabled={pending}>
      {pending ? '提交中...' : '提交'}
    </button>
  )
}

function MyForm() {
  return (
    <form action={formAction}>
      <input name="email" />
      <SubmitButton />  {/* 无需传 prop */}
    </form>
  )
}
```

### 10.4 useOptimistic — 乐观更新

在服务器响应前立即更新 UI，失败时自动回滚。

```jsx
import { useOptimistic } from 'react'

function TodoList({ todos }) {
  const [optimisticTodos, addOptimistic] = useOptimistic(
    todos,
    (state, newTodo) => [...state, { text: newTodo, pending: true }]
  )

  async function formAction(formData) {
    const text = formData.get('todo')
    addOptimistic(text)                    // 立即显示
    await saveToServer(text)               // 异步发送
  }

  return (
    <form action={formAction}>
      <input name="todo" />
      <button>添加</button>
      <ul>
        {optimisticTodos.map((t, i) => (
          <li key={i}>{t.text}{t.pending && ' (保存中)'}</li>
        ))}
      </ul>
    </form>
  )
}
```

### 10.5 ref 作为 prop（无需 forwardRef）

React 19 起函数组件可直接通过 `ref` prop 接收 ref，`forwardRef` 不再是必需。

```jsx
// React 18：必须用 forwardRef
const MyInput = forwardRef((props, ref) => (
  <input {...props} ref={ref} />
))

// React 19：直接解构 ref prop
function MyInput({ placeholder, ref }) {
  return <input placeholder={placeholder} ref={ref} />
}

<MyInput ref={inputRef} />
```

### 10.6 React 19 特性速查

| 特性 | 作用 | 替代 |
|------|------|------|
| `use()` | 读取 Promise / 条件读取 Context | `useContext` + `Suspense` 手动包裹 |
| `useActionState` | 管理表单提交状态 | `useFormState`（已废弃） |
| `useFormStatus` | 读取父表单 pending 状态 | 需要 prop 传递 |
| `useOptimistic` | 乐观更新 UI | 手动实现 `useState` + try/catch |
| `ref` as prop | 直接接收 ref | `forwardRef`（将废弃） |
| `<form>` action | 支持异步函数作为 form action | 需手动 `onSubmit` + `preventDefault` |

## 十一、React CSS 方案

React 本身不限定样式方案，社区常见的五种方式各有适用场景。

### 11.1 CSS Modules（.module.css）

文件以 `.module.css` 结尾自动启用 CSS Modules——类名会被编译为唯一哈希，天然隔离不污染全局，无运行时开销。Vite / Webpack / Next.js 均内置支持。

> **`.css` vs `.module.css`**：普通 `import './style.css'` 是**全局样式**，注入后整个页面生效；`import styles from './style.module.css'` 才是 CSS Modules，类名局部作用域，通过 `styles.xxx` 访问。后者依赖 `.module.` 命名约定，去掉中间缀即为普通全局 CSS。

```css
/* Button.module.css */
.button {
  padding: 8px 16px;
  border-radius: 4px;
}
.primary {
  background: #1890ff;
  color: #fff;
}
```

```jsx
import styles from './Button.module.css'

function Button({ primary, children }) {
  return (
    <button className={`${styles.button} ${primary ? styles.primary : ''}`}>
      {children}
    </button>
  )
}
```

### 11.2 Tailwind CSS（原子化）

预定义的工具类直接在 JSX 中组合，无需起类名、文件切换，适合快速开发。生产构建时自动摇树移除未使用的样式。

```bash
pnpm add tailwindcss @tailwindcss/vite
```

```jsx
function Card({ title, children }) {
  return (
    <div className="rounded-lg border bg-white p-6 shadow-sm dark:bg-gray-900">
      <h2 className="mb-4 text-xl font-semibold text-gray-900 dark:text-white">
        {title}
      </h2>
      <div className="text-gray-600 dark:text-gray-400">{children}</div>
    </div>
  )
}
```

### 11.3 CSS-in-JS（styled-components / emotion）

样式以组件形式定义，天然支持基于 props 的动态样式和主题切换，运行时生成 `<style>` 标签。

```bash
pnpm add styled-components
```

```jsx
import styled from 'styled-components'

const Button = styled.button`
  padding: 8px 16px;
  border-radius: 4px;
  background: ${props => props.$primary ? '#1890ff' : '#ddd'};
  color: ${props => props.$primary ? '#fff' : '#333'};

  &:hover {
    opacity: 0.9;
  }
`

function App() {
  return <Button $primary>提交</Button>
}
```

### 11.4 内联样式

直接以对象形式写入 `style` 属性，适合动态计算的值（如元素位置、进度条宽度），但无伪类/媒体查询。

```jsx
function ProgressBar({ percent }) {
  return (
    <div style={{ height: 8, background: '#eee' }}>
      <div style={{
        width: `${percent}%`,
        height: '100%',
        background: '#1890ff',
        transition: 'width 0.3s',
      }} />
    </div>
  )
}
```

### 11.5 className 条件组合

轻量级库 `clsx` / `classnames` 优雅处理条件类名：

```jsx
import clsx from 'clsx'

function Alert({ type, message }) {
  return (
    <div className={clsx('alert', {
      'alert-success': type === 'success',
      'alert-error': type === 'error',
      'alert-warning': type === 'warning',
    })}>
      {message}
    </div>
  )
}
```

### 11.6 方案对比

| 方案 | 运行时开销 | 动态样式 | 学习成本 | 适用场景 |
|------|-----------|---------|---------|---------|
| CSS Modules | 无 | 无（仅组合） | 低 | 中大型项目，追求零运行时 |
| Tailwind CSS | 无（编译时） | 伪类/响应式 | 中 | 快速开发，原子化爱好者 |
| styled-components | 有（~13KB） | 原生支持 | 中 | 需要基于 props 动态样式 |
| 内联样式 | 无 | 原生支持 | 低 | 动态计算值（进度条、拖拽位置） |
| clsx | 无 | — | 低 | 任何方案中处理条件类名 |

## 十二、React Router v7

React Router 是 React 生态最主流的路由库，v7 统一了 Remix 和 React Router，支持声明式路由配置、数据加载、表单提交和错误处理。

```bash
pnpm add react-router
```

### 12.1 路由定义与 RouterProvider

v7 推荐使用 `createBrowserRouter` + `RouterProvider` 的配置式路由：

```tsx
import { createBrowserRouter, RouterProvider } from 'react-router/dom'

const router = createBrowserRouter([
  {
    path: '/',
    Component: Layout,
    children: [
      { index: true, Component: Home },
      { path: 'about', Component: About },
      {
        path: 'users/:userId',
        loader: async ({ params }) => fetchUser(params.userId),
        Component: UserProfile,
      },
    ],
  },
])

createRoot(document.getElementById('root')).render(
  <RouterProvider router={router} />
)
```

### 12.2 导航组件：Link / NavLink / Navigate

```tsx
import { Link, NavLink, Navigate, useNavigate } from 'react-router'

// Link：基础跳转
<Link to="/about">关于</Link>
<Link to={`/users/${user.id}`}>{user.name}</Link>

// NavLink：自动高亮当前路由
<NavLink
  to="/"
  className={({ isActive }) => isActive ? 'active' : ''}
>
  首页
</NavLink>

// Navigate：编程式重定向
{!user && <Navigate to="/login" replace />}

// useNavigate：事件中编程跳转
const navigate = useNavigate()
const goUser = (id) => navigate(`/users/${id}`)
```

### 12.3 路由参数与查询参数

```tsx
import { useParams, useSearchParams, useLocation } from 'react-router'

function UserProfile() {
  const { userId } = useParams()               // /users/:userId
  const [searchParams, setSearchParams] = useSearchParams()
  const location = useLocation()

  const filter = searchParams.get('filter')

  return (
    <div>
      <p>用户 ID：{userId}</p>
      <p>筛选：{filter}</p>
      <button onClick={() => setSearchParams({ filter: 'active' })}>
        筛选活跃
      </button>
    </div>
  )
}
```

### 12.4 数据加载（loader）与数据变更（action）

loader 在路由渲染前获取数据，action 处理表单提交后自动重新验证 loader。

```tsx
import { Form, useLoaderData, useActionData } from 'react-router'

const router = createBrowserRouter([
  {
    path: '/todos',
    loader: async () => {
      const todos = await fetchTodos()
      return { todos }
    },
    action: async ({ request }) => {
      const formData = await request.formData()
      await addTodo(formData.get('title'))
      return { ok: true }
    },
    Component: TodoList,
  },
])

function TodoList() {
  const { todos } = useLoaderData()
  const actionData = useActionData()

  return (
    <div>
      <ul>
        {todos.map(todo => <li key={todo.id}>{todo.title}</li>)}
      </ul>
      <Form method="post">
        <input name="title" placeholder="新任务" />
        <button>添加</button>
      </Form>
      {actionData?.ok && <p>添加成功</p>}
    </div>
  )
}
```

### 12.5 布局与 Outlet

父路由通过 `<Outlet>` 渲染子路由，可通过 `context` 传递数据。

```tsx
// 布局组件
function DashboardLayout() {
  const [user, setUser] = useState(null)

  return (
    <div className="dashboard">
      <Sidebar />
      <main>
        <Outlet context={{ user, setUser }} />
      </main>
    </div>
  )
}

// 子组件通过 useOutletContext 获取 context
function DashboardHome() {
  const { user } = useOutletContext()
  return <h2>欢迎，{user.name}</h2>
}
```

### 12.6 路由守卫与重定向

```tsx
import { Navigate, useLocation } from 'react-router'

function RequireAuth({ children }) {
  const { user } = useAuth()
  const location = useLocation()

  if (!user) {
    // 保存来源路径，登录后跳回
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return children
}

// 在路由配置中使用
{
  path: '/admin',
  loader: async () => {
    const user = await getCurrentUser()
    if (!user) throw redirect('/login')
    return { user }
  },
  Component: Admin,
}
```

### 12.7 错误处理（errorElement）

```tsx
import { useRouteError, isRouteErrorResponse } from 'react-router'

function ErrorBoundary() {
  const error = useRouteError()

  if (isRouteErrorResponse(error)) {
    return (
      <div>
        <h1>{error.status}</h1>
        <p>{error.statusText}</p>
        <Link to="/">返回首页</Link>
      </div>
    )
  }

  return <div>未知错误</div>
}

const router = createBrowserRouter([
  {
    path: '/',
    errorElement: <ErrorBoundary />,   // 全局错误边界
    children: [
      { path: 'users/:id', errorElement: <UserError />, Component: User },
    ],
  },
])
```

### 12.8 Hooks 速查

| Hook | 说明 |
|------|------|
| `useNavigate` | 编程式导航 |
| `useParams` | 读取动态路由参数 `/users/:id` → `{ id }` |
| `useSearchParams` | 读取/写入 URL 查询参数 |
| `useLocation` | 获取当前 location 对象（pathname, state, search） |
| `useLoaderData` | 获取当前路由 loader 返回的数据 |
| `useActionData` | 获取最近一次 action 的返回数据 |
| `useRouteError` | 获取路由错误边界捕获的错误 |
| `useOutletContext` | 获取父路由 `<Outlet context={} />` 传递的数据 |
| `useFetcher` | 不与导航关联的数据交互（适合搜索建议等） |
| `useNavigation` | 获取当前导航状态（idle/loading/submitting） |
| `useSubmit` | 编程式触发表单提交 |


