import { Router } from "express";
import auth from "../middlewares/authMiddleware.js";
import admin from "../middlewares/adminMiddleware.js";
import controller from "../controllers/AdminUserController.js";
import reports from "../controllers/AdminReportController.js";

const router = Router();
router.use((req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
});
router.use(auth, admin);
router.get("/users", controller.list);
router.get("/users/:id", controller.detail);
router.get("/users/:id/history", controller.history);
router.post("/users/:id/suspend", controller.suspend);
router.post("/users/:id/reactivate", controller.reactivate);
router.get("/reports", reports.list);
router.get("/reports/:id", reports.detail);
router.post("/reports/:id/decision", reports.decide);
export default router;
