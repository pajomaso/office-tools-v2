import express, { type Express } from "express";
import cors from "cors";
import router from "./routes";
import { securityHeaders, serveWebApp } from "./security";

const app: Express = express();
const isProd = process.env.NODE_ENV === "production";

// Behind a load balancer (DigitalOcean) the client IP is in X-Forwarded-For; rate limits use it.
if (isProd) app.set("trust proxy", 1);
app.disable("x-powered-by");
app.use(securityHeaders);

// The web app and the API share one address in production, so no other site needs access (CORS off).
// CORS_ORIGINS (comma-separated) can allow specific extra origins if ever needed.
const origins = (process.env.CORS_ORIGINS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
app.use(cors(isProd ? { origin: origins.length ? origins : false, credentials: true } : {}));
app.use(express.json({ limit: "200kb" }));
app.use(express.urlencoded({ extended: true, limit: "200kb" }));

app.use("/api", router);
serveWebApp(app);

export default app;
