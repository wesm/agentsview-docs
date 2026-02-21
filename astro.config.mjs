import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

export default defineConfig({
  site: 'https://agentsview.io',
  integrations: [
    starlight({
      title: 'agentsview',
      disable404Route: false,
      components: {
        ThemeSelect: './src/components/EmptyThemeSelect.astro',
        Header: './src/components/Header.astro',
        Footer: './src/components/Footer.astro',
      },
      customCss: ['./src/styles/custom.css'],
      expressiveCode: {
        themes: ['dracula'],
        styleOverrides: {
          copyButton: {
            visible: true,
          },
        },
      },
      head: [
        {
          tag: 'meta',
          attrs: {
            property: 'og:type',
            content: 'website',
          },
        },
      ],
      sidebar: [
        { label: 'Quick Start', slug: 'quickstart' },
        { label: 'Usage Guide', slug: 'usage' },
        { label: 'CLI Reference', slug: 'commands' },
        { label: 'Configuration', slug: 'configuration' },
        { label: 'API Reference', slug: 'api' },
        { label: 'Architecture', slug: 'architecture' },
      ],
    }),
  ],
});
