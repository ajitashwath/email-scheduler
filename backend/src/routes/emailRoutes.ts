import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { listScheduledEmails, listSentEmails, searchEmails, getEmailById } from "../controllers/emailController";

const router = Router();

router.get("/scheduled", requireAuth, listScheduledEmails);
router.get("/sent", requireAuth, listSentEmails);
router.get("/search", requireAuth, searchEmails);
router.get("/:id", requireAuth, getEmailById);

export default router;
