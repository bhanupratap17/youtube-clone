import { Router } from "express";
import {
  getAllVideos,
  publishVideo,
  getVideoById,
  getVideoById,
  deleteVideo,
  updateVideo,
  togglePublishStatus
} from "../controllers/video.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { upload } from "../middlewares/multer.middleware.js";

const router = Router();
router.use(verifyJWT);

router
  .route("/")
  .get(getAllVideos)
  .post(
    upload.fields([
      {
        name: "videoFile",
        maxCount: 1,
      },
      {
        name: "thumbnail",
        maxCount: 1,
      },
    ]),
    publishVideo
  );

router
  .route("/:videoId")
  .get(getVideoById)
  .delete(deleteVideo)
  .patch(upload.single("thumbnail"), updateVideo)
  .get(checkValidObjectId(["videoId"]), getVideoById)
  .delete(checkValidObjectId(["videoId"]), deleteVideo)
  .patch(
    checkValidObjectId(["videoId"]),
    upload.single("thumbnail"),
    updateVideo
  );

router.route("/toggle/publish/:videoId").patch(togglePublishStatus);
router
  .route("/toggle/publish/:videoId")
  .patch(checkValidObjectId(["videoId"]), togglePublishStatus);

export default router;
