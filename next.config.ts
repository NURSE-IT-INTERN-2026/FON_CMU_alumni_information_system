import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              // Next.js requires 'unsafe-inline' and 'unsafe-eval' for hydration/RSC
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              // Allow inline styles for Tailwind utilities and WYSIWYG-rendered content
              "style-src 'self' 'unsafe-inline'",
              // Local uploads plus data URIs for editor images
              "img-src 'self' data: blob:",
              "font-src 'self'",
              "connect-src 'self'",
              // Allow embedded YouTube / Vimeo iframes in news articles
              "frame-src https://www.youtube.com https://player.vimeo.com",
              // Prevent this site from being embedded in a foreign frame (clickjacking)
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join("; "),
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
