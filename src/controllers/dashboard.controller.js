import mongoose, { get } from "mongoose";
import { Video } from "../models/video.model.js";
import { Subscription } from "../models/subcription.model.js";
import { Like } from "../models/like.model.js";
import { asyncHandlers } from "../utils/asyncHandlers.js";
import { ApiResponse } from "../utils/ApiResponse.js";

const getChannelStats = asyncHandlers(async (req, res) => {
  const channelId = req.user?._id;

  const getTotalViews = await Video.aggregate([
    {
      $match: { owner: new mongoose.Types.ObjectId(channelId) },
    },
    {
      $group: {
        _id: null,
        totalViews: { $sum: "$views" },
      },
    },
  ]);

  const totalViews = getTotalViews.length > 0 ? getTotalViews[0].totalViews : 0;

  const totalSubscribers = await Subscription.countDocuments({
    channel: channelId,
  });

  const totalVideos = await Video.countDocuments({ owner: channelId });

  const getAllLikes = await Like.aggregate([
    {
      $lookup: {
        from: "videos",
        localField: "video",
        foreignField: "_id",
        as: "videoInfo",
      },
    },
    {
      $unwind: "$videoInfo",
    },
    {
      $match: {
        "videoInfo.owner": new mongoose.Types.ObjectId(channelId),
      },
    },
    {
      $count: "totalLikes",
    },
  ]);

  const totalLikes = getAllLikes.length > 0 ? getAllLikes[0].totalLikes : 0;

  const stats = {
    totalViews,
    totalSubscribers,
    totalVideos,
    totalLikes,
  };

  return res
    .status(200)
    .json(new ApiResponse(200, stats, "Channel stats fetched succesfully"));
});

const getChannelVideos = asyncHandlers(async (req, res) => {
  const channelId = req.user?._id;
  const { page = 1, limit = 10 } = req.query;

  const getAllVideos = Video.aggregate([
    {
      $match: {
        owner: new mongoose.Types.ObjectId(channelId),
      },
    },

    {
      $lookup: {
        from: "users",
        localField: "owner",
        foreignField: "_id",
        as: "ownerInfo",
      },
    },

    {
      $unwind: "$ownerInfo",
    },

    {
      $sort: { createdAt: -1 },
    },

  ]);

  const options = {
    page: parseInt(page),
    limit: parseInt(limit),
  };

  const result = await Video.aggregatePaginate(getAllVideos, options);

  return res
    .status(200)
    .json(new ApiResponse(200, result, "Channel videos fetched successfully"));
});

export { getChannelStats, getChannelVideos };
