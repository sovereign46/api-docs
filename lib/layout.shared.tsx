import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';

function S46Wordmark() {
  return (
    <span className="s46-wordmark" aria-label="sovereign46 API documentation">
      <span className="s46-wordmark__mark" aria-hidden="true" />
      <span className="s46-wordmark__name">sovereign46</span>
      <span className="s46-wordmark__domain">.dev</span>
      <span className="s46-wordmark__tag">API</span>
    </span>
  );
}

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: <S46Wordmark />,
      url: '/docs',
    },
    links: [
      { text: 'Admin', url: 'https://admin.s46.dev' },
      { text: 'CLI', url: 'https://github.com/sovereign46/s46' },
      { text: 'Status', url: 'https://api.s46.dev/healthz' },
      { text: 'LLM index', url: '/llms.txt' },
    ],
  };
}
