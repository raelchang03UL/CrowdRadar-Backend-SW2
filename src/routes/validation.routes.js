import { Router } from "express";
import auth from "../middlewares/authMiddleware.js";
import service from "../services/ReportValidationService.js";

const router = Router();
router.use((req, res, next) => { res.set("Cache-Control", "no-store"); next(); });
router.use(auth);

const run = (action) => async (req, res) => {
    try {
        if (Object.keys(req.query).length) {
            return res.status(400).json({ code: "QUERY_INVALID", message: "Esta ruta no admite parámetros de consulta." });
        }
        await action(req, res);
    } catch (error) {
        const known = error.publicReportError || error.code === "SESSION_INVALID";
        res.status(known ? error.status : 503).json({
            code: known ? error.code : "SERVICE_UNAVAILABLE",
            message: known ? error.message : "No se pudo completar la operación. Inténtalo de nuevo."
        });
    }
};

router.get("/", run(async (req, res) => res.json({ data: await service.list(req.user.id) })));
router.get("/:id", run(async (req, res) => res.json({ data: await service.detail(req.user.id, req.params.id) })));
router.get("/:id/own-validation", run(async (req, res) =>
    res.json({ data: await service.detail(req.user.id, req.params.id, true) })));
router.post("/:id/validations", run(async (req, res) =>
    res.status(201).json({ message: "Validación registrada.", data: await service.participate(req.user, req.params.id, req.body, "vote") })));
router.post("/:id/denunciations", run(async (req, res) =>
    res.status(201).json({ message: "Denuncia enviada correctamente.", data: await service.participate(req.user, req.params.id, req.body, "denounce") })));
export default router;
