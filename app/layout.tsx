import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import NotificationListener from "@/features/notifications/components/NotificationListener";
import OfflineBanner from "@/components/ui/OfflineBanner";
import RestrictionBanner from "@/components/ui/RestrictionBanner";
import ServerWakeGate from "@/components/ui/ServerWakeGate";
import AnnouncementCenter from "@/features/announcements/components/AnnouncementCenter";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "Vokitoki",
  description: "A modern real-time chat application",
  icons: {
    icon: "/icon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  const theme = localStorage.getItem('theme');
                  // Default to dark unless explicitly set to light
                  if (theme === 'light') {
                    document.documentElement.setAttribute('data-theme', 'light');
                  } else {
                    document.documentElement.setAttribute('data-theme', 'dark');
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ServerWakeGate>{children}</ServerWakeGate>
        <NotificationListener />
        <AnnouncementCenter />
        <RestrictionBanner />
        <OfflineBanner />
      </body>
    </html>
  );
}