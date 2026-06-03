import type { ReactNode } from 'react';

import { routeIndex, type RouteEntry, type RouteIndexName } from '@/lib/docs-routes';

type Tone = 'info' | 'warn' | 'danger';

export function Note({ tag, tone = 'info', children }: { tag: string; tone?: Tone; children: ReactNode }) {
  return (
    <aside className={`s46-note s46-note--${tone}`}>
      <span className="s46-note__tag">{tag}</span>
      <div className="s46-note__body">{children}</div>
    </aside>
  );
}

export function RouteIndex({
  page,
  routes,
  title = 'Route index',
  description,
}: {
  page?: RouteIndexName;
  routes?: RouteEntry[];
  title?: string;
  description?: string;
}) {
  const entries = routes ?? (page ? routeIndex[page] : undefined);
  if (!entries?.length) return null;

  return (
    <nav className={`s46-route-index ${entries.length > 18 ? 's46-route-index--dense' : ''}`} aria-label={title}>
      {description ? (
        <div className="s46-route-index__head">
          <p className="s46-route-index__title">{title}</p>
          <p>{description}</p>
        </div>
      ) : null}
      <div className="s46-route-index__grid">
        {entries.map((route, index) => (
          <a className="s46-route-index__item" href={route.href} key={`${route.method}-${route.path}-${index}`}>
            <span className={`s46-verb s46-verb--${methodClass(route.method)}`}>{route.method}</span>
            <span className="s46-route-index__path">{route.path}</span>
          </a>
        ))}
      </div>
    </nav>
  );
}

export function Method({ method, path, returns }: { method: string; path: string; returns?: string }) {
  return (
    <div className="s46-method-row">
      <span className={`s46-method-row__verb s46-verb--${methodClass(method)}`}>{method}</span>
      <span className="s46-method-row__path">{path}</span>
      {returns ? <span className="s46-method-row__returns">→ {returns}</span> : null}
    </div>
  );
}

export function EndpointMeta({ children }: { children: ReactNode }) {
  return <p className="s46-endpoint-meta">{children}</p>;
}

export function Cards({ columns = 3, children }: { columns?: 2 | 3; children: ReactNode }) {
  return <div className={`s46-cards s46-cards--${columns}`}>{children}</div>;
}

export function Card({
  href,
  eyebrow,
  title,
  description,
  cta,
  url,
}: {
  href?: string;
  eyebrow?: string;
  title?: string;
  description?: string;
  cta?: string;
  url?: string;
}) {
  const content = (
    <>
      {eyebrow ? <p className="s46-card__eyebrow">{eyebrow}</p> : null}
      {url ? <p className="s46-card__url">{url}</p> : null}
      {title ? <p className="s46-card__title">{title}</p> : null}
      {description ? <p className="s46-card__description">{description}</p> : null}
      {cta ? <span className="s46-card__cta">{cta}</span> : null}
    </>
  );

  if (href) {
    return (
      <a className="s46-card" href={href}>
        {content}
      </a>
    );
  }

  return <div className="s46-card">{content}</div>;
}

export function Steps({ children }: { children: ReactNode }) {
  return <div className="s46-steps">{children}</div>;
}

export function Step({ number, title, children }: { number: number | string; title: string; children: ReactNode }) {
  return (
    <section className="s46-step">
      <span className="s46-step__number">{number}</span>
      <div className="s46-step__body">
        <h3>{title}</h3>
        {children}
      </div>
    </section>
  );
}

function methodClass(method: string) {
  const normalized = method.toLowerCase();
  if (normalized.includes('delete') || normalized.includes('del')) return 'delete';
  if (normalized.includes('post')) return 'post';
  if (normalized.includes('put') || normalized.includes('patch')) return 'put';
  if (normalized.includes('get')) return 'get';
  return 'other';
}
