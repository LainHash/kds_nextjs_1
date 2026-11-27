import type { NextConfig } from "next";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "https://apigatewayv2.onrender.com";

function buildGatewayOrigins(rawUrl: string): string[] {
  try {
    const url = new URL(rawUrl);
    const wsProtocol = url.protocol === "https:" ? "wss:" : "ws:";
    return [url.origin, `${wsProtocol}//${url.host}`];
  } catch {
    return ["https://apigatewayv2.onrender.com", "wss://apigatewayv2.onrender.com"];
  }
}

const gatewayOrigins = buildGatewayOrigins(apiBaseUrl);
const isDev = process.env.NODE_ENV === "development";
const devConnectOrigins = isDev
  ? "http://localhost:* https://localhost:* ws://localhost:* wss://localhost:*"
  : "";
const scriptEval = isDev ? "'unsafe-eval'" : "";

const cspReportOnly = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' ${scriptEval} https://accounts.google.com https://apis.google.com`.replace(/\s+/g, " ").trim(),
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://accounts.google.com",
  "img-src 'self' data: blob: https://res.cloudinary.com https://*.cloudinary.com https://qr.sepay.vn https://img.vietqr.io https://lh3.googleusercontent.com https://*.googleusercontent.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  `connect-src 'self' ${gatewayOrigins.join(" ")} ${devConnectOrigins} https://accounts.google.com https://oauth2.googleapis.com https://api.cloudinary.com https://res.cloudinary.com`.replace(/\s+/g, " ").trim(),
  "frame-src 'self' https://accounts.google.com",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const nextConfig: NextConfig = {
  poweredByHeader: false,
  cacheComponents: true,
  partialPrefetching: true,
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
      {
        protocol: "http",
        hostname: "**",
      },
    ],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy-Report-Only",
            value: cspReportOnly,
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
