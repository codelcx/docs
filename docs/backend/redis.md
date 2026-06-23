---
title: Redis 缓存实战
date: 2026-06-05
category: backend
sort: 700
description: Redis 基础数据类型、过期与淘汰策略、RedisTemplate、StringRedisTemplate、CacheManager、连接池、Redisson 与消息队列全解析
---

# Redis 缓存实战

Redis 是一个基于内存的键值存储系统，以高性能、丰富的数据结构和原子操作著称，广泛用于缓存、会话管理、排行榜、消息队列等场景。本文从基础数据类型入手，逐步深入到 Spring 集成与连接池配置。

## 一、Redis 基础数据类型

Redis 提供了五种核心数据类型，每种类型都对应不同的底层编码和适用场景。

### 1.1 String

String 是 Redis 最基础的类型，值最大 512 MB，支持二进制安全（可存图片、序列化对象）。

**常用命令**：

```bash
SET key value          # 设置键值
GET key                # 获取值
INCR key               # 原子自增 1
DECR key               # 原子自减 1
SETEX key seconds value # 设置带过期时间的值
SETNX key value        # 键不存在时才设置（分布式锁基础）
```

**应用场景**：

```java
// 页面缓存：缓存 HTML/JSON 片段
stringRedisTemplate.opsForValue().set("page:home", htmlContent, Duration.ofMinutes(10));

// 计数器：统计文章访问量
Long count = stringRedisTemplate.opsForValue().increment("article:count:123");
if (count == 1) {
    stringRedisTemplate.expire("article:count:123", Duration.ofDays(1)); // 首次设置过期
}

// 分布式锁
String lockKey = "lock:order:" + orderId;
Boolean locked = stringRedisTemplate.opsForValue()
    .setIfAbsent(lockKey, "locked", Duration.ofSeconds(30));
if (Boolean.TRUE.equals(locked)) {
    try {
        // 执行业务逻辑
    } finally {
        stringRedisTemplate.delete(lockKey);
    }
}

// 分布式 ID
Long id = stringRedisTemplate.opsForValue().increment("global:id:order");
```

### 1.2 Hash

Hash 是一个 field-value 映射表，适合存储对象（如用户信息），相比 String 序列化整对象，Hash 可以单独读写某个字段。

**常用命令**：

```bash
HSET key field value    # 设置字段值
HGET key field          # 获取字段值
HGETALL key             # 获取所有字段和值
HDEL key field          # 删除字段
HEXISTS key field       # 判断字段是否存在
HINCRBY key field num   # 字段原子增减
```

**应用场景**：

```java
// 用户信息：按需读写字段
HashOperations<String, String, Object> hashOps = redisTemplate.opsForHash();
hashOps.put("user:1001", "name", "Alice");
hashOps.put("user:1001", "age", 25);
hashOps.put("user:1001", "email", "alice@example.com");

String name = (String) hashOps.get("user:1001", "name");

// 购物车：用户 1001 的购物车
String cartKey = "cart:1001";
hashOps.put(cartKey, "sku_001", 2);
hashOps.put(cartKey, "sku_002", 1);
hashOps.increment(cartKey, "sku_001", 1); // 加一件
Integer qty = (Integer) hashOps.get(cartKey, "sku_001");
```

### 1.3 List

List 是基于双向链表实现的有序列表，支持两端插入和弹出。

**常用命令**：

```bash
LPUSH key value     # 从左侧插入
RPUSH key value     # 从右侧插入
LPOP key            # 从左侧弹出
RPOP key            # 从右侧弹出
LRANGE key start stop # 获取范围元素
LLEN key            # 获取列表长度
```

**应用场景**：

```java
// 消息队列：生产者
ListOperations<String, Object> listOps = redisTemplate.opsForList();
listOps.leftPush("queue:task", taskJson);

// 消息队列：消费者（阻塞式读取，5 秒超时）
List<Object> task = listOps.rightPop("queue:task", 5, TimeUnit.SECONDS);

// 最新动态：发布新动态，仅保留最近 100 条
listOps.leftPush("feed:user:1001", articleJson);
listOps.trim("feed:user:1001", 0, 99);

// 栈结构：后退导航
listOps.leftPush("history:user:1001", "/page1");
listOps.leftPush("history:user:1001", "/page2");
String back = (String) listOps.leftPop("history:user:1001"); // → /page2
```

### 1.4 Set

Set 是无序、不可重复的集合，支持交、并、差运算。

**常用命令**：

```bash
SADD key member       # 添加成员
SMEMBERS key          # 获取所有成员
SISMEMBER key member  # 判断是否存在
SREM key member       # 移除成员
SCARD key             # 获取成员数量
SINTER key1 key2      # 交集
SUNION key1 key2      # 并集
SDIFF key1 key2       # 差集
```

**应用场景**：

```java
SetOperations<String, Object> setOps = redisTemplate.opsForSet();

// 标签系统：为文章打标签，并找出标签交集
setOps.add("tag:article:1", "java", "redis", "spring");
setOps.add("tag:article:2", "java", "spring", "mybatis");
Set<Object> common = setOps.intersect("tag:article:1", "tag:article:2");
// common → ["java", "spring"]

// 共同好友
Set<Object> mutualFriends = setOps.intersect("friends:user:1", "friends:user:2");

// 抽奖去重：每个用户 ID 只算一次，随机抽取
setOps.add("lottery:2026", "user_001", "user_002", "user_003");
String winner = (String) setOps.randomMember("lottery:2026");
```

### 1.5 ZSet

ZSet（有序集合）每个成员关联一个 double 类型的 score，按 score 排序，成员唯一。

**常用命令**：

```bash
ZADD key score member      # 添加成员
ZRANGE key start stop      # 按 score 升序返回
ZREVRANGE key start stop   # 按 score 降序返回
ZRANK key member           # 获取成员排名（升序）
ZREVRANK key member        # 获取成员排名（降序）
ZREM key member            # 删除成员
ZINCRBY key num member     # 增加成员的 score
```

**应用场景**：

```java
ZSetOperations<String, Object> zsetOps = redisTemplate.opsForZSet();

// 排行榜：玩家积分实时更新
zsetOps.incrementScore("leaderboard:game1", "player_1", 100);
zsetOps.incrementScore("leaderboard:game1", "player_2", 200);
// 获取前三名
Set<Object> top3 = zsetOps.reverseRange("leaderboard:game1", 0, 2);
// 查看某玩家排名
Long rank = zsetOps.reverseRank("leaderboard:game1", "player_1");

// 延时队列：score 为执行时间戳
zsetOps.add("delay:order", "order_001", System.currentTimeMillis() + 30_000);
// 消费者轮询获取到期的任务
Set<Object> tasks = zsetOps.rangeByScore("delay:order", 0, System.currentTimeMillis());
tasks.forEach(task -> {
    zsetOps.remove("delay:order", task);
    // 处理过期订单
});

// 滑动窗口限流：每分钟最多 10 次
String windowKey = "ratelimit:api:" + userId + ":" + (System.currentTimeMillis() / 60_000);
zsetOps.add(windowKey, String.valueOf(System.currentTimeMillis()), System.currentTimeMillis());
zsetOps.removeRangeByScore(windowKey, 0, System.currentTimeMillis() - 60_000);
Long count = zsetOps.zCard(windowKey);
if (count > 10) {
    throw new RuntimeException("触发限流");
}
```

## 二、过期时间与内存淘汰

Redis 作为内存数据库，内存是有限的核心资源。理解 Key 的过期机制和内存淘汰策略，是保障 Redis 稳定运行和高可用的基础。

### 2.1 Key 过期机制

Redis 支持为单个 Key 设置过期时间（TTL，Time To Live），到达过期时间后 Key 会被自动删除。

**常用命令**：

```bash
EXPIRE key seconds        # 设置过期时间（秒）
PEXPIRE key milliseconds  # 设置过期时间（毫秒）
SETEX key seconds value   # 设置值同时指定过期时间（秒）
EXPIREAT key timestamp    # 设置过期时间戳（秒级 Unix 时间戳）
TTL key                   # 查看剩余时间（秒），-1 表示永不过期，-2 表示已过期
PTTL key                  # 查看剩余时间（毫秒）
PERSIST key               # 移除过期时间，永不过期
```

```java
// 设置过期时间
stringRedisTemplate.expire("key", 30, TimeUnit.MINUTES);
stringRedisTemplate.opsForValue().set("key", "value", Duration.ofMinutes(30));

// 检查剩余过期时间
Long ttl = stringRedisTemplate.getExpire("key", TimeUnit.SECONDS);
if (ttl != null && ttl > 0) {
    System.out.println("剩余 " + ttl + " 秒过期");
}

// 移除过期时间
stringRedisTemplate.persist("key");
```

**过期删除策略**：Redis 采用三种策略的组合来删除过期 Key：

| 策略 | 说明 | 优缺点 |
|------|------|--------|
| 定时删除 | 创建 Key 时启动定时器，到期立即删除 | 内存友好，但大量定时器消耗 CPU |
| 惰性删除 | 每次访问 Key 时检查是否过期，过期则删除 | CPU 友好，但过期 Key 可能长时间占用内存 |
| 定期删除 | 每隔 100ms 随机抽查部分 Key，删除过期的 | 折中方案，兼顾 CPU 和内存 |

Redis 实际使用 **惰性删除 + 定期删除** 的组合：定期删除兜底清理，惰性删除保证访问时的一致性。

