---
title: Web SDK 开发规范
date: 2026-05-29
category: scenario
sort: 888
description: 通用 Web SDK 的可复用开发流程与工程化实践
---

# Web SDK 可复用开发流程

> 基于唤醒SDK项目提炼的通用 Web SDK 开发模式与最佳实践。

---

## 一、项目结构

```
project-sdk/
├── package.json
├── tsconfig.json
├── rollup.config.js               # 主构建配置
├── .eslintrc                      # 代码规范
├── .release-it.json               # 发布配置
├── README.md
├── public/                        # 静态资源（构建时复制到 dist）
├── scripts/                       # 构建脚本 + 辅助文件
│   └── generate-version.js
├── src/                           # SDK 源码
│   ├── index.ts                   # ★ 公共 API 入口（唯一出口）
│   ├── version.ts                 # 自动生成的版本常量
│   ├── core/                      # 核心逻辑
│   │   ├── sdk.ts                 # ★ 主类（门面模式）
│   │   ├── logger.ts              # 内部日志
│   │   └── errors/                # 错误体系
│   │       ├── index.ts
│   │       ├── sdk-error.ts
│   │       └── error-codes.ts
│   ├── types/                     # 类型定义
│   │   ├── index.ts               # 公共类型
│   │   ├── config.ts              # 配置接口
│   │   ├── internal.ts            # 内部类型
│   │   ├── global.d.ts            # 全局类型增强
│   │   └── raw.d.ts               # 自定义模块声明
│   ├── enums/                     # 枚举
│   │   └── index.ts
│   └── utils/                     # 工具函数
│       └── index.ts
├── dist/                          # 构建产物（git ignore）
│   ├── index.d.ts                 # 类型声明（tsc 生成）
│   ├── index.esm.js               # ESM 产物
│   ├── index.umd.cjs              # UMD 产物
│   └── awake/                     # 运行时静态资源
└── examples/                      # 集成示例（代替单元测试）
    ├── test-vue3/                 # 框架集成示例
    └── test-umd/                  # 纯 HTML 示例
```

| 目录 | 职责 | 对外暴露 |
|------|------|----------|
| `src/index.ts` | 集中导出所有公共 API | 是 |
| `src/core/` | 核心业务逻辑实现 | 否（通过 index 间接暴露） |
| `src/types/` | 接口、类型别名、类型增强 | 是（公共类型） |
| `src/enums/` | 状态/常量枚举 | 是 |
| `src/utils/` | 纯函数工具集 | 否 |
| `scripts/` | 构建辅助（版本生成、独立入口文件） | 否 |
| `public/` | 不参与编译的静态资源 | 作为 dist/ 子目录分发 |

---

## 二、构建工具链

### 2.1 核心思路：Rollup 打包 + tsc 生成声明

**为何不用 tsc 直接打包？**
- tsc 无法高效处理多格式输出（ESM/UMD/CJS IIFE）
- tsc 无法内联静态资源（`?raw` 导入）
- Rollup 的 Tree-shaking 和插件生态更适合 SDK 场景

### 2.2 多格式双输出

SDK 必须同时输出 **ESM** 和 **UMD**，覆盖打包工具和 `<script>` 标签两种接入方式：

```js
// rollup.config.js
export default [
  {
    input: 'src/index.ts',
    inlineDynamicImports: true,     // 输出单个文件
    output: [
      { file: 'dist/index.esm.js', format: 'esm', exports: 'named' },
      { file: 'dist/index.umd.cjs', format: 'umd', name: 'MySDKLib', exports: 'named' }
    ],
    plugins: [
      nodeResolve({ browser: true, preferBuiltins: false }),
      commonjs(),
      typescript({ declaration: false }),  // 仅转译，不生成 .d.ts
      ...minifyPlugins
    ]
  }
];
```

### 2.3 类型声明独立生成

声明文件通过 `tsc` 单独生成，与 Rollup 转译分离：

```json
// package.json scripts
{
  "build": "npm run clean && NODE_ENV=production rollup -c && npm run build:types",
  "build:types": "tsc -p tsconfig.json --declaration --emitDeclarationOnly --outDir dist"
}
```

**关键点：** `tsconfig.json` 中 `declaration: false`，生成声明时命令行覆盖为 `true`。

### 2.4 自定义 Rollup 插件：内联资源

当需要将独立脚本文件以**字符串形式**内联到 SDK 包中时（例如 AudioWorklet 源码），可使用自定义 `?raw` 插件：

