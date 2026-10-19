import { Router, type IRouter } from "express";

const router: IRouter = Router();

// Used by DigitalOcean's health check (and uptime monitoring).
router.get("/healthz", (_req, res) => {
  res.json({ status: "ok" });
});

export default router;