### 2.2 内存淘汰策略

当 Redis 内存使用达到 `maxmemory` 上限时，会触发内存淘汰，根据配置的策略选择哪些 Key 被删除。

**配置 maxmemory**：

```bash
# redis.conf
maxmemory 2gb
maxmemory-policy allkeys-lru

# 运行时动态设置
CONFIG SET maxmemory 2gb
CONFIG SET maxmemory-policy allkeys-lru
```

**8 种淘汰策略**：

| 策略 | 说明 | 适用场景 |
|------|------|---------|
| `noeviction` | 不淘汰，写入直接报错 | 数据库级数据，不允许丢失 |
| `allkeys-lru` | 从所有 Key 中淘汰最近最少使用的 | 最常用，适用于缓存场景 |
| `allkeys-lfu` | 从所有 Key 中淘汰最不经常使用的 | 访问频率差异明显的场景 |
| `allkeys-random` | 从所有 Key 中随机淘汰 | 数据访问均匀的场景 |
| `volatile-lru` | 从设了过期时间的 Key 中淘汰最近最少使用的 | 缓存 + 持久化混合 |
| `volatile-lfu` | 从设了过期时间的 Key 中淘汰最不经常使用的 | 缓存 + 持久化混合 |
| `volatile-random` | 从设了过期时间的 Key 中随机淘汰 | 缓存 + 持久化混合 |
| `volatile-ttl` | 从设了过期时间的 Key 中淘汰即将过期的 | 优先淘汰快过期的 |

**LRU 与 LFU 的区别**：

| 算法 | 淘汰依据 | 适用场景 |
|------|---------|---------|
| LRU（Least Recently Used） | 最后一次访问时间，淘汰最久未访问的 | 热点数据相对稳定 |
| LFU（Least Frequently Used） | 访问频率，淘汰访问次数最少的 | 存在长期热点，避免偶发大流量污染 |

### 2.3 淘汰策略选择建议

| 场景 | 推荐策略 | 理由 |
|------|---------|------|
| 纯缓存（允许全部淘汰） | `allkeys-lru` | 兼顾性能和内存利用率 |
| 访问频率差异大 | `allkeys-lfu` | 避免偶发访问污染缓存 |
| 数据均匀访问 | `allkeys-random` | 无淘汰开销，公平 |
| 部分数据不可丢失 | `volatile-lru` + 只对缓存 Key 设过期 | 无过期时间的 Key 永不被淘汰 |
| 不允许任何淘汰 | `noeviction` | 数据完整性第一 |

### 2.4 过期与淘汰的协作关系

过期和淘汰共同决定了 Redis 的内存使用行为：

- **过期**：主动/被动删除已到生命周期的数据，是预期的数据清理
- **淘汰**：内存不足时强制删除数据，是被动的降级手段
- **优先级**：Key 即使未过期，也可能因淘汰策略被提前删除（`allkeys-*` 系列）

注意事项：

1. 合理设置过期时间，避免大量 Key 同时过期导致缓存雪崩（参考 **8.2 节**）
2. 热点 Key 的过期时间加随机偏移，减少集中失效
3. 对于不需要自动删除的数据（如持久化配置），不必设置过期时间
4. 设置 `maxmemory` 预留内存给系统自身开销，建议不超过物理内存的 80%

---

## 三、RedisTemplate 使用详解

`RedisTemplate` 是 Spring Data Redis 提供的核心操作类，封装了与 Redis 交互的底层细节。

### 3.1 依赖与配置

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-data-redis</artifactId>
</dependency>
```

```yaml
spring:
  data:
    redis:
      host: localhost
      port: 6379
      password: ${REDIS_PASSWORD:}
      database: 0
      timeout: 3000ms
      lettuce:
        pool:
          enabled: true
          max-active: 16
          max-idle: 8
          min-idle: 2
```

### 3.2 RedisTemplate Bean 配置

默认情况下 Spring Boot 会自动配置 `RedisTemplate<Object, Object>`, 但默认使用 JDK 序列化，存到 Redis 中为二进制数据，可读性差。通常自定义配置：

```java
@Configuration
public class RedisConfig {

    @Bean
    public RedisTemplate<String, Object> redisTemplate(RedisConnectionFactory factory) {
        RedisTemplate<String, Object> template = new RedisTemplate<>();
        template.setConnectionFactory(factory);

        // JSON 序列化
        Jackson2JsonRedisSerializer<Object> jsonSerializer = new Jackson2JsonRedisSerializer<>(Object.class);
        ObjectMapper om = new ObjectMapper();
        om.setVisibility(PropertyAccessor.ALL, JsonAutoDetect.Visibility.ANY);
        om.activateDefaultTyping(om.getPolymorphicTypeValidator(), ObjectMapper.DefaultTyping.NON_FINAL);
        jsonSerializer.setObjectMapper(om);

        // String 序列化（key 使用）
        StringRedisSerializer stringSerializer = new StringRedisSerializer();

        template.setKeySerializer(stringSerializer);
        template.setHashKeySerializer(stringSerializer);
        template.setValueSerializer(jsonSerializer);
        template.setHashValueSerializer(jsonSerializer);

        template.afterPropertiesSet();
        return template;
    }
}
```

### 3.3 Ops 操作

`RedisTemplate` 通过 `opsForXxx()` 方法获取对应数据类型的操作器：

```java
@Autowired
private RedisTemplate<String, Object> redisTemplate;

// String
ValueOperations<String, Object> ops = redisTemplate.opsForValue();
ops.set("key", "value");
Object val = ops.get("key");
ops.increment("counter", 1);

// Hash
HashOperations<String, String, Object> hashOps = redisTemplate.opsForHash();
hashOps.put("user:1", "name", "Alice");
hashOps.put("user:1", "age", 25);
String name = (String) hashOps.get("user:1", "name");

// List
ListOperations<String, Object> listOps = redisTemplate.opsForList();
listOps.leftPush("queue", "task1");
listOps.leftPush("queue", "task2");
Object task = listOps.rightPop("queue");

// Set
SetOperations<String, Object> setOps = redisTemplate.opsForSet();
setOps.add("tags:article:1", "java", "redis", "spring");
Set<Object> tags = setOps.members("tags:article:1");

// ZSet
ZSetOperations<String, Object> zsetOps = redisTemplate.opsForZSet();
zsetOps.add("leaderboard", "player1", 100.0);
zsetOps.add("leaderboard", "player2", 200.0);
Set<Object> topPlayers = zsetOps.reverseRange("leaderboard", 0, 2);
```

### 3.4 序列化机制

| 序列化器 | 特点 | 适用场景 |
|----------|------|---------|
| `StringRedisSerializer` | 纯字符串，可读性好 | Key 序列化 |
| `Jackson2JsonRedisSerializer` | JSON 格式，跨语言 | Value 序列化 |
| `JdkSerializationRedisSerializer` | Java 原生（默认），二进制 | 不推荐，可读性差、体积大 |
| `GenericJackson2JsonRedisSerializer` | 自带类型信息，安全 | Value 序列化（推荐） |

**推荐策略**：Key 用 `StringRedisSerializer`，Value 用 `GenericJackson2JsonRedisSerializer`，兼顾可读性与灵活性。

## 四、StringRedisTemplate 与 RedisTemplate 的区别

### 4.1 对比

| 维度 | RedisTemplate | StringRedisTemplate |
|------|---------------|-------------------|
| 泛型 | `<K, V>` 任意类型 | `<String, String>` 固定 |
| 默认 Key 序列化 | `JdkSerializationRedisSerializer` | `StringRedisSerializer` |
| 默认 Value 序列化 | `JdkSerializationRedisSerializer` | `StringRedisSerializer` |
| 继承关系 | 直接继承 `RedisAccessor` | 继承 `RedisTemplate<String, String>` |
| 数据可读性 | Redis 中为二进制乱码 | 明文可读 |

### 4.2 选择建议

- **StringRedisTemplate**：适合 key 和 value 都是字符串的场景（如缓存 JSON 字符串、验证码），与 `redis-cli` 操作一致，调试方便
- **RedisTemplate**：需要存取对象、自动序列化/反序列化的场景（如直接存 Java 对象），配合 JSON 序列化器使用
- **组合使用**：项目中可同时注入两个 Bean，按需选用

```java
@Autowired
private StringRedisTemplate stringRedisTemplate;

@Autowired
private RedisTemplate<String, Object> redisTemplate;

// StringRedisTemplate：存 JSON 字符串
stringRedisTemplate.opsForValue().set("user:1", "{\"name\":\"Alice\"}");

// RedisTemplate：存 Java 对象（自动序列化）
User user = new User("Alice", 25);
redisTemplate.opsForValue().set("user:2", user);
```

## 五、Spring Cache + Redis 缓存管理

Spring Cache 提供了声明式缓存抽象，结合 Redis 作为缓存存储，可零侵入地添加缓存能力。

### 5.1 开启缓存

```java
@EnableCaching
@SpringBootApplication
public class Application {
    public static void main(String[] args) {
        SpringApplication.run(Application.class, args);
    }
}
```

### 5.2 核心注解

```java
@Service
public class UserService {

    // 查询缓存：先查缓存，命中直接返回；未命中执行方法并存入缓存
    @Cacheable(value = "users", key = "#id")
    public User getUserById(Long id) {
        return userMapper.selectById(id);
    }

