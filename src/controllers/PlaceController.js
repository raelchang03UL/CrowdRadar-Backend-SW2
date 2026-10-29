import PlaceService from "../services/PlaceService.js";

export default {
    async list(req, res) {
        try {
            return res.status(200).json({ data: await PlaceService.listActive() });
        } catch {
            return res.status(503).json({ message: "No se pudieron cargar los lugares. Inténtalo de nuevo." });
        }
    },

    async removeFavorite(req, res) {
        const placeId = Number(req.params.id);
        if (!Number.isSafeInteger(placeId) || placeId === 0) {
            return res.status(400).json({ message: "El identificador del lugar no es válido.", code: "INVALID_PLACE_ID" });
        }
        try {
            await PlaceService.removeFavorite(req.user.id, placeId);
            return res.status(204).end();
        } catch {
            return res.status(503).json({ message: "No se pudo eliminar el favorito. Inténtalo de nuevo." });
        }
    }
};
