import { Router } from "express";
import authMiddleware from "../middlewares/authMiddleware.js";
import PushNotificationService from "../services/PushNotificationService.js";
import { createNotificationController } from "../controllers/NotificationController.js";

export function createNotificationRoutes(service = PushNotificationService) {
    const router = Router();
    const controller = createNotificationController(service);
    router.post("/devices", authMiddleware, controller.registerDevice);
    router.delete("/devices", authMiddleware, controller.removeDevice);
    return router;
}

export default createNotificationRoutes();
