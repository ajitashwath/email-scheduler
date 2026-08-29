import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { listScheduledEmails, listSentEmails, searchEmails } from "../controllers/emailController";

const router = Router();

router.get("/scheduled", requireAuth, listScheduledEmails);
router.get("/sent", requireAuth, listSentEmails);
router.get("/search", requireAuth, searchEmails);

export default router;
