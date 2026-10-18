import { Router } from "express";

import UserController from "../controllers/UserController.js";

import authMiddleware from "../middlewares/authMiddleware.js";
import validateSchema from "../middlewares/validateSchema.js";
import { updateUserSchema } from "../validations/userSchemas.js";

const router = Router();

router.get(
    "/karma",
    authMiddleware,
    UserController.getKarma
);

router.get(
    "/profile",
    authMiddleware,
    UserController.getProfile
);

router.put(
    "/profile",
    authMiddleware,
    validateSchema(updateUserSchema),
    UserController.updateProfile
);

router.get(
    "/reports",
    authMiddleware,
    UserController.getReports
);

export default router;