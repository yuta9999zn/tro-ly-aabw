import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Trợ lý AABW",
  description: "Hỏi đáp Agentic AI Build Week — trả lời từ dữ liệu chính thức, không bịa.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
