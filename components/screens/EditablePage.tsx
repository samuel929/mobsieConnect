import AppShell from '@/components/AppShell';

export type ControlCentreRoute =
  | 'dashboard'
  | 'schools'
  | 'branches'
  | 'applications'
  | 'waiting-list'
  | 'learners'
  | 'parents'
  | 'teachers'
  | 'attendance'
  | 'homework'
  | 'daily-activity'
  | 'reports'
  | 'calendar'
  | 'payments'
  | 'invoices'
  | 'statements'
  | 'messages'
  | 'newsletters'
  | 'push'
  | 'feedback'
  | 'gallery'
  | 'products'
  | 'orders'
  | 'inventory'
  | 'documents'
  | 'users'
  | 'roles'
  | 'audit'
  | 'settings';

type EditablePageProps = {
  route: ControlCentreRoute;
};

/**
 * Shared route adapter. Every screen has its own app/.../page.tsx file so routes
 * are easy to discover. Edit the screen layout in components/legacy/pages,
 * or replace this adapter with a React screen incrementally.
 */
export default function EditablePage({ route }: EditablePageProps) {
  return <AppShell route={route} />;
}
