<template>
  <div class="home-wrap">
    <section class="hero">
      <div class="hero-left">
        <h1 class="hero-title">ANCX Docs</h1>
        <p class="hero-subtitle">记录前端、后端与运维的学习与实践</p>
        <div class="hero-line"></div>
        <p class="hero-desc">将日常积累的技术知识整理成结构化文档，沉淀经验，提升认知，让知识长期可复用。</p>
        <div class="hero-actions">
          <a class="btn btn-primary" href="/frontend/vue">开始阅读</a>
          <a class="btn btn-ghost" href="https://github.com" target="_blank" rel="noreferrer">
            <svg class="gh-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="currentColor"
                d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56v-2.17c-3.2.7-3.88-1.36-3.88-1.36-.52-1.33-1.28-1.68-1.28-1.68-1.05-.72.08-.7.08-.7 1.16.08 1.78 1.2 1.78 1.2 1.03 1.77 2.71 1.26 3.37.97.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.27-5.24-5.67 0-1.25.45-2.28 1.19-3.08-.12-.29-.52-1.46.11-3.04 0 0 .97-.31 3.19 1.18A11.1 11.1 0 0 1 12 6.1c.98 0 1.97.13 2.9.38 2.22-1.5 3.19-1.18 3.19-1.18.63 1.58.23 2.75.11 3.04.74.8 1.19 1.83 1.19 3.08 0 4.41-2.7 5.38-5.27 5.66.42.36.78 1.06.78 2.14v3.17c0 .31.21.68.8.56A11.51 11.51 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5z"
              />
            </svg>
            GitHub
          </a>
        </div>
      </div>

      <div class="hero-right">
        <img class="hero-image" src="/images/dev.png" alt="技术博客插图" />
      </div>
    </section>

    <section class="card-grid">
      <div class="tech-card frontend">
        <h3>前端</h3>
        <p>Vue、React 等现代框架原理与实战</p>
      </div>

      <div class="tech-card backend">
        <h3>后端</h3>
        <p>Node、Java 服务端架构与最佳实践</p>
      </div>

      <div class="tech-card devops">
        <h3>运维</h3>
        <p>Docker、Nginx 容器化部署与 CI/CD</p>
      </div>
    </section>
  </div>
</template>

<style scoped>
.home-wrap { max-width: 1240px; margin: 20px auto 40px; padding: 0 12px; }
.hero { display: grid; grid-template-columns: 1fr 560px; align-items: center; gap: 18px; }
.hero-badge { display: inline-flex; align-items: center; gap: 8px; padding: 8px 14px; border-radius: 999px; background: #edf2ff; color: #2f63de; font-weight: 700; font-size: 14px; }
.badge-dot { width: 12px; height: 12px; border-radius: 3px; background: linear-gradient(180deg, #5f8fff, #2c62da); }
.hero-title { margin: 18px 0 8px; font-size: 64px; line-height: 1.1; font-weight: 800; letter-spacing: 1px; background: -webkit-linear-gradient(315deg, #42d392 25%, #647eff); background-clip: text; -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
.hero-title span { color: #2f6cff; }
.hero-subtitle { margin: 0; color: var(--vp-c-text-1); font-size: 28px; line-height: 1.35; font-weight: 600; }
.hero-line { width: 72px; height: 5px; border-radius: 99px; margin: 18px 0 16px; background: linear-gradient(90deg, #25bf9a, #2db2d8); }
.hero-desc { margin: 0; color: var(--vp-c-text-2); font-size: 20px; line-height: 1.8; max-width: 620px; }
.hero-actions { margin-top: 28px; display: flex; gap: 14px; }
.btn { display: inline-flex; align-items: center; gap: 8px; padding: 10px 24px; border-radius: 999px; text-decoration: none !important; font-size: 16px; font-weight: 700; transition: transform .2s ease, box-shadow .2s ease; }
.btn-primary { color: #fff !important; background: linear-gradient(90deg, #1f5dff, #2086ff); box-shadow: 0 10px 24px rgba(42, 106, 240, 0.24); }
.btn-ghost { color: var(--vp-c-text-1) !important; border: 1px solid var(--vp-c-border); background: var(--vp-c-bg); }
.gh-icon { width: 18px; height: 18px; color: currentColor; }
.btn:hover { transform: translateY(-2px); }
.hero-right { display: flex; justify-content: flex-end; }
.hero-image { width: 100%; max-width: 560px; height: auto; }
.card-grid { margin-top: 34px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
.tech-card { text-decoration: none !important; background: var(--vp-c-bg-elv); border: 1px solid var(--vp-c-border); border-radius: 16px; padding: 22px; box-shadow: 0 3px 8px rgba(63, 87, 130, 0.05); transition: transform .2s ease, box-shadow .2s ease, border-color .2s ease; }
.tech-card:hover { transform: translateY(-2px); box-shadow: 0 10px 20px rgba(58, 88, 152, 0.1); }
.card-head { display: flex; align-items: center; gap: 12px; margin-bottom: 10px; }
.card-icon { width: 54px; height: 54px; display: block; }
.tech-card h3 { margin: 0; color: var(--vp-c-text-1); font-size: 24px; line-height: 1.2; }
.tech-card p { margin: 0; color: var(--vp-c-text-2); font-size: 15px; line-height: 1.7; }
.tags { margin-top: 16px; display: flex; flex-wrap: wrap; gap: 8px; }
.tags span { padding: 5px 10px; border-radius: 999px; font-size: 14px; font-weight: 600; }
.frontend .tags span { background: #eaf8f1; color: #19a96f; }
.backend .tags span { background: #fff5e2; color: #dc930c; }
.devops .tags span { background: #ebf2ff; color: #2e65df; }
.entry { margin-top: 14px; font-size: 18px; font-weight: 700; }
.frontend .entry { color: #19a96f; }
.backend .entry { color: #dc930c; }
.devops .entry { color: #2e65df; }

:global(html.dark) .hero-badge {
  background: rgba(79, 118, 255, 0.18);
  color: #9ab8ff;
}

:global(html.dark) .tech-card {
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.24);
}

:global(html.dark) .tech-card:hover {
  border-color: #4f76ff;
  box-shadow: 0 10px 22px rgba(0, 0, 0, 0.34);
}

:global(html.dark) .frontend .tags span { background: rgba(30, 148, 102, 0.22); color: #74ddb0; }
:global(html.dark) .backend .tags span { background: rgba(209, 144, 36, 0.2); color: #ffc978; }
:global(html.dark) .devops .tags span { background: rgba(70, 112, 217, 0.25); color: #9cbcff; }
@media (max-width: 1180px) {
  .hero { grid-template-columns: 1fr; gap: 14px; }
  .hero-right { justify-content: center; }
  .card-grid { grid-template-columns: 1fr 1fr; }
  .value-row { grid-template-columns: 1fr 1fr; }
  .hero-title { font-size: 52px; }
  .hero-subtitle { font-size: 24px; }
  .hero-desc { font-size: 20px; }
  .tech-card h3 { font-size: 22px; }
  .tech-card p { font-size: 14px; }
  .entry { font-size: 18px; }
  .value-item b { font-size: 18px; }
  .value-item span { font-size: 14px; }
}
@media (max-width: 768px) {
  .hero-title { font-size: 40px; }
  .hero-subtitle { font-size: 22px; }
  .hero-desc { font-size: 16px; }
  .hero-actions { flex-wrap: wrap; }
  .card-grid { grid-template-columns: 1fr; }
  .value-row { grid-template-columns: 1fr; }
}

:global(.VPDoc:has(.home-wrap)) {
  padding-top: 0!important;
}
</style>