```js
function rawPlugin() {
  return {
    name: 'raw-loader',
    resolveId(source, importer) {
      if (!source.endsWith('?raw')) return null;
      const filePath = source.slice(0, -4);
      const resolvedPath = importer ? resolve(dirname(importer), filePath) : resolve(filePath);
      return `${resolvedPath}?raw`;
    },
    load(id) {
      if (!id.endsWith('?raw')) return null;
      const filePath = id.slice(0, -4);
      return `export default ${JSON.stringify(readFileSync(filePath, 'utf-8'))};`;
    }
  };
}
```

对应类型声明：

```ts
// src/types/raw.d.ts
declare module '*?raw' {
  const content: string;
  export default content;
}
```

### 2.5 独立入口文件单独构建

如果 SDK 包含需要独立加载的脚本（如 AudioWorklet Processor），使用 Rollup 的第二个构建目标：

```js
{
  input: 'scripts/voice-awake-processor.js',
  output: {
    file: 'dist/awake/voice-awake-processor.js',
    format: 'iife',
    name: 'VoiceAwakeProcessorBundle'
  },
  plugins: [...minifyPlugins]
}
```

### 2.6 TypeScript 配置建议

```json
{
  "compilerOptions": {
    "target": "es2018",           // 广泛浏览器兼容
    "module": "esnext",           // 让 Rollup 处理模块
    "declaration": false,         // 声明由 build:types 命令处理
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "moduleResolution": "node",
    "lib": ["dom", "esnext"],
    "baseUrl": ".",
    "paths": { "@/*": ["src/*"] }
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "examples"]
}
```

### 2.7 构建脚本一览

```json
{
  "dev": "NODE_ENV=development rollup -c -w",   // 开发监听模式
  "clean": "rimraf dist",                         // 清理产物
  "generate:version": "node scripts/generate-version.js",  // 自动生成版本
  "build": "npm run clean && NODE_ENV=production rollup -c && npm run build:types",
  "lint": "eslint \"./src/**/*.{ts,js}\" --fix",
  "prebuild": "npm run generate:version && npm run lint",   // pre hook
  "prepublishOnly": "npm run build"              // npm 发布前自动构建
}
```

---

## 三、公共 API 设计

### 3.1 门面模式 + 主类

SDK 对外暴露一个**单一主类**，复杂的内部逻辑全部封装在类内部：

```ts
// src/index.ts - 唯一的公共入口
export { MySDK } from './core/sdk';
export { SDK_VERSION } from './version';
export { SDKStatus } from './enums';
export { SDKError, ErrorCategory, ConfigErrorCode } from './core/errors';
export type { ISDKConfig, ISDKResult, ISDKEvents } from './types';
```

### 3.2 状态机驱动

SDK 内部维护明确的状态枚举，每次操作前校验当前状态，保证生命周期严格有序：

```ts
enum SDKStatus {
  INIT, LOADING, READY, LISTENING, STOPPED, DESTROYED, ERROR
}

// 状态流转约束
init()   → INIT → LOADING → READY
start()  → READY/STOPPED → LISTENING
stop()   → LISTENING → STOPPED
destroy() → 任意状态 → DESTROYED
任意状态   → ERROR（从 catch 进入）
```

**设计要点：**
- 每个公开方法内部先检查当前状态是否允许执行
- 状态变更统一通过 `updateStatus()` 方法，触发 `statusChange` 事件
- 进入 ERROR 后不可恢复，须 destroy 重建

### 3.3 事件驱动模型

使用轻量的自定义事件系统（不依赖 Node EventEmitter，减小包体积）：

```ts
// 事件类型定义
interface ISDKEvents {
  wake: (result: IWakeResult) => void;
  statusChange: (status: SDKStatus) => void;
  error: (error: SDKError) => void;
}

// 实现
class MySDK {
  private listeners: { [K in keyof ISDKEvents]?: Array<ISDKEvents[K]> } = {};

  on<K extends keyof ISDKEvents>(event: K, cb: ISDKEvents[K]): this { /* ... */ }
  off<K extends keyof ISDKEvents>(event: K, cb: ISDKEvents[K]): this { /* ... */ }
  private emit<K extends keyof ISDKEvents>(event: K, ...args: Parameters<ISDKEvents[K]>): void { /* ... */ }
}
```

**关键细节：**
- `emit` 内部用 try-catch 包裹回调，防止单个回调的异常导致其它回调不被执行
- `on()/off()` 返回 `this`，支持链式调用
- 事件类型用接口映射而非 string，获得完整的类型安全

