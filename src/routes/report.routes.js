import { Router } from "express";
import authMiddleware from "../middlewares/authMiddleware.js";
import { saturationReportLevels } from "../domain/saturationReport.js";
import SaturationReportController from "../controllers/SaturationReportController.js";

const router = Router();
router.post(
    "/:placeId/reports",
    authMiddleware,
    (req, res, next) => {
        if (!req.body || typeof req.body !== "object" || Array.isArray(req.body) ||
            Object.keys(req.body).some((key) => key !== "level") ||
            !saturationReportLevels.includes(req.body.level)) {
            return res.status(400).json({ code: "INVALID_REPORT_LEVEL", message: "Selecciona un nivel de saturación válido." });
        }
        next();
    },
    SaturationReportController.create
);

export default router;
