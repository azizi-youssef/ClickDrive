import type { NextConfig } from "next";

const isProduction = process.env.NODE_ENV === "production";

// Mesure d'audience Plausible (sans cookie) : son origine n'est autorisée que si elle est configurée
const analyticsOrigin = (() => {
  if (!process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN?.trim()) return "";
  try {
    const url = new URL(process.env.NEXT_PUBLIC_PLAUSIBLE_SRC?.trim() || "https://plausible.io/js/script.js");
    return url.protocol === "https:" ? url.origin : "";
  } catch {
    return "";
  }
})();

/* Projet Supabase du site : seules ses images et son API sont autorisées (pas tout *.supabase.co). */
const DEFAULT_SUPABASE_HOST = "wviqbscbnrrpxpojhqql.supabase.co";
const supabaseHosts = new Set([DEFAULT_SUPABASE_HOST]);
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
if (supabaseUrl) {
  try {
    const supabaseOrigin = new URL(supabaseUrl);
    if (supabaseOrigin.protocol === "https:") supabaseHosts.add(supabaseOrigin.hostname);
  } catch {
    // Ignore invalid url
  }
}

const remotePatterns: NonNullable<
  NonNullable<NextConfig["images"]>["remotePatterns"]
> = [
  {
    protocol: "https",
    hostname: "images.unsplash.com",
    pathname: "/**",
  },
  // Fichiers publics du stockage uniquement (pas les URL signées ni l'API)
  ...[...supabaseHosts].map((hostname) => ({
    protocol: "https" as const,
    hostname,
    pathname: "/storage/v1/object/public/**",
  })),
];

const supabaseHttps = [...supabaseHosts].map((host) => `https://${host}`).join(" ");
const supabaseWss = [...supabaseHosts].map((host) => `wss://${host}`).join(" ");

/* -------------------------------------------------------------------------- */
/* Security Headers                                                           */
/* -------------------------------------------------------------------------- */

const securityHeaders = [
  // Prevent clickjacking
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  // Stop MIME-type sniffing
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Ancien filtre XSS désactivé : obsolète et lui-même source de fuites ; la CSP prend le relais
  { key: "X-XSS-Protection", value: "0" },
  // Control referrer information
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Restrict browser features
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(self), payment=()",
  },
  // HSTS – force HTTPS (enable only in production behind HTTPS)
  ...(isProduction
    ? [
        {
          key: "Strict-Transport-Security",
          value: "max-age=63072000; includeSubDomains; preload",
        },
      ]
    : []),
  // Content-Security-Policy
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      // Scripts : 'unsafe-inline' requis par les scripts inline de Next.js ; 'unsafe-eval' seulement en dev (Fast Refresh)
      `script-src 'self' 'unsafe-inline'${isProduction ? "" : " 'unsafe-eval'"}${analyticsOrigin ? ` ${analyticsOrigin}` : ""}`,
      // Styles: self + inline (Tailwind generates inline styles)
      "style-src 'self' 'unsafe-inline'",
      // Polices auto-hébergées (next/font/local)
      "font-src 'self'",
      // Images: self + stockage Supabase du projet + Unsplash + data URIs
      `img-src 'self' data: blob: ${supabaseHttps} https://images.unsplash.com`,
      // Connections: self + API & Realtime du projet Supabase
      `connect-src 'self' ${supabaseHttps} ${supabaseWss}${analyticsOrigin ? ` ${analyticsOrigin}` : ""}`,
      // Workers: self
      "worker-src 'self' blob:",
      // Aucun plugin (Flash, applets…)
      "object-src 'none'",
      // Frame ancestors: deny by default (same as X-Frame-Options)
      "frame-ancestors 'self'",
      // Form submissions to self only
      "form-action 'self'",
      // Base URI
      "base-uri 'self'",
      ...(isProduction ? ["upgrade-insecure-requests"] : []),
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  transpilePackages: ["@clickdrive/shared"],
  outputFileTracingIncludes: {
    "/api/admin/agencies/sync-logos": [
      "./public/logo_marchicacar.jpeg",
      "./public/logo_Krinicar.jpeg",
    ],
  },
  images: {
    remotePatterns,
    // Enable size optimization
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 3600,
  },
  // Apply security headers to all routes
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
  // Compress output
  compress: true,
  // Enable React strict mode for catching potential issues
  reactStrictMode: true,
  // Power header
  poweredByHeader: false,
};

export default nextConfig;