    // 更新缓存：始终执行方法，并将结果存入缓存
    @CachePut(value = "users", key = "#user.id")
    public User updateUser(User user) {
        userMapper.updateById(user);
        return user;
    }

    // 删除缓存
    @CacheEvict(value = "users", key = "#id")
    public void deleteUser(Long id) {
        userMapper.deleteById(id);
    }

    // 清空整个缓存分区
    @CacheEvict(value = "users", allEntries = true)
    public void clearAll() {}
}
```

**注解说明**：

| 注解 | 行为 | 适用场景 |
|------|------|---------|
| `@Cacheable` | 先查缓存，有则返回，无则执行并缓存 | 查询方法 |
| `@CachePut` | 总是执行方法，将结果写入缓存 | 更新/新增方法 |
| `@CacheEvict` | 删除缓存 | 删除方法 |
| `@Caching` | 组合多个缓存注解 | 复杂缓存策略 |

**SpEL 表达式 key 示例**：

```java
@Cacheable(value = "users", key = "#root.methodName + ':' + #id")
@Cacheable(value = "users", key = "#result.id")
@Cacheable(value = "users", condition = "#id > 1000")
```

### 5.3 RedisCacheManager 配置

自定义 `RedisCacheManager` 可控制序列化方式、默认过期时间和缓存分区前缀：

```java
@Configuration
public class CacheConfig {

    @Bean
    public RedisCacheManager cacheManager(RedisConnectionFactory factory) {
        RedisCacheConfiguration config = RedisCacheConfiguration.defaultCacheConfig()
            .entryTtl(Duration.ofMinutes(30))        // 默认过期时间
            .disableCachingNullValues()               // 不允许缓存 null
            .serializeKeysWith(
                RedisSerializationContext.SerializationPair.fromSerializer(new StringRedisSerializer()))
            .serializeValuesWith(
                RedisSerializationContext.SerializationPair.fromSerializer(
                    new GenericJackson2JsonRedisSerializer()));

        return RedisCacheManager.builder(factory)
            .cacheDefaults(config)
            .withCacheConfiguration("users",          // 分区独立配置
                RedisCacheConfiguration.defaultCacheConfig().entryTtl(Duration.ofMinutes(10)))
            .withCacheConfiguration("config",
                RedisCacheConfiguration.defaultCacheConfig().entryTtl(Duration.ofDays(1)))
            .build();
    }
}
```

### 5.4 自定义 Key 生成器

```java
@Component("customKeyGenerator")
public class CustomKeyGenerator implements KeyGenerator {
    @Override
    public Object generate(Object target, Method method, Object... params) {
        return target.getClass().getSimpleName() + ":" + method.getName() + ":"
            + Arrays.stream(params).map(String::valueOf).collect(Collectors.joining("_"));
    }
}

// 使用
@Cacheable(value = "users", keyGenerator = "customKeyGenerator")
public User getUser(Long id, String name) { ... }
```

## 六、Redis 连接池原理与配置

### 6.1 连接池的作用

Redis 连接基于 TCP，每次创建和销毁连接都有开销。连接池维护一组已建立的连接，复用而非重建，显著提升性能。

Spring Boot 2.x 起默认使用 **Lettuce**（基于 Netty，异步非阻塞），替代了旧版的 Jedis（同步阻塞）。

| 客户端 | 线程模型 | 特点 |
|--------|---------|------|
| Jedis | 同步阻塞 | 每个实例对应一个连接，需配合连接池 |
| Lettuce | 异步非阻塞（Netty） | 单连接多线程共享，默认自带池化支持 |

### 6.2 常用参数

```yaml
spring:
  data:
    redis:
      lettuce:
        pool:
          enabled: true          # 启用连接池
          max-active: 16         # 最大活跃连接数（默认 8）
          max-idle: 8            # 最大空闲连接数（默认 8）
          min-idle: 2            # 最小空闲连接数（默认 0）
          max-wait: -1ms         # 获取连接的最大等待时间（-1 表示无限等待）
          time-between-eviction-runs: 100ms # 空闲连接回收间隔
```

**参数调优建议**：

| 参数 | 说明 | 建议 |
|------|------|------|
| `max-active` | 最大连接数 | 根据并发量调整，一般 16-64 |
| `max-idle` | 最大空闲数 | 与 max-active 一致或略低 |
| `min-idle` | 最小空闲数 | 高并发场景设 2-8，避免冷启动 |
| `max-wait` | 获取连接超时 | 建议 1000-3000ms，避免永久阻塞 |
| `time-between-eviction-runs` | 回收间隔 | 默认空值（不回收），建议设 100-200ms |

### 6.3 Spring Boot 配置示例

完整的 Redis + 连接池配置：

```yaml
spring:
  data:
    redis:
      host: ${REDIS_HOST:localhost}
      port: ${REDIS_PORT:6379}
      password: ${REDIS_PASSWORD:}
      database: ${REDIS_DATABASE:0}
      timeout: 3000ms               # 读写超时
      connect-timeout: 2000ms       # 连接超时
      lettuce:
        pool:
          enabled: true
          max-active: 32
          max-idle: 16
          min-idle: 4
          max-wait: 2000ms
          time-between-eviction-runs: 100ms
        shutdown-timeout: 100ms     # 关闭超时
```

**监控连接池状态**：

```java
@Component
public class RedisPoolMonitor {

    @EventListener
    public void onApplicationEvent(ApplicationReadyEvent event) {
        // Actuator 端点暴露连接池指标
        // 配置：management.endpoints.web.exposure.include=health,metrics
    }
}
```

通过 `actuator` 可查看连接池指标：`/actuator/health` 和 `/actuator/metrics/lettuce.pool.*`。

## 七、缓存更新策略

### 7.1 Cache Aside（旁路缓存）

Cache Aside 是目前应用最广的缓存更新策略：

- **读操作**：先查缓存，命中则直接返回；未命中则查数据库，再写入缓存，最后返回
- **写操作**：先更新数据库，再删除缓存

**为什么是删除缓存而不是更新缓存？**

更新缓存相当于"写两次"，并发场景下后写的旧值可能覆盖先写的新值，导致不一致。而删除缓存采用懒加载方式，下次读取时自动加载最新数据，更简单可靠。

**为什么先更新数据库再删除缓存？**

如果先删缓存再更新数据库，并发时会有一个时间窗口：
1. 线程 A 删除缓存
2. 线程 B 读缓存未命中，查数据库得到旧值并写入缓存
3. 线程 A 更新数据库为新值

此时缓存中为旧值，数据不一致。而**先更新数据库再删除缓存**只有在删除缓存那一刻失败时才可能出现不一致，概率更低。

```java
@Service
public class UserService {

    @Autowired
    private StringRedisTemplate redisTemplate;

    public User getUser(Long id) {
        String key = "user:" + id;
        // 1. 查询缓存
        String json = redisTemplate.opsForValue().get(key);
        if (StrUtil.isNotBlank(json)) {
            return JSONUtil.toBean(json, User.class);
        }
        // 2. 缓存未命中，查数据库
        User user = userMapper.selectById(id);
        if (user != null) {
            // 3. 写入缓存，设置过期时间防止雪崩
            redisTemplate.opsForValue().set(key, JSONUtil.toJsonStr(user), 30, TimeUnit.MINUTES);
        }
        return user;
    }

    @Transactional
    public void updateUser(User user) {
        // 1. 更新数据库
        userMapper.updateById(user);
        // 2. 删除缓存
        redisTemplate.delete("user:" + user.getId());
    }
}
```

**延时双删**：极端场景下可在更新数据库后延迟几百毫秒再次删除缓存，作为兜底：

```java
@Transactional
public void updateUser(User user) {
    redisTemplate.delete("user:" + user.getId());
    userMapper.updateById(user);
    ThreadPoolUtil.schedule(() -> redisTemplate.delete("user:" + user.getId()), 500, TimeUnit.MILLISECONDS);
}
```

### 7.2 Read/Write Through（读写穿透）

Read/Write Through 将缓存视为底层存储的唯一数据访问层，应用只与缓存交互：

- **Read Through**：缓存未命中时，由缓存组件自动加载数据库数据
- **Write Through**：写入时先更新缓存，再由缓存组件同步写入数据库

Spring Cache 的 `@Cacheable` / `@CachePut` 本质上就是 Read/Write Through 的实现：

```java
@Cacheable(value = "user", key = "#id")
public User getUser(Long id) {
    // 缓存未命中时自动调用
    return userMapper.selectById(id);
}

