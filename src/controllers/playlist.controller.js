import mongoose, { isValidObjectId } from "mongoose";
import { Playlist } from "../models/playlist.model.js";
import { Video } from "../models/video.model.js"
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandlers } from "../utils/asyncHandlers.js";

const createPlaylist = asyncHandlers(async (req, res) => {
  const { name, description } = req.body;

  if (!name) {
    throw new ApiError(400, "Name is required");
  }

  const playlist = await Playlist.create({
    name,
    description: description || "",
    owner: req.user._id,
  });

  if (!playlist) {
    throw new ApiError(400, "Playlist Creation Failed");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, playlist, "Playlist Created Successfully"));
});

const getUserPlaylists = asyncHandlers(async (req, res) => {
  const { userId } = req.params;

  const playlists = await Playlist.aggregate([
    {
      $match: {
        owner: new mongoose.Types.ObjectId(userId),
      },
    },
    {
      $project: {
        name: 1,
        description: 1,
        createdAt: 1,
        totalVideos: {
          $size: {
            $ifNull: ["$videos", []],
          },
        },
      },
    },
    {
      $sort: {
        createdAt: -1,
      },
    },
  ]);
  return res
    .status(200)
    .json(new ApiResponse(200, playlists, "Playlist fetch successfully."));
});

const getPlaylistById = asyncHandlers(async (req, res) => {
  const { playlistId } = req.params;

  const playlist = await Playlist.aggregate([
    {
      $match: {
        _id: new mongoose.Types.ObjectId(playlistId),
      },
    },

    {
      $lookup: {
        from: "videos",
        localField: "videos",
        foreignField: "_id",
        as: "videos",
        pipeline: [
          {
            $lookup: {
              from: "users",
              localField: "owner",
              foreignField: "_id",
              as: "ownerDetails",
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
              ownerDetails: { $first: "$ownerDetails" },
            },
          },
        ],
      },
    },
  ]);

  if (playlist.length === 0) {
    throw new ApiError(404, "Playlist doesn't exist.");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, playlist[0], "Fetched Playslist Succesfully."));
});

const addVideoToPlaylist = asyncHandlers(async (req, res) => {
  const { playlistId, videoId } = req.params;

  if (!(await Video.exists({ _id: videoId }))) {
    throw new ApiError(400, "Video doesn't Exists, Sorry.");
  }

  const updatedPlaylist = await Playlist.findOneAndUpdate(
    {
      _id: playlistId,
      owner: req.user?._id,
    },
    {
      $addToSet: {
        videos: videoId,
      },
    },
    {
      new: true,
    }
  );

  if (!updatedPlaylist) {
    throw new ApiError(404, "Playlist not found or unauthorized");
  }

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        updatedPlaylist,
        "Successfully Added video to the playlist"
      )
    );
});

export {
  createPlaylist,
  getUserPlaylists,
  getPlaylistById,
  addVideoToPlaylist,
};
