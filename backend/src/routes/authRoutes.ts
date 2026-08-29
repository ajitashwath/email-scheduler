import { Router } from "express";
import { googleLoginRedirect, googleLoginCallback, getCurrentUser, logout } from "../controllers/authController";
import { requireAuth } from "../middleware/auth";

const router = Router();

router.get("/google", googleLoginRedirect);
router.get("/google/callback", googleLoginCallback);
router.get("/me", requireAuth, getCurrentUser);
router.post("/logout", logout);

export default router;
