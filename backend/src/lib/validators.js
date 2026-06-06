import mongoose from "mongoose";

export const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

export const normalizeEmail = (email) => email?.trim().toLowerCase();

export const isValidEmail = (email) => /^\S+@\S+\.\S+$/.test(email);

export const hasMessageContent = ({ text, image }) => Boolean(text?.trim() || image);
