---
title: Docker 容器化部署实战
date: 2026-05-12
category: devops
sort: 10
description: 从安装到部署，掌握 Docker 容器化全流程
---

# Docker 容器化部署实战

Docker 通过镜像将应用及其依赖打包为标准化容器，实现"一次构建，处处运行"。核心三要素：**Dockerfile** 定义镜像构建规则，**镜像** 为只读模板，**容器** 为镜像的运行实例。

## 一、安装

### 1.1 Mac

```bash
# 方式一：Homebrew（推荐）
brew install --cask docker

# 方式二：官网下载 Docker Desktop
# https://www.docker.com/products/docker-desktop/

# 安装后启动 Docker Desktop，验证
docker --version
docker run hello-world
```

### 1.2 Windows

```bash
# 启用 WSL 2（前置条件）
# PowerShell 管理员模式：
wsl --install

# 下载 Docker Desktop for Windows
# https://www.docker.com/products/docker-desktop/

# 安装时勾选 "Use WSL 2 instead of Hyper-V"
# 安装后验证
docker --version
docker run hello-world
```

## 二、基础使用

### 2.1 镜像操作

```bash
# 搜索镜像
docker search nginx

# 拉取镜像
docker pull nginx:alpine          # 指定标签
docker pull node:18-alpine

# 查看本地镜像
docker images
docker images | grep nginx

# 删除镜像
docker rmi nginx:alpine
docker image prune -a             # 清理未使用的镜像
```

### 2.2 容器生命周期

```bash
# 运行容器
docker run -d --name web -p 8080:80 nginx:alpine
#          │    │            │          └── 镜像名:标签
#          │    │            └── 端口映射 宿主机:容器
#          │    └── 容器名称
#          └── 后台运行

# 查看容器
docker ps                          # 运行中
docker ps -a                       # 全部（含已停止）

# 启停控制
docker stop web                     # 停止
docker start web                    # 启动
docker restart web                  # 重启
docker rm web                       # 删除（需先停止）
docker rm -f web                    # 强制删除
```

### 2.3 进入容器与日志

```bash
# 进入容器 shell
docker exec -it web sh              # Alpine 用 sh
docker exec -it web bash            # Debian/Ubuntu 用 bash

# 查看日志
docker logs web                     # 全部日志
docker logs -f web                  # 实时跟踪（Ctrl+C 退出）
docker logs --tail 50 web           # 最后 50 行
docker logs --since 10m web         # 最近 10 分钟

# 文件拷贝
docker cp ./index.html web:/usr/share/nginx/html/
docker cp web:/var/log/nginx ./logs/
```

### 2.4 数据卷与挂载

容器是无状态的——删除容器后，其内部写入的所有文件将永久丢失。Docker 提供三种挂载方式将数据持久化到容器外部：

#### 命名卷（Volume）

最推荐的方式。卷由 Docker 完全管理，存放在宿主机的 `/var/lib/docker/volumes/<卷名>/_data/` 下，**无需关心具体路径**，Docker 自动处理读写权限、跨平台兼容。

```bash
# 1. 创建命名卷
docker volume create pgdata
docker volume create redisdata

# 2. 启动容器并挂载卷
#    语法：-v <卷名>:<容器内路径>
#    容器内写入 /var/lib/postgresql/data 的内容会持久化到宿主机卷中
docker run -d \
  --name db \
  -v pgdata:/var/lib/postgresql/data \
  postgres:16-alpine

# 3. 卷的生命周期独立于容器——即使容器被删除，卷和数据依然保留
docker rm -f db          # 删除容器
docker volume ls          # pgdata 卷仍然存在
docker run -d --name db2 -v pgdata:/var/lib/postgresql/data postgres:16  # 新容器继续使用同一份数据

# 4. 卷的管理
docker volume ls                         # 列出所有卷
docker volume inspect pgdata             # 查看卷的宿主机路径、挂载的容器等信息
docker volume rm pgdata                  # 删除卷（需先停止所有使用它的容器）
docker volume prune                      # 批量清理未被任何容器使用的卷
```