@CachePut(value = "user", key = "#user.id")
public User updateUser(User user) {
    userMapper.updateById(user);
    return user; // 返回值自动写入缓存
}
```

### 7.3 Write Behind（异步写回）

Write Behind 策略只更新缓存，然后异步批量写入数据库：

**优点**：写入性能极高，可合并多次写操作，适合写密集型场景

**缺点**：缓存宕机时未持久化的数据丢失，一致性弱

典型应用：MySQL 的 Buffer Pool、Redis 的 AOF 持久化均借鉴了此思想。纯业务层较少直接使用。

---

## 八、缓存常见问题

### 8.1 缓存穿透

**定义**：查询一个不存在的数据，缓存和数据库均无此记录，每次请求都穿透到数据库。

**危害**：恶意攻击者可构造大量不存在 key，直接打垮数据库。

**解决方案**：

| 方案 | 说明 | 适用场景 |
|------|------|----------|
| 缓存空值 | 将 null 缓存，设较短过期时间 | 通用方案，实现简单 |
| 布隆过滤器 | 不存在的数据直接拦截 | 数据量大、不要求 100% 准确 |
| 参数校验 | 对非法参数直接拒绝 | 配合其他方案使用 |

```java
public User getUser(Long id) {
    String key = "user:" + id;
    String json = redisTemplate.opsForValue().get(key);
    if (StrUtil.isNotBlank(json)) {
        return JSONUtil.toBean(json, User.class);
    }
    // 缓存空值命中（null 标记）
    if (json != null) {
        return null;
    }
    User user = userMapper.selectById(id);
    if (user == null) {
        // 缓存空值，短过期时间兜底
        redisTemplate.opsForValue().set(key, "", 60, TimeUnit.SECONDS);
        return null;
    }
    redisTemplate.opsForValue().set(key, JSONUtil.toJsonStr(user), 30, TimeUnit.MINUTES);
    return user;
}
```

**布隆过滤器实现**：

```xml
<dependency>
    <groupId>org.redisson</groupId>
    <artifactId>redisson-spring-boot-starter</artifactId>
</dependency>
```

```java
@Component
public class BloomFilterService {

    @Autowired
    private RedissonClient redissonClient;

    @PostConstruct
    public void init() {
        RBloomFilter<Long> bloomFilter = redissonClient.getBloomFilter("userBloom");
        bloomFilter.tryInit(100000L, 0.01); // 10 万预期元素，1% 误判率
        List<Long> allIds = userMapper.selectAllIds();
        allIds.forEach(bloomFilter::add);
    }

    public boolean mightExist(Long id) {
        RBloomFilter<Long> bloomFilter = redissonClient.getBloomFilter("userBloom");
        return bloomFilter.contains(id);
    }
}
```

### 8.2 缓存雪崩

**定义**：大量缓存 key 同一时间过期，或 Redis 节点宕机，全部请求直击数据库。

**解决方案**：

| 方案 | 说明 |
|------|------|
| 过期时间加随机值 | 避免大量 key 同时过期 |
| 缓存预热 | 系统上线前预先加载热点数据 |
| 多级缓存 | 本地 Caffeine + Redis 二级缓存 |
| 限流降级 | Sentinel 限流，保护数据库 |
| 高可用架构 | 主从 + 哨兵 / Cluster 集群 |

```java
// 设置过期时间加随机偏移
public void setWithRandomExpire(String key, String value, long baseTime, TimeUnit unit) {
    long random = ThreadLocalRandom.current().nextLong(60000); // 0~60 秒随机
    redisTemplate.opsForValue().set(key, value, baseTime + random, unit);
}

// 批量设置时使用
for (Long id : hotIds) {
    setWithRandomExpire("user:" + id, json, 30, TimeUnit.MINUTES);
}
```

### 8.3 缓存击穿

**定义**：一个热点 key 在过期瞬间，大量并发请求同时发现缓存失效，全部查询数据库。

**区别**：穿透针对不存在的数据，击穿针对热点 key 过期，雪崩针对大量 key 同时过期。

**解决方案**：

**1. 互斥锁**：只允许一个线程查数据库，其他线程等待

```java
public User getUserWithLock(Long id) {
    String key = "user:" + id;
    // 1. 查缓存
    String json = redisTemplate.opsForValue().get(key);
    if (StrUtil.isNotBlank(json)) {
        return JSONUtil.toBean(json, User.class);
    }
    // 缓存空值命中
    if (json != null) {
        return null;
    }
    // 2. 加互斥锁
    String lockKey = "lock:user:" + id;
    String lockValue = UUID.randomUUID().toString();
    Boolean locked = redisTemplate.opsForValue()
        .setIfAbsent(lockKey, lockValue, 10, TimeUnit.SECONDS);
    if (Boolean.TRUE.equals(locked)) {
        try {
            // 双重检查
            json = redisTemplate.opsForValue().get(key);
            if (StrUtil.isNotBlank(json)) {
                return JSONUtil.toBean(json, User.class);
            }
            if (json != null) {
                return null;
            }
            User user = userMapper.selectById(id);
            if (user != null) {
                redisTemplate.opsForValue().set(key, JSONUtil.toJsonStr(user), 30, TimeUnit.MINUTES);
            } else {
                redisTemplate.opsForValue().set(key, "", 60, TimeUnit.SECONDS);
            }
            return user;
        } finally {
            // Lua 脚本原子释放锁
            String script = "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end";
            redisTemplate.execute(new DefaultRedisScript<>(script, Long.class),
                Collections.singletonList(lockKey), lockValue);
        }
    }
    // 3. 获取锁失败，等待后重试
    try {
        Thread.sleep(100);
    } catch (InterruptedException e) {
        Thread.currentThread().interrupt();
    }
    return getUserWithLock(id);
}
```

**2. 逻辑过期**：不设物理过期时间，在 value 中存逻辑过期字段，异步刷新

```java
public class CacheData<T> {
    private T data;
    private long expireTime; // 逻辑过期时间戳
}

public User getUserWithLogicalExpire(Long id) {
    String key = "user:" + id;
    String json = redisTemplate.opsForValue().get(key);

    // 1. 缓存未命中，查数据库
    if (json == null) {
        User user = userMapper.selectById(id);
        if (user != null) {
            CacheData<User> cacheData = new CacheData<>(user, System.currentTimeMillis() + 30000);
            redisTemplate.opsForValue().set(key, JSONUtil.toJsonStr(cacheData));
        }
        return user;
    }

    // 2. 空值标记命中，直接返回
    if (StrUtil.isBlank(json)) {
        return null;
    }

    // 3. 解析缓存数据
    CacheData<User> cacheData = JSONUtil.toBean(json, new TypeReference<CacheData<User>>() {});

    // 4. 逻辑未过期，直接返回
    if (cacheData.getExpireTime() > System.currentTimeMillis()) {
        return cacheData.getData();
    }

    // 5. 逻辑过期，获取互斥锁后异步刷新缓存
    String lockKey = "lock:" + key;
    if (Boolean.TRUE.equals(redisTemplate.opsForValue().setIfAbsent(lockKey, "", 3, TimeUnit.SECONDS))) {
        ThreadPoolUtil.execute(() -> {
            try {
                User user = userMapper.selectById(id);
                CacheData<User> newCache = new CacheData<>(user, System.currentTimeMillis() + 30000);
                redisTemplate.opsForValue().set(key, JSONUtil.toJsonStr(newCache));
            } finally {
                redisTemplate.delete(lockKey);
            }
        });
    }

    // 6. 先返回旧数据（即使逻辑过期）
    return cacheData.getData();
}
```

### 8.4 数据一致性

**问题**：缓存和数据库的数据不一致是分布式系统中的经典难题，无法彻底避免，只能通过策略降低发生概率。

**常见不一致场景**：

| 操作顺序 | 问题 |
|----------|------|
| 先更新数据库，再更新缓存 | 并发写时旧值覆盖新值 |
| 先删除缓存，再更新数据库 | 并发读时写入旧值 |
| 先更新数据库，再删除缓存 | 删除缓存失败则数据不一致 |

**推荐方案：Cache Aside + 过期时间兜底**

1. 采用 Cache Aside 模式：更新数据库后删除缓存
2. 所有缓存设置过期时间作为最终一致性的最后一道防线
3. 配合**延时双删**或**MQ 异步重试**保障删除成功

**MQ 异步重试保障**：

```java
@Transactional
public void updateUser(User user) {
    userMapper.updateById(user);
    // 发送 MQ 消息，异步删除缓存
    rabbitTemplate.convertAndSend("cache.exchange", "cache.delete", "user:" + user.getId());
}

@RabbitListener(queues = "cache.delete.queue")
public void handleCacheDelete(String key) {
    try {
        redisTemplate.delete(key);
    } catch (Exception e) {
        // 重试机制：消息重新入队
        throw new AmqpRejectAndDontRequeueException(e);
    }
}
```

**Binlog 订阅（Canal）**：

对于要求强一致性的场景，可通过 Canal 订阅 MySQL binlog 变更，实时同步 Redis：

- 业务代码只操作数据库，不关注缓存
- Canal 监听 binlog 变化，推送至 MQ
- 消费端根据变更内容更新 Redis

优点是完全解耦，缺点是引入 Canal 运维成本高。生产环境大部分场景接受最终一致性即可。

## 九、多级缓存

多级缓存根据数据访问热度分层缓存，越靠近用户延迟越低。典型架构为 **Nginx 共享字典（L0）→ 应用本地缓存（L1）→ Redis（L2）→ DB**，查询时逐级查找，miss 后向下查询并回填上层。

```
请求 → Nginx L0（共享字典）→ 应用 L1（Caffeine）→ Redis L2 → DB
         ↓ 命中返回       ↓ 命中返回        ↓ 命中返回    ↓ 回源
         ← 回填 L0        ← 回填 L1         ← 回填 L2
