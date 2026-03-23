import { Router } from "express";
import {
  toggleSubscription,
  getUserChannelSubscriber,
} from "../controllers/subscription.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();
router.use(verifyJWT); 

router.route("/c/:channelId").post(toggleSubscription);

router.route("/u/:channelId").get(getUserChannelSubscriber);

export default router;
