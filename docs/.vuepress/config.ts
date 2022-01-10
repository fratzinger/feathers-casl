export default {
  title: 'feathers-casl',
  description: 'Add access control with CASL to your feathers application',
  head: [['link', { rel: 'icon', href: '/favicon.ico' }]],
  themeConfig: {
    repo: 'fratzinger/feathers-casl',
    logo: '/img/logo.svg',
    docsDir: 'docs',
    editLinks: true,
    editLinkText: 'Edit this page on GitHub',
    contributors: false,
    lastUpdated: true,
    sidebarDepth: 1,
    sidebar: {
      '/': [
        '/getting-started',
        '/hooks',
        '/channels',
        '/utils',
        '/client-side',
        '/gotchas',
        '/cookbook'
      ]
    },
    navbar: [
      {
        text: 'Ecosystem',
        children: [
          { 
            text: 'www.feathersjs.com', 
            link: 'https://feathersjs.com/' 
          }, {
            text: "Feathers Github Repo",
            link: "https://github.com/feathersjs/feathers"
          }, {
            text: 'Awesome Feathersjs',
            link: 'https://github.com/feathersjs/awesome-feathersjs'
          }
        ]
      }
    ]
  }
}