import { Router } from "express";

import AuthController from "../controllers/AuthController.js";
import authMiddleware from "../middlewares/authMiddleware.js";

import validateSchema from "../middlewares/validateSchema.js";

import {
    registerSchema,
    loginSchema
} from "../validations/authSchemas.js";

const router = Router();

router.post("/password/change", authMiddleware, (req, res, next) => {
    const fields = ["currentPassword", "newPassword", "confirmPassword"];
    if (!req.body || typeof req.body !== "object" || Array.isArray(req.body) ||
        fields.some((field) => typeof req.body[field] !== "string") ||
        Object.keys(req.body).some((field) => !fields.includes(field))) {
        return res.status(400).json({ message: "Completa los tres campos de contraseña.", code: "PASSWORD_VALIDATION" });
    }
    return next();
}, AuthController.changePassword);

router.post(
    "/register",
    validateSchema(registerSchema),
    AuthController.register
);

router.post(
    "/login",
    validateSchema(loginSchema),
    AuthController.login
);

export default router;
