---
title: MyBatis Plus 数据持久化
date: 2026-05-25
category: backend
sort: 777
description: MyBatis-Plus 项目结构、依赖配置、基本使用与高级特性详解
---

# MyBatis Plus 数据持久化

MyBatis-Plus 是 MyBatis 的增强工具，无侵入地提供通用 CRUD、分页、条件构造器和代码生成器，只做增强不做改变。

## 一、项目结构

### 1.1 方式一：按层级分包

```
src/main/java/com/example/
├── controller/          # 接口层
│   └── UserController.java
├── service/
│   ├── UserService.java           # 接口
│   └── impl/
│       └── UserServiceImpl.java   # 实现
├── mapper/              # 数据访问层
│   └── UserMapper.java
├── entity/              # 实体类
│   └── User.java
└── dto/                 # 数据传输对象
    └── UserDTO.java
```

### 1.2 方式二：按业务模块分包

```
src/main/java/com/example/
├── user/
│   ├── UserController.java
│   ├── UserService.java
│   ├── UserServiceImpl.java
│   ├── UserMapper.java
│   ├── User.java
│   └── UserDTO.java
├── order/
│   ├── OrderController.java
│   ├── OrderService.java
│   ├── OrderServiceImpl.java
│   ├── OrderMapper.java
│   └── Order.java
└── common/              # 公共模块
    ├── config/
    └── util/
```

### 1.3 两种方式对比

| 维度 | 按层级 | 按业务模块 |
|------|--------|-----------|
| 导航效率 | 跨层查找（找 Service→进 service 包） | 单一模块内上下切换 |
| 跨业务复用 | 公共 Mapper/Entity 天然可见 | 需抽出 `common` 模块 |
| 模块边界 | 模糊，同层文件堆叠 | 清晰，可独立拆分微服务 |
| 适合规模 | 小项目（<5 模块） | 中大型项目（5+ 模块） |
| Spring 扫描 | `@MapperScan("com.example.mapper")` | 需逐个指定或宽泛扫描 |

> **建议**：初创期用层级，快速上手；模块数超过 5 个后向业务模块迁移。

## 二、依赖与配置

```xml
<dependency>
    <groupId>com.baomidou</groupId>
    <artifactId>mybatis-plus-spring-boot3-starter</artifactId>
    <version>3.5.9</version>
</dependency>
<dependency>
    <groupId>com.mysql</groupId>
    <artifactId>mysql-connector-j</artifactId>
</dependency>
```

```yaml
spring:
  datasource:
    url: jdbc:mysql://localhost:3306/mydb
    username: root
    password: ${DB_PASSWORD}
    driver-class-name: com.mysql.cj.jdbc.Driver

mybatis-plus:
  configuration:
    map-underscore-to-camel-case: true      # 下划线 ↔ 驼峰自动映射
    log-impl: org.apache.ibatis.logging.stdout.StdOutImpl
  global-config:
    db-config:
      id-type: auto                         # 主键自增
      logic-delete-field: deleted           # 逻辑删除字段
      logic-delete-value: 1
      logic-not-delete-value: 0
```

```java
@SpringBootApplication
@MapperScan("com.example.mapper")           // 扫描 Mapper 接口
public class DemoApplication { }
```

## 三、核心类与注解

### 3.1 实体类

```java
@Data
@TableName("sys_user")                     // 指定表名（类名驼峰转下划线可不写）
public class User {

    @TableId(type = IdType.AUTO)           // 主键自增
    private Long id;

    @TableField("user_name")               // 字段名不一致时指定
    private String userName;

    private Integer age;
    private String email;

    @TableField(exist = false)             // 表中无此字段
    private String token;

    @TableLogic                            // 逻辑删除
    private Integer deleted;

    @TableField(fill = FieldFill.INSERT)   // 插入时自动填充
    private LocalDateTime createTime;

    @TableField(fill = FieldFill.UPDATE)   // 更新时自动填充
    private LocalDateTime updateTime;
}
```

### 3.2 注解速查

