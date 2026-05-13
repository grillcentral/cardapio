import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Grill Central — Cardápio | Sabor das Carnes e Lanches",
  description: "Grill Central - Cardápio online. Peça pelo WhatsApp! Terça a Sábado, 18:30 às 23:00.",
  openGraph: {
    title: "Grill Central — Cardápio | Sabor das Carnes e Lanches",
    description: "Grill Central - Cardápio online. Peça pelo WhatsApp! Terça a Sábado, 18:30 às 23:00.",
    url: "https://grillcardapio.com.br",
    siteName: "Grill Central",
    images: [
      {
        url: "https://grillcardapio.com.br/images/restaurant-logo.jpeg",
        width: 800,
        height: 800,
        alt: "Grill Central — Sabor das Carnes e Lanches",
      },
    ],
    locale: "pt_BR",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=DM+Sans:ital,wght@0,300;0,400;0,500;0,600;1,400&display=swap" rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  );
}
