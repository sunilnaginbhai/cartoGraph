import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Cartograph",
  description: "Understand the shape of your codebase.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full">
        <script
          dangerouslySetInnerHTML={{
            __html: `(() => {
              const preference = localStorage.getItem("cartograph-theme") || "system";
              const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
              document.documentElement.dataset.theme = preference === "system"
                ? systemDark ? "dark" : "light"
                : preference;
            })();`,
          }}
        />
        <ClerkProvider
          appearance={{
            options: { animations: false, elevation: "raised" },
          }}
          signInUrl="/sign-in"
          signUpUrl="/sign-up"
          signInFallbackRedirectUrl="/workspace"
          signUpFallbackRedirectUrl="/workspace"
        >
          {children}
        </ClerkProvider>
      </body>
    </html>
  );
}
