import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col justify-center gap-8 px-6 py-20">
      <p className="font-mono text-sm uppercase tracking-[0.2em] text-fd-muted-foreground">Sovereign46</p>
      <h1 className="text-5xl font-semibold tracking-tight md:text-7xl">API contract for the s46 control plane.</h1>
      <p className="max-w-2xl text-lg text-fd-muted-foreground">
        Auth, org-scoped teams, admin operations, worker leases, jobs, schedules, usage, and audit routes for production clients.
      </p>
      <div>
        <Link className="rounded-md bg-fd-primary px-4 py-2 text-fd-primary-foreground" href="/docs">
          Read the docs
        </Link>
      </div>
    </main>
  );
}
