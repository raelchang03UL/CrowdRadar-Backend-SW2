import { Router } from "express";
import authMiddleware from "../middlewares/authMiddleware.js";
import PlaceController from "../controllers/PlaceController.js";

const router = Router();
router.get("/", authMiddleware, PlaceController.list);
export default router;
