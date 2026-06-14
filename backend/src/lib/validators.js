import mongoose from "mongoose";

export const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

export const normalizeEmail = (email) => email?.trim().toLowerCase();

export const isValidEmail = (email) => /^\S+@\S+\.\S+$/.test(email);

export const normalizeUsername = (username) => username?.trim().toLowerCase();

export const isValidUsername = (username) => /^[a-z0-9_]{3,20}$/.test(username);

export const hasMessageContent = ({ text, image }) => Boolean(text?.trim() || image);
