import { Router } from "express";
import multer from "multer";
import { requireAuth } from "../middleware/auth";
import { createCampaign, parseLeadsUpload, listSenders } from "../controllers/campaignController";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

const router = Router();

router.post("/leads/parse", requireAuth, upload.single("file"), parseLeadsUpload);
router.post("/campaigns", requireAuth, createCampaign);
router.get("/senders", requireAuth, listSenders);

export default router;
