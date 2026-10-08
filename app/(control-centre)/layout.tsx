'use client';

import { usePathname } from 'next/navigation';
import AppShell from '@/components/AppShell';

export default function ControlCentreLayout() {
  const pathname = usePathname();
  const route = (pathname ?? '/dashboard').split('/').filter(Boolean)[0] || 'dashboard';
  return <AppShell route={route} />;
}
