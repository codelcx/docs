---
title: Spring Security 认证与授权
date: 2026-05-25
category: backend
sort: 888
description: Spring Security 认证流程、授权注解与过滤器链详解
---

# Spring Security 认证与授权

Spring Security 基于过滤器链实现认证（你是谁）和授权（你能做什么），核心组件：`SecurityFilterChain`（过滤器链）、`AuthenticationManager`（认证管理器）、`SecurityContext`（安全上下文）。

## 一、认证流程

### 1.1 核心流程

```
请求 → SecurityFilterChain 过滤器链
        ├── UsernamePasswordAuthenticationFilter（提取用户名/密码）
        │       └── AuthenticationManager
        │               └── ProviderManager
        │                       └── DaoAuthenticationProvider
        │                               ├── UserDetailsService.loadUserByUsername()
        │                               └── PasswordEncoder.matches()
        │       └── 认证成功 → SecurityContextHolder 存入 Authentication
        └── 后续过滤器根据 SecurityContext 判断权限
```

### 1.2 依赖与基础配置

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-security</artifactId>
</dependency>
```

```java
@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/login", "/public/**").permitAll()
                .requestMatchers("/admin/**").hasRole("ADMIN")
                .anyRequest().authenticated()
            )
            .formLogin(form -> form
                .loginPage("/login")
                .defaultSuccessUrl("/dashboard")
                .permitAll()
            )
            .logout(logout -> logout
                .logoutUrl("/logout")
                .logoutSuccessUrl("/login")
            );
        return http.build();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();     // 推荐 BCrypt
    }
}
```

### 1.3 UserDetailsService

实现 `UserDetailsService` 接口从数据库加载用户信息：

```java
@Service
public class CustomUserDetailsService implements UserDetailsService {

    @Override
    public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {
        User user = userMapper.findByUsername(username);
        if (user == null) {
            throw new UsernameNotFoundException("用户不存在");
        }
        return org.springframework.security.core.userdetails.User
            .withUsername(user.getUsername())
            .password(user.getPassword())      // 数据库中的 BCrypt 密文
            .roles(user.getRoles().toArray(new String[0]))
            .build();
    }
}
```

## 二、授权注解

### 2.1 方法级注解

启用方法级安全：

```java
@Configuration
@EnableMethodSecurity              // 替代 @EnableGlobalMethodSecurity
public class SecurityConfig { }
```

#### @PreAuthorize

方法执行前校验权限，支持 SpEL 表达式：

```java
@RestController
@RequestMapping("/users")
public class UserController {

    @PreAuthorize("hasRole('ADMIN')")
    @GetMapping
    public List<User> list() {
        return userService.findAll();
    }

    @PreAuthorize("hasRole('ADMIN') or #id == authentication.principal.id")
    @GetMapping("/{id}")
    public User getById(@PathVariable Long id) {
        return userService.findById(id);       // 管理员或本人可查
    }

    @PreAuthorize("hasAuthority('user:delete')")
    @DeleteMapping("/{id}")
    public void delete(@PathVariable Long id) {
        userService.delete(id);
    }
}
```

#### @PostAuthorize

方法执行后校验返回值：

```java
@PostAuthorize("returnObject.owner == authentication.principal.username")
@GetMapping("/docs/{id}")
public Document getDocument(@PathVariable Long id) {
    return documentService.findById(id);
}
```

#### @PreFilter / @PostFilter

过滤集合参数或返回值：

```java
@PreFilter("filterObject.owner == authentication.principal.username")
@PostMapping("/batch")
public void createBatch(@RequestBody List<Task> tasks) {
    // 过滤掉不属于当前用户的 task
}

@PostFilter("filterObject.public == true")
@GetMapping("/articles")
public List<Article> listArticles() {
    return articleService.findAll();   // 仅返回公开文章
}
```

### 2.2 注解速查

| 注解 | 时机 | 作用 |
|------|------|------|
| `@PreAuthorize` | 方法执行前 | 最常用，SpEL 表达式校验 |
| `@PostAuthorize` | 方法执行后 | 校验返回值（访问返回对象的属性） |
| `@PreFilter` | 方法执行前 | 过滤集合入参 |
| `@PostFilter` | 方法执行后 | 过滤返回值集合 |
| `@Secured` | 方法执行前 | 仅支持 `ROLE_xxx`，无 SpEL |
| `@RolesAllowed` | 方法执行前 | JSR-250 标准，仅角色校验 |

## 三、过滤器链

### 3.1 核心过滤器（按执行顺序）

| 过滤器 | 作用 |
|--------|------|
| `SecurityContextPersistenceFilter` | 请求前从 Session 恢复 SecurityContext，响应后清除（避免内存泄漏） |
| `CsrfFilter` | 校验 CSRF Token，防止跨站请求伪造 |
| `UsernamePasswordAuthenticationFilter` | 处理表单登录，提取用户名/密码并调用认证 |
| `BasicAuthenticationFilter` | 处理 HTTP Basic 认证（请求头 `Authorization: Basic xxx`） |
| `ExceptionTranslationFilter` | 捕获认证/授权异常，跳转登录页或返回 403 |
| `FilterSecurityInterceptor` | 最后一道防线，根据配置校验当前请求是否有权限访问 |

### 3.2 自定义过滤器

自定义过滤器需继承 `OncePerRequestFilter` 并在配置中通过 `addFilterBefore` 等方注册。完整 JWT 过滤器实现与 SecurityConfig 见 [JWT 认证](#六jwt-认证)。

### 3.3 过滤器添加策略

| 方法 | 位置 |
|------|------|
| `addFilterBefore(filter, Target.class)` | 在指定过滤器之前 |
| `addFilterAfter(filter, Target.class)` | 在指定过滤器之后 |
| `addFilterAt(filter, Target.class)` | 与指定过滤器同位置（覆盖） |

### 3.4 异常处理

```java
@Component
public class JwtAuthEntryPoint implements AuthenticationEntryPoint {

    @Override
    public void commence(HttpServletRequest request,
                         HttpServletResponse response,
                         AuthenticationException authException)
            throws IOException {
        response.setContentType("application/json;charset=UTF-8");
        response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        response.getWriter().write("{\"code\":401,\"message\":\"未登录或Token已过期\"}");
    }
}

@Component
public class AccessDeniedHandlerImpl implements AccessDeniedHandler {

    @Override
    public void handle(HttpServletRequest request,
                       HttpServletResponse response,
                       AccessDeniedException e)
            throws IOException {
        response.setContentType("application/json;charset=UTF-8");
        response.setStatus(HttpServletResponse.SC_FORBIDDEN);
        response.getWriter().write("{\"code\":403,\"message\":\"权限不足\"}");
    }
}
```

配置中接入：

```java
http
    .exceptionHandling(ex -> ex
        .authenticationEntryPoint(jwtAuthEntryPoint)      // 401 未登录
        .accessDeniedHandler(accessDeniedHandler)          // 403 无权限
    );
```

## 四、SecurityContext 获取当前用户

### 4.1 SecurityContextHolder 获取

任何层（Controller、Service、Utils）都可直接获取当前认证信息：

```java
Authentication auth = SecurityContextHolder.getContext().getAuthentication();
String username = auth.getName();

boolean isAdmin = auth.getAuthorities().stream()
    .anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN"));
```

### 4.2 @AuthenticationPrincipal 注入

Controller 方法参数上直接注入 `UserDetails`：

```java
@GetMapping("/me")
public String me(@AuthenticationPrincipal UserDetails user) {
    return user.getUsername();
}
```

### 4.3 自定义 @CurrentUser 注解

`@AuthenticationPrincipal` 只能拿到 `UserDetails`，自定义注解配合参数解析器可直接注入 `User` 实体、`userId` 等任意类型。

#### 注解定义

```java
@Target(ElementType.PARAMETER)
@Retention(RetentionPolicy.RUNTIME)
@AuthenticationPrincipal(expression = "#this == 'anonymousUser' ? null : #this")
public @interface CurrentUser { }
```

#### 参数解析器

```java
@Component
public class CurrentUserArgumentResolver implements HandlerMethodArgumentResolver {

    @Override
    public boolean supportsParameter(MethodParameter parameter) {
        return parameter.hasParameterAnnotation(CurrentUser.class);
    }

    @Override
    public Object resolveArgument(MethodParameter parameter,
                                  ModelAndViewContainer mavContainer,
                                  NativeWebRequest webRequest,
                                  WebDataBinderFactory binderFactory) {

        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated()) {
            return null;
        }

        // 根据参数类型返回不同值
        Class<?> paramType = parameter.getParameterType();
        if (paramType == Long.class) {
            UserDetails user = (UserDetails) auth.getPrincipal();
            return Long.valueOf(user.getUsername());   // 返回 userId
        }
        if (paramType == String.class) {
            return auth.getName();                     // 返回 username
        }
        // 查询完整 User 实体返回
        UserDetails user = (UserDetails) auth.getPrincipal();
        return userService.findByUsername(user.getUsername());
    }
}
```

#### 注册到 Spring MVC

```java
@Configuration
public class WebMvcConfig implements WebMvcConfigurer {

    @Autowired
    private CurrentUserArgumentResolver currentUserResolver;

    @Override
    public void addArgumentResolvers(List<HandlerMethodArgumentResolver> resolvers) {
        resolvers.add(currentUserResolver);
    }
}
```

#### Controller 中使用

```java
@RestController
public class ProfileController {

    @GetMapping("/profile")
    public User profile(@CurrentUser User user) {       // 直接拿到 User 实体
        return user;
    }

    @GetMapping("/my-id")
    public Long myId(@CurrentUser Long userId) {        // 直接拿到用户 ID
        return userId;
    }

    @GetMapping("/my-articles")
    public List<Article> articles(@CurrentUser String username) {  // 拿到用户名
        return articleService.findByAuthor(username);
    }
}
```

## 五、会话管理

Spring Security **默认使用 Session** 保存认证信息——登录成功后，服务器生成 `JSESSIONID` Cookie 返回给浏览器，后续请求携带该 Cookie 即可恢复登录态。无需任何额外配置即可工作。

### 5.1 登录 → Session 创建全流程

```java
// POST /login  请求体：username=admin&password=123456
@RestController
public class AuthController {

    @PostMapping("/login")
    public Result<String> login(@RequestParam String username,
                                @RequestParam String password,
                                HttpSession session) {

        // 1. 手动触发认证
        UsernamePasswordAuthenticationToken token =
            new UsernamePasswordAuthenticationToken(username, password);
        Authentication auth = authenticationManager.authenticate(token);

        // 2. 存入 SecurityContext（当前请求后续可见）
        SecurityContextHolder.getContext().setAuthentication(auth);

        // 3. 写入 HttpSession（跨请求持久化）
        session.setAttribute("SPRING_SECURITY_CONTEXT", SecurityContextHolder.getContext());

        return Result.success("登录成功");
    }
}
```

```
浏览器请求流程：
  POST /login                                    → 认证成功 → 响应 Set-Cookie: JSESSIONID=abc123
  GET  /users (自动携带 Cookie: JSESSIONID=abc123) → SecurityContextPersistenceFilter 从 Session 恢复认证 → 已登录
```

### 5.2 SecurityConfig 中配置 Session

完整的 `SecurityConfig` 类展示了 `sessionManagement` 放在哪里：

```java
@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/login", "/public/**").permitAll()
                .anyRequest().authenticated()
            )
            .formLogin(form -> form
                .loginPage("/login")
                .defaultSuccessUrl("/dashboard")
            )
            // ↓ 会话管理配置
            .sessionManagement(session -> session
                .sessionCreationPolicy(SessionCreationPolicy.IF_REQUIRED)  // 默认：需要时创建
                .maximumSessions(1)                    // 同账号最大登录数
                .maxSessionsPreventsLogin(false)       // 后登录踢掉先登录
                .expiredUrl("/login?expired")          // 被踢后跳转
            )
            .logout(logout -> logout
                .logoutUrl("/logout")
                .logoutSuccessUrl("/login")
                .invalidateHttpSession(true)           // 登出时清除 Session
                .deleteCookies("JSESSIONID")
            );
        return http.build();
    }
}
```

`filterChain` 方法被 `@Bean` 标注，Spring 自动将返回的 `SecurityFilterChain` 注册到过滤器链。`HttpSecurity` 参数由 Spring 自动注入。`logout()` 是内置功能，配置后框架**自动创建** `/logout` 端点（清除 Session → 删除 Cookie → 跳转），无需手动写 Controller。

### 5.3 Session 创建策略

| 策略 | 说明 |
|------|------|
| `ALWAYS` | 每次请求都创建 Session（即使未登录） |
| `IF_REQUIRED` | 需要时才创建（默认，认证成功后创建） |
| `NEVER` | 不创建 Session，但已存在的继续使用 |
| `STATELESS` | 完全无状态，不创建不读取 Session（JWT 必选） |

> 使用 JWT 时必须设为 `STATELESS`，否则 `SecurityContextPersistenceFilter` 每次从 Session 恢复时找不到认证信息。

### 5.4 并发会话控制

```java
.sessionManagement(session -> session
    .maximumSessions(1)                       // 同一账号最多 1 个 Session
    .maxSessionsPreventsLogin(false)          // false: 后登录踢掉先登录
                                               // true:  先登录阻止后登录
    .expiredUrl("/login?expired")             // 被踢后跳转
);
```

### 5.5 自定义登出

```java
.logout(logout -> logout
    .logoutUrl("/logout")
    .logoutSuccessUrl("/login?logout")
    .invalidateHttpSession(true)             // 清除 Session
    .clearAuthentication(true)               // 清除认证信息
    .deleteCookies("JSESSIONID")             // 删除 Cookie
);
```

### 5.6 Redis 共享 Session

多服务器实例部署时，负载均衡可能将同一用户的请求分发到不同服务器，若 Session 仅存储在单机内存中，用户会频繁掉线。解决方案是将 Session 统一存储在**外部 Redis** 中，所有服务器共享读写。

```
客户端 → Nginx → 服务器 A         客户端 → Nginx → 服务器 B
                    │                                 │
                    └───────── Redis ─────────────────┘
                           (Session 存储)
```

#### 单机 Redis

```xml
<dependency>
    <groupId>org.springframework.session</groupId>
    <artifactId>spring-session-data-redis</artifactId>
</dependency>
```

```yaml
spring:
  session:
    store-type: redis
    timeout: 30m
  redis:
    host: redis-server
    port: 6379
    password: ${REDIS_PASSWORD}
```

配置后无需修改任何代码，所有服务器从同一 Redis 读写 Session，用户无感知。

#### Redis 哨兵（高可用）

哨兵模式引入独立进程监控主从，主节点宕机时自动选举从节点升级为新主：

```
          ┌──────────────────────┐
          │    3 个 Sentinel      │
          │  (sentinel1 ~ 3)     │
          │  监听 + 投票 + 选举    │
          └──────────┬───────────┘
                     │
              ┌──────┴──────┐
              ▼              ▼
         Master (6379)    Slave (6380)
           读写             只读副本
              │              ↑ 故障转移
              └──→ 宕机 → Slave 升级为 Master
```

```yaml
spring:
  redis:
    sentinel:
      master: mymaster                          # 哨兵监控的主节点名
      nodes:
        - sentinel1:26379
        - sentinel2:26379
        - sentinel3:26379
      password: ${SENTINEL_PASSWORD}
```

#### Redis 集群（分片存储）

集群模式将数据按 slot 分布到多个节点，每个节点负责部分数据，突破单机内存和吞吐上限：

```
              应用服务器
                  │
          ┌───────┴───────┐
          │  Redis Cluster  │
          └───────┬───────┘
                  │
    ┌──────┬──────┼──────┬──────┐
    ▼      ▼      ▼      ▼      ▼
  Node 1 Node 2 Node 3 Node 4  ...
  ┌────┐ ┌────┐ ┌────┐ ┌────┐
  │主  │ │主  │ │主  │ │主  │
  │从  │ │从  │ │从  │ │从  │
  └────┘ └────┘ └────┘ └────┘
  slot    slot   slot   slot
  0-      5461-  10923- ...
  5460    10922  16383
```

每个主节点有对应的从节点副本，主节点故障时从节点自动升级。数据按 `CRC16(key) % 16384` 分配 slot，水平扩展只需增加节点。

```yaml
spring:
  redis:
    cluster:
      nodes:
        - node1:6379
        - node2:6379
        - node3:6379
      max-redirects: 3                            # 最大重定向次数
```

对 Spring Session **透明**，底层 Lettuce 自动处理槽位路由和故障转移。JWT 无需 Session 可跳过。

## 六、JWT 认证

JWT（JSON Web Token）是无状态认证方案。登录后服务端签发 Token，客户端每次请求携带 `Authorization: Bearer <token>`，服务端验证签名即可恢复用户信息，**不需要 Session**。

### 6.1 依赖

JJWT（Java JWT）是 Java 生态最主流的 JWT 库，三个 jar 各司其职：

```xml
<dependency>
    <groupId>io.jsonwebtoken</groupId>
    <artifactId>jjwt-api</artifactId>          <!-- API 接口 → 编译期使用 -->
    <version>0.12.6</version>
</dependency>
<dependency>
    <groupId>io.jsonwebtoken</groupId>
    <artifactId>jjwt-impl</artifactId>         <!-- 实现代码 → 运行时加载 -->
    <version>0.12.6</version>
    <scope>runtime</scope>
</dependency>
<dependency>
    <groupId>io.jsonwebtoken</groupId>
    <artifactId>jjwt-jackson</artifactId>       <!-- JSON 序列化（可选 gson） -->
    <version>0.12.6</version>
    <scope>runtime</scope>
</dependency>
```

### 6.2 JWT 工具类

封装 Token 的生成、解析和校验三个核心操作。密钥需使用 Base64 编码的字符串，生产环境建议 256 位以上并通过**环境变量**注入，禁止硬编码。

```java
@Component
public class JwtUtil {
    @Value("${jwt.secret}")
    private String secret;                       // HMAC-SHA 密钥（Base64）

    @Value("${jwt.expiration}")
    private long expiration;                     // Token 有效期（毫秒）

    private SecretKey getKey() {
        return Keys.hmacShaKeyFor(Decoders.BASE64.decode(secret));
    }

    // 签发 Token，负载中包含 username 和过期时间
    public String generateToken(String username) {
        return Jwts.builder()
            .subject(username)
            .issuedAt(new Date())
            .expiration(new Date(System.currentTimeMillis() + expiration))
            .signWith(getKey())
            .compact();
    }

    // 解析 Token 并提取 username，签名不正确或过期会抛出异常
    public String extractUsername(String token) {
        return Jwts.parser()
            .verifyWith(getKey())
            .build()
            .parseSignedClaims(token)
            .getPayload()
            .getSubject();
    }

    // 校验 Token 签名是否有效（是否被篡改、是否过期）
    public boolean validateToken(String token) {
        try {
            Jwts.parser().verifyWith(getKey()).build().parseSignedClaims(token);
            return true;
        } catch (JwtException | IllegalArgumentException e) {
            return false;                        // 签名错误、过期、格式不对
        }
    }
}
```

```yaml
# application.yml
jwt:
  secret: ${JWT_SECRET}                         # 生产环境通过环境变量注入
  expiration: 86400000                           # 24 小时
```

### 6.3 登录接口

与 Session 模式最大的区别：认证成功后不创建 Session，而是签发 Token 返回给客户端，由客户端自行存储并在后续请求中携带。

```java
@RestController
public class AuthController {
    @Resource
    private AuthenticationManager authenticationManager;
    @Resource
    private JwtUtil jwtUtil;

    @PostMapping("/login")
    public Result<Map<String, String>> login(@RequestBody LoginDTO dto) {
        // 1. 调用 AuthenticationManager 校验用户名密码
        Authentication auth = authenticationManager.authenticate(
            new UsernamePasswordAuthenticationToken(dto.getUsername(), dto.getPassword())
        );
        // 2. 签发 JWT（不创建 HttpSession）
        String token = jwtUtil.generateToken(auth.getName());
        // 3. 返回 Token 给前端
        return Result.success(Map.of("token", token));
    }
}
```

前端收到 Token 后存入 `localStorage` 或 `sessionStorage`，每次请求在请求头中追加：

```http
GET /api/users HTTP/1.1
Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJhZG1pbiJ9.xxx
```

**登出**：JWT 无状态，服务端不存储任何信息，登出只需客户端删除 Token 即可。如需服务端主动使 Token 失效（如管理员强制下线），可将失效 Token 写入 Redis 黑名单，在 `JwtAuthFilter` 中额外判断。

### 6.4 JWT 过滤器

每个请求到达时从请求头提取 Token，验证通过后恢复认证信息到 `SecurityContext`。继承 `OncePerRequestFilter` 确保同一请求只执行一次。

```java
@Component
public class JwtAuthFilter extends OncePerRequestFilter {
    @Resource
    private JwtUtil jwtUtil;
    @Resource
    private UserDetailsService userDetailsService;

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain chain)
            throws ServletException, IOException {

        // 1. 从 Authorization 头提取 Token
        String token = extractToken(request);
        if (token == null || !jwtUtil.validateToken(token)) {
            chain.doFilter(request, response);   // 无 Token 放行，由后续过滤器（401）处理
            return;
        }

        // 2. 从 Token 解析用户名
        String username = jwtUtil.extractUsername(token);
        if (username != null && SecurityContextHolder.getContext().getAuthentication() == null) {
            // 3. 加载用户信息（每次请求查库，可加缓存优化）
            UserDetails user = userDetailsService.loadUserByUsername(username);
            // 4. 存入 SecurityContext → 后续 Controller 通过 @CurrentUser 可获取
            UsernamePasswordAuthenticationToken auth =
                new UsernamePasswordAuthenticationToken(user, null, user.getAuthorities());
            SecurityContextHolder.getContext().setAuthentication(auth);
        }
        chain.doFilter(request, response);
    }

    private String extractToken(HttpServletRequest request) {
        String header = request.getHeader("Authorization");
        if (header != null && header.startsWith("Bearer ")) {
            return header.substring(7);          // 去掉 "Bearer " 前缀
        }
        return null;
    }
}
```

### 6.5 SecurityConfig

与 Session 模式的关键区别：`sessionCreationPolicy(STATELESS)` 禁用 Session，`csrf().disable()` 关闭 CSRF（API 无需），自定义 JWT 过滤器插入到认证过滤器之前。

```java
@Configuration
@EnableWebSecurity
public class SecurityConfig {
    @Resource
    private JwtAuthFilter jwtAuthFilter;              // 自定义 JWT 过滤器
    @Resource
    private JwtAuthEntryPoint jwtAuthEntryPoint;      // 401 未登录处理
    @Resource
    private AccessDeniedHandlerImpl accessDeniedHandler; // 403 权限不足处理

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .csrf(csrf -> csrf.disable())                          // 无 Session，关闭 CSRF
            .sessionManagement(session -> session                  // 无 Session
                .sessionCreationPolicy(SessionCreationPolicy.STATELESS)
            )
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/login").permitAll()             // 登录接口公开
                .anyRequest().authenticated()
            )
            .addFilterBefore(jwtAuthFilter,                        // JWT 过滤器
                UsernamePasswordAuthenticationFilter.class)        // 在表单登录之前
            .exceptionHandling(ex -> ex
                .authenticationEntryPoint(jwtAuthEntryPoint)       // Token 无效 → 401
                .accessDeniedHandler(accessDeniedHandler)          // 无权限 → 403
            );
        return http.build();
    }

    // 暴露 AuthenticationManager 供登录接口使用
    @Bean
    public AuthenticationManager authenticationManager(
            AuthenticationConfiguration config) throws Exception {
        return config.getAuthenticationManager();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
}
```

> `AuthenticationManager` 默认不暴露为 Bean，JWT 登录接口需要手动注入认证，必须显式声明。Session 模式下 `formLogin()` 内部已自动调用，无需此 Bean。

### 6.6 JWT vs Session 对比

| 维度 | Session | JWT |
|------|---------|-----|
| 服务端存储 | 是（内存/Redis） | 否（客户端存储 Token） |
| 水平扩展 | 需 Redis 共享 | 天然支持 |
| 每次请求 | 查 Redis/内存恢复 | 验证签名（CPU 操作） |
| 失效控制 | 服务端主动删除 Session | 依赖过期时间，无法主动撤销 |
| 登出 | 服务端清除 | 客户端删除 Token |
| CSRF | 需要防护 | 不依赖 Cookie，天然免疫 |

## 七、OAuth2

OAuth2 是授权框架，核心解决的问题是**用户不需要把密码交给第三方应用**——第三方只拿到一个有时效、有范围限制的 Token。Spring Security 通过 `oauth2ResourceServer` 和 `oauth2Login` 提供全套支持。

### 7.1 四种授权模式

| 模式 | 流程 | Token 获取方 |
|------|------|-------------|
| 授权码模式 | 浏览器重定向 → 用户授权 → code → 后端换 Token | 后端 |
| 客户端模式 | 后端直接用 client_id + secret 获取 Token | 后端 |
| 密码模式 | 用户名+密码直接换取 Token | 已废弃 |
| 隐式模式 | 前端直接拿 Token | 已废弃 |

> 授权码模式最安全：Token 仅在后端流转，前端永远接触不到。客户端模式适合服务间调用。

### 7.2 依赖

```xml
<!-- 作为资源服务器（验证 Token） -->
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-oauth2-resource-server</artifactId>
</dependency>
```

### 7.3 资源服务器配置

```yaml
spring:
  security:
    oauth2:
      resourceserver:
        jwt:
          issuer-uri: http://auth-server:9000     # 授权服务器地址
```

```java
@Configuration
@EnableWebSecurity
public class ResourceServerConfig {

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/public/**").permitAll()
                .anyRequest().authenticated()
            )
            .oauth2ResourceServer(oauth2 -> oauth2
                .jwt(Customizer.withDefaults())
            );
        return http.build();
    }
}
```

配置后每个请求自动验证请求头中的 `Authorization: Bearer <token>`，无效则返回 401。

### 7.4 自定义 Token 验证

默认只验证签名和有效期。生产环境通常需要额外校验，Spring Security 提供了两个扩展点：

#### 提取自定义 Claim → 权限（JwtAuthenticationConverter）

Token 中除了 `sub`（用户名），常包含 `roles`、`scope` 等自定义字段。`JwtAuthenticationConverter` 将其转换为 Spring Security 的权限对象：

```java
@Bean
public JwtAuthenticationConverter jwtAuthenticationConverter() {
    JwtGrantedAuthoritiesConverter grantedAuthorities = new JwtGrantedAuthoritiesConverter();
    grantedAuthorities.setAuthorityPrefix("ROLE_");          // 自动加前缀

    JwtAuthenticationConverter converter = new JwtAuthenticationConverter();
    converter.setJwtGrantedAuthoritiesConverter(jwt -> {
        // 从 Token payload 中提取角色
        Map<String, Object> claims = jwt.getClaims();
        List<String> roles = (List<String>) claims.get("roles");
        if (roles == null) return Collections.emptyList();

        return roles.stream()
            .map(role -> new SimpleGrantedAuthority("ROLE_" + role))
            .collect(Collectors.toList());
    });
    return converter;
}
```

#### Token 黑名单校验（JwtDecoder 自定义）

JWT 无状态，签发后无法服务端撤销。常用黑名单方案：将已登出或管理员强制踢下线的 Token 存入 Redis，解码后先查黑名单：

```java
@Component
public class BlacklistJwtDecoder implements JwtDecoder {

    private final NimbusJwtDecoder delegate;       // 委托给默认解码器
    private final StringRedisTemplate redis;

    public BlacklistJwtDecoder(@Value("${spring.security.oauth2.resourceserver.jwt.issuer-uri}")
                               String issuerUri, StringRedisTemplate redis) {
        this.delegate = NimbusJwtDecoder.withIssuerLocation(issuerUri).build();
        this.redis = redis;
    }

    @Override
    public Jwt decode(String token) throws JwtException {
        Jwt jwt = delegate.decode(token);           // 1. 先验证签名和过期

        String jti = jwt.getId();                   // JWT ID：每个 Token 的唯一标识
        if (Boolean.TRUE.equals(redis.hasKey("blacklist:" + jti))) {
            throw new JwtException("Token 已被撤销");
        }

        return jwt;
    }
}
```

```java
http
    .oauth2ResourceServer(oauth2 -> oauth2
        .jwt(jwt -> jwt
            .decoder(blacklistJwtDecoder)                // 替换默认解码器
            .jwtAuthenticationConverter(jwtAuthenticationConverter())
        )
    );
```

#### 两个扩展点的区别

| 扩展点 | 时机 | 用途 |
|--------|------|------|
| `JwtDecoder` | Token 解码时（最早） | 黑名单拒绝、额外签名验证 |
| `JwtAuthenticationConverter` | Token 解码后 | 提取权限、自定义 Principal |

### 7.5 JWT vs OAuth2 的关系

OAuth2 是**协议框架**，定义怎么授权、怎么发 Token。JWT 是**数据格式**，定义 Token 怎么编码。OAuth2 的 Token 通常用 JWT 承载，但两者是独立的概念：

| 层级 | 概念 | 解决的问题 |
|------|------|-----------|
| OAuth2 | 授权协议 | 谁有权访问什么资源 |
| JWT | Token 格式 | Token 怎么编码、怎么防篡改 |
| Spring Security | 安全框架 | 如何集成到 Java 应用中 |
