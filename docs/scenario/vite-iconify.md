---
title: 图标离线化插件
date: 2026-05-29
category: scenario
sort: 998
description: 扫描项目图标引用，生成离线可用的图标数据包
---

# 编译时图标离线化

## 一、问题定义

在基于 Iconify 的 Vue 项目中，图标按需加载存在以下问题：

- **网络依赖**：每次访问页面都需要从 Iconify CDN 实时获取图标 SVG，弱网环境首屏图标会出现延迟
- **不可控**：CDN 稳定性不在自己手中，第三方服务宕机会导致图标无法渲染
- **图标透明度低**：项目里究竟用了哪些图标、哪些图标集，缺乏可视化统计
- **重复加载**：同一套图标每次访问都要重新下载，没有利用浏览器缓存

这个插件在构建阶段自动扫描源码中的图标引用，从 `@iconify/json` 中提取对应的 SVG 数据，生成精简的离线图标包，并附加一套带 localStorage 持久化缓存的运行时加载器。

---

## 二、方案概述

它是一个 Vite 插件，在 `buildStart` 阶段执行，通过正则 + 官方 API 双重校验提取项目图标，最终输出离线图标文件和加载器。

### 2.1 核心流程

1. 从 Iconify 官方 API 拉取全部图标集清单（一次性校验用）
2. 递归扫描项目中所有 `.ts` / `.vue` 文件，用正则匹配图标引用（如 `"mdi:home"`）
3. 通过前缀忽略规则 + 官方图标集校验，过滤非法或非官方的引用
4. 从本地 `@iconify/json` 中提取对应图标集的完整数据，按需裁剪为只包含使用到的图标
5. 本地缺失的图标尝试从 Iconify API 补拉
6. 输出精简的 `{prefix}-raw.json` 到 `public/icons/`，同时生成元数据 `index.json` 和数据清单 `data.json`
7. 生成带 localStorage 缓存的运行时加载器 `index.ts`，在页面初始化时注册图标数据

### 2.2 输入

```typescript
// 代码中任意位置引用图标
<Icon icon="mdi:home" />
<Icon icon="carbon:settings" />

// 插件配置
autoInstallIconifyPlugin({
  appCode: 'cms',
  includes: ['.ts', '.vue'],
  iconPattern: String.raw`["']{1}([a-zA-Z0-9-]+):([^"'\s]+)["']{1}`,
})
```

### 2.3 输出产物

```
public/icons/
├── mdi-raw.json          # 精简后的 Material Design Icons 数据（仅项目使用到的图标）
├── carbon-raw.json       # 精简后的 Carbon Icons 数据

src/iconify/
├── index.ts              # 运行时加载器（带 localStorage 缓存）
├── index.json            # 元数据（图标集列表 + 使用模式）
├── data.json             # 数据清单（各图标集的 hash、图标名称列表）
```

---

## 三、实现拆解

核心技术栈：

```bash
pnpm add fs-extra @iconify/json
```

---

### 3.1 生命周期注册

使用 `buildStart` 钩子，在构建开始时触发分析——不需要阻塞每个模块的加载，只执行一次全局扫描和生成。

```typescript
export default function autoInstallIconifyPlugin(options: PluginOptions = {}) {
  const config = initializeConfig(options)
  const usedIcons = new Map<string, Set<string>>()
  const iconReferences: IconReference[] = []

  return {
    name: 'vite-plugin-auto-install-iconify',
    enforce: 'pre',

    async buildStart() {
      await initializeOfficialCollections(config, fakeRef)
      await analyzeAndGenerateIcons(config, usedIcons, iconReferences, fakeRef)
    },
  }
}
```

几点要点：

- `enforce: 'pre'` 确保在构建流程最早阶段运行，拿到完整源码
- 核心逻辑收敛在 `analyzeAndGenerateIcons` 一个入口函数中
- 选择 `buildStart` 而非 `transform`，因为我们关心的是全局图标集而非单个模块的变换

---

### 3.2 配置初始化

```typescript
function initializeConfig(options: PluginOptions): Required<PluginOptions> {
  return {
    appCode:          options.appCode ?? '',
    includes:         options.includes ?? ['.ts', '.vue'],
    excludes:         options.excludes ?? ['node_modules'],
    iconOutputDir:    options.iconOutputDir ?? 'public/icons',
    metaOutputPath:   options.metaOutputPath ?? 'src/iconify/index.json',
    dataOutputPath:   options.dataOutputPath ?? 'src/iconify/data.json',
    iconPattern:      options.iconPattern ?? String.raw`["']{1}([a-zA-Z0-9-]+):([^"'\s]+)["']{1}`,
    iconPrefixToIgnore: options.iconPrefixToIgnore ?? 'i-',
    validateWithOfficialAPI: options.validateWithOfficialAPI ?? true,
    onlyUsedIcons:    options.onlyUsedIcons ?? true,
    fetchMissingIcons: options.fetchMissingIcons ?? true,
    enableCache:      options.enableCache ?? true,
    cacheVersion:     options.cacheVersion ?? '1.0.0',
    generateLoader:   options.generateLoader ?? true,
  }
}
```

