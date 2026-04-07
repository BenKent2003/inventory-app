import './globals.css';

export const metadata = {
  title: 'Albion Engineering Inventory',
  description: 'Inventory, stock logging, machine usage, and analytics dashboard.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