#### 绑定挂载（Bind Mount）

将宿主机上的**任意目录或文件**映射到容器内。对宿主机文件的修改立即反映到容器内，反之亦然。适合开发环境实现代码热重载。

```bash
# 语法：-v <宿主机绝对路径>:<容器内路径>[:ro]

# 示例：将当前目录的 src 挂载到容器的 /app/src
#   修改本地 src/index.ts → 容器内 /app/src/index.ts 同步变化
docker run -v $(pwd)/src:/app/src my-app

# Windows PowerShell 下路径写法不同
docker run -v ${PWD}\src:/app/src my-app

# 只读挂载：容器只能读取，无法修改宿主机文件
docker run -v $(pwd)/nginx.conf:/etc/nginx/conf.d/default.conf:ro nginx
```

> **注意**：绑定挂载依赖宿主机的目录结构，换一台机器路径不同就会失效。生产环境应使用命名卷或直接 COPY 进镜像。

#### tmpfs 挂载

数据仅存在于宿主机**内存**中，不写入磁盘。容器停止或重启后数据消失。适合存放临时敏感信息（密钥、Token、会话），避免落盘泄漏。

```bash
# 语法：--tmpfs <容器内路径> 或 --mount type=tmpfs,destination=<路径>

docker run --tmpfs /tmp/tokens my-app

# 限制内存占用大小
docker run --mount type=tmpfs,destination=/tmp/secrets,tmpfs-size=64m my-app
```

#### 三种方式选择指南

| 你要做什么？ | 用哪种 |
|-------------|--------|
| 数据库数据持久化（Postgres / MySQL） | **Volume** |
| 开发时修改代码立即看到效果 | **Bind Mount** |
| 容器间共享数据（前端构建产物 → Nginx） | **Volume**（共享命名卷） |
| 配置文件注入（nginx.conf） | **Bind Mount**（只读 `:ro`） |
| 临时敏感数据（Token、密钥） | **tmpfs** |

| 方式 | 数据位置 | 持久化 | 跨容器共享 | 性能 |
|------|---------|--------|-----------|------|
| Volume | Docker 管理目录 | 是 | 是（同名卷） | 高 |
| Bind Mount | 宿主机自定义路径 | 是 | 否（路径绑定） | 高 |
| tmpfs | 宿主机内存 | 否 | 否 | 极高 |

### 2.5 镜像层与构建缓存

Docker 镜像由多个只读**层**堆叠而成，每条 `RUN`/`COPY`/`ADD` 指令生成一个新层。理解层的机制是写好 Dockerfile 的关键。

#### 层是如何工作的

每个指令产生一层，修改文件时 Docker 只重建变化的层及其之上所有层，未变化的层直接复用缓存。

```
COPY package*.json ./     ← 第 1 层（依赖清单）
RUN npm ci                ← 第 2 层（安装依赖，几百 MB）
COPY src/ ./src/          ← 第 3 层（源码）
RUN npx tsc --outDir dist   ← 第 4 层（编译产物，输出到 dist/）
CMD ["node", "dist/index.js"]  ← 第 5 层（元数据，不占体积）
```

如果你只改了 `src/index.ts`，前两层命中缓存直接复用，仅从第 3 层开始重新执行。反过来，如果把 `COPY . .` 写在前，改一行代码就会导致缓存全部失效，`npm ci` 被迫重跑。

#### 层缓存最佳实践：按变动频率排序

```dockerfile
# ✅ 正确：变动频率越低的越靠前
COPY package*.json tsconfig.json ./   # 依赖清单（很少变）
RUN npm ci                             # 安装依赖（命中缓存秒过）
COPY src/ ./src/                       # 源码（频繁变）
RUN npx tsc --outDir dist                # 编译 → dist/

# ❌ 错误：COPY . . 在前，任何文件改动都使缓存全部失效
COPY . .
RUN npm ci    # 每次都要重新下载，慢！
RUN npx tsc
```

#### 减少层数：用 && 串联 RUN

