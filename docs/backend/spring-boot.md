---
title: Spring Boot 从入门到实践
date: 2026-05-15
category: backend
sort: 999
description: Spring Boot 配置、多线程、多环境管理与事务管理详解
---

# Spring Boot 从入门到实践

Spring Boot 以"约定优于配置"简化了 Spring 应用的搭建，但仍然提供了极其灵活的配置体系来覆盖默认行为。

> **Spring 与 Spring Boot 的关系**：Spring Framework 是底层 IoC 容器，提供依赖注入、AOP、事务管理等核心能力，但需要大量 XML 或 Java 配置才能运行。Spring Boot 在 Spring 之上封装了自动配置、起步依赖和内嵌服务器，使开发者无需手动搭建环境，**开箱即用**。关系类比：Spring 是发动机，Spring Boot 是整车——发动机提供了驱动力，整车让你直接开上路。

## 一、配置

### 1.1 Bean 与 IoC 容器

**Bean** 是由 Spring IoC 容器管理的 Java 对象。传统开发中由 `new` 创建对象并手动管理依赖关系；Spring 中你只需声明"我需要什么"，容器负责**创建、装配、管理**对象的整个生命周期。这种"控制权反转"就是 IoC（控制反转）。

**声明 Bean 的两种方式**：

```java
// 方式一：注解标记类（推荐）
@Component                          // 声明该类为 Bean，由 Spring 管理
public class UserService {
    public void save() { /* ... */ }
}

// 方式二：@Configuration + @Bean
@Configuration
public class AppConfig {
    @Bean                           // 方法返回值作为 Bean 放入容器
    public RestTemplate restTemplate() {
        return new RestTemplate();
    }
}
```

**@Component vs @Bean 区别**：

| 方式 | 作用对象 | 适用场景 |
|------|---------|---------|
| `@Component` | 标记在**自己的类**上 | 业务逻辑类（Service、Controller） |
| `@Bean` | 标记在**配置类的方法**上 | 第三方库的对象（RestTemplate、RedisTemplate）、需要复杂初始化 |

**@Component 的语义化派生注解**：以下注解本质上都是 `@Component`，只是加了语义标识，底层 IoC 行为完全一致。

| 注解 | 语义 | 常见于 |
|------|------|--------|
| `@Service` | 业务层 | Service 实现类 |
| `@Repository` | 数据访问层 | DAO / Mapper 接口 |
| `@Controller` | Web 控制层 | REST 接口类 |
| `@RestController` | `@Controller` + `@ResponseBody` | 返回 JSON 的接口类 |
| `@Mapper` | MyBatis 数据层 | MyBatis Mapper 接口（需 `@MapperScan` 激活） |

```java
@Service
public class UserService {                    // 等同于 @Component，语义更明确
    public User findById(Long id) { /* ... */ }
}

@Repository
public interface UserMapper {                 // MyBatis Mapper
    User findById(@Param("id") Long id);
}
```

**@ComponentScan** 告诉 Spring 从哪个包开始扫描 `@Component` 等注解。默认从启动类所在包开始扫描当前包及所有子包：

```java
package com.example.demo;          // 启动类在 com.example.demo 包

@SpringBootApplication             // 等价于 @Configuration + @EnableAutoConfiguration + @ComponentScan
public class DemoApplication { }

// 默认扫描范围：com.example.demo 及其子包
// com.example.demo.service.UserService → ✅ 会被找到
// com.example.other.utils.Helper    → ❌ 不会被找到
```

如果 Bean 在启动类包路径之外，需要显式指定扫描路径：

```java
@SpringBootApplication
@ComponentScan(basePackages = {"com.example.demo", "com.example.common"})
public class DemoApplication { }
```

### 1.2 核心配置注解

#### @SpringBootApplication

启动类必须注解，是一个组合注解，等价于同时声明三个注解：

```java
@SpringBootApplication
public class DemoApplication {
    public static void main(String[] args) {
        SpringApplication.run(DemoApplication.class, args);
    }
}
```

| 内含注解 | 作用 |
|----------|------|
| `@Configuration` | 标记该类为配置类，相当于 Spring 的 XML 配置文件 |
| `@EnableAutoConfiguration` | 触发 Spring Boot 的自动配置机制，根据 classpath 依赖自动配置 Bean |
| `@ComponentScan` | 扫描当前包及子包中的 `@Component`、`@Service`、`@Repository`、`@Controller` 等注解 |

#### @Configuration

声明一个类为配置类，内部 `@Bean` 方法返回的对象会被 Spring IoC 容器管理。

```java
@Configuration
public class AppConfig {

    @Bean
    public RestTemplate restTemplate() {
        return new RestTemplate();
    }

    @Bean
    public RedisTemplate<String, Object> redisTemplate(RedisConnectionFactory factory) {
        RedisTemplate<String, Object> template = new RedisTemplate<>();
        template.setConnectionFactory(factory);
        return template;
    }
}
```

#### @ConfigurationProperties

将配置文件中的一组属性绑定到一个 Java 对象上，支持宽松绑定（`max-retry` ↔ `maxRetry`）。

```java
@Component
@ConfigurationProperties(prefix = "app.oss")
@Data
public class OssProperties {
    private String endpoint;
    private String accessKey;
    private String secretKey;
    private String bucket;
    private int maxRetry = 3;       // 默认值
}
```

```yaml
# application.yml
app:
  oss:
    endpoint: https://oss-cn-hangzhou.aliyuncs.com
    access-key: LTAI5xxxx
    secret-key: xxxxx
    bucket: my-bucket
```

#### @Value

从配置文件或环境变量中注入单个值，支持 SpEL 表达式和默认值。

```java
@Component
public class AppInfo {

    @Value("${server.port}")
    private int port;

    @Value("${app.name:Spring Boot App}")     // 冒号后为默认值
    private String appName;
}
```

#### @PropertySource

```java
@Configuration
@PropertySource("classpath:custom.properties")
public class CustomConfig {
    @Value("${custom.key}")
    private String customKey;
}
```

### 1.3 application.yml 配置结构

Spring Boot 默认支持 `.yml` 和 `.properties` 两种格式，YAML 层级更直观。配置文件支持直接引用环境变量和默认值。

#### 环境变量引用

```yaml
spring:
  datasource:
    username: ${DB_USER}                    # 直接引用环境变量
    password: ${DB_PASS}

    # 带默认值：无环境变量时使用 localhost
    url: ${DB_HOST:localhost}:3306/mydb

    # 嵌套默认值：先取 DB_HOST，为空则取 DB_HOST_DEFAULT
    host: ${DB_HOST:${DB_HOST_DEFAULT:127.0.0.1}}
```

