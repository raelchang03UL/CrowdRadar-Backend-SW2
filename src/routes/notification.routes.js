import { Router } from "express";
import authMiddleware from "../middlewares/authMiddleware.js";
import PushNotificationService from "../services/PushNotificationService.js";
import { createNotificationController } from "../controllers/NotificationController.js";

export function createNotificationRoutes(service = PushNotificationService) {
    const router = Router();
    router.use((req, res, next) => { res.set("Cache-Control", "no-store"); next(); });
    const controller = createNotificationController(service);
    router.post("/devices", authMiddleware, controller.registerDevice);
    router.delete("/devices", authMiddleware, controller.removeDevice);
    return router;
}

export default createNotificationRoutes();