```

### 9.1 为什么需要多级缓存

Redis 虽快，但每次读取仍有 ~1-5ms 网络开销。对于热点数据（如首页推荐、热门文章），单机 QPS 上到万级后 Redis 压力显著，且网络延迟成为瓶颈。本地缓存将热点数据存于应用进程内存中，读取延迟降到微秒级（~0.1ms），且完全不占用网络和 Redis 资源。Nginx 层缓存则更进一步，在网关层直接拦截热点请求，连应用服务器都不需要到达。

| 维度 | 单级 Redis | Caffeine + Redis | Nginx + Caffeine + Redis |
|------|-----------|-----------------|-------------------------|
| 读取延迟 | ~1-5ms（网络 IO） | ~0.1ms（本地内存） | ~0.01ms（Nginx 共享内存） |
| Redis 压力 | 高（每次请求） | 低（L1 拦截热数据） | 极低（L0 拦截热数据） |
| 数据一致性 | 好（唯一副本） | L1 短暂滞后 | L0 短暂滞后（短 TTL 缓解） |
| 复杂度 | 低 | 中 | 高（需维护 Lua 脚本） |
| 适用场景 | 一致性要求极高 | 读多写少，允许秒级不一致 | 超高并发读，允许分钟级不一致 |

### 9.2 实现方案

**Maven 依赖**：

```xml
<dependency>
    <groupId>com.github.ben-manes.caffeine</groupId>
    <artifactId>caffeine</artifactId>
</dependency>
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-cache</artifactId>
</dependency>
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-data-redis</artifactId>
</dependency>
```

**自定义多级 CacheManager**：

```java
@Configuration
public class MultiLevelCacheConfig {

    @Bean
    public CacheManager cacheManager(RedisConnectionFactory redisFactory) {
        // L1: Caffeine 本地缓存
        CaffeineCacheManager caffeine = new CaffeineCacheManager();
        caffeine.setCaffeine(Caffeine.newBuilder()
            .maximumSize(5000)
            .expireAfterWrite(60, TimeUnit.SECONDS));     // L1 短 TTL，保证时效

        // L2: Redis 分布式缓存
        RedisCacheConfiguration redisConfig = RedisCacheConfiguration.defaultCacheConfig()
            .entryTtl(Duration.ofMinutes(30))
            .serializeValuesWith(RedisSerializationContext.SerializationPair
                .fromSerializer(new GenericJackson2JsonRedisSerializer()));

        RedisCacheManager redis = RedisCacheManager.builder(redisFactory)
            .cacheDefaults(redisConfig)
            .build();

        // 组合：优先走 Caffeine，miss 后查 Redis
        return new MultiLevelCacheManager(caffeine, redis);
    }
}
```

**MultiLevelCacheManager** 实现两级查找逻辑：

```java
public class MultiLevelCacheManager implements CacheManager {
    private final CacheManager l1;
    private final CacheManager l2;

    public MultiLevelCacheManager(CacheManager l1, CacheManager l2) {
        this.l1 = l1;
        this.l2 = l2;
    }

    @Override
    public Cache getCache(String name) {
        return new MultiLevelCache(l1.getCache(name), l2.getCache(name));
    }
}

public class MultiLevelCache implements Cache {
    private final Cache l1;
    private final Cache l2;

    @Override
    public ValueWrapper get(Object key) {
        ValueWrapper wrapper = l1.get(key);
        if (wrapper != null) return wrapper;

        wrapper = l2.get(key);
        if (wrapper != null) {
            l1.put(key, wrapper.get());     // L1 miss → 回填 L1
        }
        return wrapper;
    }

    @Override
    public void put(Object key, Object value) {
        l1.put(key, value);
        l2.put(key, value);
    }

    @Override
    public void evict(Object key) {
        l1.evict(key);
        l2.evict(key);
    }
}
```

使用方式和 Spring Cache 完全一致，`@Cacheable` 注解无需任何改动：

```java
@Service
public class ArticleService {

    @Cacheable(value = "articles", key = "#id")
    public Article getArticle(Long id) {
        return articleMapper.selectById(id);    // L1 → L2 → DB 自动逐级回填
    }

    @CacheEvict(value = "articles", key = "#id")
    public void deleteArticle(Long id) {
        articleMapper.deleteById(id);
    }
}
```

### 9.3 缓存同步策略

多级缓存的核心挑战是 **L1 与 L2 的一致性**。本地缓存分布在每个应用实例中，一个实例更新数据后，其他实例的 L1 无法感知。

| 策略 | 说明 | 一致性 | 复杂度 |
|------|------|:------:|:------:|
| **L1 短 TTL** | L1 过期时间短（30-60s），到期后自动从 L2 拉取最新值 | 最终一致 | 低 |
| **写操作双删** | 更新 DB 后，先删 L1，再删 L2，通知其他实例删 L1 | 最终一致 | 中 |
| **Redis Pub/Sub 广播** | 更新时发广播通知所有实例清除本地缓存 | 最终一致 | 中 |
| **Redis Key 空间通知** | 利用 Redis 的 Keyspace Notification 监听 key 变化 | 最终一致 | 高 |

**推荐组合：短 TTL + 写操作双删**

```java
@Transactional
public void updateArticle(Article article) {
    // 1. 删除本地缓存（当前实例）
    cacheManager.getCache("articles").evict(article.getId());

    // 2. 更新数据库
    articleMapper.updateById(article);

    // 3. 删除 Redis 缓存
    redisTemplate.delete("articles::" + article.getId());

    // 4. 通知其他实例删除本地缓存（可选，通过 MQ/Redis Pub/Sub）
    redisTemplate.convertAndSend("cache:evict", "articles::" + article.getId());
}
```

L1 短 TTL 作为兜底，即使双删失败（如网络异常），最多也只会在 TTL 时间内读到旧数据。

### 9.4 关键配置建议

| 参数 | 建议 | 说明 |
|------|------|------|
| Caffeine `maximumSize` | 1000-10000 | 根据应用可用内存调整，防止 OOM |
| Caffeine `expireAfterWrite` | 30-60s | L1 TTL 越短一致性越好，但命中率下降 |
| Redis `entryTtl` | 10-30min | L2 TTL 可较长，承担分布式共享兜底 |
| Redis `maxmemory` | 物理内存 80% | 预留内存给系统自身 |
| 淘汰策略 | `allkeys-lru` | 热数据优先保留 |

### 9.5 Nginx 层缓存（OpenResty + Lua）

在高并发读场景下，Nginx 作为流量入口，可在网关层直接缓存热点数据，请求无需到达应用服务器，延迟最低（共享内存，~0.01ms）。OpenResty 基于 Nginx + LuaJIT，在 Nginx 阶段嵌入 Lua 脚本操作 Redis，实现 Nginx 层面的多级缓存。

**架构位置**：

```
客户端 → Nginx（L0: shared dict + Redis）→ 应用服务器（L1: Caffeine）→ DB
```

#### 9.5.1 OpenResty 环境搭建

```nginx
# nginx.conf — 引入 Lua 模块和 Redis 连接（单机版；集群版见 9.5.5 节）
http {
    # 共享内存缓存（L0），所有 worker 共享
    lua_shared_dict cache_articles 10m;

    # Redis 单机连接池配置（集群版无需 socket 连接池，由 resty.rediscluster 管理）
    lua_socket_pool_size 100;
    lua_socket_connect_timeout 100ms;
    lua_socket_send_timeout 200ms;
    lua_socket_read_timeout 200ms;

    server {
        listen 80;

        location /api/article/ {
            # 由 Lua 处理缓存逻辑
            content_by_lua_block {
                local ngx_cache = ngx.shared.cache_articles
                local key = ngx.var.uri

                -- 1. 查 Nginx 本地共享缓存（L0）
                local val = ngx_cache:get(key)
                if val then
                    ngx.header["X-Cache-L0"] = "HIT"
                    ngx.say(val)
                    return
                end

                -- 2. L0 miss → 查 Redis（L2）
                -- 单机版使用 resty.redis；集群版改用 resty.rediscluster（见 cache_multi_level_cluster.lua）
                local redis = require("resty.redis")
                local red = redis:new()
                red:set_timeouts(100, 200, 200)

                local ok, err = red:connect("127.0.0.1", 6379)
                if not ok then
                    ngx.log(ngx.ERR, "redis connect error: ", err)
                else
                    val, err = red:get(key)
                    if val and val ~= ngx.null then
                        -- 回填 L0，设短 TTL 保证时效
                        ngx_cache:set(key, val, 30)
                        ngx.header["X-Cache-L2"] = "HIT"
                        ngx.say(val)
                        red:set_keepalive(10000, 100)
                        return
                    end
                    red:set_keepalive(10000, 100)
                end

                -- 3. L0 + L2 均 miss → 代理到上游应用服务器
                ngx.header["X-Cache-Miss"] = "1"

                -- 使用 lua-resty-http 或 proxy_pass 回源
                local res = ngx.location.capture("/upstream/article" .. key)
                if res.status == 200 then
                    -- 回填 L0 和 L2（异步写入）
                    ngx_cache:set(key, res.body, 30)
                    -- 集群版回填使用 resty.rediscluster
                    local red2 = redis:new()
                    red2:set_timeouts(100, 200, 200)
                    local ok2, err2 = red2:connect("127.0.0.1", 6379)
                    if ok2 then
                        red2:setex(key, 1800, res.body)
                        red2:set_keepalive(10000, 100)
                    end
                    ngx.say(res.body)
                else
                    ngx.status = res.status
                    ngx.say(res.body)
                end
            }
        }

        # 上游应用服务器
        location /upstream/ {
            proxy_pass http://backend_servers;
            internal;  # 仅内部重定向访问
        }
    }
}
```

#### 9.5.2 Lua 多级缓存模块封装

将缓存逻辑封装为独立 Lua 模块 `cache_multi_level.lua`：

```lua
-- cache_multi_level.lua
local _M = {}

