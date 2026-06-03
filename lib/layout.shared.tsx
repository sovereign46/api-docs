import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';

function S46Wordmark() {
  return (
    <span className="s46-wordmark" aria-label="s46 API documentation">
      <span className="s46-wordmark__mark" aria-hidden="true" />
      <span className="s46-wordmark__name">
        s46<span className="s46-wordmark__domain">.api</span>
      </span>
      <span className="s46-wordmark__tag">v1</span>
    </span>
  );
}

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: <S46Wordmark />,
      url: '/docs',
    },
  };
}
