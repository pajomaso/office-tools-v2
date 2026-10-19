import { Router, type IRouter } from "express";
import healthRouter from "./health";
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

router.use(healthRouter);
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
