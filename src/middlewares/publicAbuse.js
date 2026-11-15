import { createHash } from "node:crypto";
import { isIP } from "node:net";

const policies = new Map([["/register", 5], ["/login", 20]]);
const hash = value => createHash("sha256").update(value).digest("hex");

export function vercelClientAddress(req) {
    // Vercel sobrescribe este header. Solo se instala en el runtime Vercel,
    // nunca en el servidor local, que conserva la dirección del socket.
    const value = req.get("x-vercel-forwarded-for");
    return typeof value === "string" && isIP(value) ? value : undefined;
}

export function createPublicAbuseMiddleware({ repository, clientAddress = vercelClientAddress }) {
    return async (req, res, next) => {
        if (req.method !== "POST") return next();
        const maximum = policies.get(req.path.replace(/\/$/, "").toLowerCase());
        if (maximum === undefined && !req.path.toLowerCase().startsWith("/password/")) return next();
        res.set("Cache-Control", "no-store");
        try {
            const address = clientAddress(req);
            if (!address) throw new Error("Dirección de cliente no disponible.");
            req.clientAddress = address;
            if (maximum !== undefined && !await repository.consumeLimits([
                { keyHash: hash(`public-auth:${req.path.replace(/\/$/, "").toLowerCase()}:${address}`), maximum }
            ])) {
                res.set("Retry-After", "900");
                return res.status(429).json({ code: "RATE_LIMITED", message: "Demasiados intentos. Espera unos minutos e inténtalo nuevamente." });
            }
            return next();
        } catch {
            return res.status(503).json({ code: "SERVICE_UNAVAILABLE", message: "No se pudo completar la solicitud. Inténtalo de nuevo." });
        }
    };
}
