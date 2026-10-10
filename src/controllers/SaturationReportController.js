import SaturationReportService from "../services/SaturationReportService.js";

export default {
    async create(req, res) {
        try {
            const report = await SaturationReportService.create({
                userId: req.user.id,
                placeId: Number(req.params.placeId),
                level: req.body.level
            });
            return res.status(201).json({
                message: "Reporte enviado correctamente.",
                data: {
                    id: report.id,
                    placeId: report.place_id,
                    level: report.level,
                    createdAt: report.created_at
                }
            });
        } catch (error) {
            if (error.status) {
                return res.status(error.status).json({ message: error.message, code: error.code });
            }
            return res.status(503).json({
                message: "No se pudo registrar el reporte. Inténtalo de nuevo.",
                code: "SERVICE_UNAVAILABLE"
            });
        }
    }
};
