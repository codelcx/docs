<template>
  <div class="home-cards">
    <a
      v-for="card in cards"
      :key="card.title"
      :href="card.link"
      class="home-card"
    >
      <div class="home-card-icon">{{ card.icon }}</div>
      <h2 class="home-card-title">{{ card.title }}</h2>
      <p class="home-card-desc">{{ card.desc }}</p>
      <div class="home-card-tags">
        <span v-for="tag in card.tags" :key="tag" class="home-card-tag">
          {{ tag }}
        </span>
      </div>
      <span class="home-card-link">进入 →</span>
    </a>
  </div>
</template>

<script setup lang="ts">
const cards = [
  {
    title: '前端',
    icon: '🎨',
    desc: 'Vue、React 等现代前端框架',
    tags: ['Vue', 'React'],
    link: '/frontend/',
  },
  {
    title: '后端',
    icon: '⚙️',
    desc: 'Java、Spring 等服务端技术',
    tags: ['Java', 'Spring'],
    link: '/backend/',
  },
  {
    title: '运维',
    icon: '🚀',
    desc: 'Nginx、Docker 等部署运维',
    tags: ['Nginx', 'Docker'],
    link: '/devops/',
  },
]
</script>

<style scoped>
.home-cards {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 24px;
  max-width: 960px;
  margin: 0 auto;
  padding: 0 24px;
}

.home-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 40px 24px 32px;
  background: var(--vp-c-bg-alt);
  border: 1px solid var(--vp-c-border);
  border-radius: 12px;
  text-decoration: none;
  transition: border-color 0.25s, transform 0.25s, box-shadow 0.25s;
}

.home-card:hover {
  border-color: var(--vp-c-brand);
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(66, 184, 131, 0.15);
}

html.dark .home-card:hover {
  box-shadow: 0 4px 16px rgba(66, 211, 146, 0.2);
}

.home-card-icon {
  font-size: 40px;
  margin-bottom: 16px;
}

.home-card-title {
  font-size: 28px;
  font-weight: 600;
  color: var(--vp-c-brand);
  margin: 0 0 8px 0;
}

.home-card-desc {
  font-size: 16px;
  font-weight: 400;
  color: var(--vp-c-text-2);
  margin: 0 0 16px 0;
  text-align: center;
}

.home-card-tags {
  display: flex;
  gap: 8px;
  margin-bottom: 20px;
}

.home-card-tag {
  font-size: 14px;
  font-weight: 400;
  color: var(--vp-c-text-3);
  background: var(--vp-c-bg);
  padding: 2px 10px;
  border-radius: 999px;
  border: 1px solid var(--vp-c-border);
}

.home-card-link {
  font-size: 15px;
  font-weight: 500;
  color: var(--vp-c-brand);
}

/* 响应式 */
@media (max-width: 768px) {
  .home-cards {
    grid-template-columns: 1fr;
  }
}
</style>
