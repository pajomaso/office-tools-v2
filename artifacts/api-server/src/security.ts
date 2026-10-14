import express, { type Express, type RequestHandler } from "express";
import path from "node:path";
import { existsSync } from "node:fs";

const isProd = process.env.NODE_ENV === "production";

// The page may load: its own scripts and styles, Google Fonts, images from https links (guides),
// and video players from YouTube, Vimeo and Loom (guides). Nothing else, and it can't be framed.
export const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob: https:",
  "frame-src https://www.youtube-nocookie.com https://player.vimeo.com https://www.loom.com",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

export const securityHeaders: RequestHandler = (_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin"); // other sites never see a path (e.g. the supplier's secret link)
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  res.setHeader("Content-Security-Policy", CSP);
  if (isProd) res.setHeader("Strict-Transport-Security", "max-age=31536000");
  next();
};

// In production the server also serves the built web app (one address for page and API, so the sign-in cookie stays first-party).
// PORTAL_STATIC_DIR points at artifacts/portal/dist/public. Every non-/api path gets index.html (the app does its own routing).
export function serveWebApp(app: Express) {
  const dir = process.env.PORTAL_STATIC_DIR;
  if (!dir) return;
  const root = path.resolve(dir);
  if (!existsSync(path.join(root, "index.html"))) throw new Error(`PORTAL_STATIC_DIR has no index.html: ${root}`);
  app.use(express.static(root, { index: false, maxAge: "1y", immutable: true, setHeaders: (res, file) => { if (!file.includes(`${path.sep}assets${path.sep}`)) res.setHeader("Cache-Control", "no-cache"); } }));
  app.get(/^\/(?!api\/).*/, (_req, res) => { res.setHeader("Cache-Control", "no-cache"); res.sendFile(path.join(root, "index.html")); });
}
