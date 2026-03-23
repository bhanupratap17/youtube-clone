import mongoose, { isValidObjectId } from "mongoose";
import { User } from "../models/user.model.js";
import { Subscription } from "../models/subcription.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandlers } from "../utils/asyncHandlers.js";

const toggleSubscription = asyncHandlers(async (req, res) => {
  const { channelId } = req.params;

  if (!isValidObjectId(channelId)) {
    throw new ApiError(400, "Invalid channel ID");
  }

  const isSubscribed = await Subscription.findOne({
    channel: channelId,
    subscriber: req.user._id,
  });

  if (channelId == req.user._id) {
    throw new ApiError(400, "you can't subscribe your own channel");
  }

  if (!isSubscribed) {
    const subscribeChannel = await Subscription.create({
      subscriber: req.user._id,
      channel: channelId,
    });

    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          subscribeChannel,
          "subscribed channel successfully."
        )
      );
  } else {
    const unsubscribe = await isSubscribed.deleteOne();

    return res
      .status(200)
      .json(
        new ApiResponse(200, unsubscribe, "channel unsubscribed successfully.")
      );
  }
});

export { toggleSubscription };
