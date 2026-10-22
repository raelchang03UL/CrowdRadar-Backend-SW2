import SaturationQueryService from "../services/SaturationQueryService.js";

export default {
    async get(req, res) {
        try {
            return res.status(200).json({ data: await SaturationQueryService.getForPlace(req.params.id) });
        } catch (error) {
            if (["PLACE_ID_INVALID", "PLACE_NOT_FOUND"].includes(error.code)) {
                return res.status(error.status).json({ message: error.message, code: error.code });
            }
            return res.status(503).json({ message: "No se pudo consultar la saturación. Inténtalo de nuevo.", code: "SERVICE_UNAVAILABLE" });
        }
    }
};
