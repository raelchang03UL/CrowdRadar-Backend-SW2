import { Router } from "express";
import authMiddleware from "../middlewares/authMiddleware.js";
import PlaceController from "../controllers/PlaceController.js";
import SaturationQueryController from "../controllers/SaturationQueryController.js";

const router = Router();
router.delete("/:id/favorite", authMiddleware, PlaceController.removeFavorite);
router.get("/categories", authMiddleware, PlaceController.categories);
router.get("/:id", authMiddleware, PlaceController.detail);


router.get("/", (req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
}, authMiddleware, PlaceController.list);
router.get("/:id/saturation", (req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
}, authMiddleware, SaturationQueryController.get);
export default router;
