import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  typedRoutes: true,
  // Server-only Node packages that webpack should not bundle:
  //  - pdf-parse: has a debug side effect at the package root.
  //  - pdfkit: ships AFM/font metrics it loads via fs at runtime.
  //  - sharp: native module (libvips bindings) — must load from
  //    node_modules at runtime, not be bundled.
  serverExternalPackages: ["pdf-parse", "pdfkit", "sharp"],
  // Trace the embedded TTFs into the PDF route's serverless bundle so
  // they exist at runtime on Vercel. Without this, fs.readFileSync
  // works locally but fails in production with ENOENT.
  outputFileTracingIncludes: {
    "/api/export/cover-letter-pdf": ["./lib/export/fonts/**/*.ttf"],
    "/api/export/cv-pdf": ["./lib/export/fonts/**/*.ttf"],
  },
  async redirects() {
    return [
      // Legacy "resumes" routes → "cvs". Permanent (308): renaming the
      // product surface, not a temporary swap.
      { source: "/resumes", destination: "/cvs", permanent: true },
      { source: "/resumes/:slug*", destination: "/cvs/:slug*", permanent: true },
    ];
  },
};

export default nextConfig;
