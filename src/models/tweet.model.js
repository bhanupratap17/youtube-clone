import mongoose, { Schema } from "mongoose";
import mongodbAggregatePaginate from "mongoose-aggregate-paginate-v2";

const tweetSchema = new Schema({
content:{
    type:String,
    required:true
},
owner:{
    type:Schema.Types.ObjectId,
    ref:'User'
},

}, { timestamps: true });

tweetSchema.plugin(mongodbAggregatePaginate);

export const Tweet = new mongoose("Tweet", tweetSchema);
