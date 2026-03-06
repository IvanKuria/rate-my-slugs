import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  srcDir: 'src',
  manifest: {
    name: 'Rate My Slugs',
    version: '1.4.0',
    description:
      'Shows Rate My Professors ratings for UCSC courses on MyUCSC enrollment pages as well as grade distribution graphs for each course.',
    permissions: ['storage'],
    host_permissions: [
      'https://my.ucsc.edu/*',
      'https://pisa.ucsc.edu/*',
      'https://www.ratemyprofessors.com/*',
      'https://rate-my-slugs-server.onrender.com/*',
      'https://campusdirectory.ucsc.edu/*',
    ],
    web_accessible_resources: [
      {
        resources: [
          'icons/sammy/*.png',
          'icons/sammy/*.jpg',
          'data/*.json',
          'images/*',
        ],
        matches: ['https://my.ucsc.edu/*', 'https://pisa.ucsc.edu/*'],
      },
    ],
    icons: {
      '16': 'icons/sammy/sammy-16.jpg',
      '48': 'icons/sammy/sammy-48.png',
      '128': 'icons/sammy/sammy-128.jpg',
    },
  },
});
