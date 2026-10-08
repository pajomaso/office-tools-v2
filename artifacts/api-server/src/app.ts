import express, { type Express } from "express";
import cors from "cors";
import router from "./routes";

const app: Express = express();

// Behind a load balancer (DigitalOcean) the client IP is in X-Forwarded-For; the public leads form rate-limits on it.
if (process.env.NODE_ENV === "production") app.set("trust proxy", 1);

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

export default app;