每个 `RUN` 产生一个层，多层叠加会增加镜像体积。用 `&&` 将相关命令合并为单层：

```dockerfile
# ❌ 3 个 RUN → 产生 3 层，apt 缓存残留在中间层
RUN apt-get update
RUN apt-get install -y curl git
RUN rm -rf /var/lib/apt/lists/*

# ✅ 1 个 RUN → 1 层，安装后立即清理，缓存不留痕
RUN apt-get update && \
    apt-get install -y curl git && \
    rm -rf /var/lib/apt/lists/*
```

#### 查看镜像层

```bash
# 查看构建历史（每层大小、创建时间、执行的指令）
docker history my-app:latest

# 示例输出
# IMAGE          CREATED        CREATED BY                        SIZE
# abc123         2 mins ago     CMD ["node" "dist/index.js"]      0B
# def456         2 mins ago     COPY /app/dist ./dist             150kB
# ghi789         3 mins ago     RUN npm ci --only=production      45MB
# ...

# 查看镜像详细元数据
docker image inspect my-app:latest
```

## 三、Dockerfile 编写

### 3.1 指令速查

| 指令 | 说明 | 示例 |
|------|------|------|
| `FROM` | 基础镜像 | `FROM node:18-alpine` |
| `WORKDIR` | 工作目录 | `WORKDIR /app` |
| `COPY` | 复制文件 | `COPY package*.json ./` |
| `ADD` | 复制 + 自动解压 tar/URL | `ADD https://xxx/file.tar.gz /tmp/` |
| `RUN` | 构建时执行命令 | `RUN npm ci` |
| `ENV` | 环境变量 | `ENV NODE_ENV=production` |
| `ARG` | 构建参数 | `ARG VERSION=latest` |
| `EXPOSE` | 声明端口 | `EXPOSE 3000` |
| `CMD` | 容器启动默认命令 | `CMD ["node", "dist/index.js"]` |
| `ENTRYPOINT` | 容器入口点 | `ENTRYPOINT ["node"]` |

### 3.2 单阶段构建

所有操作在一个 `FROM` 中完成，适合无需编译为 JS 的纯 TS 项目（通过 `tsx` 直接运行 .ts 文件）。

```dockerfile
FROM node:18-alpine

WORKDIR /app

# 先复制依赖清单 → 利用缓存
COPY package*.json tsconfig.json ./
RUN npm ci --only=production

# 复制源码（.ts 文件）
COPY src/ ./src/

EXPOSE 3000

# 使用 tsx 直接运行 TypeScript（无需预编译）
CMD ["npx", "tsx", "src/index.ts"]
```

#### CMD 与 ENTRYPOINT 对比

两者都定义容器启动时执行的命令，但被 `docker run` 尾部参数覆盖的行为完全不同。

**仅用 CMD**：尾部参数会**整体替换** CMD。

```dockerfile
FROM alpine
CMD ["echo", "hello"]
```

```bash
docker run my-image               # 输出: hello
docker run my-image echo world    # 输出: world（CMD 被完全替换）
docker run my-image sh            # 进入 shell（CMD 被替换）
```

**仅用 ENTRYPOINT**：尾部参数会**追加**到 ENTRYPOINT 后面。

```dockerfile
FROM alpine
ENTRYPOINT ["echo"]
```

```bash
docker run my-image               # 输出: （空行，echo 无参数）
docker run my-image hello world   # 输出: hello world（追加到 echo 后）
docker run my-image sh            # 输出: sh（不是进入 shell，而是 echo sh）
```

**CMD + ENTRYPOINT 组合（最常用）**：ENTRYPOINT 定义固定入口，CMD 提供默认参数，`docker run` 尾部参数可覆盖 CMD。

```dockerfile
FROM alpine
ENTRYPOINT ["ping"]
CMD ["-c", "3", "localhost"]
```

```bash
docker run my-image               # ping -c 3 localhost（使用 CMD 默认参数）
docker run my-image baidu.com     # ping baidu.com（CMD 被替换，ENTRYPOINT 不变）
docker run my-image -c 5 baidu.com # ping -c 5 baidu.com
```

