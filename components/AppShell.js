'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

/*
  AppShell renders the Control Centre chrome (the same DOM skeleton the original
  app used) and, on the client only, loads the app modules and boots them.

  Why this shape? The Control Centre's modular pages, charts, tables, drawers and
  data layer are ~4,000 lines of verified vanilla JS built around a render() +
  mount() pattern. Rather than risk a line-by-line JSX rewrite, we keep that
  code intact as client-only modules (components/legacy/*) and let React own the
  routing, the page container and the app lifecycle. Each URL is a real Next.js
  route; navigating re-renders the active page through the legacy engine.

  To migrate a page to idiomatic React later, replace its entry in
  components/legacy/pages/* with a React component and render it here by route —
  the data layer (window.DB) and helpers stay the same.
*/

let libsPromise = null;
function loadLibs() {
  // Import order matters: icons/data/charts/ui/app-core, then the pages.
  if (!libsPromise) libsPromise = import('@/components/legacy/boot');
  return libsPromise;
}

export default function AppShell({ route = 'dashboard' }) {
  const router = useRouter();
  const [bootError, setBootError] = useState('');
  const booted = useRef(false);
  const currentRoute = useRef(route);
  currentRoute.current = route;

  const showSkeleton = () => {
    const content = document.getElementById('content');
    if (!content) return;
    content.innerHTML = `<div class="screen-skeleton" aria-label="Loading page">
      <div class="skeleton-title"></div><div class="skeleton-subtitle"></div>
      <div class="skeleton-grid"><div class="skeleton-card"></div><div class="skeleton-card"></div><div class="skeleton-card"></div><div class="skeleton-card"></div></div>
      <div class="skeleton-panel"></div></div>`;
  };

  useEffect(() => {
    let cancelled = false;
    setBootError('');
    // Let the legacy layer drive Next navigation for in-app links.
    window.__mobsieNavigate = (r) => {
      if (r === window.App?.route) return;
      showSkeleton();
      router.push('/' + r, { scroll: false });
    };
    window.__mobsiePrefetch = (r) => router.prefetch('/' + r);
    window.MobsieShowPageSkeleton = showSkeleton;

    async function boot() {
      try {
        const response = await fetch('/api/auth/me', { credentials: 'include' });

        // Only a real missing/expired session may send someone to sign in.
        // A page render, database, or API error must keep the user signed in.
        if (response.status === 401 || response.status === 403) {
          router.replace('/login');
          return;
        }
        if (!response.ok) {
          throw new Error(`Unable to verify the session (${response.status}).`);
        }

        const body = await response.json();
        if (!body?.data?.user) {
          throw new Error('The session response did not include a user.');
        }

        window.MobsieSession = body.data.user;
        await loadLibs();
        if (cancelled) return;

        if (window.MobsieApi) await window.MobsieApi.load();
        if (cancelled) return;
        booted.current = true;
        if (typeof window.MobsieBoot === 'function') window.MobsieBoot(currentRoute.current);
      } catch (error) {
        if (cancelled) return;
        console.error(`Failed to load the ${route} screen.`, error);
        setBootError(
          'This screen could not be loaded. Your session is still active. Refresh the page or try again.',
        );
      }
    }

    void boot();
    return () => {
      cancelled = true;
      delete window.__mobsieNavigate;
      delete window.__mobsiePrefetch;
      delete window.MobsieShowPageSkeleton;
    };
  }, [router]);

  useEffect(() => {
    if (!booted.current || typeof window.MobsieBoot !== 'function') return;
    if (window.App?.route === route) return;
    showSkeleton();
    const frame = requestAnimationFrame(() => window.MobsieBoot(route));
    return () => cancelAnimationFrame(frame);
  }, [route]);

  return (
    <div id="app" className="app">
      <aside className="sidebar" id="sidebar" aria-label="Main navigation" suppressHydrationWarning />
      <div className="sidebar-scrim" id="sidebarScrim" />
      <div className="main">
        <header className="topbar" id="topbar" suppressHydrationWarning />
        <main className="content" id="content" tabIndex={-1} suppressHydrationWarning>
          {bootError ? (
            <div className="card" role="alert" style={{ maxWidth: 680, margin: '32px auto', padding: 24 }}>
              <h2 style={{ marginTop: 0 }}>Unable to load this screen</h2>
              <p>{bootError}</p>
              <button className="btn btn-primary" type="button" onClick={() => window.location.reload()}>
                Refresh page
              </button>
            </div>
          ) : (
            <div className="screen-skeleton" aria-label="Loading page">
              <div className="skeleton-title" />
              <div className="skeleton-subtitle" />
              <div className="skeleton-grid">
                <div className="skeleton-card" /><div className="skeleton-card" />
                <div className="skeleton-card" /><div className="skeleton-card" />
              </div>
              <div className="skeleton-panel" />
            </div>
          )}
        </main>
      </div>

      {/* Overlays the imperative UI helpers mount into */}
      <div className="search-overlay" id="searchOverlay" hidden />
      <div className="drawer-root" id="drawerRoot" />
      <div className="modal-root" id="modalRoot" />
      <div className="chart-tip" id="chartTip" hidden />
      <div className="toast-stack" id="toastStack" />
    </div>
  );
}
