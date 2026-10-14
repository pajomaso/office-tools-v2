import { Router, type IRouter } from "express";
import healthRouter from "./health";
import roomsRouter from "./rooms";
import bookingsRouter from "./bookings";
import inventoryRouter from "./inventory";
import maintenanceRouter from "./maintenance";
import vendorsRouter from "./vendors";
import scheduledMaintenanceRouter from "./scheduled-maintenance";
import uploadRouter from "./upload";
import suggestionsRouter from "./suggestions";
import authRouter from "./auth";
import portalRouter from "./portal";
import portalAdminRouter from "./portal-admin";
import portalItemsRouter from "./portal-items";
import portalMessagesRouter from "./portal-messages";
import portalRoomsRouter from "./portal-rooms";
import portalAreaRouter from "./portal-area";
import portalTagsRouter from "./portal-tags";
import portalSupplierRouter from "./portal-supplier";
import portalMetricsRouter from "./portal-metrics";
import portalSuppliersRouter from "./portal-suppliers";
import portalSettingsRouter from "./portal-settings";

const router: IRouter = Router();

// The old Office Engine routes have no sign-in at all. They're only for local development of the old apps
// and are never served in production unless LEGACY_ROUTES=1 is set on purpose.
const legacy = process.env.NODE_ENV !== "production" || process.env.LEGACY_ROUTES === "1";

router.use(healthRouter);
if (legacy) {
  router.use(roomsRouter);
  router.use(bookingsRouter);
  router.use(inventoryRouter);
  router.use(maintenanceRouter);
  router.use(vendorsRouter);
  router.use(scheduledMaintenanceRouter);
  router.use(uploadRouter);
  router.use(suggestionsRouter);
  router.use(authRouter);
}
router.use(portalRouter);
router.use(portalAdminRouter);
router.use(portalItemsRouter);
router.use(portalMessagesRouter);
router.use(portalRoomsRouter);
router.use(portalAreaRouter);
router.use(portalTagsRouter);
router.use(portalSupplierRouter);
router.use(portalMetricsRouter);
router.use(portalSuppliersRouter);
router.use(portalSettingsRouter);

export default router;
