/// <reference types="vitepress/client" />

declare module '*.css' {}

declare module '*.data' {
  const data: unknown[]
  export { data }
}
