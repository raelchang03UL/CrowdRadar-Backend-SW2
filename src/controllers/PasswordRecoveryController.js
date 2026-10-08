import { AuthError } from "../utils/passwordPolicy.js";

export default function passwordRecoveryController(service, action, status) {
    return async (req, res) => {
        res.set("Cache-Control", "no-store");
        res.set("Referrer-Policy", "no-referrer");
        try {
            // Express no confía X-Forwarded-For: solo socket IP, salvo futuro proxy aprobado/configurado.
            return res.status(status).json(await service[action](req.body, req.ip));
        } catch (error) {
            if (error instanceof AuthError) {
                if (error.status === 429) res.set("Retry-After", "900");
                return res.status(error.status).json({ message: error.message, code: error.code });
            }
            return res.status(503).json({ message: "No se pudo completar la solicitud. Inténtalo de nuevo.", code: "SERVICE_UNAVAILABLE" });
        }
    };
}
