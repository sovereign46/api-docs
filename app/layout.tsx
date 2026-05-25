import './global.css';

import { RootProvider } from 'fumadocs-ui/provider/next';
import type { ReactNode } from 'react';

const clipboardFallback = `
(function () {
  if (navigator.clipboard && navigator.clipboard.writeText) return;

  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: {
      writeText: function (text) {
        return new Promise(function (resolve, reject) {
          var textarea = document.createElement('textarea');
          textarea.value = String(text || '');
          textarea.setAttribute('readonly', '');
          textarea.style.position = 'fixed';
          textarea.style.top = '-1000px';
          textarea.style.left = '-1000px';
          document.body.appendChild(textarea);
          textarea.select();

          try {
            if (!document.execCommand('copy')) throw new Error('copy command failed');
            resolve();
          } catch (error) {
            reject(error);
          } finally {
            textarea.remove();
          }
        });
      }
    }
  });
})();
`;

export const metadata = {
  title: 's46 API docs',
  description: 'Sovereign46 API contract for CLI, admin, workers, and integrations.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: clipboardFallback }} />
      </head>
      <body>
        <RootProvider>{children}</RootProvider>
      </body>
    </html>
  );
}
