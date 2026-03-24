import mongoose, { isValidObjectId } from "mongoose";
import { Tweet } from "../models/tweet.model.js";
import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandlers } from "../utils/asyncHandlers.js";

const createTweet = asyncHandlers(async (req, res) => {
  const userId = req.user._id;
  const { content } = req.body;

  if (!content || content.trim() == "") {
    throw new ApiError(400, "Content is required");
  }

  const newTweet = await Tweet.create({
    owner: userId,
    content: content.trim(),
  });

  if(!newTweet){
    throw new ApiError(500,"couldn't create tweet.")
  }

  const populatedDoc = await newTweet.populate("owner","avatar username fullName")

 return res
   .status(201)
   .json(new ApiResponse(201, populatedDoc, "Successfully created new tweet."));

});

export { createTweet };
