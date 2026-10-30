import { timingSafeEqual } from "node:crypto";
import { PushNotificationError } from "../services/PushNotificationService.js";
import { saturationErrorResponse } from "./NotificationController.js";

export function matchesSaturationSecret(supplied, expected) {
    if (typeof supplied !== "string" || typeof expected !== "string" ||
        !expected || supplied.length !== expected.length) return false;
    const suppliedBytes = Buffer.from(supplied);
    const expectedBytes = Buffer.from(expected);
    return suppliedBytes.length === expectedBytes.length &&
        timingSafeEqual(suppliedBytes, expectedBytes);
}

export function createSaturationEventController(service, { secret = process.env.SATURATION_EVENT_SECRET } = {}) {
    return async (req, res) => {
        if (!secret) {
            return res.status(503).json({
                code: "SATURATION_SOURCE_UNAVAILABLE",
                message: "La fuente de saturación no está configurada."
            });
        }
        if (!matchesSaturationSecret(req.get("x-saturation-event-secret"), secret)) {
            return res.status(401).json({
                code: "SATURATION_SOURCE_UNAUTHORIZED",
                message: "La fuente de saturación no está autorizada."
            });
        }
        if (req.body && (typeof req.body !== "object" || Array.isArray(req.body) || Object.keys(req.body).length)) {
            return res.status(400).json({ code: "SATURATION_BODY_INVALID", message: "La saturación se calcula desde los reportes; no admite niveles del cliente." });
        }
        const placeId = Number(req.params.id);
        try {
            const result = await service.reconcilePlace({ placeId });
            return res.status(200).json({ data: result });
        } catch (error) {
            if (error instanceof PushNotificationError) {
                return res.status(error.status).json({ code: error.code, message: error.message });
            }
            return saturationErrorResponse(error, res);
        }
    };
}

export function createPushProcessController(service, { secret = process.env.SATURATION_EVENT_SECRET } = {}) {
    return async (req, res) => {
        res.set("Cache-Control", "no-store");
        if (!secret) return res.status(503).json({ code: "SATURATION_SOURCE_UNAVAILABLE", message: "El reconciliador no está configurado." });
        if (!matchesSaturationSecret(req.get("x-saturation-event-secret"), secret)) return res.status(401).json({ code: "SATURATION_SOURCE_UNAUTHORIZED", message: "La fuente no está autorizada." });
        if (req.body && (typeof req.body !== "object" || Array.isArray(req.body) || Object.keys(req.body).length)) return res.status(400).json({ code: "SATURATION_BODY_INVALID", message: "El reconciliador no admite parámetros." });
        try {
            const reconciliation = await service.reconcileAll();
            const delivery = await service.dispatchPending();
            return res.status(200).json({ data: { ...reconciliation, ...delivery } });
        } catch (error) { return saturationErrorResponse(error, res); }
    };
}