```bash
# 设置环境变量后启动
export DB_USER=prod_admin
export DB_PASS=secret123
java -jar app.jar
```

#### IDEA 中设置

`Run Configuration → Environment Variables` 中填入 `DB_USER=prod_admin;DB_PASS=secret123`，以分号分隔。

#### 完整配置示例

```yaml
server:
  port: ${SERVER_PORT:8080}
  servlet:
    context-path: /api

spring:
  application:
    name: my-app
  datasource:
    url: jdbc:mysql://${DB_HOST:localhost}:${DB_PORT:3306}/mydb
    username: ${DB_USER:root}
    password: ${DB_PASS}
    driver-class-name: com.mysql.cj.jdbc.Driver
    hikari:
      maximum-pool-size: ${DB_POOL_MAX:20}
      minimum-idle: 5

logging:
  level:
    root: ${LOG_LEVEL:INFO}
```

### 1.4 多环境配置

#### Profile 文件命名

```
src/main/resources/
├── application.yml                 # 公共配置
├── application-dev.yml             # 开发环境
├── application-test.yml            # 测试环境
└── application-prod.yml            # 生产环境
```

```yaml
# application.yml
spring:
  profiles:
    active: dev
```

```yaml
# application-prod.yml
server:
  port: 80
spring:
  datasource:
    url: jdbc:mysql://prod-db:3306/mydb
    username: ${DB_USER}
    password: ${DB_PASS}
```

#### @Profile 注解

```java
@Bean
@Profile("dev")
public DataSource devDataSource() {
    return new HikariDataSource();
}

@Bean
@Profile("prod")
public DataSource prodDataSource() {
    HikariDataSource ds = new HikariDataSource();
    ds.setJdbcUrl(env.getProperty("spring.datasource.url"));
    return ds;
}
```

激活方式：命令行 `--spring.profiles.active=prod` 或环境变量 `SPRING_PROFILES_ACTIVE=prod`。

### 1.5 配置优先级

| 优先级 | 来源 |
|--------|------|
| 1 | 命令行参数 `--server.port=9090` |
| 2 | 环境变量 `SERVER_PORT=9090` |
| 3 | `application-{profile}.yml` |
| 4 | `application.yml` |
| 5 | `@PropertySource` 自定义文件 |
| 6 | 默认值（`@Value("${key:default}")` ） |

### 1.6 随机值与占位符

```yaml
app:
  secret: ${random.uuid}
  port: ${random.int(8000,9000)}
  server-url: http://${app.host:localhost}:${server.port}
```

### 1.7 条件注解

| 注解 | 条件 |
|------|------|
| `@ConditionalOnProperty` | 指定的配置项存在且为某值时 |
| `@ConditionalOnClass` | classpath 中存在某个类 |
| `@ConditionalOnMissingBean` | 容器中不存在指定 Bean |
| `@ConditionalOnExpression` | SpEL 表达式为 true |

```java
@Bean
@ConditionalOnProperty(name = "app.cache.enabled", havingValue = "true")
public CacheManager cacheManager() {
    return new RedisCacheManager();
}

@Bean
@ConditionalOnExpression("'${app.env}' != 'prod'")
public DevTools devTools() {
    return new DevTools();
}
```

### 1.8 配置加密（Jasypt）

```yaml
jasypt:
  encryptor:
    password: ${JASYPT_KEY}

spring:
  datasource:
    password: ENC(加密后的密文)
```

## 二、多线程

### 2.1 创建线程

#### 方式一：直接 new Thread

```java
// 简单但不可复用，线程创建和销毁开销大
new Thread(() -> {
    System.out.println("异步任务执行: " + Thread.currentThread().getName());
}).start();
```

适合：单次执行的轻量任务、Demo 验证。不适合：频繁创建线程或需要结果返回的场景。

#### 方式二：ExecutorService 线程池

```java
// 线程复用，手动管理生命周期
ExecutorService executor = Executors.newFixedThreadPool(5);

executor.execute(() -> {
    System.out.println("任务1: " + Thread.currentThread().getName());
});

Future<String> future = executor.submit(() -> {
    return "任务2 结果";
});
String result = future.get();                    // 阻塞等待结果

executor.shutdown();                             // 不再接收新任务，等待已有任务完成
```

适合：中等并发、需要返回结果或批量处理。不适合：线程数需动态调整、需与 Spring 事务/Bean 生命周期配合的场景。

> 以上两种方式都需要手动管理线程生命周期，且不受 Spring 容器管理。Spring 的 `@Async` 和 `@Scheduled` 封装了线程池，线程由容器统一管理，支持自动回收、异常处理和监控。

### 2.2 @EnableAsync 启用异步

```java
@SpringBootApplication
@EnableAsync
public class DemoApplication {
    public static void main(String[] args) {
        SpringApplication.run(DemoApplication.class, args);
    }
}
```

### 2.3 @Async 异步方法

```java
@Service
public class EmailService {

    @Async
    public CompletableFuture<Boolean> sendEmail(String to, String subject) {
        // 耗时操作不阻塞主线程
        Thread.sleep(3000);
        return CompletableFuture.completedFuture(true);
    }

    // 获取异步结果
    public void send() {
        CompletableFuture<Boolean> future = sendEmail("user@example.com", "验证码");
        future.thenAccept(success -> System.out.println("发送完成: " + success));
    }
}
```

### 2.4 自定义线程池

Spring Boot 默认使用 `SimpleAsyncTaskExecutor`，生产环境必须自定义线程池以控制资源和监控。

```java
@Configuration
@EnableAsync
public class ThreadPoolConfig implements AsyncConfigurer {

    @Override
    public Executor getAsyncExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(10);           // 核心线程数
        executor.setMaxPoolSize(50);            // 最大线程数
        executor.setQueueCapacity(200);         // 队列容量
        executor.setKeepAliveSeconds(60);       // 空闲线程存活时间
        executor.setThreadNamePrefix("async-"); // 线程名前缀（便于日志追踪）
        executor.setRejectedExecutionHandler(new ThreadPoolExecutor.CallerRunsPolicy());
        executor.initialize();
        return executor;
    }
}
```

### 2.5 @Scheduled 定时任务

```java
@SpringBootApplication
@EnableScheduling
public class DemoApplication {
    // ...
}
```

