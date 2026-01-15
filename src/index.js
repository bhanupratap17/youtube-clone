import dotenv from "dotenv";
import connectDB from "./db/index.js";
import express from "express";
const app = express();

dotenv.config({ path: "./env" });
const PORT = process.env.PORT || 8000;

connectDB()
  .then(() => {
    app.on("error", (error) => {
      console.error("Err", error);
      throw error;
    });

    app.listen(PORT, () => {
      console.log(`Server Is Running On Port ${PORT}`);
    });
  })
  .catch((error) => {
    console.log("MongoDB Connection Failed", error);
  });

/*
( async () => {
     try {
     await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`);
     app.on("error",(error)=>{
        console.error("Err",error);
        throw error;
     });
     app.listen(process.env.PORT,()=>{
        console.log(`App is listening on port ${process.env.PORT}`);
     })
     } catch (error) {
        console.error(error);
     }
} )()
*/
