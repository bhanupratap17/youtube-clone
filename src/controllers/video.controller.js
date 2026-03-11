import mongoose, { isValidObjectId } from "mongoose";
import { Video } from "../models/video.model.js";
import { User } from "../models/user.model.js";
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

  if (
    [title, description].some((field) => {
      field.trim() === "";
    })
  ) {
    throw new ApiResponse(400, "video file is required.");
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
      //checks if the url is in the cloudinary in the first place,
      await deleteFromCloudinary(videoFile.public_id, "video");
    }
    if (thumbnailFile?.public_id) {
      await deleteFromCloudinary(thumbnailFile.public_id, "image");
    }
    throw error;
  }
});

export { getAllVideos, publishVideo };
