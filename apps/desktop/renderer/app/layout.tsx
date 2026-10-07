import { GeistSans, GeistMono } from "geist/font";
import "./globals.css";
import { Shell } from "../components/shell";

export const metadata = { title: "Ego — tu yo operativo" };

const geist = GeistSans;
const mono = GeistMono;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${geist.variable} ${mono.variable}`}>
      <body>
        <Shell />
        {children}
      </body>
    </html>
  );
}