**选择指南**：

| 场景 | 用哪个 | 示例 |
|------|--------|------|
| 固定功能、允许参数覆盖 | ENTRYPOINT + CMD | `ping`、`curl` 等工具镜像 |
| 需要让用户自由覆盖命令 | 仅 CMD | 开发容器、通用基础镜像 |
| 不可被用户覆盖的核心入口 | ENTRYPOINT（配 exec 脚本） | 初始化脚本、前置检查 |

> **运行方式选择**：`tsx` 直接执行 `.ts` 无需编译步骤，适合简单服务；编译型项目应使用下面的多阶段构建，先 `tsc` 编译为 `.js` 再运行。

### 3.3 多阶段构建

多阶段构建将"编译依赖"与"运行时"分离，最终镜像仅含编译后的 `.js` 文件。适用于需要 `tsc` 编译或 Vite/Webpack 打包的项目。

#### 问题：单阶段构建会产生什么？

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY . .
RUN npm ci && npm run build    # tsc 编译 + node_modules 数百 MB，src/ 源码也留存
CMD ["node", "dist/index.js"]
```

最终镜像包含 `node_modules`、`src/` 源码、`tsconfig.json` 等无用文件，体积可能超过 1GB。

#### 解决：多阶段分离构建与运行

```dockerfile
# === 阶段 1：编译 ===
FROM node:18-alpine AS build
WORKDIR /app

# 分两步 COPY 而非 COPY . . 的原因：
# 1. 依赖文件（package.json）变动频率远低于源码
# 2. 改一行 .ts 时 COPY package*.json 命中缓存 → npm ci 跳过 → 构建秒过
# 3. COPY . . 会带入 node_modules、.git 等无用文件，且任何改动都使缓存全失效
COPY package*.json tsconfig.json ./
RUN npm ci

COPY src/ ./src/
RUN npx tsc

# === 阶段 2：运行 ===
# 全新干净镜像，仅含编译后的 .js 和生产依赖
FROM node:18-alpine AS run
WORKDIR /app

# 安全：创建非 root 用户
RUN addgroup -g 1001 -S app && \
    adduser -S appuser -u 1001 -G app

# 仅复制运行时依赖和编译产物
COPY --from=build /app/package*.json ./
RUN npm ci --only=production && npm cache clean --force
COPY --from=build /app/dist ./dist

ENV NODE_ENV=production
EXPOSE 3000

USER appuser
CMD ["node", "dist/index.js"]
```

#### 为什么使用非 root 用户

容器默认以 `root` 身份运行——容器内的 `root` 拥有几乎所有能力（修改文件系统、安装软件、监听低端口等）。一旦应用存在漏洞被攻破，攻击者将获得容器内的 root 权限，可能进一步逃逸到宿主机。切换为普通用户后即使被入侵也只能操作有限的 `/app` 目录，无法 `apt install` 恶意工具或修改系统文件，有效缩小攻击面。

与之配合，`--S` 表示创建系统用户（无登录 shell、无主目录），`-u 1001` 固定 UID，确保多环境行为一致。

#### 为什么能节省空间？

Dockerfile 中每个指令（`RUN`、`COPY` 等）会在镜像中产生一个**层**，层层叠加，只增不减——即使后面的 `RUN rm -rf node_modules` 删除文件，这些文件依然残留在中间层，最终镜像体积不会缩小。

而多阶段构建的核心机制是：**每个 `FROM` 开启一个全新的、干净的镜像**。只有通过 `COPY --from=<阶段名>` 显式指定的文件才会传递给下一阶段，其余一切（`node_modules`、`src/` 源码、`tsconfig.json`、甚至整个编译阶段的层历史）全部丢弃。最终镜像仅包含最后一个 `FROM` 的层和你复制过来的文件。

```
单阶段                         多阶段
─────────────────────────      ─────────────────────────
FROM node:18                   FROM node:18 AS build
  (基础层)                       (基础层)
  COPY . .     ← 源码留下        COPY . .
  RUN npm ci   ← node_modules    RUN npm ci    }
  RUN npm build                  RUN npm build } 全部丢弃 ✗
  RUN rm -rf node_modules        ─ ─ ─ ─ ─ ─ ─
  （node_modules 仍在中间层！）  FROM node:18 AS run
                                 COPY --from=build /dist ← 仅取产物 ✓
