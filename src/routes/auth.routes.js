import { Router } from "express";

import AuthController from "../controllers/AuthController.js";
import PasswordRecoveryService from "../services/PasswordRecoveryService.js";
import passwordRecoveryController from "../controllers/PasswordRecoveryController.js";
import authMiddleware from "../middlewares/authMiddleware.js";

import validateSchema from "../middlewares/validateSchema.js";
import { normalizeEmail } from "../utils/normalization.js";

import {
    registerSchema,
    loginSchema
} from "../validations/authSchemas.js";

// Normaliza el correo antes de validar: " Ana@Mail.com " y "ana@mail.com" son la misma cuenta.
export function normalizeEmailField(req, res, next) {
    if (req.body && typeof req.body === "object" && !Array.isArray(req.body) && typeof req.body.email === "string") {
        req.body.email = normalizeEmail(req.body.email);
    }
    next();
}

export function createAuthRoutes({ recoveryService = new PasswordRecoveryService() } = {}) {
    const router = Router();
    router.post("/password/forgot", passwordRecoveryController(recoveryService, "forgot", 202));
    router.post("/password/reset/validate", passwordRecoveryController(recoveryService, "validate", 200));
    router.post("/password/reset", passwordRecoveryController(recoveryService, "reset", 200));

    router.post("/password/change", authMiddleware, (req, res, next) => {
        const fields = ["currentPassword", "newPassword", "confirmPassword"];
        if (!req.body || typeof req.body !== "object" || Array.isArray(req.body) ||
            fields.some((field) => typeof req.body[field] !== "string") ||
            Object.keys(req.body).some((field) => !fields.includes(field))) {
            return res.status(400).json({ message: "Completa los tres campos de contraseña.", code: "PASSWORD_VALIDATION" });
        }
        return next();
    }, AuthController.changePassword);

    router.post("/register", normalizeEmailField, validateSchema(registerSchema), AuthController.register);
    router.post("/login", normalizeEmailField, validateSchema(loginSchema), AuthController.login);
    return router;
}

export default createAuthRoutes();
