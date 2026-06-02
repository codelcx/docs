import { createContentLoader } from 'vitepress'

export default createContentLoader(
  ['/frontend/*.md', '/backend/*.md', '/devops/*.md'],
  {
    transform(raw) {
      return raw
        .map((page) => ({
          title: page.frontmatter.title || '',
          date: page.frontmatter.date || '',
          category: page.frontmatter.category || '',
          description: page.frontmatter.description || '',
          sort: page.frontmatter.sort ?? NaN,
          url: page.url,
        }))
        .sort((a, b) => {
          const aSort = Number.isNaN(Number(a.sort)) ? -Infinity : Number(a.sort)
          const bSort = Number.isNaN(Number(b.sort)) ? -Infinity : Number(b.sort)
          if (aSort !== bSort) return bSort - aSort
          return (
            new Date(b.date).getTime() - new Date(a.date).getTime()
          )
        })
    },
  }
)