### 3.4 Promise 复用模式

当初始化操作可能被重复调用时（如 UI 按钮连续点击），复用同一个 Promise 实例：

```ts
private initPromise: Promise<void> | null = null;

async init(): Promise<void> {
  if (this.status === Status.READY) return;        // 已初始化
  if (this.initPromise) return this.initPromise;   // 初始化进行中，复用

  this.initPromise = this.doInit();
  try {
    await this.initPromise;
  } finally {
    this.initPromise = null;
  }
}
```

### 3.5 配置校验

构造函数中执行完整的配置校验，快速失败：

```ts
private validateConfig(config: ISDKConfig): void {
  if (!config) throw new SDKError(Code.MISSING_REQUIRED_PARAM, '缺少配置');
  if (!config.appId) throw new SDKError(Code.MISSING_REQUIRED_PARAM, '缺少 appId');
  if (config.threshold < 0 || config.threshold > 1) throw new SDKError(Code.INVALID_CONFIG);
  // ...更多校验
}
```

---

## 四、错误处理体系

### 4.1 分级错误码

按四位数编码规则分类，不同千位对应不同错误类别：

| 千位 | 类别 | 枚举 | 示例 |
|------|------|------|------|
| 2xxx | 操作错误 | `OperationErrorCode` | 权限拒绝(2002)、状态错误(2003) |
| 3xxx | 资源错误 | `ResourceErrorCode` | WASM加载失败(3001)、超时(3007) |
| 4xxx | 鉴权错误 | `AuthErrorCode` | 鉴权失败(4001) |
| 5xxx | 配置错误 | `ConfigErrorCode` | 参数无效(5001)、参数缺失(5002) |

```ts
enum ErrorCategory { CONFIG, OPERATION, RESOURCE, AUTH }

enum ConfigErrorCode { INVALID_CONFIG = 5001, MISSING_REQUIRED_PARAM = 5002 }
enum OperationErrorCode { OPERATION_FAILED = 2001, PERMISSION_DENIED = 2002 }
enum ResourceErrorCode { WASM_LOAD_FAILED = 3001, WASM_RUNTIME_TIMEOUT = 3007 }
enum AuthErrorCode { AUTH_FAILED = 4001 }

type SDKErrorCode = ConfigErrorCode | OperationErrorCode | ResourceErrorCode | AuthErrorCode;
```

### 4.2 SDKError 类

```ts
class SDKError extends Error {
  readonly code: SDKErrorCode;
  readonly category: ErrorCategory;
  readonly timestamp: number;
  readonly originalError?: unknown;

  constructor(code: SDKErrorCode, message?: string, originalError?: unknown) {
    super(message || getErrorInfo(code).message);
    this.code = code;
    this.category = getErrorInfo(code).category;
    this.timestamp = Date.now();
    this.originalError = originalError;
  }

  toJSON() {
    return { name: this.name, code: this.code, category: this.category, message: this.message, timestamp: this.timestamp };
  }
}
```

### 4.3 错误码映射表

集中管理错误码→分类+默认消息的映射：

```ts
const ERROR_CODE_MAP: Record<SDKErrorCode, { category: ErrorCategory; message: string }> = {
  [ConfigErrorCode.INVALID_CONFIG]: { category: ErrorCategory.CONFIG, message: '配置参数无效' },
  // ...所有映射
};

function getErrorInfo(code: SDKErrorCode) {
  return ERROR_CODE_MAP[code] || { category: ErrorCategory.OPERATION, message: '未知错误' };
}
```

### 4.4 错误统一处理

```ts
private handleError(error: SDKError): SDKError {
  if (this.status !== Status.DESTROYED) {
    this.updateStatus(Status.ERROR);
  }
  this.logger.error(error.message, error.originalError || error);
  this.emit('error', error);
  return error;
}

private toSDKError(error: unknown, fallbackCode: number): SDKError {
  if (error instanceof SDKError) return error;
  return new SDKError(fallbackCode, undefined, error);
}
```

---

## 五、package.json 发布配置

### 5.1 条件导出

利用 `exports` 字段提供现代化的条件导出：

```json
{
  "type": "module",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "require": "./dist/index.umd.cjs",
      "import": "./dist/index.esm.js",
      "browser": {
        "require": "./dist/index.umd.cjs",
        "import": "./dist/index.esm.js"
      },
      "default": "./dist/index.umd.cjs"
    },
    "./package.json": "./package.json"
  },
  "main": "dist/index.umd.cjs",
  "module": "dist/index.esm.js",
  "types": "dist/index.d.ts",
  "unpkg": "dist/index.umd.cjs",
  "files": ["dist"]
}
```

