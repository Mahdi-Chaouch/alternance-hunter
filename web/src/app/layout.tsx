import type { Metadata } from "next";
import { Nunito } from "next/font/google";
import "./globals.css";
import { LayoutWrapper } from "./LayoutWrapper";

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
});

export const metadata: Metadata = {
  title: "Alternance Hunter",
  description:
    "Automatisez vos candidatures d'alternance avec un pipeline Gmail suivi par un dashboard temps reel.",
  icons: {
    icon: [{ url: "/logo.png", type: "image/png" }],
    apple: "/logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body className={nunito.variable}>
        <script
          dangerouslySetInnerHTML={{
            __html: `document.documentElement.dataset.theme = localStorage.getItem('alternance-ui-theme') === 'light' ? 'light' : 'dark';`,
          }}
        />
        <LayoutWrapper>{children}</LayoutWrapper>
      </body>
    </html>
  );
}
