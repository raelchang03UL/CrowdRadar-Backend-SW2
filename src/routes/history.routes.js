import { Router } from "express";
import auth from "../middlewares/authMiddleware.js";
import service from "../services/PlaceHistoryService.js";

const router = Router();
router.use((req, res, next) => { res.set("Cache-Control", "no-store"); next(); });
router.use(auth);

const handle = (kind) => async (req, res) => {
    try {
        const allowed = kind === "comparison" ? ["from", "to", "compareFrom", "compareTo"] : ["from", "to"];
        if (Object.keys(req.query).some((key) => !allowed.includes(key))) {
            return res.status(400).json({ code: "PERIOD_INVALID", message: "Parámetros del período inválidos." });
        }
        let data;
        if (kind === "comparison") {
            data = await service.compare(req.params.id,
                { from: req.query.from, to: req.query.to },
                { from: req.query.compareFrom, to: req.query.compareTo });
        } else if (kind === "quiet-hours") {
            data = await service.recommendations(req.params.id, req.query.from, req.query.to);
        } else {
            data = await service.history(req.params.id, req.query.from, req.query.to);
        }
        res.json({ data });
    } catch (error) {
        res.status(error.publicHistoryError ? error.status : 503).json({
            code: error.publicHistoryError ? error.code : "SERVICE_UNAVAILABLE",
            message: error.publicHistoryError ? error.message : "No se pudo consultar el historial. Inténtalo de nuevo."
        });
    }
};
router.get("/:id/history", handle("history"));
router.get("/:id/comparison", handle("comparison"));
router.get("/:id/quiet-hours", handle("quiet-hours"));
export default router;
