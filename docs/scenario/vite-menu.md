---
title: 菜单生成插件
date: 2026-05-29
category: scenario
sort: 999
description: 依旧前端路由自动生成后台菜单
---

# 编译时菜单生成

## 一、问题定义

在中后台系统中，菜单配置是一个绕不开的话题。通常我们会维护两套数据：

- **路由配置**供 Vue Router 使用（路径、组件、权限等）
- **菜单配置**供后端菜单管理使用（菜单编码、名称、层级关系、排序等）

两套数据本质上是同一棵树的两种表达，分开维护极易导致不一致：比如改了路由路径却没更新菜单编码，或者路由顺序调整了但菜单排序号没跟上。

## 二、方案概述

它是一个 Vite 插件，在构建阶段解析你的路由文件，自动生成一份结构化的菜单 JSON 文件。

### 2.1 核心流程

1. 读取你指定的 Vue Router 入口文件
2. 用 Babel 将 TypeScript 代码解析为 AST（抽象语法树）
3. 深度遍历路由配置，逐层解析嵌套路由
4. 自动生成层级菜单编码（如 `cms-sp.merchant.account`）
5. 补充菜单名称、排序号、是否启用等字段
6. 输出为拍平的一维菜单数组 JSON

### 2.2 输入规范

```typescript
// src/router/routes.ts
export const asyncRoutes: Route.RecordMainRaw[] = [
  {
    meta: { title: '商户管理', icon: 'shop', menuCode: 'cms-merchant' },
    children: [merchantRoutes, accountRoutes],
  },
  {
    meta: { title: '短视频', icon: 'video', menuCode: 'cms-d-video' },
    children: [dVideoRoutes],
  },
];
```

### 2.3 输出产物

```json
[
  {
    "menuName": "商户管理",
    "menuCode": "cms-merchant",
    "menuRoleType": 1,
    "enabled": true,
    "orderNum": 1,
    "appCode": "cms",
    "meta": { "title": "商户管理", "icon": "shop", "menuCode": "cms-merchant" }
  },
  {
    "menuName": "商户列表",
    "menuCode": "cms-merchant.merchant.list",
    "menuRoleType": 2,
    "enabled": true,
    "orderNum": 1,
    "appCode": "cms",
    "routeName": "merchantList",
    "routePath": "/merchant/list",
    "parentMenuCode": "cms-merchant",
    "component": "merchant/list/index.vue"
  }
]
```

---

## 三、实现拆解

下面从零开始还原这个插件的实现思路。核心依赖只有三个 Babel 包：

```bash
pnpm add @babel/parser @babel/traverse @babel/types
```

---

### 3.1 生命周期注册

一个 Vite 插件就是一个符合 `Plugin` 接口的对象。我们用 `transform` 钩子，它会在每个模块被加载时触发——我们只处理匹配 `entry` 的那个文件，其余模块直接透传。

```typescript
import { Plugin } from 'vite';

export default function createGenerateMenu(options: IGenerateMenuOptions): Plugin {
  return {
    name: 'vite-plugin-menus-generation',
    enforce: 'pre',

    transform(code: string, id: string) {
      // 标准化路径分隔符（Windows 反斜杠 → 正斜杠）
      const normalizedId = id.replace(/\\/g, '/');
      const normalizedEntry = options.entry.replace(/\\/g, '/');

      if (normalizedId !== normalizedEntry) return null;

      // 后续解析逻辑……
      return { code, map: null };
    },
  };
}
```

几个要点：

- 路径标准化兼容了 Windows 开发环境
- `enforce: 'pre'` 确保在其他插件之前执行，拿到原始源码
- `transform` 返回 `null` 表示不处理该模块

---

### 3.2 类型约束

```typescript
export interface IGenerateMenuOptions {
  /** 路由入口文件绝对路径 */
  entry: string;
  /** 输出目录，默认根目录下的 menu 文件夹 */
  outputDir?: string;
  /** 应用编码 */
  appCode: string;
  /** 路由变量名，如 ['asyncRoutes'] */
  menuVariable: string[];
  /** meta 中作为菜单编码的字段名，默认 'menuCode' */
  menuIdentifier?: string;
  /** 输出文件名，默认 'menu'（自动补 .json） */
  filename?: string;
  /** 别名映射，默认 { '@': 'src' } */
  alias?: Record<string, string>;
  /** 筛选特定模块编码 */
  modules?: string[];
}
```