─────────────────────────      ─────────────────────────
镜像体积：~1.2GB                镜像体积：~150MB
```

#### 效果对比

| 项目 | 单阶段（1 个 FROM） | 多阶段（2 个 FROM） |
|------|---------------------|---------------------|
| 镜像大小 | ~1.2GB | ~150MB |
| 层数 | ~12 层（含编译垃圾层） | ~5 层（仅运行层） |
| 包含 src/ 源码 | 是 | 否 |
| 包含 devDependencies | 是（typescript 等） | 否 |
| 包含 tsconfig.json | 是 | 否 |
| 构建缓存命中 | 低 | 高 |
| 原理 | 层叠加，删除不减小体积 | 新 FROM 抛弃旧阶段全部层 |

### 3.4 .dockerignore

```
node_modules
dist
.env
.git
*.md
Dockerfile
docker-compose.yml
```

## 四、Docker Compose 编写

Docker Compose 通过一个 YAML 文件定义多个服务的运行配置，用一条命令 `docker compose up` 启动整个应用栈。核心概念：

- **services**：每个服务对应一个容器，可指定镜像、端口、卷、环境变量等
- **volumes**：声明命名卷，由 Compose 统一管理生命周期
- **networks**：默认创建独立网络，同一网络内的服务通过**服务名**互访（如 `db:5432`），无需暴露端口

### 4.1 全栈编排示例

下面是一个典型的前后端分离项目：Vite 前端 → Nginx → Node API → Postgres + Redis。

#### 数据库层：Postgres + Redis

```yaml
services:
  db:
    image: postgres:16-alpine
    container_name: app-db
    restart: unless-stopped         # 异常退出或宿主机重启后自动恢复
    environment:                    # 首次启动时创建数据库和用户
      POSTGRES_USER: app
      POSTGRES_PASSWORD: secret
      POSTGRES_DB: appdb
    volumes:
      - pgdata:/var/lib/postgresql/data   # 持久化数据目录
    healthcheck:                    # 供 depends_on 判断就绪状态
      test: ["CMD-SHELL", "pg_isready -U app -d appdb"]
      interval: 10s
      timeout: 5s
      retries: 5

  cache:
    image: redis:7-alpine
    container_name: app-cache
    restart: unless-stopped
    volumes:
      - redisdata:/data
    command: redis-server --appendonly yes  # AOF 持久化
```

#### 业务层：后端 API + 前端构建

```yaml
  api:
    build:                        # 从 Dockerfile 构建，而非拉取现成镜像
      context: ./server
      dockerfile: Dockerfile
    container_name: app-api
    restart: unless-stopped
    environment:                  # 通过服务名互联，无需写死 IP
      DATABASE_URL: "postgresql://app:secret@db:5432/appdb"
      REDIS_URL: "redis://cache:6379"
    depends_on:                   # 控制启动顺序
      db:
        condition: service_healthy   # 等 Postgres 健康检查通过
      cache:
        condition: service_started   # 仅等 Redis 进程启动

  web:
    build:
      context: ./web
      dockerfile: Dockerfile
    container_name: app-web
    restart: unless-stopped
    volumes:
      - web-dist:/app/dist        # 将构建产物写入共享卷，供 Nginx 读取
```

#### 网关层：Nginx 统一入口

```yaml
  nginx:
    image: nginx:alpine
    container_name: app-nginx
    restart: unless-stopped
    ports:
      - "80:80"                              # 宿主机 80 → 容器 80
    volumes:
      - ./nginx.conf:/etc/nginx/conf.d/default.conf:ro   # ① 绑定挂载
      - web-dist:/usr/share/nginx/html:ro     # ② 命名卷，共享自 web 服务
    depends_on:
      - web
      - api

