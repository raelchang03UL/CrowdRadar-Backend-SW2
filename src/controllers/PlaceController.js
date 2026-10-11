import PlaceService, { parseSaturationFilter } from "../services/PlaceService.js";

export default {
    async list(req, res) {
        let nivel;
        try {
            nivel = parseSaturationFilter(req.query);
        } catch {
            return res.status(400).json({ code: "SATURATION_FILTER_INVALID", message: "El filtro de saturación no es válido." });
        }
        try {
            return res.status(200).json({ data: await PlaceService.listActive(nivel) });
        } catch {
            return res.status(503).json({ message: "No se pudieron cargar los lugares. Inténtalo de nuevo." });
        }
    }
};
