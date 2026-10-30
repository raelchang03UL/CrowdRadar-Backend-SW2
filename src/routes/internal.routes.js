import { Router } from "express";
import PushNotificationService from "../services/PushNotificationService.js";
import { createSaturationEventController } from "../controllers/SaturationEventController.js";

export function createInternalRoutes(service = PushNotificationService, options) {
    const router = Router();
    router.post("/places/:id/saturation", createSaturationEventController(service, options));
    return router;
}

export default createInternalRoutes();
