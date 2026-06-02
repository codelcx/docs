<template>
  <div class="post-list">
    <div v-if="filteredPosts.length === 0" class="post-empty">
      暂无文章，敬请期待。
    </div>
    <a
      v-for="post in filteredPosts"
      :key="post.url"
      :href="post.url"
      class="post-item"
    >
      {{ post.title }}
    </a>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
// @ts-ignore
import { data } from '../../../docs/posts.data'

const props = defineProps<{
  category: string
}>()

interface Post {
  title: string
  url: string
  category: string
}

const filteredPosts = computed(() => {
  return (data as Post[]).filter((post) => post.category === props.category)
})
</script>

<style scoped>
.post-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.post-item {
  font-size: 16px;
  color: var(--vp-c-text-1);
  text-decoration: none;
  padding: 8px 12px;
  border-radius: 6px;
  transition: background 0.2s, color 0.2s;
}

.post-item:hover {
  background: var(--vp-c-bg-alt);
  color: var(--vp-c-brand);
}

.post-empty {
  font-size: 16px;
  color: var(--vp-c-text-3);
  padding: 20px 0;
}
</style>
