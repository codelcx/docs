---
title: Spring MVC 请求处理
date: 2026-05-26
category: backend
sort: 900
description: Spring MVC 请求映射、参数绑定与 RESTful 接口详解
---

# Spring MVC 请求处理

Spring MVC 是 Spring 的 Web 层框架，核心通过注解映射 HTTP 请求到 Controller 方法，自动完成参数绑定、类型转换和结果序列化。在 Spring Boot 中只需引入 `spring-boot-starter-web` 即自动配置完成。

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-web</artifactId>
</dependency>
```

> 该 starter 内含 Spring MVC、内嵌 Tomcat、Jackson（JSON 序列化）和 `@Valid` 校验实现，无需额外配置即可使用。

## 一、请求映射

### 1.1 @RequestMapping

类和方法级别均可使用，指定 URL 和 HTTP 方法。若所有接口都需要统一前缀（如 `/api`），无需在每个 Controller 上重复写，可通过**全局配置**一劳永逸：

```yaml
# application.yml
server:
  servlet:
    context-path: /api
```

配置后所有 `@RequestMapping` 自动加上 `/api` 前缀，如 `/users` → `/api/users`。

```java
@RestController
@RequestMapping("/users")                      // 类级别：所有方法前缀 /users
public class UserController {

    @RequestMapping(value = "/list", method = RequestMethod.GET)
    public List<User> list() {
        return userService.findAll();
    }

    // 等价简写
    @GetMapping("/list")
    public List<User> list2() { }
}
```

### 1.2 HTTP 方法简写

| 注解 | 等价写法 | 用途 |
|------|---------|------|
| `@GetMapping` | `@RequestMapping(method=GET)` | 查询 |
| `@PostMapping` | `@RequestMapping(method=POST)` | 新增 |
| `@PutMapping` | `@RequestMapping(method=PUT)` | 全量更新 |
| `@PatchMapping` | `@RequestMapping(method=PATCH)` | 部分更新 |
| `@DeleteMapping` | `@RequestMapping(method=DELETE)` | 删除 |

```java
@RestController
@RequestMapping("/users")
public class UserController {

    @GetMapping("/{id}")
    public User getById(@PathVariable Long id) { }

    @PostMapping
    public User create(@RequestBody User user) { }

    @PutMapping("/{id}")
    public User update(@PathVariable Long id, @RequestBody User user) { }

    @DeleteMapping("/{id}")
    public void delete(@PathVariable Long id) { }
}
```

### 1.3 produces / consumes

`consumes` 限制请求 `Content-Type`，不匹配返回 415；`produces` 限制响应 `Content-Type`，根据请求头 `Accept` 自动匹配。

```java
@RestController
@RequestMapping("/api/data")
public class DataController {

    @PostMapping(consumes = "application/json", produces = "application/json")
    public Result<User> create(@RequestBody User user) {
        // @RequestBody 自动将 JSON 反序列化为 User 对象
        user.setId(null);                          // 新增时清空 id
        userService.save(user);                    // 调用业务层保存
        return Result.success(user);               // 返回保存后的对象
    }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public Result<String> upload(@RequestParam MultipartFile file) {
        // MultipartFile 封装了上传文件的所有信息
        String originalName = file.getOriginalFilename();   // 原始文件名
        long size = file.getSize();                         // 字节数
        String contentType = file.getContentType();         // MIME 类型

        // 保存到磁盘
        Path dest = Path.of("/upload", UUID.randomUUID() + "_" + originalName);
        file.transferTo(dest);                              // 写入目标路径

        return Result.success("上传成功: " + originalName);
    }

    @GetMapping(value = "/{id}", produces = "application/json")
    public User asJson(@PathVariable Long id) {
        User user = userService.findById(id);
        // Spring MVC 自动将返回对象序列化为 JSON 写入响应体
        return user;
    }

    @GetMapping(value = "/{id}", produces = "application/xml")
    public User asXml(@PathVariable Long id) {
        User user = userService.findById(id);
        // 需引入 jackson-dataformat-xml，Spring 自动序列化为 XML
        return user;
    }
}
```

请求示例：

```bash
# 1. JSON 请求 → 匹配 consumes = application/json
curl -X POST http://localhost:8080/api/data \
  -H "Content-Type: application/json" \
  -d '{"name":"张三","age":25}'

# 2. 文件上传 → 匹配 consumes = multipart/form-data
curl -X POST http://localhost:8080/api/data \
  -F "file=@avatar.png"

# 3. 请求 JSON 响应 → 匹配 produces = application/json
curl http://localhost:8080/api/data/1 \
  -H "Accept: application/json"
# 响应：{"id":1,"name":"张三","age":25}

# 4. 请求 XML 响应 → 匹配 produces = application/xml
curl http://localhost:8080/api/data/1 \
  -H "Accept: application/xml"
# 响应：<User><id>1</id><name>张三</name><age>25</age></User>

# 5. Accept 头未匹配 → 返回 406 Not Acceptable
curl http://localhost:8080/api/data/1 \
  -H "Accept: text/plain"
