import { headers } from "next/headers";
import "./globals.css";
export const metadata = {
  title: "Filmgram",
  description: "Discover stories worth sharing.",
};
export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = (await headers()).get("x-filmgram-locale") || "en";
  return (
    <html lang={locale}>
      <body>{children}</body>
    </html>
  );
}
