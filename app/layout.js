import './globals.css';

export const metadata = {
  title: 'Machinery Parts Inventory',
  description: 'Track stock, machines, and parts used on each machine.'
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
