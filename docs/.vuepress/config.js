module.exports = {
    title: 'feathers-casl',
    description: 'Add access control with CASL to your feathers application',
    head: [['link', { rel: 'icon', href: '/favicon.ico' }]],
    theme: 'default-prefers-color-scheme',
    themeConfig: {
      logo: '/img/logo.svg',
      repo: 'fratzinger/feathers-casl',
      docsDir: 'docs',
      editLinks: true,
      lastUpdated: true,
      sidebar: [
        '/getting-started.md',
        '/hook-authorize.md',
        '/channels.md',
        '/cookbook.md',
        '/client-side.md',
        '/gotchas.md'
      ],
      serviceWorker: {
        updatePopup: true
      }
    },
    plugins: [
        '@vuepress/active-header-links', {
        sidebarLinkSelector: '.sidebar-link',
        headerAnchorSelector: '.header-anchor'
    }]
  }