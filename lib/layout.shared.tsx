import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: 's46 API',
    },
    links: [
      { text: 'Admin', url: 'https://admin.s46.dev' },
      { text: 'CLI', url: 'https://github.com/sovereign46/s46' },
      { text: 'Status', url: 'https://api.s46.dev/healthz' },
    ],
  };
}