默认正则 `["']{1}([a-zA-Z0-9-]+):([^"'\s]+)["']{1}` 会匹配所有形如 `"prefix:name"` 的引号包裹字符串，分组 1 为前缀、分组 2 为名称。

---

### 3.3 官方图标集校验

在分析开始前，先从 Iconify API 拉取一份完整的官方图标集清单：

```typescript
async function initializeOfficialCollections(
  config: Required<PluginOptions>,
  officialIconCollections: Record<string, unknown> | null,
): Promise<void> {
  if (!config.validateWithOfficialAPI) return

  const response = await fetch('https://api.iconify.design/collections')
  if (response.ok) {
    officialIconCollections = await response.json()
  }
}
```

随后在 `extractIconReference` 中：

```typescript
// 验证是否为官方图标集
if (validateWithOfficialAPI && officialIconCollections && !officialIconCollections[prefix]) {
  return null  // 非官方图标集 → 丢弃
}
```

这一步过滤掉了项目中的变量名、路径、注释等误匹配。

---

### 3.4 文件递归扫描

```typescript
async function scanProjectFiles(
  dirPath: string,
  includes: string[],
  excludes: string[],
): Promise<string[]> {
  const files: string[] = []

  async function walkDirectory(currentPath: string) {
    const entries = await fs.readdir(currentPath, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name)
      if (shouldExclude(fullPath, excludes)) continue
      if (entry.isDirectory()) {
        await walkDirectory(fullPath)
      } else if (entry.isFile() && matchesExtension(fullPath, includes)) {
        files.push(fullPath)
      }
    }
  }

  await walkDirectory(dirPath)
  return files
}
```

通过 `excludes` 跳过 `node_modules` 等目录，通过 `includes` 只处理 `.ts` 和 `.vue` 文件，避免扫描无关的静态资源。

---

### 3.5 图标识别与提取

对每个匹配到的文件，用配置的 `iconPattern` 正则提取前缀和名称：

```typescript
async function analyzeFileForIcons(...): Promise<IconReference[]> {
  const content = await fs.readFile(filePath, 'utf8')
  const iconRegex = new RegExp(iconPattern, 'g')
  const matches = [...content.matchAll(iconRegex)]

  const references: IconReference[] = []
  for (const match of matches) {
    if (match.length < 3) continue
    const reference = extractIconReference(
      match[1], match[2], iconPrefixToIgnore,
      officialIconCollections, validateWithOfficialAPI,
    )
    if (reference) references.push(reference)
  }
  return references
}
```

前缀忽略规则处理一种常见编码模式：组件库可能用 `i-carbon` 这样的前缀使用图标，配置 `iconPrefixToIgnore: 'i-'` 后会自动剥离得到 `carbon`：

```typescript
if (iconPrefixToIgnore && prefix.startsWith(iconPrefixToIgnore)) {
  prefix = prefix.slice(iconPrefixToIgnore.length)
}
```

---

### 3.6 图标集裁剪与合并

这是插件的核心逻辑——从 `@iconify/json` 的完整图标集中按需提取。

```typescript
async function processIconSet(
  prefix: string,
  iconNames: Set<string>,
  outputDir: string,
  onlyUsedIcons: boolean,
  fetchMissingIcons: boolean,
): Promise<IconSetMeta | null> {
  // 1. 加载本地完整图标集数据
  const { hasLocalData, fullSetData } = await loadLocalIconSet(prefix)

  // 2. 准备数据容器（仅有使用的图标，或完整拷贝）
  const usedIconsData = prepareIconDataContainer(...)

  // 3. 逐个图标处理：直接图标、别名、缺失
  const processingResult = await processIconsInSet(...)

  // 4. 保存并计算 hash
  return await saveIconSetFiles(...)
}
```

**别名处理**是关键细节。Iconify 中很多图标是别名（如 `home-outline` 实际指向 `home`），如果只取别名本身，渲染时会因为缺少 `parent` 图标数据而失败：

```typescript
if (fullSetData.aliases?.[iconName]) {
  const aliasData = fullSetData.aliases[iconName]
  const parentIcon = (aliasData as { parent: string }).parent
  parentIconsToAdd.add(parentIcon)  // 记录父图标，后续统一补充
}
```