一个路由项目里可能有多组路由（静态路由、异步路由），你需要告诉插件追踪哪一组。

---

### 3.3 词法-语法分析

`@babel/parser` 将 TypeScript 源码解析为 AST：

```typescript
import { parse } from '@babel/parser';

const ast = parse(code, {
  sourceType: 'module',
  plugins: ['typescript', 'topLevelAwait'],
});
```

通用的 **AST 节点值提取函数**，它能根据节点类型递归地还原出运行时的 JavaScript 值：

```typescript
function getNodeValue(node: any, context: Map<string, any>): any {
  if (node.type === 'StringLiteral') return node.value;
  if (node.type === 'NumericLiteral') return node.value;
  if (node.type === 'BooleanLiteral') return node.value;

  if (node.type === 'Identifier') {
    return context.get(node.name);
  }

  if (node.type === 'ObjectExpression') {
    const obj: Record<string, any> = {};
    for (const prop of node.properties) {
      const key = prop.key.name || prop.key.value;
      obj[key] = getNodeValue(prop.value, context);
    }
    return obj;
  }

  if (node.type === 'ArrayExpression') {
    return node.elements.map((el: any) => getNodeValue(el, context));
  }

  // ArrowFunctionExpression → 动态 import 组件路径提取
  if (node.type === 'ArrowFunctionExpression') {
    const body = node.body;
    if (body.type === 'CallExpression' && body.callee.type === 'Import') {
      const importPath = body.arguments[0].value;
      return importPath.replace(/^@\/views\//, '');
    }
  }

  // ... 更多节点类型处理
}
```

### 3.4 符号表构建

在遍历入口文件的 AST 时，我们需要收集两类信息：

**1. Import 映射（模块名 → 文件路径）**

```typescript
import traverse from '@babel/traverse';

const importMap = new Map<string, string>();

traverse(ast, {
  ImportDeclaration(path) {
    const source = path.node.source.value;
    for (const specifier of path.node.specifiers) {
      if (specifier.type === 'ImportDefaultSpecifier') {
        importMap.set(specifier.local.name, source);
      } else if (specifier.type === 'ImportSpecifier') {
        importMap.set(specifier.imported.name, source);
      }
    }
  },
});
```

**2. 目标路由变量声明（匹配 `menuVariable`）**

```typescript
let routesAst: any = null;

traverse(ast, {
  VariableDeclarator(path) {
    const varName = (path.node.id as any).name;
    if (options.menuVariable.includes(varName)) {
      routesAst = path.node.init;         // 拿到初始化的 AST 节点
      path.stop();                         // 找到就停，提升性能
    }
  },
});
```

这样我们就拿到了 `asyncRoutes = [...]` 这个数组表达式的 AST，可以从中提取出完整的路由对象列表。

---

### 3.5 跨模块追踪

路由文件的常见模式是：顶层路由定义结构，`children` 引用其他文件中导出的路由数组。我们需要能**跨文件追踪**这些引用。