volumes:
  pgdata:
  redisdata:
  web-dist:       # 声明后由 Compose 创建，多个服务可共享
```

> **两种卷写法的区别**：① `./nginx.conf` 是绑定挂载，路径**相对于 docker-compose.yml 所在目录**，Compose 自动解析为绝对路径，适合注入配置文件。② `web-dist` 是命名卷，由 Docker 管理存储位置，在文件底部 `volumes:` 中声明以便多个服务共享（web 服务写入 → Nginx 服务只读读取）。

#### 后端 Dockerfile（Node.js + TypeScript）

```dockerfile
# server/Dockerfile
# === 阶段 1：编译 ===
FROM node:18-alpine AS build
WORKDIR /app

COPY package*.json tsconfig.json ./
RUN npm ci

COPY src/ ./src/
RUN npx tsc

# === 阶段 2：运行 ===
FROM node:18-alpine AS run
WORKDIR /app

RUN addgroup -g 1001 -S app && \
    adduser -S appuser -u 1001 -G app

COPY --from=build /app/package*.json ./
RUN npm ci --only=production && npm cache clean --force
COPY --from=build /app/dist ./dist

ENV NODE_ENV=production
EXPOSE 3000

USER appuser
CMD ["node", "dist/index.js"]
```

#### 前端 Dockerfile（多阶段，Vite 项目）

```dockerfile
# web/Dockerfile
# === 构建阶段 ===
FROM node:18-alpine AS build
WORKDIR /app
COPY package*.json tsconfig.json ./
RUN npm ci
COPY . .
RUN npm run build          # vite build → 产物输出到 dist/

