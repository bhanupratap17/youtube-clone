import mongoose, { isValidObjectId } from "mongoose";
import { Video } from "../models/video.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandlers } from "../utils/asyncHandlers.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { deleteFromCloudinary } from "../utils/deleteFromCloudinary.js";

const getAllVideos = asyncHandlers(async (req, res) => {
  //example req /api/videos?page=1&limit=10&query=coding&sortBy=views&sortType=desc
  const { page = 1, limit = 10, query, sortBy, sortType, userId } = req.query;

  const pipeline = [];

  const defaultCriteria = {
    isPublished: true,
  };

  //dynamic query building
  if (query) {
    defaultCriteria.$or = [
      { title: { $regex: query, $options: "i" } },
      { description: { $regex: query, $options: "i" } },
    ];
  }

  if (userId) {
    if (!mongoose.isValidObjectId(userId)) {
      throw new ApiError(400, "Invalid User");
    }
    defaultCriteria.owner = new mongoose.Types.ObjectId(userId);
    defaultCriteria.isPublished = false;
  }

  pipeline.push({ $match: defaultCriteria });

  //if user sorts by some type of filter:(most expensive,least expensive,most liked...)
  const sortField = {};

  if (sortBy) {
    sortField[sortBy] = sortType === "asc" ? 1 : -1;
  } else {
    sortField["createdAt"] = sortType === "asc" ? 1 : -1;
  }

  pipeline.push({ $sort: sortField });

  pipeline.push(
    {
      $lookup: {
        from: "users",
        localField: "owner",
        foreignField: "_id",
        as: "owner",
        pipeline: [
          {
            $project: {
              avatar: 1,
              username: 1,
            },
          },
        ],
      },
    },
    {
      $addFields: {
        owner: { $first: "$owner" },
      },
    }
  );

  const options = {
    page: parseInt(page),
    limit: parseInt(limit),
  };

  const paginatedVideos = await Video.aggregatePaginate(
    Video.aggregate(pipeline),
    options
  );

  if (!paginatedVideos) {
    throw new ApiResponse(500, "Couldn't fetch videos, Please try again.");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, paginatedVideos, "Successfully fetched videos"));
});

const publishVideo = asyncHandlers(async (req, res) => {
  const { title, description } = req.body;

  if (!req.user?._id) {
    throw new ApiResponse(400, "Please login and try again");
  }

  if (!title?.trim() || !description?.trim()) {
    throw new ApiError(400, "All fields are required.");
  }

  const videoFileLocalPath = req.files?.videoFile?.[0]?.path;
  const thumbnailFileLocalPath = req.files?.thumbnail?.[0]?.path;

  if (!videoFileLocalPath) {
    throw new ApiError(400, "Video File is required.");
  }

  if (!thumbnailFileLocalPath) {
    throw new ApiError(400, "Thumbnail is required.");
  }

  const videoFile = await uploadOnCloudinary(videoFileLocalPath);
  const thumbnailFile = await uploadOnCloudinary(thumbnailFileLocalPath);

  if (!videoFile?.url || !thumbnailFile?.url) {
    throw new ApiError(500, "Upload to cloudinary failed. Please try again");
  }

  try {
    const uploadVideo = await Video.create({
      videoFile: {
        url: videoFile.url,
        public_id: videoFile.public_id,
      },
      thumbnail: {
        url: thumbnailFile.url,
        public_id: thumbnailFile.public_id,
      },
      owner: req.user?._id,
      title: title.trim(),
      description: description.trim(),
      duration: videoFile.duration,
      views: 0,
      isPublished: true,
    });

    return res
      .status(201)
      .json(new ApiResponse(201, uploadVideo, "Successfully uploaded video"));
  } catch (error) {
    if (videoFile?.public_id) {
      await deleteFromCloudinary(videoFile.public_id, "video");
    }
    if (thumbnailFile?.public_id) {
      await deleteFromCloudinary(thumbnailFile.public_id, "image");
    }
    throw error;
  }
});

