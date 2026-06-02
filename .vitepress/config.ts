import { defineConfig } from 'vitepress';
import fs from 'node:fs';
import path from 'node:path';

function parseFrontmatter(filePath: string) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const match = content.match(/^---([\s\S]*?)---/);
  if (!match) return { title: '', date: '', sort: NaN };
  let title = '';
  let date = '';
  let sort = NaN;
  for (const line of match[1].split('\n')) {
    const idx = line.indexOf(':');
    if (idx > 0) {
      const key = line.slice(0, idx).trim();
      let value = line.slice(idx + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (key === 'title') title = value;
      if (key === 'date') date = value;
      if (key === 'sort') sort = Number(value);
    }
  }
  return { title, date, sort };
}

function getArticles(dir: string, basePath: string) {
  const fullDir = path.resolve(process.cwd(), dir);
  if (!fs.existsSync(fullDir)) return [];
  return fs
    .readdirSync(fullDir, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith('.md') && e.name !== 'index.md')
    .map((e) => {
      const name = e.name.replace('.md', '');
      const fm = parseFrontmatter(path.join(fullDir, e.name));
      return {
        text: fm.title || name,
        link: `${basePath}/${name}`,
        date: fm.date,
        sort: fm.sort,
      };
    })
    .sort((a, b) => {
      const aSort = Number.isNaN(a.sort) ? -Infinity : a.sort;
      const bSort = Number.isNaN(b.sort) ? -Infinity : b.sort;
      if (aSort !== bSort) return bSort - aSort;
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });
}

const frontendArticles = getArticles('docs/frontend', '/frontend');
const backendArticles = getArticles('docs/backend', '/backend');
const devopsArticles = getArticles('docs/devops', '/devops');
const scenarioArticles = getArticles('docs/scenario', '/scenario');

export default defineConfig({
  title: 'ANCX Docs',
  description: '记录前端、后端与运维的学习与实践',
  lang: 'zh-CN',

  srcDir: 'docs',

  vite: {
    publicDir: 'public',
  },

  appearance: true,

  themeConfig: {
    nav: [
      {
        text: '首页',
        link: '/',
      },
      {
        text: '前端',
        link: frontendArticles[0]?.link || '/frontend/',
      },
      {
        text: '后端',
        link: backendArticles[0]?.link || '/backend/',
      },
      {
        text: '运维',
        link: devopsArticles[0]?.link || '/devops/',
      },
      {
        text: '场景',
        link: scenarioArticles[0]?.link || '/scenario/',
      },
    ],

    sidebar: {
      '/frontend/': [...frontendArticles.map(({ text, link }) => ({ text, link }))],
      '/backend/': [...backendArticles.map(({ text, link }) => ({ text, link }))],
      '/devops/': [...devopsArticles.map(({ text, link }) => ({ text, link }))],
      '/scenario/': [...scenarioArticles.map(({ text, link }) => ({ text, link }))],
    },

    search: {
      provider: 'local',
    },

    outline: [2, 3],
    outlineTitle: '本页目录',

    socialLinks: [{ icon: 'github', link: 'https://github.com' }],

    footer: {
      message: '基于 VitePress 构建',
      copyright: 'Copyright © 2026',
    },
  },
});
