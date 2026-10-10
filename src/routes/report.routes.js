import { Router } from "express";
import authMiddleware from "../middlewares/authMiddleware.js";
import validateSchema from "../middlewares/validateSchema.js";
import SaturationReportController from "../controllers/SaturationReportController.js";
import { saturationReportSchema } from "../validations/reportSchemas.js";

const router = Router();
router.post(
    "/:placeId/reports",
    authMiddleware,
    validateSchema(saturationReportSchema),
    SaturationReportController.create
);

export default router;