local redis = require("resty.redis")
local ngx_cache = ngx.shared.cache_articles

-- Redis 连接
local function connect_redis()
    local red = redis:new()
    red:set_timeouts(100, 200, 200)
    local ok, err = red:connect("127.0.0.1", 6379)
    if not ok then
        ngx.log(ngx.ERR, "redis connect failed: ", err)
        return nil, err
    end
    return red, nil
end

-- 多级缓存查询：L0 → L2 → 回源
function _M.get(key, l0_ttl, l2_ttl, upstream_callback)
    -- 1. L0: Nginx 共享内存
    local val = ngx_cache:get(key)
    if val then
        ngx.header["X-Cache-L0"] = "HIT"
        return val
    end

    -- 2. L2: Redis
    local red, err = connect_redis()
    if red then
        val, err = red:get(key)
        if val and val ~= ngx.null then
            ngx_cache:set(key, val, l0_ttl or 30)
            ngx.header["X-Cache-L2"] = "HIT"
            red:set_keepalive(10000, 100)
            return val
        end
        red:set_keepalive(10000, 100)
    end

    -- 3. 回源到上游（应用服务器 / DB）
    ngx.header["X-Cache-Miss"] = "1"
    local ok, resp = upstream_callback()
    if ok and resp then
        -- 异步回填 L0 + L2
        ngx_cache:set(key, resp, l0_ttl or 30)
        local red2, err2 = connect_redis()
        if red2 then
            red2:setex(key, l2_ttl or 1800, resp)
            red2:set_keepalive(10000, 100)
        end
        return resp
    end

    return nil
end

-- 缓存失效：删除 L0 + L2（写操作时由应用主动调用）
function _M.evict(key)
    ngx_cache:delete(key)
    local red, err = connect_redis()
    if red then
        red:del(key)
        red:set_keepalive(10000, 100)
    end
end

-- 生产环境如需 Redis Cluster，将 require("resty.redis") 替换为 resty.rediscluster
-- 并改用 connect_cluster()，详见 9.5.5 节
return _M
```

在 `nginx.conf` 中使用：

```nginx
location /api/article/ {
    content_by_lua_block {
        local cache = require("cache_multi_level")
        local key = ngx.var.uri

        local val = cache.get(key, 30, 1800, function()
            local res = ngx.location.capture("/upstream" .. key)
            if res.status == 200 then
                return true, res.body
            end
            return false, nil
        end)

        if val then
            ngx.say(val)
        else
            ngx.status = 404
            ngx.say("not found")
        end
    }
}
```

#### 9.5.3 缓存失效通知

写操作时应用需通知 Nginx 层清除缓存。通过 Redis Pub/Sub 或 HTTP 接口实现：

**方案一：Redis Pub/Sub 广播失效**

```nginx
# nginx.conf — 后台监听 Redis 失效消息
lua_shared_dict cache_articles 10m;

init_worker_by_lua_block {
    local redis = require("resty.redis")
    local red = redis:new()

    local function subscribe()
        local ok, err = red:connect("127.0.0.1", 6379)
        if not ok then
            ngx.log(ngx.ERR, "subscribe connect failed: ", err)
            ngx.timer.at(5, subscribe)
            return
        end

        local res, err = red:subscribe("cache:evict")
        if not res then
            ngx.log(ngx.ERR, "subscribe failed: ", err)
            ngx.timer.at(5, subscribe)
            return
        end

        for msg in res do
            if msg[1] == "message" then
                local key = msg[3]
                ngx.shared.cache_articles:delete(key)
                ngx.log(ngx.INFO, "cache evicted: ", key)
            end
        end
    end

    ngx.timer.at(0, subscribe)
}
```

**方案二：HTTP 管理接口**

```nginx
location /api/cache/evict {
    content_by_lua_block {
        local cache = require("cache_multi_level")
        local key = ngx.var.arg_key
        if key then
            cache.evict(key)
            ngx.say("evicted: " .. key)
        else
            ngx.status = 400
            ngx.say("missing key")
        end
    }
}
```

应用侧在写操作后调用 Nginx 清除本地缓存：

```java
@Transactional
public void updateArticle(Article article) {
    articleMapper.updateById(article);
    redisTemplate.delete("articles::" + article.getId());  // 删 L2

    // 通知 Nginx 删 L0
    redisTemplate.convertAndSend("cache:evict", "/api/article/" + article.getId());

    // 或直接调用 Nginx HTTP 接口（需加鉴权）
    // restTemplate.delete("http://nginx/api/cache/evict?key=/api/article/" + article.getId());
}
```

#### 9.5.4 Nginx 缓存配置建议

| 参数 | 建议 | 说明 |
|------|------|------|
| `lua_shared_dict` | 10-50m | 根据热点数据量调整，超出按 LRU 淘汰 |
| `lua_socket_pool_size` | 100-200 | Nginx 到 Redis 的连接池大小 |
| L0 TTL | 10-30s | Nginx 层 TTL 最短，保证热点数据时效 |
| 缓存粒度 | URI 级别 | 适用于页面片段、JSON 响应等 |
| 失效方式 | Redis Pub/Sub | 实时性最好，避免调用 Nginx 接口 |

#### 9.5.5 Redis 集群模式

生产环境 Redis 通常以集群（Cluster）模式部署以实现高可用和水平扩展。OpenResty 通过 `resty.rediscluster` 库支持 Redis Cluster，自动处理槽位（slot）路由、节点发现和 MOVED 重定向。

**安装 resty.rediscluster**：

```bash
opm get 26rebound/resty-rediscluster
# 或
luarocks install resty-rediscluster
```

**集群版 cache_multi_level_cluster.lua**（完整模块，替换单机版）：

```lua
-- cache_multi_level_cluster.lua — Redis Cluster 版多级缓存
local _M = {}

local redis_cluster = require("resty.rediscluster")
local ngx_cache = ngx.shared.cache_articles

local config = {
    name = "mycluster",
    serv_list = {
        { ip = "192.168.1.10", port = 7001 },
        { ip = "192.168.1.11", port = 7002 },
        { ip = "192.168.1.12", port = 7003 },
    },
    pool_size = 100,
    pool_timeout = 1000,
    max_redirection = 5,
    read_timeout = 200,
    connect_timeout = 100,
}

local function connect_cluster()
    local red = redis_cluster:new(config)
    local ok, err = red:connect()
    if not ok then
        ngx.log(ngx.ERR, "redis cluster connect failed: ", err)
        return nil, err
    end
    return red, nil
end

function _M.get(key, l0_ttl, l2_ttl, upstream_callback)
    local val = ngx_cache:get(key)
    if val then
        ngx.header["X-Cache-L0"] = "HIT"
        return val
    end

    local red, err = connect_cluster()
    if red then
        val, err = red:get(key)
        if val and val ~= ngx.null then
            ngx_cache:set(key, val, l0_ttl or 30)
            ngx.header["X-Cache-L2"] = "HIT"
            red:set_keepalive(10000, 100)
            return val
        end
    end

    ngx.header["X-Cache-Miss"] = "1"
    local ok, resp = upstream_callback()
    if ok and resp then
        ngx_cache:set(key, resp, l0_ttl or 30)
        local red2, err2 = connect_cluster()
        if red2 then
            red2:setex(key, l2_ttl or 1800, resp)
            red2:set_keepalive(10000, 100)
        end
        return resp
    end

    return nil
end

function _M.evict(key)
    ngx_cache:delete(key)
    local red, err = connect_cluster()
    if red then
        red:del(key)
        red:set_keepalive(10000, 100)
    end
end

return _M
```

**集群版 subscribe 模块**（Cluster 下 Pub/Sub 需维护到各主节点的独立连接）：

```lua
-- subscribe_cluster.lua — Cluster 版缓存失效监听
-- Cluster 不支持跨节点 Pub/Sub，需连接到所有主节点分别 subscribe
local redis_cluster = require("resty.rediscluster")

local cluster_config = {
    name = "mycluster",
    serv_list = {
        { ip = "192.168.1.10", port = 7001 },
        { ip = "192.168.1.11", port = 7002 },
        { ip = "192.168.1.12", port = 7003 },
    },
    pool_size = 10,
    max_redirection = 5,
}

local function subscribe_master(node_ip, node_port)
    local red = redis_cluster:new(cluster_config)
    local ok, err = red:connect()
    if not ok then
        ngx.log(ngx.ERR, "subscribe connect to ", node_ip, ":", node_port, " failed: ", err)
        return
    end

    -- resty.rediscluster 内部会路由到正确节点
    -- 实际项目中建议单独维护直连连接（resty.redis）到每个主节点
    local res, err = red:subscribe("cache:evict")
    if not res then
        ngx.log(ngx.ERR, "subscribe failed: ", err)
        return
    end

    for msg in res do
        if msg[1] == "message" then
            ngx.shared.cache_articles:delete(msg[3])
            ngx.log(ngx.INFO, "cache evicted: ", msg[3])
        end
    end
end