```typescript
function readModuleFile(
  modulePath: string, 
  baseDir: string, 
  rootRoutes: string[], 
  alias: Record<string, string>)
{
  // 步骤1：解析模块路径为绝对路径
  const keys = Object.keys(alias);
  const key = keys.find(key => modulePath.startsWith(key));
  const transformPath = key ? modulePath.replace(key, alias[key]) : modulePath;

  const modulePathNew = transformPath.startsWith('/') ? transformPath.slice(1) : transformPath;
  const absolutePath = modulePathNew.startsWith('.')
    ? path.resolve(baseDir, `${modulePathNew}.ts`)
    : path.resolve(process.cwd(), `${modulePathNew}.ts`);

  /**
   * 步骤2：读取文件内容并解析为AST
   * 使用Babel解析器将TypeScript代码解析为抽象语法树
   */
  const fileContent = fs.readFileSync(absolutePath, 'utf-8');
  const ast = parse(fileContent, { sourceType: 'module', plugins: ['typescript'] });

  /**
   * 步骤3：初始化数据结构
   * exportedValues: 存储所有导出的路由值
   * replacements: 存储变量名到其值的映射，用于解析变量引用
   */
  const exportedValues: any[] = [];
  const replacements: Record<string, string> = {};

  /**
   * 步骤4：遍历AST，提取路由信息
   */
  traverse(ast, {
    /**
     * 处理命名导出声明
     * 导出格式如：export const broadcastRoutes = [...]
     * 这种导出方式通常用于定义根路由下的子路由模块
     */
    ExportNamedDeclaration(path: NodePath<t.ExportNamedDeclaration>)
    {
      // 获取导出声明中的变量声明部分
      const declaration = path.node.declaration as t.VariableDeclaration;
      if (declaration && declaration.declarations)
      {
        // 遍历所有声明的变量
        declaration.declarations.forEach((decl) =>
        {
          // 获取变量名
          const rootRouteName = (decl.id as t.Identifier).name;
          // 获取变量的实际值
          const value = getNodeValue(decl.init!, replacements);

          // 只处理在rootRoutes数组中指定的路由模块
          if (rootRoutes?.length && rootRoutes.includes(rootRouteName))
          {
            const isExits = exportedValues.find(item => item?.name === value.name);
            if (!isExits)
            {
              exportedValues.push(value);
            }
          }
        });
      }
    },

    /**
     * 处理默认导出声明
     * 导出格式如：export default [...] 或 export default routes
     * 这种导出方式通常用于导出主路由配置
     */
    ExportDefaultDeclaration(path: NodePath<t.ExportDefaultDeclaration>)
    {
      const declaration = path.node.declaration;
      // 1.从上下文中找出标识符对应的内容
      // 2.其他表达式（如数组、对象等）直接获取其值
      const value = declaration.type === 'Identifier'
        ? replacements[declaration.name]
        : getNodeValue(declaration, replacements);

      const isExit = exportedValues.find(item => item?.name === value.name);
      if (!isExit)
      {
        exportedValues.push(value);
      }
    },

    /**
     * 处理变量声明
     * 导出格式如：const routes = [...]，然后在默认导出中使用children: routes
     * 这种情况下，需要先收集变量的值，以便在解析导出时使用
     * replacements对象用于存储变量名到其值的映射
     */
    VariableDeclaration(path: NodePath<t.VariableDeclaration>)
    {
      path.node.declarations.forEach((declaration) =>
      {
        // 获取变量名
        const varName = (declaration.id as t.Identifier).name;
        // 将变量名映射到其实际值（递归解析变量引用）
        replacements[varName] = getNodeValue(declaration.init!, replacements);
      });
    }
  });

  // 返回所有导出的路由值
  return exportedValues;
}
```

**执行顺序很关键**：先扫描所有 `VariableDeclarator` 建立当前模块的变量上下文，再处理导出声明。这样 `getNodeValue` 在遇到 `Identifier` 时才能从 context 中找到对应值。

---

### 3.6 语义增强

拿到完整的路由树后，我们需要递归地为每个节点添加菜单属性：