```java
@Component
public class ScheduledTasks {

    @Scheduled(fixedRate = 5000)           // 每 5 秒执行（上次开始后计时）
    public void reportCurrentTime() {
        System.out.println(LocalDateTime.now());
    }

    @Scheduled(fixedDelay = 10000)         // 上次结束后 10 秒再执行
    public void cleanCache() {
        cache.clear();
    }

    @Scheduled(cron = "0 0 2 * * ?")      // 每天凌晨 2 点
    public void dailyReport() {
        reportService.generate();
    }
}
```

### 2.6 定时任务线程池

与 `@Async` 同理，`@Scheduled` 默认单线程串行执行，需自定义线程池：

```java
@Configuration
public class ScheduleConfig implements SchedulingConfigurer {

    @Override
    public void configureTasks(ScheduledTaskRegistrar registrar) {
        registrar.setScheduler(Executors.newScheduledThreadPool(5));
    }
}
```

### 2.7 线程池选择指南

| 场景 | 方案 |
|------|------|
| 发邮件、发短信（无需返回值） | `@Async` + `CompletableFuture` |
| 批量处理（Excel 导入导出） | `ThreadPoolTaskExecutor` + `CountDownLatch` |
| 定时清理、日报生成 | `@Scheduled` + `cron` 表达式 |
| CPU 密集型任务 | 线程数 = `CPU 核心数 + 1` |
| IO 密集型任务 | 线程数 = `CPU 核心数 × 2` 或更高 |

### 2.8 JMM 三大特性

Java 内存模型（JMM）定义了多线程环境下变量的访问规则，核心要解决三个问题：

#### 原子性

一个操作或多个操作要么全部执行且不被中断，要么全不执行。经典反例：`count++` 实际是三步（读取→加1→写入），多线程下会丢失更新。

```java
int count = 0;

// ❌ count++ 非原子操作：两个线程同时读 0 → 都写回 1 → 丢失一次累加
// ✅ 解决方案
AtomicInteger atomicCount = new AtomicInteger(0);
atomicCount.incrementAndGet();                // CAS 保证原子性
synchronized (lock) { count++; }              // 加锁保证原子性
```

#### 可见性

一个线程修改了共享变量，其他线程能否立即看到最新值。CPU 缓存和 JIT 编译可能导致线程 A 写入的值，线程 B 迟迟读不到。

```java
public class VisibilityExample {
    private volatile boolean running = true;    // volatile 保证可见性

    public void stop() {
        running = false;                        // 写入立即可见
    }

    public void work() {
        while (running) {                       // 每次从主内存读取最新值
            // do work
        }
    }
}
```

`volatile` 保证了可见性——被修饰的变量每次写入后立即刷新到主内存，每次读取都从主内存获取最新值。但 **`volatile` 不保证原子性**：`count++` 是三步操作（读→加→写），`volatile` 只保证每一步读到最新值，不能阻止两线程交叉执行。

与 `final` 的对比：两者都与可见性有关，但机制和场景完全不同。

```java
public class Demo {
    private volatile int count = 0;       // 值可变，保证可见性
    private final String name;            // 值不可变，构造完成后保证可见性

    public Demo(String name) {
        this.name = name;                 // final 在构造函数结束后对所有线程可见
    }

    public void increment() {
        count++;                          // ❌ 不保证原子性！
    }
}
```

| 关键字 | 可见性 | 原子性 | 可变性 | 典型场景 |
|--------|--------|--------|--------|---------|
| `volatile` | 保证 | 不保证 | 可变 | 状态标志（`running`）、DCL 单例 |
| `final` | 保证（构造完成时） | 不需要（只读） | 不可变 | 不可变对象的成员、常量 |
| `synchronized` | 保证 | 保证 | 可变 | 复合操作（`count++`）、临界区 |
| `AtomicInteger` | 保证（CAS） | 保证 | 可变 | 计数器、高频无锁并发 |

> 复合操作必须用 `synchronized` 或 `AtomicXxx`，仅靠 `volatile` 是不够的。

#### 有序性

CPU 和编译器为了性能会重排指令顺序，单线程下结果等价，多线程下可能导致难以预料的 bug。

```java
// 经典双重检查锁定（DCL）单例
public class Singleton {
    private static volatile Singleton instance;  // volatile 禁止指令重排

    public static Singleton getInstance() {
        if (instance == null) {
            synchronized (Singleton.class) {
                if (instance == null) {
                    instance = new Singleton();   // 非原子操作：分配内存→初始化→赋值引用
                }
            }
        }
        return instance;
    }
}
```

> 构造函数执行分三步：分配内存 → 初始化对象 → 引用赋值。若 2 和 3 被重排，其他线程可能拿到未初始化完成的对象，`volatile` 通过内存屏障禁止重排。

| 特性 | 含义 | 解决方案 |
|------|------|---------|
| 原子性 | 操作不可分割 | `synchronized`、`Lock`、`AtomicXxx`（CAS） |
| 可见性 | 修改后其他线程立即可见 | `volatile`、`synchronized`、`Lock` |
| 有序性 | 指令按代码顺序执行 | `volatile`（禁止指令重排）、`synchronized` |

### 2.9 并发安全

Spring 默认 Bean 是单例的，多线程同时访问时需要注意线程安全问题。

#### 成员变量共享风险

```java
@Service
public class CounterService {
    private int count = 0;            // 单例 Bean，多线程共享，非原子操作

    // ❌ 非线程安全：多个线程同时调用会丢失计数
    public void increment() {
        count++;
    }
}
```

#### 使用 AtomicXxx 保证原子性

```java
@Service
public class CounterService {
    private final AtomicInteger count = new AtomicInteger(0);

    public int increment() {
        return count.incrementAndGet();       // 原子操作，无需 synchronized
    }

    public int get() {
        return count.get();
    }
}
```

#### 使用 ConcurrentHashMap

```java
@Component
public class SessionStore {
    private final ConcurrentHashMap<String, UserInfo> sessions = new ConcurrentHashMap<>();

    public void put(String token, UserInfo user) {
        sessions.put(token, user);              // 分段锁，高并发下性能优于 Hashtable
    }

    public UserInfo get(String token) {
        return sessions.get(token);
    }

    // 原子操作：不存在时放入
    public UserInfo putIfAbsent(String token, UserInfo user) {
        return sessions.putIfAbsent(token, user);
    }
}
```

#### @Scope 调整 Bean 作用域

对于有状态的 Bean，将单例改为原型或多线程作用域：

```java
@Service
@Scope("prototype")                    // 每次注入创建新实例，线程安全
public class ReportGenerator {
    private StringBuilder buffer = new StringBuilder();
    // ...
}

// 或限定为 request/session（仅 Web 环境）
// @Scope(value = "request", proxyMode = ScopedProxyMode.TARGET_CLASS)
```