```

## 二、参数绑定

### 2.1 @PathVariable — URL 路径参数

```java
// /users/1/articles/5
@GetMapping("/{userId}/articles/{articleId}")
public Article get(@PathVariable Long userId, @PathVariable Long articleId) { }
```

### 2.2 @RequestParam — URL 查询参数与表单

```java
// /users?page=1&size=10&keyword=张三
@GetMapping
public List<User> list(
    @RequestParam(defaultValue = "1") int page,
    @RequestParam(defaultValue = "10") int size,
    @RequestParam(required = false) String keyword) { }

// 多个同名参数 → /ids?ids=1&ids=2&ids=3
@GetMapping("/batch")
public List<User> batch(@RequestParam List<Long> ids) { }
```

### 2.3 @RequestBody — JSON 请求体

```java
@PostMapping
public User create(@RequestBody @Valid User user) {
    // 自动反序列化 JSON → User 对象
    return userService.save(user);
}
```

### 2.4 @RequestHeader — 请求头

```java
@GetMapping("/me")
public String me(@RequestHeader("Authorization") String token) {
    return jwtUtil.parseToken(token);
}

// 所有请求头
@PostMapping("/log")
public void log(@RequestHeader Map<String, String> headers) { }
```

### 2.5 对象参数自动绑定

```java
// /users?name=张三&age=18&role=admin
@GetMapping
public List<User> list(UserQuery query) {
    // Spring 自动将参数注入同名属性：query.name、query.age、query.role
}
```

```java
@Data
public class UserQuery {
    private String name;
    private Integer age;
    private String role;
}
```

## 三、参数校验

```java
@Data
public class UserDTO {
    @NotBlank(message = "姓名不能为空")
    private String name;

    @Min(value = 1, message = "年龄必须大于0")
    @Max(value = 150, message = "年龄超出范围")
    private Integer age;

    @Email(message = "邮箱格式不正确")
    private String email;

    @Pattern(regexp = "^1[3-9]\\d{9}$", message = "手机号格式不正确")
    private String phone;
}
```

```java
@PostMapping
public User create(@RequestBody @Valid UserDTO dto, BindingResult result) {
    if (result.hasErrors()) {
        String msg = result.getFieldErrors().stream()
            .map(e -> e.getField() + ": " + e.getDefaultMessage())
            .collect(Collectors.joining("; "));
        throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), msg);
    }
    return userService.save(dto);
}
```

> 配合 `@RestControllerAdvice` 全局异常处理器（见 Spring Boot 异常处理章节），校验失败时自动返回 `Result.error()`，无需每个方法手写 `BindingResult` 判断。

### 3.1 校验注解速查

| 注解 | 说明 |
|------|------|
| `@NotNull` | 不能为 null |
| `@NotBlank` | 不能为空字符串（trim 后） |
| `@NotEmpty` | 不能为 null 且集合/字符串长度 > 0 |
| `@Min` / `@Max` | 数值范围 |
| `@Size(min, max)` | 字符串/集合长度范围 |
| `@Email` | 邮箱格式 |
| `@Pattern` | 正则匹配 |

## 四、接口风格

### 4.1 RESTful 风格（推荐）

通过 HTTP 方法区分操作，路径仅表示资源，不含动词：

```java
@RestController
@RequestMapping("/api/users")
public class UserController {

    @GetMapping                  // GET    /api/users
    public Result<Page<User>> list(UserQuery query) {
        return Result.success(userService.page(query));
    }

    @GetMapping("/{id}")         // GET    /api/users/1
    public Result<User> getById(@PathVariable Long id) {
        return Result.success(userService.findById(id));
    }

    @PostMapping                 // POST   /api/users
    public Result<User> create(@RequestBody @Valid UserDTO dto) {
        return Result.success(userService.save(dto));
    }

    @PutMapping("/{id}")         // PUT    /api/users/1
    public Result<User> update(@PathVariable Long id, @RequestBody @Valid UserDTO dto) {
        return Result.success(userService.update(id, dto));
    }

    @DeleteMapping("/{id}")      // DELETE /api/users/1
    public Result<Void> delete(@PathVariable Long id) {
        userService.delete(id);
        return Result.success(null);
    }
}
```

### 4.2 动词风格

路径中直接写明动作，不依赖 HTTP 方法区分，适合老项目迁移或前端框架路由匹配简化：

```java
@RestController
@RequestMapping("/api/users")
public class UserController {

    @GetMapping("/list")
    public Result<Page<User>> list(UserQuery query) { }

    @GetMapping("/detail/{id}")
    public Result<User> detail(@PathVariable Long id) { }

    @PostMapping("/create")
    public Result<User> create(@RequestBody @Valid UserDTO dto) { }

    @PostMapping("/update")
    public Result<User> update(@RequestBody @Valid UserDTO dto) { }

    @PostMapping("/delete")
    public Result<Void> delete(@RequestBody Long id) { }
}
```

### 4.3 两种风格对比

| 维度 | RESTful | 动词风格 |
|------|---------|---------|
| 可读性 | 需要理解 HTTP 方法含义 | URL 自描述，一眼看懂 |
| 缓存 | GET 天然可缓存 | POST 需要额外处理 |
| 前端调用 | `axios.get(…)` / `axios.post(…)` 区分方法 | 全部 `axios.post(…)` |
| 请求体 | GET/DELETE 无 body（非标准） | POST 均可带 body |
