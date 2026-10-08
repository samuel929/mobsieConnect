import AppShell from '@/components/AppShell';

// Landing route renders the dashboard directly (static-export friendly).
export default function Home() {
  return <AppShell route="dashboard" />;
}