| 作用域 | 说明 |
|--------|------|
| `singleton` | 单例（默认），IoC 容器内唯一实例 |
| `prototype` | 每次注入/获取创建新实例 |
| `request` | 每个 HTTP 请求一个实例（仅 Web） |
| `session` | 每个 HTTP 会话一个实例（仅 Web） |

#### ThreadLocal 隔离线程数据

```java
@Component
public class CurrentUserHolder {
    private static final ThreadLocal<UserInfo> currentUser = new ThreadLocal<>();

    public void setUser(UserInfo user) {
        currentUser.set(user);
    }

    public UserInfo getUser() {
        return currentUser.get();
    }

    public void clear() {
        currentUser.remove();             // 必须清理，防止内存泄漏
    }
}
```

## 三、锁

并发控制有多种锁实现，可从不同维度分类：

| 维度 | 分类 | 说明 | 代表 |
|------|------|------|------|
| 加锁策略 | 悲观锁 · 乐观锁 | 先加锁再访问 vs 操作后验证无冲突 | `synchronized` · `AtomicXxx` |
| 互斥程度 | 排他锁 · 共享锁 | 独占访问 vs 多线程同时读 | `ReentrantLock` · `ReentrantReadWriteLock` |
| 等待方式 | 阻塞锁 · 自旋锁 | 阻塞挂起等待 vs 循环重试 | `synchronized` · `AtomicXxx` (CAS) |
| 可重入性 | 可重入锁 · 不可重入锁 | 同一线程可多次获取 | `ReentrantLock` · `StampedLock` |
| 作用范围 | 本地锁 · 分布式锁 | 单 JVM 内互斥 vs 跨实例互斥 | `synchronized` · Redis 锁 |
| 加锁粒度 | 粗粒度 · 分段锁 | 锁整个结构 vs 锁部分段 | `Hashtable` · `ConcurrentHashMap` |

**悲观锁**：假定每次访问都会产生冲突，先获取锁再操作，其他线程阻塞等待。写多读少时保证数据一致性，代价是线程切换开销。

**乐观锁**：假定冲突很少发生，不阻塞直接操作，提交时检查是否被修改（版本号/CAS）。适合读多写少，冲突多时频繁重试反而降低性能。

**排他锁**：同一时刻只允许一个线程持有锁，其他线程必须等待。

**共享锁**：允许多个线程同时持有读锁并行访问，但写锁仍然是排他的。

**阻塞锁**：锁被占有时线程被操作系统挂起进入等待队列，释放后再被唤醒。线程切换有开销，适合锁持有时间较长的场景。

**自旋锁**：线程不挂起，在循环中反复检查锁状态（CPU 空转）。避免线程切换开销，但浪费 CPU，仅适合锁持有时间极短的场景。

**可重入锁**：同一线程在外层方法获取锁后，内层方法可以再次获取同一个锁（计数器 +1），释放时递减。

**分段锁**：将数据拆成多段，每段独立加锁。不同段的操作可并行，缩小锁粒度提升并发。

**分布式锁**：多 JVM 实例共享的互斥机制，依赖 Redis、Zookeeper 等外部中间件协调。单机锁在集群部署下失效，分布式锁保证跨实例的互斥。

### 3.1 synchronized（悲观锁）

最基础的互斥锁，修饰方法或代码块，自动获取和释放：

```java
@Service
public class InventoryService {
    private int stock = 100;

    // 修饰实例方法：锁当前对象
    public synchronized void deduct() {
        if (stock > 0) stock--;
    }

    // 修饰代码块：锁定指定对象
    public void batchDeduct(int count) {
        synchronized (this) {
            if (stock >= count) stock -= count;
        }
    }

    // 修饰静态方法：锁类的 Class 对象
    public static synchronized void staticMethod() { }
}
```

### 3.2 ReentrantLock（悲观锁-可重入）

`java.util.concurrent.locks` 包下的显式锁，比 `synchronized` 更灵活：可超时、可中断、可设置公平策略。

```java
@Service
public class PaymentService {
    private final ReentrantLock lock = new ReentrantLock();

    public void pay(Long orderId) {
        lock.lock();
        try {
            // 临界区
            balance -= amount;
        } finally {
            lock.unlock();              // 必须在 finally 中释放
        }
    }

    // 尝试加锁：超时放弃
    public boolean payWithTimeout(Long orderId) {
        try {
            if (lock.tryLock(3, TimeUnit.SECONDS)) {
                try {
                    // 业务逻辑
                    return true;
                } finally {
                    lock.unlock();
                }
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
        return false;                   // 超时或中断，放弃
    }
}
```

### 3.3 ReentrantReadWriteLock（悲观锁-读写锁）

读多写少的场景下性能优于排他锁：**读锁共享**（多线程同时读），**写锁互斥**（独占写入）。

```java
@Service
public class CacheService {
    private final ReentrantReadWriteLock rwLock = new ReentrantReadWriteLock();
    private final Map<String, Object> cache = new HashMap<>();

    public Object get(String key) {
        rwLock.readLock().lock();           // 读锁：多线程可同时持有
        try {
            return cache.get(key);
        } finally {
            rwLock.readLock().unlock();
        }
    }

    public void put(String key, Object value) {
        rwLock.writeLock().lock();          // 写锁：独占，阻塞所有读/写
        try {
            cache.put(key, value);
        } finally {
            rwLock.writeLock().unlock();
        }
    }
}
```

### 3.4 StampedLock（乐观读+悲观写）

Java 8 引入，在读远多于写且读操作很快的场景下，使用乐观读模式避免加锁开销。

```java
@Service
public class MetricsService {
    private final StampedLock stampedLock = new StampedLock();
    private long value = 0;

    public long getValue() {
        long stamp = stampedLock.tryOptimisticRead();  // 乐观读（不加锁）
        long current = value;

        if (!stampedLock.validate(stamp)) {             // 验证期间有无写操作
            stamp = stampedLock.readLock();             // 回退到悲观读锁
            try {
                current = value;
            } finally {
                stampedLock.unlockRead(stamp);
            }
        }
        return current;
    }

    public void setValue(long v) {
        long stamp = stampedLock.writeLock();
        try {
            value = v;
        } finally {
            stampedLock.unlockWrite(stamp);
        }
    }
}
```

### 3.5 AtomicXxx — CAS（乐观锁）

乐观锁不阻塞线程，通过 CAS（Compare And Swap）原子指令直接操作内存值：先比较当前值是否等于期望值，相等则替换，失败则重试。Java 在 `java.util.concurrent.atomic` 包下提供了一组无锁原子类：

