import mongoose from "mongoose";

export const connectDB = async () => {
  const mongoUri = process.env.MONGODB_URI;

  if (!mongoUri) {
    console.error(
      "MongoDB connection error: MONGODB_URI is missing. Add it to backend/.env before starting the backend."
    );
    process.exit(1);
  }

  try {
    const conn = await mongoose.connect(mongoUri);
    console.log(`MongoDB connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.log("MongoDB connection error:", error);
    process.exit(1);
  }
};