| 注解 | 作用 |
|------|------|
| `@TableName` | 指定表名 |
| `@TableId` | 主键，`type` 指定生成策略 |
| `@TableField` | 字段映射，`exist=false` 排除 |
| `@TableLogic` | 逻辑删除，删除时自动改标记 |
| `@Version` | 乐观锁版本号 |

### 3.3 Mapper 接口

```java
@Mapper
public interface UserMapper extends BaseMapper<User> {
    // 继承 BaseMapper 即拥有通用 CRUD，无需写 XML

    @Select("SELECT * FROM sys_user WHERE age > #{age}")
    List<User> selectByAge(@Param("age") int age);
}
```

**`@Mapper` 与 `@Repository` 的区别**：

| 注解 | 作用 | 来源 | 异常转换 |
|------|------|------|---------|
| `@Mapper` | 标记 MyBatis Mapper 接口，由 MyBatis 扫描生成代理对象 | MyBatis | 否 |
| `@Repository` | 标记数据访问层 Bean，由 Spring 管理 | Spring | 是（`PersistenceExceptionTranslationPostProcessor` 将 JDBC/SQL 异常转为 Spring 的 `DataAccessException`） |
| `@MapperScan` | 批量扫描包路径，替代逐个 `@Mapper` | MyBatis | — |

> 推荐：启动类加 `@MapperScan("com.example.mapper")` 批量扫描，Mapper 接口上再加 `@Repository` 以获得 Spring 异常转换和 IDE 识别。

## 四、基本使用

### 4.1 通用 CRUD

`BaseMapper` 提供了常用增删改查方法：

```java
// 插入
User user = new User();
user.setUserName("张三");
userMapper.insert(user);                   // INSERT INTO sys_user ...

// 根据 ID 查询
User user = userMapper.selectById(1L);

// 条件查询
List<User> users = userMapper.selectList(
    new LambdaQueryWrapper<User>()
        .eq(User::getAge, 18)
        .like(User::getUserName, "张")
);

// 根据 ID 更新
User updateUser = new User();
updateUser.setId(1L);
updateUser.setAge(20);
userMapper.updateById(updateUser);

// 根据 ID 删除（逻辑删除则自动改标记）
userMapper.deleteById(1L);
```

### 4.2 条件构造器 — LambdaQueryWrapper

类型安全的条件拼接，避免字段名硬编码：

```java
LambdaQueryWrapper<User> wrapper = new LambdaQueryWrapper<>();
wrapper.eq(User::getAge, 18)                   // age = 18
       .in(User::getAge, 18, 20, 25)           // age IN (18,20,25)
       .like(User::getUserName, "张")           // user_name LIKE '%张%'
       .between(User::getCreateTime, start, end)
       .gt(User::getAge, 10)                    // age > 10
       .orderByDesc(User::getCreateTime)
       .last("LIMIT 10");                       // 末尾追加 SQL

userMapper.selectList(wrapper);
```

### 4.3 LambdaUpdateWrapper

```java
LambdaUpdateWrapper<User> wrapper = new LambdaUpdateWrapper<>();
wrapper.set(User::getAge, 30)
       .set(User::getEmail, "new@email.com")
       .eq(User::getId, 1L);

userMapper.update(null, wrapper);              // 无需传实体对象
```

### 4.4 分页查询

```java
@Configuration
public class MybatisPlusConfig {
    @Bean
    public MybatisPlusInterceptor mybatisPlusInterceptor() {
        MybatisPlusInterceptor interceptor = new MybatisPlusInterceptor();
        interceptor.addInnerInterceptor(new PaginationInnerInterceptor(DbType.MYSQL));
        return interceptor;
    }
}
```

```java
Page<User> page = new Page<>(1, 10);           // 第 1 页，每页 10 条
Page<User> result = userMapper.selectPage(page,
    new LambdaQueryWrapper<User>()
        .ge(User::getAge, 18)
);

result.getRecords();     // 当前页数据
result.getTotal();       // 总记录数
result.getPages();       // 总页数
```

### 4.5 自定义 SQL

`BaseMapper` 的通用 CRUD 只覆盖简单场景。多表联查、统计聚合、复杂条件筛选需要手写 SQL。

#### 注解方式

简单查询直接在 Mapper 方法上写 SQL：