```java
@Service
public class StockService {
    private final AtomicInteger stock = new AtomicInteger(100);
    private final AtomicReference<UserInfo> currentUser = new AtomicReference<>();
    private final AtomicLong requestCount = new AtomicLong(0);

    // CAS 自旋：失败自动重试
    public boolean deduct(int count) {
        int current;
        do {
            current = stock.get();
            if (current < count) return false;         // 库存不足
        } while (!stock.compareAndSet(current, current - count));
        return true;
    }

    // 便捷写法（内部已实现 CAS 循环）
    public int addAndGet(int delta) {
        return stock.addAndGet(delta);                 // 原子自增
    }

    public void updateUser(UserInfo newUser) {
        currentUser.set(newUser);                      // 原子赋值
    }
}
```

**CAS 的问题**：高竞争时频繁自旋消耗 CPU（即自旋锁的代价）；存在 ABA 问题（A→B→A 检测不到变化），解决方案是 `AtomicStampedReference` 加版本号。

#### 自旋锁 vs 阻塞锁

自旋锁不挂起线程，循环反复检查锁状态（CPU 空转），适合**锁持有时间极短**的场景，避免线程切换开销。阻塞锁将线程挂起让出 CPU，适合**锁持有时间长**的场景。

```java
// 自旋锁简单实现（仅供理解原理）
public class SpinLock {
    private final AtomicReference<Thread> owner = new AtomicReference<>();

    public void lock() {
        Thread current = Thread.currentThread();
        while (!owner.compareAndSet(null, current)) { }  // 循环等待
    }

    public void unlock() {
        owner.set(null);
    }
}
```

### 3.6 ConcurrentHashMap 分段锁

Java 7 的 `ConcurrentHashMap` 采用分段锁：内部将数据分成多个 Segment，每个 Segment 独立加锁，不同 Segment 的操作可并行。Java 8 改进为 CAS + `synchronized` 锁单个 Node，粒度更细。

```java
// 分段思想：不同 key 落在不同段，可以并发操作
ConcurrentHashMap<String, Integer> map = new ConcurrentHashMap<>();

// 两个线程同时操作不同 key，不会互相阻塞
new Thread(() -> map.put("a", 1)).start();
new Thread(() -> map.put("b", 2)).start();

// 原子复合操作
map.computeIfAbsent("c", k -> 100);   // 不存在时计算并放入
map.merge("d", 1, Integer::sum);      // 存在则累加
```

### 3.7 锁对比与选型

#### 对比表

| 锁 | 类型 | 互斥 | 读共享 | 可重入 | 可超时 | 公平策略 | 性能 |
|------|------|------|--------|--------|--------|---------|------|
| `synchronized` | 悲观 | 是 | 否 | 是 | 否 | 否 | 中 |
| `ReentrantLock` | 悲观 | 是 | 否 | 是 | 是 | 支持 | 中 |
| `ReentrantReadWriteLock` | 悲观 | 写互斥 | 读共享 | 是 | 是 | 支持 | 读高/写中 |
| `StampedLock` | 乐观读 | 写互斥 | 乐观读无锁 | 否 | 否 | 否 | 极高 |
| `AtomicXxx` (CAS) | 乐观 | 否 | 否 | — | — | 否 | 极高（低竞争） |
| `ConcurrentHashMap` | 分段锁 | 按段互斥 | 否 | — | — | 否 | 极高 |

#### 选型指南

| 场景 | 推荐 |
|------|------|
| 简单互斥、代码块保护 | `synchronized`（无需手动释放） |
| 需要超时/中断/公平策略 | `ReentrantLock` |
| 读多写少（缓存、配置） | `ReentrantReadWriteLock` |
| 极高并发读且读操作极快 | `StampedLock`（乐观读） |
| 计数器、状态更新（低竞争） | `AtomicXxx`（无锁 CAS） |
| 数据结构的并发读写（Map/Queue） | `ConcurrentHashMap` / `ConcurrentLinkedQueue` |
| 多实例互斥 | 分布式锁（Redis / Zookeeper） |

### 3.8 分布式锁（Redis）

单机 `synchronized` 在多实例部署下失效，需借助 Redis 等中间件实现跨实例的互斥。

```java
@Component
public class RedisLock {
    @Resource
    private StringRedisTemplate stringRedisTemplate;

    public boolean tryLock(String key, String value, long expireSeconds) {
        Boolean success = stringRedisTemplate.opsForValue()
            .setIfAbsent(key, value, Duration.ofSeconds(expireSeconds));
        return Boolean.TRUE.equals(success);
    }

    public void unlock(String key, String value) {
        String script = "if redis.call('get', KEYS[1]) == ARGV[1] then " +
                        "return redis.call('del', KEYS[1]) else return 0 end";
        stringRedisTemplate.execute(
            new DefaultRedisScript<>(script, Long.class),
            Collections.singletonList(key), value
        );
    }
}
```

```java
// 业务使用
String lockKey = "order:" + orderId;
String lockValue = UUID.randomUUID().toString();

try {
    if (redisLock.tryLock(lockKey, lockValue, 30)) {
        // 执行业务逻辑
    }
} finally {
    redisLock.unlock(lockKey, lockValue);     // Lua 脚本保证原子性释放
}
```

## 四、缓存

Spring Boot 提供统一的缓存抽象（`spring-boot-starter-cache`），支持多种缓存实现的热插拔。

### 4.1 启用缓存

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-cache</artifactId>
</dependency>
```

```java
@SpringBootApplication
@EnableCaching                              // 启用缓存
public class DemoApplication { }
```

### 4.2 默认缓存（ConcurrentHashMap）

不引入任何外部缓存时，Spring Boot 默认使用 `ConcurrentHashMap` 实现，数据仅存在于 JVM 内存，重启即丢失，适合开发环境。

```java
@Service
public class UserService {

    @Cacheable(value = "users", key = "#id")        // 首次调用缓存结果
    public User findById(Long id) {
        return userMapper.findById(id);              // 后续调用直接返回缓存
    }

    @CachePut(value = "users", key = "#user.id")     // 更新缓存
    public User update(User user) {
        userMapper.update(user);
        return user;
    }

    @CacheEvict(value = "users", key = "#id")        // 删除缓存
    public void delete(Long id) {
        userMapper.delete(id);
    }

