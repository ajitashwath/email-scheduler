import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { slackAuthorizeRedirect, slackCallback, slackStatus, slackDisconnect } from "../controllers/slackController";

const router = Router();

router.get("/authorize", requireAuth, slackAuthorizeRedirect);
router.get("/callback", slackCallback); // Slack redirects here without our cookies guaranteed to be "current session" context beyond the state param
router.get("/status", requireAuth, slackStatus);
router.post("/disconnect", requireAuth, slackDisconnect);

export default router;