```java
@Mapper
public interface UserMapper extends BaseMapper<User> {

    @Select("SELECT * FROM sys_user WHERE age > #{age}")
    List<User> selectByAge(@Param("age") int age);

    @Select("SELECT u.*, o.order_count FROM sys_user u " +
            "LEFT JOIN (SELECT user_id, COUNT(*) AS order_count FROM sys_order GROUP BY user_id) o " +
            "ON u.id = o.user_id WHERE u.id = #{id}")
    UserWithOrders selectWithOrders(@Param("id") Long id);
}
```

#### XML 方式

复杂 SQL 用 XML 更清晰。在 `resources/mapper/` 下创建同路径的 XML：

```xml
<!-- resources/mapper/UserMapper.xml -->
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE mapper PUBLIC "-//mybatis.org//DTD Mapper 3.0//EN"
        "http://mybatis.org/dtd/mybatis-3-mapper.dtd">
<mapper namespace="com.example.mapper.UserMapper">

    <resultMap id="userWithOrders" type="com.example.entity.UserVo">
        <id property="id" column="id"/>
        <result property="userName" column="user_name"/>
        <collection property="orders" ofType="com.example.entity.Order">
            <id property="id" column="order_id"/>
            <result property="amount" column="amount"/>
        </collection>
    </resultMap>

    <select id="selectUserOrders" resultMap="userWithOrders">
        SELECT u.*, o.id AS order_id, o.amount
        FROM sys_user u
        LEFT JOIN sys_order o ON u.id = o.user_id
        WHERE u.id = #{id}
    </select>

    <select id="selectByCondition" resultType="com.example.entity.User">
        SELECT * FROM sys_user
        <where>
            <if test="name != null and name != ''">
                AND user_name LIKE CONCAT('%', #{name}, '%')
            </if>
            <if test="minAge != null">
                AND age &gt;= #{minAge}
            </if>
        </where>
        ORDER BY create_time DESC
    </select>
</mapper>
```

```java
@Mapper
public interface UserMapper extends BaseMapper<User> {

    UserVo selectUserOrders(@Param("id") Long id);

    List<User> selectByCondition(@Param("name") String name,
                                  @Param("minAge") Integer minAge);
}
```

#### 条件构造器 + 自定义 SQL

`Wrapper` 的条件和手写 SQL 可以共用，让条件拼接更灵活：

```java
// Mapper 接口中 Wrapper 参数需用 @Param(Constants.WRAPPER) 注解
@Select("SELECT * FROM sys_user ${ew.customSqlSegment}")
List<User> selectByWrapper(@Param(Constants.WRAPPER) Wrapper<User> wrapper);
```

```java
LambdaQueryWrapper<User> wrapper = new LambdaQueryWrapper<>();
wrapper.eq(User::getAge, 18)
       .orderByDesc(User::getCreateTime);

userMapper.selectByWrapper(wrapper);
// 最终 SQL: SELECT * FROM sys_user WHERE (age = 18) ORDER BY create_time DESC
```

## 五、高级使用

### 5.1 自动填充

插入或更新时自动填充 `createTime`、`updateTime` 等审计字段，无需每次手写。分两步配置：

**① 实体类字段标注填充时机**

```java
@Data
public class User {
    private Long id;

    @TableField(fill = FieldFill.INSERT)          // 插入时填充
    private LocalDateTime createTime;

    @TableField(fill = FieldFill.INSERT_UPDATE)   // 插入和更新时均填充
    private LocalDateTime updateTime;

    @TableField(fill = FieldFill.INSERT)          // 插入时填充创建人
    private String createBy;
}
```

| 填充策略 | 触发时机 |
|----------|---------|
| `FieldFill.INSERT` | 仅插入 |
| `FieldFill.UPDATE` | 仅更新 |
| `FieldFill.INSERT_UPDATE` | 插入和更新 |

**② MetaObjectHandler 统一填充值**