    @CacheEvict(value = "users", allEntries = true)  // 清空整个缓存区域
    public void clearAll() { }
}
```

### 4.3 缓存注解速查

| 注解 | 作用 | 触发时机 |
|------|------|---------|
| `@Cacheable` | 先查缓存，有则直接返回，无则执行方法并缓存结果 | 方法调用前 |
| `@CachePut` | 总是执行方法，将返回值更新到缓存 | 方法调用后 |
| `@CacheEvict` | 删除缓存中的数据 | 方法调用后 |
| `@Caching` | 组合多个缓存操作 | — |

### 4.4 对接 Redis 缓存

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-data-redis</artifactId>
</dependency>
```

```yaml
spring:
  cache:
    type: redis                 # 指定缓存类型
    redis:
      time-to-live: 600000      # 全局 TTL（毫秒）
  redis:
    host: localhost
    port: 6379
```

引入 Redis 后 `@Cacheable` 注解无需任何修改，底层自动从 `ConcurrentHashMap` 切换到 Redis，缓存数据持久化且多实例共享。

### 4.5 自定义缓存配置

```java
@Configuration
public class CacheConfig {

    @Bean
    public CacheManager cacheManager(RedisConnectionFactory factory) {
        RedisCacheConfiguration config = RedisCacheConfiguration.defaultCacheConfig()
            .entryTtl(Duration.ofMinutes(30))               // 默认过期 30 分钟
            .serializeKeysWith(RedisSerializationContext.SerializationPair
                .fromSerializer(new StringRedisSerializer()))
            .serializeValuesWith(RedisSerializationContext.SerializationPair
                .fromSerializer(new GenericJackson2JsonRedisSerializer()))
            .disableCachingNullValues();                    // 不缓存 null

        return RedisCacheManager.builder(factory)
            .cacheDefaults(config)
            .withCacheConfiguration("users",
                RedisCacheConfiguration.defaultCacheConfig()
                    .entryTtl(Duration.ofHours(1)))         // users 区域单独 1 小时
            .build();
    }
}
```

### 4.6 缓存实现对比

| 实现 | 默认 | 持久化 | 多实例共享 | 适用场景 |
|------|------|--------|-----------|---------|
| ConcurrentHashMap | 是 | 否 | 否 | 开发、单实例小数据 |
| Redis | 否 | 是 | 是 | 生产环境、分布式部署 |
| Caffeine | 否 | 否 | 否 | 本地高性能缓存（需单独引入） |

## 五、统一响应与异常处理

### 5.1 统一响应格式

定义通用响应体，前端无需判断各种返回格式：

```java
@Data
@AllArgsConstructor
@NoArgsConstructor
public class Result<T> {

    private int code;
    private String msg;
    private T data;

    public static <T> Result<T> success(T data) {
        return new Result<>(200, "操作成功", data);
    }

    public static <T> Result<T> error(int code, String msg) {
        return new Result<>(code, msg, null);
    }
}
```

```java
@RestController
@RequestMapping("/users")
public class UserController {

    @GetMapping
    public Result<List<User>> list() {
        List<User> users = userService.findAll();
        return Result.success(users);              // { code:200, msg:"操作成功", data:[...] }
    }

    @GetMapping("/{id}")
    public Result<User> getById(@PathVariable Long id) {
        User user = userService.findById(id);
        return Result.success(user);
    }
}
```

### 5.2 自定义异常

```java
public class BusinessException extends RuntimeException {
    private final int code;

    public BusinessException(int code, String message) {
        super(message);
        this.code = code;
    }

    public BusinessException(String message) {
        super(message);
        this.code = 400;                       // 默认 400
    }

    public int getCode() { return code; }
}
```

业务代码中需要中断时直接抛出：

```java
public User findById(Long id) {
    User user = userMapper.findById(id);
    if (user == null) {
        throw new BusinessException(404, "用户不存在");
    }
    return user;
}
```

### 5.3 全局异常处理器

`@RestControllerAdvice` 统一拦截所有 Controller 抛出的异常，转换为 `Result`：

```java
@RestControllerAdvice
public class GlobalExceptionHandler {

    // 处理自定义业务异常
    @ExceptionHandler(BusinessException.class)
    public Result<?> handleBusinessException(BusinessException e) {
        return Result.error(e.getCode(), e.getMessage());
    }

    // 处理参数校验异常
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public Result<?> handleValidation(MethodArgumentNotValidException e) {
        String msg = e.getBindingResult().getFieldErrors().stream()
            .map(err -> err.getField() + ": " + err.getDefaultMessage())
            .collect(Collectors.joining("; "));
        return Result.error(400, msg);
    }

    // 处理未捕获的运行时异常
    @ExceptionHandler(RuntimeException.class)
    public Result<?> handleRuntimeException(RuntimeException e) {
        log.error("运行时异常", e);
        return Result.error(500, "服务器内部错误");
    }

    // 兜底
    @ExceptionHandler(Exception.class)
    public Result<?> handleException(Exception e) {
        log.error("未知异常", e);
        return Result.error(500, "未知错误");
    }
}
```

### 5.4 异常枚举规范化

将错误码集中管理，避免散落各处的魔法数字：

```java
public enum ResultCode {
    SUCCESS(200, "操作成功"),
    BAD_REQUEST(400, "参数错误"),
    UNAUTHORIZED(401, "未登录"),
    FORBIDDEN(403, "权限不足"),
    NOT_FOUND(404, "资源不存在"),
    CONFLICT(409, "数据冲突"),
    INTERNAL_ERROR(500, "服务器内部错误");

    private final int code;
    private final String msg;

    ResultCode(int code, String msg) { this.code = code; this.msg = msg; }

    public int getCode() { return code; }
    public String getMsg() { return msg; }
}
```

```java
// Result 中使用枚举
public static <T> Result<T> error(ResultCode code) {
    return new Result<>(code.getCode(), code.getMsg(), null);
}

// 抛出时指定枚举
throw new BusinessException(ResultCode.NOT_FOUND.getCode(), "用户不存在");
```

## 六、事务管理

**事务（Transaction）** 是一组操作的执行单元，要么全部成功（提交），要么全部失败（回滚）。Spring 通过 `@Transactional` 注解声明式管理事务，底层基于 **AOP 代理** 拦截方法，在方法执行前后自动控制连接的提交或回滚。

> **核心机制**：Spring 使用 `TransactionInterceptor` 环绕增强目标方法。方法执行前获取数据库连接并关闭自动提交；方法成功则 `commit()`，抛出异常则 `rollback()`。这一切对业务代码透明。

### 6.1 What — 什么是事务

| 特性 | 说明 |
|------|------|
| **原子性（Atomicity）** | 事务内的操作要么全做，要么全不做 |
| **一致性（Consistency）** | 事务前后数据满足所有约束 |
| **隔离性（Isolation）** | 并发事务之间互不干扰 |
| **持久性（Durability）** | 提交后数据永久保存 |

