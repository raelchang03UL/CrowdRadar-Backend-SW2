import PlaceService from "../services/PlaceService.js";

export default {
    async list(req, res) {
        try {
            return res.status(200).json({ data: await PlaceService.listActive() });
        } catch {
            return res.status(503).json({ message: "No se pudieron cargar los lugares. Inténtalo de nuevo." });
        }
    }
};
