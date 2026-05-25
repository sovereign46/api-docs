# s46-api-docs

Fumadocs/Next.js documentation for the Sovereign46 API contract.

## Development

```sh
npm install
npm run dev
npm run build
```

Open `http://localhost:3000/docs`.

The docs track the production contract in `s46-api` and intentionally use canonical `@org/team` team ids, `region` terminology, and `https://gateway.s46.dev` harness routing.

The production hostname is `docs.s46.dev`. The Dockerfile builds the Next app for the `docs` stack in `~/dev/s46-infra`.