const getVideoById = asyncHandlers(async (req, res) => {
  const { videoId } = req.params;

  // 1 Get video id
  // 2 Increase views
  // 3 Fetch video
  // 4 Fetch comments
  // 5 Fetch comment owners
  // 6 Fetch likes
  // 7 Fetch channel owner
  // 8 Count subscribers
  // 9 Check if user liked
  // 10 Check if user subscribed
  // 11 Return everything in one response

  if (req.user?._id) {
    await Video.findOneAndUpdate({ _id: videoId }, { $inc: { views: 1 } });
  }

  const getVideoWithDetails = await Video.aggregate([
    {
      $match: {
        _id: new mongoose.Types.ObjectId(videoId),
      },
    },
    {
      $lookup: {
        from: "comments",
        localField: "_id",
        foreignField: "video",
        as: "comments",
        pipeline: [
          {
            $sort: { createdAt: -1 },
          },
          {
            $limit: 10,
          },
          {
            $lookup: {
              from: "users",
              localField: "owner",
              foreignField: "_id",
              as: "CommentOwnerDetails",
              pipeline: [
                {
                  $project: {
                    username: 1,
                    avatar: 1,
                  },
                },
              ],
            },
          },
          {
            $addFields: {
              CommentOwnerDetails: { $first: "$CommentOwnerDetails" },
            },
          },
        ],
      },
    },
    {
      $lookup: {
        from: "likes",
        localField: "_id",
        foreignField: "video",
        as: "likes",
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "owner",
        foreignField: "_id",
        as: "owner",
        pipeline: [
          {
            $project: {
              avatar: 1,
              username: 1,
            },
          },
          {
            $lookup: {
              from: "subscriptions",
              localField: "_id",
              foreignField: "channel",
              as: "subscribers",
            },
          },
          {
            $addFields: {
              subscriberCount: { $size: "$subscribers" },
              isSubscribed: {
                $cond: {
                  if: {
                    $in: [
                      new mongoose.Types.ObjectId(req.user._id),
                      "$subscribers.subscriber",
                    ],
                  },
                  then: true,
                  else: false,
                },
              },
            },
          },
          {
            $project: {
              username: 1,
              avatar: 1,
              subscriberCount: 1,
              isSubscribed: 1,
            },
          },
        ],
      },
    },
    {
      $addFields: {
        totalLikes: { $size: "$likes" },
        isLiked: {
          $cond: {
            if: {
              $in: [
                new mongoose.Types.ObjectId(req.user?._id),
                "$likes.likedBy",
              ],
            },
            then: true,
            else: false,
          },
        },
        owner: { $first: "$owner" },
      },
    },
  ]);

  if (getVideoWithDetails.length === 0) {
    throw new ApiError(404, "Video doesn't exists");
  }

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        getVideoWithDetails[0],
        "successfully fetched video details"
      )
    );
});

const updateVideo = asyncHandlers(async (req, res) => {
  const { videoId } = req.params;
  const { title, description, thumbnail } = req.body;

  const userId = req.user?._id;

  const isTitleValid = title && title.trim() !== "";
  const isDescriptionValid = description && description.trim() !== "";
  const isThumbnailValid = thumbnail && thumbnail.trim() !== "";

  if (!isTitleValid && !isDescriptionValid && !isThumbnailValid) {
    throw new ApiError(400, "At least one field is required to update");
  }

  const updateData = {};

  if (title) {
    updateData.title = title.trim();
  }

  if (description) {
    updateData.description = description.trim();
  }

  if (thumbnail) {
    updateData.thumbnail = thumbnail.trim();
  }

  const updateVideo = await Video.findOneAndUpdate(
    {
      _id: videoId,
      owner: userId,
    },
    {
      $set: updateData,
    },
    {
      new: true,
    }
  );

  if (!updateVideo) {
    throw new ApiError(
      404,
      "Video not found or you are not authorized to update this video"
    );
  }

  return res
    .status(200)
    .json(
      new ApiResponse(200, updateVideo, "Successfully updated video details")
    );
});

const deleteVideo = asyncHandlers(async (req, res) => {
  const { videoId } = req.params;
  const userId = req.user?._id;

  const video = await Video.findOneAndDelete({
    _id: videoId,
    owner: userId,
  });

  if (!video) {
    throw new ApiError(
      404,
      "Video not found or you are not authorized to delete this video"
    );
  }

  return res
    .status(200)
    .json(new ApiResponse(200, null, "Successfully deleted video"));
});

const togglePublishStatus = asyncHandlers(async (req, res) => {
  const { videoId } = req.params;
  const userId = req.user?._id;

  const toggleStatus = await Video.findOneAndUpdate(
    {
      _id: videoId,
      owner: userId,
    },
    [
      {
        $set: {
          isPublished: { $not: "$isPublished" },
        },
      },
    ],
    {
      new: true,
      updatePipeline: true,
    }
  );

  if (!toggleStatus) {
    throw new ApiError(
      404,
      "Video not found or you are not authorized to update this video"
    );
  }

  return res
    .status(200)
    .json(
      new ApiResponse(200, toggleStatus, "Successfully toggled publish status")
    );
});

export {
  getAllVideos,
  publishVideo,
  getVideoById,
  updateVideo,
  deleteVideo,
  togglePublishStatus,
};