**关键配置说明：**
- `"type": "module"` — 允许源码中使用 ESM 语法，但输出同时覆盖 CJS/ESM
- `"files": ["dist"]` — 仅发布构建产物，源码不进入 npm 包
- `"main"/"module"/"types"` — 向后兼容的基础字段
- `"exports"` — 现代打包工具优先读取的映射表
- `"./package.json": "./package.json"` — 允许下游通过 `import pkg from "sdk/package.json"` 获取版本

### 5.2 依赖管理

- **零运行时依赖**：所有第三方库打包进产物
- 仅使用 `devDependencies`（Rollup、TypeScript、ESLint 等）
- 使用 pnpm 管理（标准选择，非强制）

---

## 六、版本管理

### 6.1 版本单一来源

`package.json` 的 `version` 是唯一的版本来源。通过构建前脚本自动同步到源码：

```js
// scripts/generate-version.js
import { readFileSync, writeFileSync } from 'fs';

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'));
const content = `export const SDK_VERSION = '${pkg.version}';\n`;
writeFileSync('./src/version.ts', content);
```

```ts
// src/version.ts (自动生成，勿手动修改)
export const SDK_VERSION = '0.1.0';
```

在 `prebuild` hook 中执行，确保每次构建前版本号一致：

```json
{ "prebuild": "npm run generate:version && npm run lint" }
```

### 6.2 release-it 自动化发布

```json
{
  "git": {
    "commitMessage": "chore(release): ${version}",
    "tagName": "v${version}",
    "requireCleanWorkingDir": true,
    "requireUpstream": true
  },
  "npm": {
    "publish": true,
    "publishArgs": ["--registry=https://registry.npmjs.org/", "--access=public"]
  },
  "hooks": {
    "before:init": ["npm run lint"],
    "before:release": ["npm run build"],
    "after:release": ["echo 发布完成"]
  }
}
```

**发布命令：**

```json
{
  "release": "release-it",                    // 自动判断 semver
  "release:patch": "release-it patch",        // 补丁版本 0.1.0 → 0.1.1
  "release:minor": "release-it minor",        // 次要版本 0.1.0 → 0.2.0
  "release:major": "release-it major",        // 主版本 0.1.0 → 1.0.0
  "release:dry": "release-it --dry-run"       // 预演模式，不实际发布
}
```

**多仓库发布：** 对于需要同时发布到内网私有仓库的场景，使用独立的配置文件：

```json
{
  "release:internal": "release-it --config .release-it.internal.json"
}
```

---

## 七、全局类型增强

当 SDK 依赖 `window` 上的全局变量时（如 WASM 运行时挂载的 `Module`、`WakeWordSDK`），通过 `.d.ts` 增强全局类型：

```ts
// src/types/global.d.ts
import type { IWakeWordModule, IWakeWordSDKConstructor } from './internal';

declare global {
  interface Window {
    Module?: IWakeWordModule;
    WakeWordSDK?: IWakeWordSDKConstructor;
  }
}

export {};  // 确保此文件被视为模块
```

---

## 八、日志管理

```ts
class Logger {
  private enabled: boolean;
  private readonly prefix = '[ MySDK ]';

  constructor(enabled = false) { this.enabled = enabled; }

  info(...args: unknown[]) { if (this.enabled) console.log(this.prefix, ...args); }
  warn(...args: unknown[]) { if (this.enabled) console.warn(this.prefix, ...args); }
  error(...args: unknown[]) { console.error(this.prefix, ...args); }  // error 始终输出
}
```

**设计要点：**
- `info/warn` 受 `enableDebugLog` 开关控制，生产环境静默
- `error` 始终输出，方便排查
- 统一前缀标识日志来源，避免与其他库混淆

---

## 九、静态资源管理

### 9.1 构建时复制

SDK 所需的静态资源（WASM、模型数据等）放在 `public/` 目录，构建时通过插件复制到 `dist/` 下：

```js
import copy from 'rollup-plugin-copy';

plugins: [
  copy({
    targets: [{ src: 'public/*', dest: 'dist/awake' }],
    verbose: true
  })
]
```

### 9.2 内联优先，外部回退

对于可选的外部资源（如 AudioWorklet 文件），提供双重加载策略：

