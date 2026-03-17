import mongoose from "mongoose";
import { ApiError } from "../utils/ApiError.js";

const checkValidObjectId = (fields) => (req, _, next) => {
    const invalidField =fields.find( (field) => !req.params[field] || !mongoose.isValidObjectId(req.params[field]) );
    if(invalidField){
         return next(new ApiError(400, `Invalid ${invalidField}`));
    }
    next();
};

export { checkValidObjectId};