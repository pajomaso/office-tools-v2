import { Router, type IRouter } from "express";
import healthRouter from "./health";
import roomsRouter from "./rooms";
import bookingsRouter from "./bookings";
import inventoryRouter from "./inventory";
import maintenanceRouter from "./maintenance";
import vendorsRouter from "./vendors";
import scheduledMaintenanceRouter from "./scheduled-maintenance";
import uploadRouter from "./upload";

const router: IRouter = Router();

router.use(healthRouter);
router.use(roomsRouter);
router.use(bookingsRouter);
router.use(inventoryRouter);
router.use(maintenanceRouter);
router.use(vendorsRouter);
router.use(scheduledMaintenanceRouter);
router.use(uploadRouter);

export default router;