```ts
if (config.useInline) {
  // 内联模式：用字符串拼接 Blob URL，减少额外文件部署
  const blob = new Blob([`${processorCode}\n//# sourceURL=processor.inline.js`], { type: 'application/javascript' });
  const blobUrl = URL.createObjectURL(blob);
  await context.audioWorklet.addModule(blobUrl);
  URL.revokeObjectURL(blobUrl);  // 及时释放
} else {
  // 外部模式：适配严格 CSP 场景（禁止 blob: 协议）
  await context.audioWorklet.addModule(externalPath);
}
```

### 9.3 用户部署要求

README 中明确说明用户需要将 `dist/awake/` 目录复制到项目公共目录，并通过 `wasmPath` 配置路径。

---

## 十、示例项目（代替单元测试）

### 10.1 为什么要示例项目

- SDK 依赖浏览器 API（Web Audio、AudioWorklet、WASM），单元测试困难
- 集成示例可以完整验证从配置到销毁的全流程
- 对用户而言是最直观的接入文档

### 10.2 示例组织结构

```
examples/
├── test-vue3/           # 主流框架集成示例
│   ├── package.json     # "file:../.." 本地文件依赖
│   ├── vite.config.ts   # resolve.alias 指向源码
│   └── src/components/  # 交互式 Demo 组件
└── test-umd/            # 纯 HTML 使用示例
    └── index.html       # <script src="../../dist/index.umd.cjs">
```

### 10.3 本地开发配置

```ts
// examples/test-vue3/vite.config.ts
export default defineConfig({
  resolve: {
    alias: {
      '@zeewain/voice-awake-sdk': resolve(__dirname, '../../src/index.ts')
    }
  }
});
```

开发示例时直接引用源码，修改 SDK 后热更新即刻生效。

---


## 十一、完整开发流程总结

### 11.1 开发阶段

```
1. 编写 SDK 源码 (src/)
2. pnpm dev → Rollup 监听模式，实时构建
3. 在 examples/ 中验证功能
4. pnpm lint → 代码规范检查
```

### 11.2 构建阶段

```
1. generate:version → 同步版本号到源码
2. lint → ESLint 检查
3. clean → 清理 dist/
4. rollup -c → 双格式打包
5. build:types → tsc 生成类型声明
```

### 11.3 发布阶段

```
1. pnpm release:dry → 预演确认
2. pnpm release:patch   → 发布补丁版本
   pnpm release:minor   → 发布次要版本
   pnpm release:major   → 发布主版本
3. release-it 自动执行：
   - lint + build
   - 更新 package.json 版本
   - git commit + tag
   - npm publish
```

### 11.4 流水线顺序

```
generate:version → lint → clean → rollup → tsc(declaration) → npm publish
```

---

## 十二、关键模式速查

| 模式 | 位置 | 说明 |
|------|------|------|
| Barrel 导出 | `src/index.ts` → `src/core/errors/index.ts` | 每个目录用 index.ts 集中导出 |
| 门面模式 | `src/core/sdk.ts` | 主类封装所有复杂逻辑 |
| 状态机 | `src/core/sdk.ts:24` | 明确的状态枚举 + 转换校验 |
| 事件系统 | `src/core/sdk.ts:70-95` | 轻量 on/off/emit |
| 分级错误码 | `src/core/errors/error-codes.ts` | 2xxx操作/3xxx资源/4xxx鉴权/5xxx配置 |
| SDKError | `src/core/errors/sdk-error.ts` | 标准错误类，携带 code/category/timestamp |
| Promise复用 | `src/core/sdk.ts:100-124` | initPromise 防止重复初始化 |
| 配置校验 | `src/core/sdk.ts:245-275` | 构造函数中快速失败 |
| 优雅降级 | `src/core/sdk.ts:352-398` | 内联优先，外部回退 |
| 版本生成 | `scripts/generate-version.js` | 构建前从 package.json 同步版本 |
| 双格式输出 | `rollup.config.js:42-61` | ESM + UMD 同时输出 |
| 类型声明分离 | `package.json:41` | tsc --emitDeclarationOnly |
| 自定义插件 | `rollup.config.js:9-37` | rawPlugin 内联任意文件为字符串 |
| 独立入口 | `rollup.config.js:83-93` | 非 SDK 入口的独立脚本（AudioWorklet） |
| 全局类型增强 | `src/types/global.d.ts` | 扩展 window 类型 |
| 条件导出 | `package.json:15-27` | exports 字段覆盖所有模块系统 |
| 示例驱动测试 | `examples/` | 完整集成示例代替单元测试 |
