import "./globals.css";

export const metadata = {
  title: "PromoDevs",
  description: "Cupons agregados de vários sites, num só lugar.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
