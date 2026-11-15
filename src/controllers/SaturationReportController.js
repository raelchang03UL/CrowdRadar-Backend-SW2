import SaturationReportService, { SaturationReportError } from "../services/SaturationReportService.js";

export default {
    async create(req, res) {
        try {
            if (!/^-?[1-9]\d*$/.test(req.params.placeId)) throw new SaturationReportError(400, "INVALID_PLACE", "El lugar indicado no es válido.");
            const report = await SaturationReportService.create({
                userId: req.user.id,
                sessionVersion: req.user.sessionVersion,
                expiresAt: req.user.exp,
                placeId: Number(req.params.placeId),
                level: req.body.level
            });
            return res.status(201).json({
                message: "Reporte enviado correctamente.",
                data: {
                    id: report.id,
                    placeId: report.place_id,
                    level: report.level,
                    createdAt: report.created_at,
                    pointsAwarded: report.pointsAwarded,
                    karmaPoints: report.karmaPoints
                }
            });
        } catch (error) {
            if (error instanceof SaturationReportError || error.code === "SESSION_INVALID") {
                return res.status(error.status).json({ message: error.message, code: error.code });
            }
            return res.status(503).json({
                message: "No se pudo registrar el reporte. Inténtalo de nuevo.",
                code: "SERVICE_UNAVAILABLE"
            });
        }
    }
};
