---
title: Nginx 从安装到高可用
date: 2026-05-20
category: devops
sort: 20
description: Nginx 安装、核心配置、反向代理、负载均衡、高可用全面实战
---

# Nginx 从安装到高可用

Nginx 是一款高性能的 HTTP 和反向代理服务器，以事件驱动模型实现高并发（单机数万连接）、低内存占用。核心用途：静态资源服务、反向代理、负载均衡、SSL 终止。

## 一、安装

### 1.1 Mac

```bash
brew install nginx

# 启动与管理
brew services start nginx
brew services stop nginx
brew services restart nginx

# 配置文件位置
# /opt/homebrew/etc/nginx/nginx.conf
```

### 1.2 Linux

```bash
# Debian / Ubuntu
sudo apt update && sudo apt install nginx -y

# CentOS / Rocky / RHEL
sudo yum install epel-release -y && sudo yum install nginx -y

# 通用管理命令
sudo systemctl start nginx
sudo systemctl enable nginx    # 开机自启
sudo systemctl status nginx
```

### 1.3 Windows

Nginx 官方提供 Windows 版本，下载解压即可运行。

```powershell
# 1. 下载 zip 包：https://nginx.org/en/download.html
# 2. 解压到 C:\nginx\
# 3. 命令行启动

cd C:\nginx
start nginx                    # 启动
nginx -s reload                # 热重载
nginx -s stop                  # 快速停止
nginx -s quit                  # 优雅停止
```

> Windows 下 Nginx 以**控制台程序**运行，无后台服务。生产环境建议使用 Linux，Windows 仅适合本地开发调试。

### 1.4 验证安装

```bash
nginx -v                       # 版本号
nginx -t                       # 测试配置文件语法
curl http://localhost           # 访问默认页面
```

## 二、核心配置结构

### 2.1 配置文件层级

`nginx.conf` 从外到内依次嵌套，每层负责不同的功能域：

```nginx
# 顶层：进程运行参数（无大括号包裹）
user nginx;
worker_processes auto;
error_log /var/log/nginx/error.log;

# events 块：连接处理模型
events {
    worker_connections 1024;
}

# http 块：HTTP/HTTPS 协议层（7 层）
http {
    # 可在此定义 upstream、map 等
    # ...

    # server 块：一个虚拟主机 / 站点
    server {
        listen 80;
        server_name example.com;

        # location 块：按 URL 路径匹配处理规则
        location / { }
        location /api/ { }
        location ~ \.(png|css)$ { }
    }

    server { }
}

# stream 块：TCP/UDP 协议层（4 层），与 http 同级
stream {
    server {
        listen 443;
        proxy_pass backend:443;
    }
}
```

每个 `server` 代表一个虚拟主机，通过 `server_name` 区分域名。`location` 按 URL 路径细化处理规则。外层配置自动被内层继承，内层可覆盖。

### 2.2 指令继承规则

外层块的指令会被内层块继承，内层可覆盖。例如 `http` 中设置的 `gzip on` 对所有 `server` 生效，但某个 `server` 可单独 `gzip off` 关闭。

### 2.3 location 匹配规则

| 语法 | 优先级 | 说明 |
|------|--------|------|
| `=` | 最高 | 精确匹配，命中后立即停止 |
| `^~` | 高 | 前缀匹配，命中后不再检查正则 |
| `~` | 中 | 区分大小写的正则匹配 |
| `~*` | 中 | 不区分大小写的正则匹配 |
| (空) | 低 | 普通前缀匹配 |

```nginx
location = /login           { return 200 "精确"; }   # 仅 /login
location ^~ /static/        { return 200 "前缀优先"; } # /static/ 开头，跳过正则
location ~ \.(png|jpg)$     { return 200 "图片正则"; } # 正则优先级低于 ^~
location /                   { return 200 "兜底"; }    # 默认前缀
```

### 2.4 内置变量

| 变量 | 值示例 | 说明 |
|------|--------|------|
| `$host` | `example.com` | 请求中的 Host 头 |
| `$uri` | `/about` | 当前请求路径（不含参数） |
| `$request_uri` | `/about?id=1` | 原始请求 URI（含参数） |
| `$remote_addr` | `192.168.1.1` | 客户端 IP |
| `$scheme` | `http` / `https` | 请求协议 |
| `$args` | `id=1&name=a` | 请求参数（`?` 之后） |

### 2.5 配置文件目录