local function start_subscribe()
    local red = redis_cluster:new(cluster_config)
    local ok, err = red:connect()
    if not ok then
        ngx.log(ngx.ERR, "cluster connect for subscribe failed: ", err)
        ngx.timer.at(5, start_subscribe)
        return
    end

    -- 获取集群主节点列表
    local cluster_info, err = red:send("cluster", "slots")
    if not cluster_info then
        ngx.log(ngx.ERR, "get cluster slots failed: ", err)
        ngx.timer.at(5, start_subscribe)
        return
    end

    -- 对每个主节点启动订阅（生产推荐使用 resty.redis 直连每个主节点）
    for _, slot_range in ipairs(cluster_info) do
        local master = slot_range[3]
        ngx.timer.at(0, subscribe_master, master[1], master[2])
    end
end

ngx.timer.at(0, start_subscribe)
```

**Sentinel 模式**（另一种高可用方案，代码改动更小）：

```lua
-- connect_redis_sentinel.lua — Sentinel 版连接函数
-- 替换 cache_multi_level.lua 中的 connect_redis()
local redis = require("resty.redis")

local sentinel_host = "127.0.0.1"
local sentinel_port = 26379
local master_name = "mymaster"

local function connect_redis()
    -- 1. 查询 Sentinel 获取当前主节点地址
    local sentinel = redis:new()
    sentinel:set_timeouts(100, 200, 200)
    local ok, err = sentinel:connect(sentinel_host, sentinel_port)
    if not ok then
        ngx.log(ngx.ERR, "sentinel connect failed: ", err)
        return nil, err
    end

    local master_info, err = sentinel:send("sentinel", "get-master-addr-by-name", master_name)
    sentinel:set_keepalive(10000, 100)
    if not master_info then
        ngx.log(ngx.ERR, "get master addr failed: ", err)
        return nil, err
    end

    -- 2. 连接到返回的主节点
    local red = redis:new()
    red:set_timeouts(100, 200, 200)
    ok, err = red:connect(master_info[1], master_info[2])
    if not ok then
        ngx.log(ngx.ERR, "redis master connect failed: ", err)
        return nil, err
    end
    return red, nil
end
```

**选型建议**：

| 模式 | 自动分片 | 自动故障转移 | Lua 支持成熟度 | 适用场景 |
|------|:--------:|:----------:|:--------------:|---------|
| 单机 | 否 | 否 | 高 | 开发/测试、小规模 |
| Sentinel | 否 | 是 | 高 | 高可用但不需水平扩展 |
| Cluster | 是 | 是 | 中（需 `resty.rediscluster`） | 大规模生产、海量数据 |

## 十、Redisson 分布式工具集

### 10.1 为什么需要 Redisson

前三章使用的 `RedisTemplate` / `StringRedisTemplate` 本质是对 Redis 原生命令的 Java 封装，属于"命令级"操作。在复杂的分布式场景中，我们往往需要更高层级的抽象：

| 需求 | 自己实现 | 问题 |
|------|---------|------|
| 分布式锁 | SETNX + Lua 脚本 | 可重入、续期、红锁等逻辑需手写 |
| 布隆过滤器 | 位图操作 + 多 Hash 函数 | 实现复杂，容易出错 |
| 限流器 | ZSet 滑动窗口 / Lua 脚本 | 每换一种算法就要重写一套 |
| 延迟队列 | ZSet 轮询 + 时间戳比较 | 缺乏可靠的阻塞通知机制 |

**Redisson 的作用**：在 Redis 命令之上封装了 50+ 开箱即用的分布式数据结构和分布式服务，让开发者像使用本地 `java.util` 集合一样操作 Redis，大幅降低实现高级分布式特性的复杂度。

### 10.2 依赖与配置

```xml
<dependency>
    <groupId>org.redisson</groupId>
    <artifactId>redisson-spring-boot-starter</artifactId>
    <version>3.35.0</version>
</dependency>
```

引入 `redisson-spring-boot-starter` 后会自动配置 `RedissonClient` Bean，只需在 `application.yml` 中配置基础的 Redis 连接信息即可：

```yaml
spring:
  data:
    redis:
      host: localhost
      port: 6379
      password: ${REDIS_PASSWORD:}
      database: 0
```

如需更细粒度的控制，可使用 Redisson 独立配置：

```java
@Configuration
public class RedissonConfig {

    @Bean
    public RedissonClient redissonClient() {
        Config config = new Config();
        config.useSingleServer()
            .setAddress("redis://localhost:6379")
            .setPassword("xxx")
            .setDatabase(0)
            .setConnectionPoolSize(32)
            .setConnectionMinimumIdleSize(8);
        return Redisson.create(config);
    }
}
```

### 10.3 分布式锁

**8.3 节**中实现缓存击穿的互斥锁时，我们手写了 SETNX + Lua 脚本释放锁的代码。Redisson 提供了开箱即用的分布式锁：

```java
@Autowired
private RedissonClient redissonClient;

public void handleOrder(String orderId) {
    RLock lock = redissonClient.getLock("lock:order:" + orderId);
    // 加锁，30 秒自动续期（看门狗机制）
    lock.lock(30, TimeUnit.SECONDS);
    try {
        // 执行业务逻辑
    } finally {
        lock.unlock();
    }
}
```

**Redisson 锁相对于手写 SETNX 的优势**：

| 特性 | 手写 SETNX + Lua | Redisson RLock |
|------|-----------------|----------------|
| 可重入 | 需要额外实现 | 原生支持 |
| 自动续期（看门狗） | 需另启定时任务 | 内置 WatchDog，默认每 10 秒续一次 |
| 阻塞等待 | 要么失败返回，要么自旋 | 支持阻塞等待，可设等待超时 |
| 公平锁 | 不支持 | `getFairLock()` |
| 读写锁 | 不支持 | `getReadWriteLock()` |
| RedLock 算法 | 需要自行实现多节点协调 | `getRedLock()` |

**带等待时间的加锁**：

```java
boolean locked = lock.tryLock(5, 30, TimeUnit.SECONDS);
if (locked) {
    try {
        // 获取锁成功
    } finally {
        lock.unlock();
    }
} else {
    // 获取锁失败，做降级处理
}
```

**看门狗（Watch Dog）机制**：加锁后如果业务未执行完，Redisson 的后台线程每 10 秒检查一次，将锁的过期时间续到 30 秒，防止锁在业务执行途中自动释放。

### 10.4 限流器

之前实现限流需要用 ZSet 做滑动窗口或手写 Lua 脚本。Redisson 提供了 `RRateLimiter`，基于令牌桶算法：

```java
@Autowired
private RedissonClient redissonClient;

public void handleRequest() {
    RRateLimiter limiter = redissonClient.getRateLimiter("ratelimit:api");
    // 每秒最多 10 个令牌
    limiter.trySetRate(RateType.OVERALL, 10, 1, RateIntervalUnit.SECONDS);

    if (limiter.tryAcquire(1)) {
        // 获取令牌成功，处理请求
    } else {
        throw new RuntimeException("请求过于频繁");
    }
}
```

**参数说明**：

- `RateType.OVERALL`：所有实例共享限流
- `RateType.PER_CLIENT`：每个 Redisson 客户端独立限流

### 10.5 布隆过滤器

**8.1 节**中已给出完整使用示例。Redisson 的 `RBloomFilter` 基于 Redis 位图 + 多重 Hash 函数，是生产中最常用的布隆过滤器方案：

```java
RBloomFilter<Long> bloom = redissonClient.getBloomFilter("userBloom");
bloom.tryInit(100000L, 0.01); // 10 万预期元素，1% 误判率
bloom.add(1001L);
bloom.contains(1001L);  // true
bloom.contains(9999L);  // 大概率 false
```

### 10.6 延迟队列

**1.5 节**中我们用 ZSet 实现了简单的延迟队列，但缺乏可靠的消费端阻塞通知。Redisson 提供了 `RDelayedQueue`，元素到期后自动转移到目标队列：

```java
// 生产者
RQueue<String> queue = redissonClient.getQueue("order:queue");
RDelayedQueue<String> delayedQueue = redissonClient.getDelayedQueue(queue);
delayedQueue.offer("order_001", 30, TimeUnit.SECONDS); // 30 秒后到期

// 消费者（阻塞获取就绪元素）
RQueue<String> readyQueue = redissonClient.getQueue("order:queue");
while (true) {
    String orderId = readyQueue.poll(5, TimeUnit.SECONDS);
    if (orderId != null) {
        // 处理超时订单
    }
}
```

### 10.7 信号量

`RSemaphore` 类似于 JUC 的 `Semaphore`，可用于控制分布式环境下的并发数量：

```java
RSemaphore semaphore = redissonClient.getSemaphore("semaphore:task");
semaphore.trySetPermits(10); // 设置 10 个许可

// 获取许可
boolean acquired = semaphore.tryAcquire(1, 3, TimeUnit.SECONDS);
if (acquired) {
    try {
        // 执行任务
    } finally {
        semaphore.release();
    }
}
```

## 十一、消息队列

Redis 支持三种消息队列方案，适用不同的场景：

| 方案 | 消息可靠性 | 多消费者 | 适用范围 |
|------|:---------:|:--------:|---------|
| **List**（LPUSH + BRPOP） | 低（ACK 后删除） | 互斥消费（一个消息只被一个消费者处理） | 简单任务队列、延迟不敏感 |
| **Pub/Sub** | 最低（离线丢失） | 广播 | 实时通知、日志广播 |
| **Stream**（Redis 5.0+） | 高（持久化 + ACK） | 消费者组（组内互斥、组间广播） | 生产级消息系统 |

### 11.1 List — 最简单的消息队列

基于 List 的阻塞弹出实现 FIFO 队列，无需依赖 Redis 5.0+，适用低并发场景。

```java
// 生产者
stringRedisTemplate.opsForList().rightPush("queue:order", orderId);

