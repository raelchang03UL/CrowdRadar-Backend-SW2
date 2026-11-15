import jwt from "../utils/jwt.js";
import UserRepository from "../repositories/UserRepository.js";
import { invalidSession } from "../utils/passwordPolicy.js";

const authMiddleware = async (req, res, next) => {
    let payload;
    try {
        const header = req.headers.authorization;
        if (typeof header !== "string" || !/^Bearer [^\s]+$/i.test(header)) throw invalidSession();
        payload = jwt.verifyToken(header.slice(7));
        if (!Number.isSafeInteger(payload.id) || payload.id < 1 ||
            !Number.isSafeInteger(payload.sessionVersion) || payload.sessionVersion < 0) throw invalidSession();
    } catch {
        const error = invalidSession();
        return res.status(error.status).json({ message: error.message, code: error.code });
    }
    try {
        const user = await UserRepository.findSessionById(payload.id);
        if (!user || user.status !== "ACTIVO" || user.sessionVersion !== payload.sessionVersion) {
            const error = invalidSession();
            return res.status(error.status).json({ message: error.message, code: error.code });
        }
        req.user = { ...payload, rol: user.rol };
        return next();
    } catch {
        return res.status(503).json({ message: "No se pudo verificar la sesión. Inténtalo de nuevo.", code: "SERVICE_UNAVAILABLE" });
    }
};

export default authMiddleware;