# === 运行阶段：导出静态文件，由 Nginx 挂载 ===
FROM alpine
WORKDIR /app
COPY --from=build /app/dist ./dist
```

#### Nginx 配置（前端 SPA + API 代理）

```nginx
# nginx.conf
server {
    listen 80;
    server_name localhost;

    root /usr/share/nginx/html;
    index index.html;

    # SPA 路由回退：非文件请求 → index.html
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API 反向代理到后端服务（容器名即 host）
    location /api/ {
        proxy_pass http://api:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

#### 服务间数据流向

```
浏览器 :80
  → Nginx  /api/* → proxy_pass → api:3000 → db:5432 / cache:6379
          其他请求  → try_files  → web-dist 卷（前端静态文件）
```

### 4.2 常用 Compose 配置项

`services` 下每个服务支持以下核心配置：

| 配置项 | 类型 | 说明 |
|--------|------|------|
| `image` | string | 直接拉取现成镜像，如 `nginx:alpine` |
| `build` | object | 从 Dockerfile 构建镜像；`context` 为路径，`dockerfile` 指定文件名 |
| `container_name` | string | 容器名称，不指定则自动生成 `项目名-服务名-序号` |
| `restart` | string | 重启策略：`no`（默认）/`always`/`on-failure`/`unless-stopped` |
| `ports` | array | 端口映射，格式 `"宿主机:容器"`，如 `"80:80"` |
| `environment` | object/array | 环境变量；也可用 `env_file: .env` 加载文件 |
| `volumes` | array | 两种形式：① 命名卷 `卷名:容器路径`（需在顶层 `volumes:` 声明）；② 绑定挂载 `./相对路径:容器路径`（相对于 compose 文件目录） |
| `depends_on` | object | 控制启动顺序，可配合 `condition: service_healthy` 等健康检查 |
| `healthcheck` | object | 容器健康检查：`test`（命令）、`interval`（间隔）、`timeout`、`retries` |
| `command` | string/array | 覆盖 Dockerfile 中的 CMD 指令 |
| `networks` | array | 加入指定网络，默认加入 `项目名_default` 网络 |
| `env_file` | string/array | 从 `.env` 文件导入环境变量 |
| `profiles` | array | 按需启动：`docker compose --profile debug up` |

#### restart 四种策略

| 值 | 行为 |
|----|------|
| `no` | 容器退出后不重启（默认） |
| `always` | 任何原因退出都重启，Docker 启动时也会自动拉起 |
| `on-failure` | 仅异常退出时重启（退出码非 0） |
| `unless-stopped` | 除非手动 `docker compose stop`，否则总是重启（推荐） |

#### depends_on 两种条件

| 值 | 含义 |
|----|------|
| `service_started` | 目标服务的**进程已启动**即可（不管是否就绪） |
| `service_healthy` | 目标服务的**健康检查通过**后才启动（需目标服务定义 healthcheck） |

### 4.3 Compose 开发与生产分离

同一项目在不同环境需要不同配置：开发时需要源码挂载热重载、暴露数据库端口调试；生产只需要构建产物和内部网络。

```yaml
# docker-compose.override.yml（开发专用）
# Compose 默认自动合并 docker-compose.yml + docker-compose.override.yml
services:
  api:
    build:
      target: dev
    command: pnpm dev
    volumes:
      - ./server:/app              # 源码挂载，改代码即生效
      - /app/node_modules          # 匿名卷排除宿主机 node_modules

  web:
    build:
      target: dev
    command: pnpm dev --host
    ports:
      - "5173:5173"               # 开发环境暴露 Vite 端口
    volumes:
      - ./web/src:/app/src
      - ./web/tsconfig.json:/app/tsconfig.json:ro
      - /app/node_modules

  db:
    ports:
      - "5432:5432"               # 开发环境暴露端口供 GUI 工具连接
```

```bash
# 自动合并（开发）
docker compose up -d

# 生产部署（跳过 override 文件）
docker compose -f docker-compose.yml up -d

# 多文件合并
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

## 五、常用命令速查

### 5.1 镜像

| 命令 | 说明 |
|------|------|
| `docker images` | 列出本地镜像 |
| `docker pull <镜像>` | 拉取镜像 |
| `docker build -t <名>:<标签> .` | 构建镜像 |
| `docker tag <源> <目标>` | 打标签 |
| `docker push <镜像>` | 推送至仓库 |
| `docker rmi <镜像>` | 删除镜像 |
| `docker image prune -a` | 清理未使用的镜像 |

### 5.2 容器

| 命令 | 说明 |
|------|------|
| `docker run -d -p 80:80 --name web nginx` | 运行容器 |
| `docker ps -a` | 列出所有容器 |
| `docker stop / start / restart <容器>` | 启停 |
| `docker rm -f <容器>` | 强制删除 |
| `docker exec -it <容器> sh` | 进入容器 |
| `docker logs -f <容器>` | 实时日志 |
| `docker inspect <容器>` | 查看容器详情 |
| `docker stats` | 资源占用监控 |

### 5.3 Compose

| 命令 | 说明 |
|------|------|
| `docker compose up -d` | 后台启动所有服务，自动构建未构建的镜像 |
| `docker compose up -d --build` | 强制重新构建再启动 |
| `docker compose down` | 停止并删除容器、网络 |
| `docker compose down -v` | 同时删除所有匿名卷和命名卷 |
| `docker compose ps` | 查看各服务运行状态和端口 |
| `docker compose logs -f` | 实时查看所有服务日志 |
| `docker compose logs -f <服务>` | 只看某个服务的日志 |
| `docker compose exec <服务> sh` | 进入指定服务的容器 |
| `docker compose build` | 仅构建，不启动 |
| `docker compose build --no-cache` | 无缓存重新构建 |
| `docker compose restart <服务>` | 重启单个服务 |
| `docker compose stop / start` | 停止/启动所有服务 |
| `docker compose pull` | 拉取所有服务的镜像更新 |
| `docker compose config` | 验证并查看最终合并后的配置 |

### 5.4 清理

| 命令 | 说明 |
|------|------|
| `docker system prune -a` | 清理所有未使用的镜像/容器/网络 |
| `docker volume prune` | 清理未使用的卷 |
| `docker builder prune` | 清理构建缓存 |