// 消费者——阻塞弹出（无消息时挂起等待，减少轮询开销）
String orderId = stringRedisTemplate.opsForList().leftPop("queue:order", 5, TimeUnit.SECONDS);
```

**问题与改进**：

| 问题 | 说明 | 改进方案 |
|------|------|---------|
| 消息丢失 | 消费者取出后崩溃，消息丢失 | BRPOPLPUSH / BLMOVE：弹出同时备份到 backup 队列 |
| 重复消费 | 消费者处理超时未 ACK | 配合备份队列 + 定期重试 |
| 不支持广播 | 多个消费者互斥消费 | 每个消费者维护独立队列 |

```java
// 使用 BLMOVE 实现可靠队列（Redis 6.2+）
stringRedisTemplate.opsForList().leftPop("queue:order", 5, TimeUnit.SECONDS);
// 或者使用 RedisConnection 执行 BRPOPLPUSH 命令
stringRedisTemplate.execute((RedisCallback<String>) conn -> {
    byte[] value = conn.bRPopLPush(5, "queue:order".getBytes(), "queue:order:backup".getBytes());
    return value != null ? new String(value) : null;
});
```

### 11.2 Pub/Sub — 广播消息

Redis 内置的发布订阅模式，消息发布后广播给所有订阅者，但消息不会持久化，消费者离线则丢失。

```java
// 消息监听器
@Component
public class OrderMessageListener implements MessageListener {
    @Override
    public void onMessage(Message message, byte[] pattern) {
        String channel = new String(message.getChannel());
        String body = new String(message.getBody());
        System.out.println("收到消息: channel=" + channel + ", body=" + body);
    }
}

// 配置订阅
@Configuration
public class RedisPubSubConfig {

    @Bean
    public MessageListenerAdapter messageListenerAdapter() {
        return new MessageListenerAdapter(new OrderMessageListener());
    }

    @Bean
    public RedisMessageListenerContainer container(
            RedisConnectionFactory factory,
            MessageListenerAdapter adapter) {
        RedisMessageListenerContainer container = new RedisMessageListenerContainer();
        container.setConnectionFactory(factory);
        container.addMessageListener(adapter, new PatternTopic("channel:order:*"));
        return container;
    }
}

// 发布消息
stringRedisTemplate.convertAndSend("channel:order:new", "order_001");
```

> **Pub/Sub 局限性**：消息不持久化、消费者离线丢失、Redis 宕机全部丢失。仅适合实时性要求高但不在乎丢失的场景（如实时监控通知）。**生产环境不建议用于核心业务**。

### 11.3 Stream — 生产级消息队列（推荐）

Redis 5.0 引入的 Stream 类型，功能对标 Kafka，支持消息持久化、消费者组、ACK 确认、消息回溯。

**核心概念**：

| 概念 | 说明 | Kafka 类比 |
|------|------|-----------|
| Stream | 消息链表（每个消息有唯一 ID） | Topic |
| Consumer Group | 消费组（组内消费互斥，组间独立） | Consumer Group |
| Consumer | 组内消费者 | Consumer |
| PEL（Pending Entries List） | 已投递未 ACK 的消息列表 | — |
| last_delivered_id | 组内投递进度指针 | Offset |

```java
// —— 生产者 ——
public void sendMsg(String streamKey, Map<String, String> body) {
    stringRedisTemplate.opsForStream()
        .add(streamKey, body);                                    // 自动生成消息 ID（毫秒时间戳-序号）
}

// 也可指定 ID："*" 表示由 Redis 生成
stringRedisTemplate.opsForStream()
    .add(streamKey, Collections.singletonMap("orderId", "1001"));
```

```java
// —— 消费者组 ——

// 创建消费组（首次需创建组）
// 终端命令：XGROUP CREATE stream:order group1 $
// $ 表示只消费之后的新消息，0 表示从头开始消费

// Spring 消费者
@Component
public class StreamConsumer {

    @Autowired
    private StringRedisTemplate stringRedisTemplate;

    @PostConstruct
    public void consume() {
        Executors.newSingleThreadExecutor().execute(() -> {
            String streamKey = "stream:order";
            String group = "group1";
            String consumer = "consumer-1";

            while (true) {
                // 读取未 ACK 消息（阻塞读取）
                List<MapRecord<String, Object, Object>> messages = stringRedisTemplate.opsForStream()
                    .read(Consumer.from(group, consumer),
                          StreamReadOptions.empty().count(10).block(Duration.ofSeconds(5)),
                          StreamOffset.create(streamKey, ReadOffset.lastConsumed()));

                for (MapRecord<String, Object, Object> msg : messages) {
                    try {
                        // 处理消息
                        String orderId = (String) msg.getValue().get("orderId");
                        System.out.println("处理订单: " + orderId);

                        // 处理成功后 ACK
                        stringRedisTemplate.opsForStream()
                            .acknowledge(group, msg);
                    } catch (Exception e) {
                        log.error("处理失败", e);
                        // 不 ACK → 消息留在 PEL，后续可重新消费
                    }
                }
            }
        });
    }
}
```

**Stream 核心功能速查**：

```bash
# 生产
XADD stream:order * orderId 1001 status pending

# 消费组
XGROUP CREATE stream:order group1 $        # 创建组（$ = 只消费新消息）
XREADGROUP GROUP group1 consumer-1 COUNT 1 BLOCK 5000 > stream:order  # 读取新消息
XREADGROUP GROUP group1 consumer-1 COUNT 1 stream:order 0            # 读取历史消息

# ACK
XACK stream:order group1 123456789-0       # 确认消息已处理

# 查看 PEL
XPENDING stream:order group1               # 查看待 ACK 消息

# 消息回溯（重新消费）
XREADGROUP GROUP group1 consumer-1 COUNT 10 stream:order 0   # 从头读取
```

**三种消息读取方式**：

| 方式 | 说明 | 适用 |
|------|------|------|
| `>` | 读取未投递给当前消费者的新消息 | 常规消费 |
| `0` | 读取已投递但未 ACK 的消息（PEL） | 异常恢复 / 查询待处理 |
| 指定 ID | 从指定消息 ID 开始读取 | 消息回溯 / 重放 |

### 11.4 消息队列选型建议

| 场景 | 推荐方案 |
|------|---------|
| 轻量级异步任务（日志写入、邮件发送） | List + BLMOVE |
| 实时广播通知（WebSocket 推送、配置更新广播） | Pub/Sub |
| 生产级业务消息（订单处理、积分结算） | Stream |
| 海量日志 / 削峰填谷 | 改用 Kafka / RocketMQ |
| 严格顺序消费、事务消息 | 改用 RocketMQ |
| 延迟消息（30 分钟后超时取消） | Stream + 死信队列 或 Redisson RDelayedQueue |

### 11.5 Redis 消息队列 vs 专业 MQ

| 对比项 | Redis Stream / List | Kafka / RocketMQ |
|--------|-------------------|-----------------|
| 消息持久化 | RDB/AOF（纯内存优先） | 磁盘顺序写，海量存储 |
| 消息堆积 | 内存堆积 → OOM 风险 | 磁盘堆积，几乎无上限 |
| 吞吐量 | ~10 万/s（单线程） | ~百万/s（多分区并行） |
| 消息可靠性 | 无 or 较弱（ACK 但可能丢） | 强（ISR、多副本、事务消息） |
| 延迟消息 | 需借助 ZSet / Redisson | RocketMQ 原生支持 |
| 运维成本 | 无需额外组件 | 需维护 Kafka/RocketMQ 集群 |
| 适用规模 | 小中型项目、轻量异步 | 大型分布式、海量数据 |

> **结论**：Redis 消息队列适合**中小型项目**或**对消息可靠性要求不高的异步场景**。如果消息不能丢、需要海量堆积、要求事务消息或严格顺序，应选用 Kafka 或 RocketMQ 等专业 MQ。

| 主题 | 要点 |
|------|------|
| 基础类型 | String / Hash / List / Set / ZSet 五种类型及适用场景 |
| 过期时间与内存淘汰 | 三种过期删除策略、8 种淘汰策略、LRU 与 LFU 的区别 |
| RedisTemplate | Ops 操作、序列化策略 |
| StringRedisTemplate | 与 RedisTemplate 的对比与选择 |
| Spring Cache | @Cacheable / @CachePut / @CacheEvict 声明式缓存 |
| 连接池 | Jedis vs Lettuce，参数配置与调优 |
| 缓存更新策略 | Cache Aside / Read/Write Through / Write Behind |
| 缓存穿透 | 缓存空值、布隆过滤器（Redisson RBloomFilter） |
| 缓存雪崩 | 过期时间加随机值、多级缓存、限流降级 |
| 缓存击穿 | 互斥锁、逻辑过期 |
| 数据一致性 | Cache Aside + 过期时间兜底，MQ 异步重试 |
| 多级缓存 | Caffeine（L1）+ Redis（L2）组合，短 TTL + 双删同步 |
| Redisson | 分布式锁、限流器、布隆过滤器、延迟队列、信号量 |
| 消息队列 | List（简单队列）、Pub/Sub（广播）、Stream（生产级消息队列） |

Redis 的使用贯穿项目的各个层面，掌握基础类型的选择、序列化策略的配置以及连接池的调优，是构建高性能缓存系统的关键。