**Spring 的事务抽象**：

| 角色 | 说明 |
|------|------|
| `PlatformTransactionManager` | 事务管理器顶层接口 |
| `DataSourceTransactionManager` | JDBC / MyBatis 事务管理器 |
| `JpaTransactionManager` | JPA / Hibernate 事务管理器 |
| `@Transactional` | 声明式事务注解（生产最常用） |

### 6.2 When — 何时使用事务

**必须使用事务的场景**：
- 同时操作多张表（如：下单 = 插入订单表 + 扣减库存 + 更新用户积分）
- **CUD 组合操作**（Create + Update + Delete）需要保证数据一致性
- 调用外部接口前先保存本地记录，外部调用失败需回滚

**不需要 / 不应使用事务的场景**：
- 纯查询（SELECT 不需要事务，除非需要特定隔离级别或锁）
- 单条简单 INSERT / UPDATE 操作（数据库单条语句隐式事务足以）
- 批量导入大量数据（事务会持有连接和锁，降低吞吐量，可考虑分批事务）

### 6.3 How — 如何使用事务

#### 6.3.1 基础使用

```java
@Service
public class OrderService {

    @Autowired
    private OrderMapper orderMapper;
    @Autowired
    private StockMapper stockMapper;
    @Autowired
    private UserMapper userMapper;

    @Transactional                                 // 方法内所有操作共享一个数据库连接
    public void createOrder(Order order) {
        orderMapper.insert(order);                 // 插入订单
        stockMapper.reduceStock(order.getSkuId()); // 扣减库存
        userMapper.addScore(order.getUserId(), 1); // 增加积分
        // 任一操作抛出 RuntimeException → 全部回滚
    }
}
```

#### 6.3.2 回滚规则

默认只对 `RuntimeException` 和 `Error` 回滚，**受检异常（Exception 子类，不含 RuntimeException）不回滚**。可通过参数自定义：

```java
@Transactional(
    rollbackFor = Exception.class,                // 所有异常都回滚
    noRollbackFor = {BusinessException.class}     // 业务异常不回滚
)
public void createOrder(Order order) {
    // ...
}
```

**最佳实践**：总是显式指定 `rollbackFor = Exception.class`，避免受检异常意外不回滚。

#### 6.3.3 传播行为（Propagation）

控制事务边界——当 `@Transactional` 方法调用另一个 `@Transactional` 方法时如何处理：

| 传播属性 | 行为 |
|---------|------|
| `REQUIRED`（默认） | 支持当前事务，不存在则新建 |
| `REQUIRES_NEW` | 挂起当前事务，新建一个独立事务 |
| `NESTED` | 当前事务内嵌套一个子事务（Savepoint） |
| `SUPPORTS` | 支持当前事务，不存在则以非事务方式执行 |
| `NOT_SUPPORTED` | 以非事务方式执行，挂起当前事务 |
| `MANDATORY` | 必须存在当前事务，否则抛异常 |
| `NEVER` | 必须不在事务中，否则抛异常 |

```java
@Service
public class LogService {

    @Transactional(propagation = Propagation.REQUIRES_NEW)  // 独立事务，不受外部回滚影响
    public void saveLog(Log log) {
        logMapper.insert(log);
    }
}

@Service
public class OrderService {

    @Autowired
    private LogService logService;

    @Transactional
    public void createOrder(Order order) {
        orderMapper.insert(order);
        logService.saveLog(new Log("创建订单"));  // 即使外部回滚，日志依然写入
    }
}
```

**`REQUIRES_NEW` 与 `NESTED` 区别**：

| 特性 | `REQUIRES_NEW` | `NESTED` |
|------|---------------|----------|
| 内层回滚 | 不影响外层 | 可仅回滚到 Savepoint |
| 外层回滚 | 不影响内层（已提交） | 内层也会回滚 |
| 底层实现 | 独立数据库连接 | Savepoint（同一连接） |
| 性能 | 较高（额外连接） | 较低 |

#### 6.3.4 隔离级别（Isolation）

解决并发事务产生的**脏读、不可重复读、幻读**问题：

```java
@Transactional(isolation = Isolation.READ_COMMITTED)
public void queryAndUpdate() { ... }
```

| 隔离级别 | 脏读 | 不可重复读 | 幻读 | 说明 |
|---------|:----:|:--------:|:----:|------|
| `DEFAULT` | — | — | — | 使用数据库默认级别（MySQL = REPEATABLE_READ） |
| `READ_UNCOMMITTED` | ✅ | ✅ | ✅ | 可能读到未提交数据，几乎不用 |
| `READ_COMMITTED` | ❌ | ✅ | ✅ | 大多数数据库默认，避免脏读 |
| `REPEATABLE_READ` | ❌ | ❌ | ✅ | InnoDB 默认，通过 MVCC 避免不可重复读 |
| `SERIALIZABLE` | ❌ | ❌ | ❌ | 完全串行化，性能最低 |

> **MySQL InnoDB 默认 REPEATABLE_READ**，通过 MVCC + Gap Lock 可避免幻读。生产环境最常见的是 `READ_COMMITTED`（Oracle/PostgreSQL 默认）或保持 `DEFAULT`。

#### 6.3.5 超时与只读

```java
@Transactional(
    timeout = 5,          // 超时秒数（默认 -1 不限制）
    readOnly = true       // 只读优化（底层走只读连接，部分数据库可跳过锁）
)
public List<Order> findOrders() {
    return orderMapper.selectList();
}
```

> `readOnly = true` 仅对**纯查询方法**有意义，CUD 操作标记 `readOnly` 会导致写入失败。它会通知 `EntityManager` 或 JDBC 驱动进行性能优化（如 MySQL 跳过脏读检查）。

### 6.4 事务失效场景及解决方案

#### 6.4.1 同类方法自调用（最常踩坑）

```java
@Service
public class OrderService {

    public void createOrder(Order order) {         // 没有 @Transactional
        this.saveOrder(order);                     // ❌ 自调用，事务注解失效
    }

    @Transactional
    public void saveOrder(Order order) {           // 事务不生效
        orderMapper.insert(order);
    }
}
```

**原因**：`@Transactional` 基于 AOP 代理。自调用通过 `this` 直接调用目标方法，**不走代理对象**，因此拦截器不生效。

**解决方案**：