```java
@Component
public class MyMetaObjectHandler implements MetaObjectHandler {

    @Override
    public void insertFill(MetaObject metaObject) {
        this.strictInsertFill(metaObject, "createTime", LocalDateTime.class, LocalDateTime.now());
        this.strictInsertFill(metaObject, "updateTime", LocalDateTime.class, LocalDateTime.now());
        this.strictInsertFill(metaObject, "createBy", String.class, getCurrentUser());
    }

    @Override
    public void updateFill(MetaObject metaObject) {
        this.strictUpdateFill(metaObject, "updateTime", LocalDateTime.class, LocalDateTime.now());
    }

    private String getCurrentUser() {
        // 从 SecurityContext 或 ThreadLocal 获取当前登录用户
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return auth != null ? auth.getName() : "system";
    }
}
```

> **`strict` vs 非 `strict`**：`strictInsertFill` 在字段已有值时不覆盖（已有值优先）；`setFieldValByName` 无条件覆盖。推荐 `strict` 系列，避免误覆盖业务代码手动设置的值。

### 5.2 乐观锁

通过 `@Version` 注解实现更新时的版本冲突检测——`updateById` 自动追加 `WHERE version = ?`，若其他线程已修改则更新失败：

```java
@Bean
public MybatisPlusInterceptor mybatisPlusInterceptor() {
    MybatisPlusInterceptor interceptor = new MybatisPlusInterceptor();
    interceptor.addInnerInterceptor(new OptimisticLockerInnerInterceptor());
    return interceptor;
}
```

```java
@Data
public class Article {
    private Long id;
    private String title;
    private String content;
    @Version
    private Integer version;
}
```

```java
// 更新时自动追加 WHERE version = ?
Article article = articleMapper.selectById(1L);
article.setTitle("新标题");
int rows = articleMapper.updateById(article);
// rows=0 表示其他线程已修改，当前 version 失效

// 重试：重新获取最新数据后再次更新
if (rows == 0) {
    for (int retry = 0; retry < 3; retry++) {
        article = articleMapper.selectById(1L);       // 读到最新 version
        article.setTitle("新标题");
        rows = articleMapper.updateById(article);
        if (rows > 0) break;
    }
}
```

> 乐观锁适合**冲突少**的场景（如用户编辑自己文章、个人资料修改）。高并发扣库存应使用 Redis + Lua 或消息队列，频繁重试会加剧竞争。

### 5.3 批量操作

Service 层继承了 `IService`，提供了批量插入和更新的便捷方法，内部自动分批次执行，避免一次性插入海量数据导致内存溢出：

```java
// 批量插入
List<User> users = Arrays.asList(new User("张三"), new User("李四"));
userService.saveBatch(users);

// 批量更新
userService.updateBatchById(users);

// 分批次处理（每批 1000 条）
userService.saveBatch(users, 1000);
```

### 5.4 多数据源

引入 `dynamic-datasource-spring-boot-starter`，通过 `@DS` 注解在类或方法上指定数据源，实现读写分离、多库切换：

```yaml
spring:
  datasource:
    dynamic:
      primary: master
      strict: false
      datasource:
        master:
          url: jdbc:mysql://localhost:3306/mydb
          username: root
          password: ${DB_PASSWORD}
        slave:
          url: jdbc:mysql://localhost:3306/mydb_readonly
          username: root
          password: ${DB_PASSWORD}
```

```java
@Service
public class UserService {
    @DS("master")                              // 指定数据源
    public void save(User user) { userMapper.insert(user); }

    @DS("slave")
    public List<User> list() { return userMapper.selectList(null); }
}
```

### 5.5 逻辑删除

配置 `logic-delete-field` 后，`deleteById` 自动转为 UPDATE，查询自动追加 `WHERE deleted = 0`：

```java
userMapper.deleteById(1L);
// 实际执行：UPDATE sys_user SET deleted = 1 WHERE id = 1 AND deleted = 0
```

需要查询已删除数据时手动忽略逻辑删除：

```java
LambdaQueryWrapper<User> wrapper = new LambdaQueryWrapper<>();
wrapper.eq(User::getId, 1L)
       .apply("deleted = 1");              // 手动覆盖
```

### 5.6 代码生成器

根据数据库表结构自动生成 Entity、Mapper、Service、Controller 全套代码，减少重复劳动。需单独引入 `mybatis-plus-generator` 和模板引擎依赖：

