module.exports = {
  title: 'Democrat',
  tagline: 'Like React, but for global state management',
  url: 'https://democrat.etienne.tech',
  baseUrl: '/',
  favicon: 'img/favicon.ico',
  organizationName: 'etienne-dldc', // Usually your GitHub org/user name.
  projectName: 'democrat', // Usually your repo name.
  themeConfig: {
    navbar: {
      title: 'Democrat',
      logo: {
        alt: 'Democrat Logo',
        src: 'img/logo-small-inverted.svg',
      },
      links: [
        { to: 'docs/introduction', label: 'Docs', position: 'left' },
        { to: 'blog', label: 'Blog', position: 'left' },
        {
          href: 'https://github.com/etienne-dldc/democrat',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [],
      copyright: `Copyright © ${new Date().getFullYear()} Etienne Dldc. Built with Docusaurus.`,
    },
    disableDarkMode: true,
  },
  presets: [
    [
      '@docusaurus/preset-classic',
      {
        docs: {
          path: '../docs',
          sidebarPath: require.resolve('./sidebars.js'),
        },
        pages: {
          path: './pages',
        },
        theme: {
          customCss: require.resolve('./theme/index.css'),
        },
      },
    ],
  ],
};
