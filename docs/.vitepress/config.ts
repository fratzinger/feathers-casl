import { defineConfig } from "vitepress"

export default defineConfig({
  title: 'feathers-casl',
  description: 'Add access control with CASL to your feathers application',
  head: [['link', { rel: 'icon', href: '/favicon.ico' }]],
  themeConfig: {
    logo: '/img/logo.svg',
    editLink: { pattern: 'https://github.com/fratzinger/feathers-casl/edit/master/docs/:path', text: 'Edit this page on GitHub' },
    lastUpdatedText: 'Last Updated',
    socialLinks: [
      { icon: 'github', link: 'https://github.com/fratzinger/feathers-casl' }
    ],
    sidebar: [
      {
        text: 'Guide',
        items: [
          { text: 'Getting Started', link: '/getting-started' },
          { text: 'Hooks', link: '/hooks' },
          { text: 'Channels', link: '/channels' },
          { text: 'Utils', link: '/utils' },
          { text: 'Client Side', link: '/client-side' },
          { text: 'Gotchas', link: '/gotchas' },
          { text: 'Cookbook', link: '/cookbook' }
        ]
      }
    ],
    nav: [
      
      {
        text: 'Ecosystem',
        items: [
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
    ],
    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2020-present Frederik Schmatz'
    },
  }
});