```xml
<dependency>
    <groupId>com.baomidou</groupId>
    <artifactId>mybatis-plus-generator</artifactId>
    <version>3.5.9</version>
</dependency>
<!-- 模板引擎（选一个） -->
<dependency>
    <groupId>org.apache.velocity</groupId>
    <artifactId>velocity-engine-core</artifactId>
    <version>2.3</version>
</dependency>
```

#### globalConfig — 全局配置

```java
.globalConfig(builder -> builder
    .author("dev")                         // 作者名（写入 @author）
    .outputDir(System.getProperty("user.dir") + "/src/main/java")  // 输出目录
    .commentDate("yyyy-MM-dd")             // 注释日期格式
    .disableOpenDir()                      // 生成后不自动打开目录
)
```

#### packageConfig — 包路径

```java
.packageConfig(builder -> builder
    .parent("com.example")                 // 父包
    .moduleName("user")                    // 模块名 → com.example.user
    .entity("entity")
    .mapper("mapper")
    .service("service")
    .serviceImpl("service.impl")
    .controller("controller")
    .xml("mapper/xml")                     // XML 映射文件路径
)
```

#### strategyConfig — 策略配置

```java
.strategyConfig(builder -> builder
    // 表过滤
    .addInclude("sys_user", "sys_role")    // 只生成这些表
    .addExclude("sys_config")              // 排除某些表
    .addTablePrefix("sys_")                // 过滤表前缀 → SysUser → User

    // 实体策略
    .entityBuilder()
        .enableLombok()                    // 使用 Lombok（@Data 等）
        .enableTableFieldAnnotation()      // 生成 @TableField 注解
        .enableFileOverride()              // 覆盖已有文件
        .logicDeleteColumnName("deleted") // 逻辑删除字段
        .versionColumnName("version")      // 乐观锁字段
        .formatFileName("%s")              // 文件命名格式

    // Mapper 策略
    .mapperBuilder()
        .enableBaseResultMap()             // 生成 BaseResultMap
        .enableBaseColumnList()            // 生成 BaseColumnList
        .formatMapperFileName("%sMapper")
        .formatXmlFileName("%sMapper")

    // Service 策略
    .serviceBuilder()
        .formatServiceFileName("%sService")
        .formatServiceImplFileName("%sServiceImpl")

    // Controller 策略
    .controllerBuilder()
        .enableRestStyle()                 // @RestController
        .enableHyphenStyle()               // URL 驼峰转连字符 (/userInfo → /user-info)
        .formatFileName("%sController")
)
```

#### 完整生成类

```java
public class CodeGenerator {
    public static void main(String[] args) {
        FastAutoGenerator.create(
                "jdbc:mysql://localhost:3306/mydb",
                "root",
                "password"
            )
            .globalConfig(builder -> builder
                .author("dev")
                .outputDir(System.getProperty("user.dir") + "/src/main/java")
                .commentDate("yyyy-MM-dd")
            )
            .packageConfig(builder -> builder
                .parent("com.example")
                .entity("entity")
                .mapper("mapper")
                .service("service")
                .serviceImpl("service.impl")
                .controller("controller")
                .xml("mapper/xml")
            )
            .strategyConfig(builder -> builder
                .addInclude("sys_user")
                .addTablePrefix("sys_")

                .entityBuilder()
                    .enableLombok()
                    .enableTableFieldAnnotation()
                    .logicDeleteColumnName("deleted")

                .controllerBuilder()
                    .enableRestStyle()
                    .enableHyphenStyle()

                .mapperBuilder()
                    .enableBaseResultMap()
                    .enableBaseColumnList()
            )
            .templateEngine(new VelocityTemplateEngine())
            .execute();
    }
}
```

生成后的文件结构：

```
com/example/
├── entity/
│   └── User.java                # @Data @TableName
├── mapper/
│   ├── UserMapper.java          # extends BaseMapper
│   └── xml/
│       └── UserMapper.xml       # BaseResultMap + BaseColumnList
├── service/
│   ├── UserService.java         # extends IService
│   └── impl/
│       └── UserServiceImpl.java # extends ServiceImpl
└── controller/
    └── UserController.java      # @RestController
```
