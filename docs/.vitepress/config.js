module.exports = {
  title: 'feathers-casl',
  description: 'Add access control with CASL to your feathers application',
  head: [['link', { rel: 'icon', href: '/favicon.ico' }]],
  themeConfig: {
    repo: 'fratzinger/feathers-casl',
    logo: '/img/logo.svg',
    docsDir: 'docs',
    editLinks: true,
    editLinkText: 'Edit on GitHub',
    lastUpdated: true,
    sidebarDepth: 1,
    sidebar: {
      '/': [
        { text: 'Getting Started', link: '/getting-started' },
        { text: 'Hooks', link: '/hooks'},
        { text: 'Channels', link: '/channels'},
        { text: 'Utils', link: '/utils' },
        { text: 'Client side', link: '/client-side'},
        { text: 'Gotchas', link: '/gotchas'},
        { text: 'Cookbook', link: '/cookbook'}
      ]
    }
  }
}