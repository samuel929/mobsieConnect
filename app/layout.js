import './globals.css';

export const metadata = {
  title: 'Mobsie Connect — Control Centre',
  description:
    'Mobsie Connect Control Centre — enterprise school management platform. Manage every campus, family and payment from one place.',
  icons: {
    icon:
      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect x='4' y='4' width='56' height='56' rx='18' fill='%23F97316'/%3E%3Ccircle cx='40' cy='26' r='11' fill='%2322C55E'/%3E%3Ccircle cx='26' cy='38' r='11' fill='%23fff'/%3E%3C/svg%3E",
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