Nginx 主配置通过 `include` 引入分散的子文件，方便多站点管理：

```
/etc/nginx/
├── nginx.conf                 # 主配置（全局 + events + http + include）
├── mime.types                 # MIME 类型映射
├── conf.d/                    # 通用 server 块，加载 *.conf 结尾的文件
│   └── default.conf
├── sites-available/           # 所有站点配置源文件
│   └── example.com
└── sites-enabled/             # 软链接，加载目录下所有文件（不限后缀）
    └── example.com → ../sites-available/example.com
```

> `sites-enabled/*` 加载目录内所有文件，软链接名称可以任意（通常与源文件同名）。

### 2.6 最简静态站点

一个可以运行的单页面站点配置，包含日志和 SPA 路由回退。

```nginx
server {
    listen 80;
    server_name example.com;

    root /var/www/html;
    index index.html;

    # 日志
    access_log /var/log/nginx/example.access.log;
    error_log  /var/log/nginx/example.error.log;

    location / {
        try_files $uri $uri/ /index.html;  # SPA 路由回退
    }
}
```

### 2.7 全局配置优化

调整 worker 模型、事件驱动和连接数等影响并发能力的关键参数。

```nginx
# /etc/nginx/nginx.conf
user nginx;
worker_processes auto;          # 自动匹配 CPU 核心数
worker_rlimit_nofile 65535;     # 最大文件句柄数

events {
    use epoll;                  # Linux 推荐 epoll
    worker_connections 4096;    # 单 worker 最大并发连接
    multi_accept on;            # 一次接受所有新连接
}

http {
    include       /etc/nginx/mime.types;
    default_type  application/octet-stream;

    # 性能优化
    sendfile       on;
    tcp_nopush     on;
    tcp_nodelay    on;
    keepalive_timeout 65;

    # Gzip 压缩
    gzip on;
    gzip_min_length 1024;
    gzip_types text/plain text/css application/json application/javascript text/xml;

    # 包含站点配置
    include /etc/nginx/conf.d/*.conf;
}
```

## 三、反向代理

反向代理隐藏后端真实地址，统一对外入口，并承担 SSL 终止、缓存、请求改写等功能。

### 3.1 基础反向代理

将客户端请求转发到后端服务，并透传关键请求头使后端能获取客户端真实信息。

```nginx
server {
    listen 80;
    server_name api.example.com;

    location / {
        proxy_pass http://localhost:3000;

        # 透传关键请求头
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 3.2 WebSocket 反向代理

WebSocket 需要升级 HTTP 协议，通过 `Upgrade` 和 `Connection` 头维持长连接。

```nginx
location /ws/ {
    proxy_pass http://backend:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_read_timeout 3600s;     # 长连接不超时
}
```

### 3.3 路径重写

`rewrite` 将请求路径按正则替换后再转发，常用于剥离 API 前缀。

```nginx
# 场景：/api/users → http://backend/users
location /api/ {
    rewrite ^/api/(.*) /$1 break;
    proxy_pass http://backend;
}
```

### 3.4 SSL / HTTPS 配置

Nginx 作为 TLS 终止端，对外提供 HTTPS，内部以 HTTP 转发给 upstream 后端集群。

```nginx
upstream backend_api {
    server 192.168.1.10:3000;
    server 192.168.1.11:3000;
}

server {
    listen 443 ssl http2;
    server_name example.com;

    ssl_certificate     /etc/nginx/ssl/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    location / {
        proxy_pass http://backend_api;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
    }
}

# HTTP → HTTPS 强制跳转
# server 块必须放在 http {} 内（7 层），不能写在顶层
# 80 端口收到任何请求，返回 301 永久重定向到 HTTPS
# 示例：http://example.com/about → https://example.com/about
server {
    listen 80;
    server_name example.com;
    return 301 https://$host$request_uri;
}
```

### 3.5 SSL 透传（4 层代理）

Nginx 不解密 TLS，通过 `stream` 模块将加密流量原样转发给后端集群，由后端自己处理证书。

透传**必须放在 `stream` 块中**。因为 `http` 块工作在 7 层，需要解密 TLS 后才能读取 HTTP 请求内容；不解密时 Nginx 看到的只是一串加密字节，无法做任何 HTTP 层面的处理。

```nginx
# /etc/nginx/nginx.conf
# stream 块与 http 块同级

