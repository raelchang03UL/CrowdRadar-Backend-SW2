import PlaceService from "../services/PlaceService.js";

export default {
    async list(req, res) {
        try {
            return res.status(200).json({ data: await PlaceService.listActive() });
        } catch {
            return res.status(503).json({ message: "No se pudieron cargar los lugares. Inténtalo de nuevo." });
        }
    },

    async detail(req, res) {
        const id = Number(req.params.id);
        if (!Number.isSafeInteger(id)) {
            return res.status(400).json({
                code: "PLACE_INVALID",
                message: "El lugar indicado no es válido."
            });
        }
        try {
            const place = await PlaceService.findActiveById(id);
            return place
                ? res.status(200).json({ data: place })
                : res.status(404).json({ code: "PLACE_NOT_FOUND", message: "No encontramos ese lugar." });
        } catch (error) {
            const code = typeof error?.code === "string" ? error.code : "PLACE_LOOKUP_FAILED";
            console.error("No se pudo consultar el detalle del lugar.", { code });
            return res.status(503).json({ message: "No pudimos cargar la información del lugar." });
        }
    }
};