```typescript
function addCustomProperties(
  route: any,
  index: number,
  parentMenuCode: string,
  depth: number,
  appCode: string
): any {
  const pathSegment = route.path?.replace(/^\//, '') || '';

  // 层级菜单编码：父级编码 + '.' + 路径段（斜杠替换为点）
  const menuCode = depth === 0
    ? route.meta?.menuCode                      // 根节点直接用配置值
    : `${parentMenuCode}.${pathSegment.replace(/\//g, '.')}`;

  return {
    ...route,
    menuName: typeof route.meta?.title === 'function'
      ? route.meta.title()
      : route.meta?.title || '',
    menuCode,
    menuRoleType: route.children?.length ? 1 : 2,   // 1=目录 2=叶子
    enabled: true,
    orderNum: index + 1,
    appCode,
    ...(depth === 0 ? {} : {                       // 根节点不加路由字段
      routeName: route.name || '',
      routePath: route.path?.startsWith('/')
        ? route.path
        : `/${route.path}`,
      parentMenuCode: parentMenuCode || undefined,
    }),
    component: route.component || undefined,
    children: route.children?.map((child: any, i: number) =>
      addCustomProperties(child, i, menuCode, depth + 1, appCode)
    ),
  };
}
```

**编码规则**：

| 层级 | menuCode 示例 |
|------|--------------|
| 根节点 | `cms-merchant`（直接取 meta 中的值） |
| 二级 | `cms-merchant.account` |
| 三级 | `cms-merchant.account.detail` |

路径中的 `/` 统一替换为 `.`，确保编码格式统一、可读、适合后端存储。

---

### 3.7 序列化输出

最后把增强后的树形菜单拍平为一维数组：

```typescript
function getMenuList(routes: any[]): any[] {
  const result: any[] = [];
  for (const route of routes) {
    const { children, ...rest } = route;
    result.push(rest);
    if (children?.length) {
      result.push(...getMenuList(children));
    }
  }
  return result;
}
```

配合 `modules` 筛选：

```typescript
let finalList = getMenuList(enhancedRoutes);

if (options.modules?.length) {
  finalList = finalList.filter((item) =>
    options.modules!.some((mod) => item.menuCode.startsWith(mod))
  );
}
```

写入文件：

```typescript
const outputDir = options.outputDir || path.resolve(process.cwd(), 'menu');
fs.mkdirSync(outputDir, { recursive: true });
const filename = options.filename || 'menu';
fs.writeFileSync(
  path.resolve(outputDir, `${filename}.json`),
  JSON.stringify(finalList, null, 2),
  'utf-8'
);
```

---

### 3.8 产物工程化

使用 Rollup 打包为 ESM + CJS 双格式，TypeScript 声明文件单独输出：

```javascript
// rollup.config.cjs
module.exports = defineConfig({
  input: 'src/index.ts',
  output: [
    { file: 'dist/index.js', format: 'es' },
    { file: 'dist/index.cjs', format: 'cjs' },
  ],
  external: ['fs', 'path', 'vue', '@babel/parser', '@babel/traverse'],
  plugins: [terser(), typescript({ tsconfig: './tsconfig.json' })],
});
```

核心依赖全部 external 化，不打入 bundle，由使用方自行安装。

---

## 四、接入指南

```bash
pnpm add @zeewain/vite-plugin-menus-generation -D
```

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import createGenerateMenu from '@zeewain/vite-plugin-menus-generation';

export default defineConfig({
  plugins: [
    createGenerateMenu({
      entry: path.resolve(__dirname, 'src/router/routes.ts'),
      appCode: 'cms',
      menuVariable: ['asyncRoutes'],
    }),
  ],
});
```

每次 `vite build` 或 `vite dev`（首次加载路由文件时），`menu/menu.json` 就会自动生成或更新。

---

## 五、边界分析

### 5.1 最佳适用

- 前后端协作：前端定义路由，后端通过生成的 JSON 构建菜单数据库
- 多应用统一：不同子应用各自生成菜单，通过 `appCode` 区分
- 菜单与路由强绑定的中后台项目

### 5.2 已知约束

- 约定强：要求路由 `meta` 中必须有标识字段，children 的拆分方式需遵循特定模式
- 静态解析：只在构建/热更新时执行，无法处理运行时动态路由
- 依赖 Babel AST：对极端复杂的表达式（如三元、模板字符串拼接）解析能力有限

---

## 六、总结

这个插件的核心思想是：**用编译器思维解决运行时的重复性配置问题**。通过 Babel 的 AST 解析能力，在构建阶段就把路由信息提取、重组、增强为菜单配置。

关键模块拆解下来就是三步：

1. **解析**：用 `@babel/parser` 把 TS 源码变成 AST
2. **遍历**：用 `@babel/traverse` 按需提取节点 + 跨文件追踪
3. **生成**：递归加属性、拍平、写文件