stream {
    upstream backend_ssl {
        server 192.168.1.10:443;
        server 192.168.1.11:443;
    }

    server {
        listen 443;
        proxy_pass backend_ssl;
        proxy_connect_timeout 10s;
        proxy_timeout 300s;
    }
}
```

如果需要在不解密的情况下根据**域名**分发到不同后端，可以借助 `ssl_preread` 读取 TLS 握手中的 SNI 字段：

```nginx
stream {
    # SNI 读取：不解密，仅提取客户端请求的域名
    map $ssl_preread_server_name $backend_name {
        api.example.com    backend_api;
        web.example.com    backend_web;
        default            backend_default;
    }

    upstream backend_api   { server 192.168.1.10:443; }
    upstream backend_web   { server 192.168.1.11:443; }
    upstream backend_default { server 192.168.1.12:443; }

    server {
        listen 443;

        ssl_preread on;                    # 开启 SNI 预读
        proxy_pass $backend_name;          # 按域名动态选择 upstream

        proxy_connect_timeout 10s;
        proxy_timeout 300s;
    }
}
```

`ssl_preread` 仅在 TLS 握手阶段读取 SNI 域名，**不参与加密解密**，流量仍原样转发。这样既保持端到端加密，又能按域名分流。

#### 终止 vs 透传的关键区别

SSL 终止工作在 7 层（HTTP），Nginx 解密后可以读取请求内容，因此支持按**路径**（如 `/api`、`/images`）分发到不同后端。SSL 透传工作在 4 层（TCP），Nginx 不解密看不到 HTTP 内容，只能按**域名+端口**转发。

```
SSL 终止（7 层）：                         SSL 透传（4 层）：
请求 → Nginx 解密 → 读 URL 路径           请求 → Nginx 不解密 → 原样转发
         ├── /api/*  → backend_api                     └── 只能按端口分发，无法路由路径
         ├── /img/*  → backend_images
         └── /*      → backend_web
```

#### 选择建议

| 需要 | 用 |
|------|-----|
| 按 URL 路径路由（/api、/admin） | SSL 终止 |
| 添加/修改请求头 | SSL 终止 |
| 检查请求内容（WAF、限流） | SSL 终止 |
| 后端自行管理证书 | SSL 透传 |
| 端到端加密（合规要求） | SSL 透传 |
| 非 HTTP 协议（MySQL、Redis TCP 代理） | SSL 透传 |

## 四、负载均衡

Nginx 将请求分发到多个后端节点，提高吞吐和可用性。

### 4.1 upstream 调度算法

| 算法 | 指令 | 说明 |
|------|------|------|
| 轮询（默认） | — | 逐一分配，后端均摊 |
| 加权轮询 | `weight=N` | 权重越高分得越多 |
| IP Hash | `ip_hash` | 同一 IP 始终打到同一节点（会话保持） |
| 最少连接 | `least_conn` | 分配给当前连接数最少的节点 |
| 响应时间优先 | `fair`（第三方） | 分配给响应最快的节点 |

### 4.2 加权轮询 + 健康检查

`weight` 控制分发比例，`max_fails` + `fail_timeout` 实现自动剔除故障节点。

```nginx
upstream backend {
    # 加权轮询（默认算法）
    server 192.168.1.10:3000 weight=3 max_fails=3 fail_timeout=30s;
    server 192.168.1.11:3000 weight=1;
    server 192.168.1.12:3000 backup;    # 仅当其他节点全挂时启用

    # 长连接池
    keepalive 32;
}

server {
    location / {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
    }
}
```

### 4.3 IP Hash（会话保持）

将同一客户端 IP 固定转发到同一后端节点，避免 session 跨节点丢失。

```nginx
upstream backend {
    ip_hash;
    server 192.168.1.10:3000;
    server 192.168.1.11:3000;
}
```

### 4.4 最少连接

Nginx 跟踪每个后端节点的当前活跃连接数，新请求会分配给活跃连接**最少的节点**，使后端负载趋于均衡。配合 `weight` 时，权重视为一个节点的能力系数——连接数除以权重最小的节点优先获得请求。

轮询只看顺序不看负载，若某个请求处理很慢（如文件下载持续数十秒），轮询仍会继续向忙节点分发新请求，导致雪上加霜。最少连接则自动避开忙碌节点。

```nginx
upstream backend {
    least_conn;
    server 192.168.1.10:3000 weight=3;    # 能力强的节点，相同连接数下优先
    server 192.168.1.11:3000 weight=1;
}
```

| 对比 | 轮询 | 最少连接 |
|------|------|---------|
| 分配依据 | 固定顺序 | 当前连接数 |
| 适合场景 | 短请求（API 调用） | 长连接（WebSocket、下载、流媒体） |
| 负载不均时 | 仍需手动 weight 调整 | 自动均衡 |

## 五、高可用（Keepalived + VRRP）

单台 Nginx 宕机会导致全网不可访问。通过 Keepalived 实现**主备热切换**——主 Nginx 持有虚拟 IP（VIP），故障时备机自动接管。

### 5.1 架构拓扑

```
客户端
  │
  ├── 虚拟 IP: 192.168.1.100（始终指向存活节点）
       │
       ├── Nginx-01 (MASTER)  192.168.1.11
       └── Nginx-02 (BACKUP)  192.168.1.12
            │
            └── upstream → 后端应用服务器集群
```

### 5.2 安装 Keepalived

```bash
# Ubuntu / Debian
sudo apt install keepalived -y

# CentOS / Rocky
sudo yum install keepalived -y
```

### 5.3 主节点配置（MASTER）

MASTER 持有虚拟 IP 对外提供服务，Keepalived 通过 VRRP 协议持续广播自己的优先级。

```bash
# /etc/keepalived/keepalived.conf
global_defs {
    router_id nginx-master
}

vrrp_script chk_nginx {
    script "/usr/bin/killall -0 nginx"   # 检测 nginx 进程是否存在
    interval 2                            # 每 2 秒检查一次
    weight -2                             # 失败时优先级减 2
}

vrrp_instance VI_1 {
    state MASTER
    interface eth0                        # 网卡名（ip addr 查看）
    virtual_router_id 51                  # 同一组必须相同（0-255）
    priority 100                          # 优先级，MASTER 需高于 BACKUP
    advert_int 1                          # VRRP 通告间隔（秒）

    authentication {
        auth_type PASS
        auth_pass 123456                  # 同一组密码必须一致
    }

    virtual_ipaddress {
        192.168.1.100/24                  # 虚拟 IP（VIP）
    }

    track_script {
        chk_nginx                         # 关联 nginx 存活检测
    }
}
```

### 5.4 备节点配置（BACKUP）

BACKUP 持续监听 MASTER 的 VRRP 通告，MASTER 失联时自动接管 VIP。

```bash
# /etc/keepalived/keepalived.conf
global_defs {
    router_id nginx-backup
}

vrrp_script chk_nginx {
    script "/usr/bin/killall -0 nginx"
    interval 2
    weight -2
}

vrrp_instance VI_1 {
    state BACKUP
    interface eth0
    virtual_router_id 51                  # 与 MASTER 一致
    priority 90                           # 低于 MASTER
    advert_int 1

    authentication {
        auth_type PASS
        auth_pass 123456
    }

    virtual_ipaddress {
        192.168.1.100/24
    }

    track_script {
        chk_nginx
    }
}
```

### 5.5 启动与验证

```bash
# 两台服务器分别执行
sudo systemctl start keepalived
sudo systemctl enable keepalived

# 查看 VIP 当前绑定在哪个节点
ip addr show eth0 | grep 192.168.1.100

# 模拟故障：停止主节点 nginx
sudo systemctl stop nginx
# VIP 应在 2 秒内漂移至备节点
```

### 5.6 故障切换流程

当主节点 Nginx 异常时，Keepalived 检测到并触发 VIP 漂移，全程客户端无感知。

```
正常运行：VIP 绑定在 MASTER，BACKUP 监听等待
    ↓
MASTER 的 nginx 进程异常退出
    ↓
chk_nginx 检测失败 → MASTER 优先级下降
    ↓
MASTER 释放 VIP，BACKUP 接管 VIP
    ↓
切换完成，客户端无感知（目标 IP 不变）
```

## 六、常用命令速查

| 命令 | 说明 |
|------|------|
| `nginx -t` | 测试配置文件语法 |
| `nginx -s reload` | 热重载配置（不中断连接） |
| `nginx -s stop` | 快速停止 |
| `nginx -s quit` | 优雅停止（等待请求处理完） |
| `nginx -s reopen` | 重新打开日志文件 |
| `nginx -V` | 查看编译参数和版本 |
| `ps aux \| grep nginx` | 查看进程 |
| `tail -f /var/log/nginx/access.log` | 实时查看访问日志 |
| `tail -f /var/log/nginx/error.log` | 实时查看错误日志 |