```java
// 方案一：注入自身代理（推荐，配合 @EnableAspectJAutoProxy）
@EnableAspectJAutoProxy(exposeProxy = true)        // 在启动类或配置类上添加

@Service
public class OrderService {

    public void createOrder(Order order) {
        ((OrderService) AopContext.currentProxy()).saveOrder(order);  // 走代理
    }

    @Transactional
    public void saveOrder(Order order) {
        orderMapper.insert(order);
    }
}

// 方案二：拆分到不同 Service
@Service
public class OrderFacade {

    @Autowired
    private OrderService orderService;

    @Transactional
    public void createOrder(Order order) {
        orderService.saveOrder(order);             // 跨类调用 → 走代理 ✅
    }
}

@Service
public class OrderService {

    public void saveOrder(Order order) {
        orderMapper.insert(order);
    }
}
```

#### 6.4.2 异常被 catch 吃掉

```java
@Transactional
public void createOrder(Order order) {
    try {
        orderMapper.insert(order);
        stockMapper.reduceStock(order.getSkuId());
    } catch (Exception e) {
        log.error("操作失败", e);
        // ❌ 没有抛出异常 → 事务认为执行成功，不会回滚
    }
}
```

**解决方案**：catch 后继续抛出异常（或调用 `TransactionAspectSupport` 手动回滚）。

```java
@Transactional
public void createOrder(Order order) {
    try {
        orderMapper.insert(order);
        stockMapper.reduceStock(order.getSkuId());
    } catch (Exception e) {
        log.error("操作失败", e);
        throw e;                                   // ✅ 重新抛出，让拦截器触发回滚
    }
}

// 如果不想抛出给上层，可手动回滚：
@Transactional
public void createOrder(Order order) {
    try {
        orderMapper.insert(order);
        stockMapper.reduceStock(order.getSkuId());
    } catch (Exception e) {
        log.error("操作失败", e);
        TransactionAspectSupport.currentTransactionStatus().setRollbackOnly();  // ✅ 标记回滚
    }
}
```

#### 6.4.3 方法非 public

```java
@Service
public class OrderService {

    @Transactional
    protected void saveOrder(Order order) {        // ❌ protected 方法，事务不生效
        orderMapper.insert(order);
    }
}
```

**原因**：Spring AOP 默认只增强 `public` 方法。非 `public` 方法不会被代理拦截（除非使用 AspectJ 织入）。

**解决方案**：使用 `public` 修饰。

#### 6.4.4 @Transactional 加在接口上

```java
public interface OrderService {
    @Transactional                                 // ❌ 接口注解可能不生效
    void createOrder(Order order);
}
```

**原因**：使用 JDK 动态代理时，接口方法上的 `@Transactional` 可被识别；使用 CGLIB 时，接口注解会被忽略。Spring Boot 2.x+ 默认开启 CGLIB 代理（`spring.aop.proxy-target-class=true`），因此接口注解失效。

**解决方案**：加在实现类的方法上。

#### 6.4.5 使用 new 关键字创建对象

```java
@Service
public class OrderService {

    public void createOrder(Order order) {
        new OtherService().saveOrder(order);       // ❌ new 出来的对象不受 Spring 管理
    }
}

public class OtherService {

    @Transactional
    public void saveOrder(Order order) {           // 事务不生效
        orderMapper.insert(order);
    }
}
```

**解决方案**：确保目标类也被 Spring 管理（标记 `@Service`、`@Component` 等），并通过依赖注入获取实例。

#### 6.4.6 多线程中事务失效

```java
@Transactional
public void processBatch(List<Order> orders) {
    orders.forEach(order -> {
        new Thread(() -> {
            orderMapper.insert(order);             // ❌ 新线程中的操作不在原事务内
        }).start();
    });
}
```

**原因**：事务绑定到当前线程的 `ThreadLocal`（数据库连接），新线程拿不到原事务的连接，也就无法回滚。

**解决方案**：

```java
// 方式一：在循环外执行批量操作
@Transactional
public void processBatch(List<Order> orders) {
    orders.forEach(order -> orderMapper.insert(order));  // ✅ 同一线程，同一事务
}

// 方式二：每个线程内独立事务
public void processBatch(List<Order> orders) {
    orders.forEach(order ->
        CompletableFuture.runAsync(() -> singleInsert(order))  // 异步执行
    );
}

@Transactional(propagation = Propagation.REQUIRES_NEW)
public void singleInsert(Order order) {
    orderMapper.insert(order);
}
```

#### 6.4.7 数据库引擎不支持事务

```java
// application.yml
spring:
  datasource:
    url: jdbc:mysql://localhost:3306/test
    driver-class-name: com.mysql.cj.jdbc.Driver
```

如果某张表使用了 `MyISAM` 引擎（MySQL 5.7 之前默认），则 `@Transactional` 不会报错，但**永远不会回滚**。

**解决方案**：确保表引擎为 InnoDB。

```sql
-- 检查表引擎
SHOW TABLE STATUS WHERE Name = 'orders';

-- 修改为 InnoDB
ALTER TABLE orders ENGINE = InnoDB;
```

#### 6.4.8 事务未被 Spring 管理

```java
// 如果配置中排除了事务管理器：
@SpringBootApplication(exclude = DataSourceTransactionManagerAutoConfiguration.class)
// ❌ 事务管理器未启用，@Transactional 全部失效
```

**解决方案**：确保 `DataSourceTransactionManager` Bean 存在。Spring Boot 自动配置默认已注入，除非手动排除。

#### 6.4.9 @Transactional 与 @Async 混用

```java
@Transactional
@Async                                              // ❌ @Async 会修改目标类的代理
public void asyncSave(Order order) {
    orderMapper.insert(order);
}
```

**原因**：多个 AOP 注解同时作用时，如果顺序不对，`@Async` 的代理可能先于事务代理执行，导致事务不生效。

**解决方案**：分离事务方法与异步方法，或在方法内部显式调用事务方法走代理。

### 6.5 常见问题总结

| 场景 | 原因 | 解决方案 |
|------|------|---------|
| 自调用 | 不走代理 | 使用 `AopContext.currentProxy()` 或拆分 Service |
| 异常被 catch | 未抛出回滚信号 | 重新抛出或 `setRollbackOnly()` |
| 非 public 方法 | AOP 不增强非 public | 改为 `public` |
| 接口上注解 | CGLIB 忽略接口注解 | 加在实现类上 |
| new 对象 | 非 Spring 管理 | 用 `@Autowired` 注入 |
| 多线程 | 事务绑定线程 | 单线程或每线程独立事务 |
| MyISAM | 不支持事务 | 改为 InnoDB |
| 事务管理器未配置 | 自动配置被排除 | 确认 `DataSourceTransactionManager` 存在 |