**API 补偿**：本地 `@iconify/json` 可能版本滞后，找不到的图标会尝试从 API 拉取：

```typescript
const apiUrl = `https://api.iconify.design/${prefix}.json?icons=${missingIcons.join(',')}`
const response = await fetch(apiUrl)
const apiData = await response.json()
// 合并 API 数据到 usedIconsData
```

---

### 3.7 运行时加载器生成

生成的 `src/iconify/index.ts` 是一个完整的图标初始化模块：

```typescript
// 生成的代码结构
import { addCollection } from '@iconify/vue'
import iconsMeta from './index.json'
import data from './data.json'

export async function setupIconify(): Promise<boolean> {
  // 开发环境跳过（dev 模式由 Iconify CDN 负责）
  if (import.meta.env.DEV) return true

  // 清理旧版本缓存
  cleanOldCache(currentHashes)

  for (const collection of data) {
    // 优先从 localStorage 读取缓存
    let iconData = getIconDataFromCache(name, iconSetHash)
    if (!iconData) {
      // 缓存未命中 → fetch 网络文件
      const response = await fetch(`${publicPath}/icons/${name}-raw.json?v=${iconSetHash}`)
      iconData = await response.json()
      saveIconDataToCache(name, iconData, iconSetHash)
    }

    // 冻结对象 + 注册到 Iconify
    const frozenIconData = Object.freeze(iconData)
    addCollection(frozenIconData)
  }
}
```

缓存机制包含三层：

| 机制 | 说明 |
|------|------|
| **hash 版本号** | 图标数据内容有变化 → hash 变化 → 旧缓存自动失效 |
| **应用隔离** | `appCode` 拼入缓存 key 前缀，不同应用缓存互不干扰 |
| **空间保护** | 写入缓存遇到 QuotaExceededError 时，自动清理其他应用的缓存腾空间 |

---

### 3.8 数据优化

保存前对图标数据进行瘦身，剔除对渲染无影响的元数据字段：

```typescript
function optimizeIconData(iconData: IconSetData): any {
  const optimizedData = structuredClone(iconData)

  const fieldsToRemove = [
    'info', 'categories', 'total', 'version',
    'samples', 'displayHeight', 'category',
    'tags', 'palette', 'chars', 'suffixes', 'prefixes',
  ]

  fieldsToRemove.forEach((field) => {
    delete optimizedData[field]
  })

  return optimizedData
}
```

一套标准 mdi 完整图标集约 6MB，裁剪后项目实际用到的 20 个图标可能只有 20KB，减少 99% 以上。

---

## 四、接入指南

```bash
pnpm add @zeewain/vite-plugin-auto-install-iconify -D
```

```typescript
// vite.config.ts
import autoInstallIconifyPlugin from '@zeewain/vite-plugin-auto-install-iconify'

export default defineConfig({
  plugins: [
    autoInstallIconifyPlugin({
      appCode: 'cms',
      includes: ['.ts', '.vue'],
    }),
  ],
})
```

```typescript
// main.ts —— 在 Vue 应用初始化时加载图标
import { setupIconify } from '@/iconify'

async function bootstrap() {
  await setupIconify()
  const app = createApp(App)
  app.mount('#app')
}
```

每次 `vite build` 时自动分析并生成最新的图标数据包。

---

## 五、边界分析

### 5.1 最佳适用

- 完全离线部署的内网中后台项目（CDN 不可达）
- PWA / Electron 桌面应用，追求图标零网络请求
- 对图标加载性能有要求的移动端 H5
- 需要精确控制图标版本的工程化项目

### 5.2 已知约束

- 依赖 `@iconify/json` 本地包，首次安装体积较大（~50MB），但不打包到最终产物
- 仅处理通过字符串字面量引用的图标，动态拼接（如 `` `mdi:${name}` ``）无法识别
- 官方 API 校验需要网络，离线构建环境需设置 `validateWithOfficialAPI: false`
- 图标集版本受本地 `@iconify/json` 制约，需定期升级依赖获取最新图标

---

## 六、总结

这个插件的核心思想是：**将运行时的网络依赖前置到编译时解决**。通过正则扫描 + 官方校验 + 本地裁剪 + API 补偿的四层链路，确保最终产物只包含项目真实需要的图标数据。

关键模块拆解：

1. **扫描**：递归遍历文件系统，正则匹配图标引用
2. **校验**：通过 Iconify API 过滤非官方/误识别引用
3. **裁剪**：从本地完整图标集中按需提取 + 别名父图标追踪
4. **补偿**：本地缺失的图标通过 API 兜底拉取
5. **输出**：生成精简 JSON + 带三级缓存策略的运行时加载器
