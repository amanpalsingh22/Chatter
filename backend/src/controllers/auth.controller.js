import { generateToken } from "../lib/utils.js";
import User from "../models/user.model.js";
import bcrypt from "bcryptjs";
import cloudinary from "../lib/cloudinary.js";
import {
  isValidEmail,
  isValidUsername,
  normalizeEmail,
  normalizeUsername,
} from "../lib/validators.js";

const serializeUser = (user) => ({
  _id: user._id,
  fullName: user.fullName,
  email: user.email,
  profilePic: user.profilePic,
  username: user.username || "",
  bio: user.bio || "",
  lastSeen: user.lastSeen,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

const getUsernameBase = ({ email, fullName }) => {
  const source = email?.split("@")[0] || fullName || "user";
  const cleaned = source.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 16);
  return cleaned.length >= 3 ? cleaned : `${cleaned}user`.slice(0, 16);
};

const getUniqueUsername = async ({ email, fullName }) => {
  const base = getUsernameBase({ email, fullName });
  let username = base;
  let suffix = 1;

  while (await User.exists({ username })) {
    const suffixText = String(suffix);
    username = `${base.slice(0, 20 - suffixText.length)}${suffixText}`;
    suffix += 1;
  }

  return username;
};

const ensureProfileDefaults = async (user) => {
  const updates = {};

  if (!user.username) {
    updates.username = await getUniqueUsername({ email: user.email, fullName: user.fullName });
  }

  if (!user.lastSeen) {
    updates.lastSeen = new Date();
  }

  if (Object.keys(updates).length === 0) return user;

  return User.findByIdAndUpdate(user._id, updates, { new: true }).select("-password");
};

export const signup = async (req, res) => {
  const { fullName, password } = req.body;
  const email = normalizeEmail(req.body.email);
  try {
    if (!fullName?.trim() || !email || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({ message: "Invalid email format" });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    const user = await User.findOne({ email });

    if (user) return res.status(400).json({ message: "Email already exists" });

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = new User({
      fullName: fullName.trim(),
      email,
      password: hashedPassword,
      username: await getUniqueUsername({ email, fullName }),
      lastSeen: new Date(),
    });

    if (newUser) {
      // generate jwt token here
      generateToken(newUser._id, res);
      await newUser.save();

      res.status(201).json(serializeUser(newUser));
    } else {
      res.status(400).json({ message: "Invalid user data" });
    }
  } catch (error) {
    console.log("Error in signup controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const login = async (req, res) => {
  const { password } = req.body;
  const email = normalizeEmail(req.body.email);
  try {
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const isPasswordCorrect = await bcrypt.compare(password, user.password);
    if (!isPasswordCorrect) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    generateToken(user._id, res);
    const profileUser = await ensureProfileDefaults(user);

    res.status(200).json(serializeUser(profileUser));
  } catch (error) {
    console.log("Error in login controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const logout = (req, res) => {
  try {
    res.cookie("jwt", "", { maxAge: 0 });
    res.status(200).json({ message: "Logged out successfully" });
  } catch (error) {
    console.log("Error in logout controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const { profilePic, fullName, bio } = req.body;
    const username = normalizeUsername(req.body.username);
    const userId = req.user._id;

    const updates = {};

    if (fullName !== undefined) {
      if (!fullName?.trim()) {
        return res.status(400).json({ message: "Full name is required" });
      }
      updates.fullName = fullName.trim();
    }

    if (username !== undefined) {
      if (!isValidUsername(username)) {
        return res.status(400).json({
          message: "Username must be 3-20 characters and use only letters, numbers, or underscores",
        });
      }

      const existingUser = await User.findOne({ username, _id: { $ne: userId } });
      if (existingUser) {
        return res.status(400).json({ message: "Username already taken" });
      }

      updates.username = username;
    }

    if (bio !== undefined) {
      if (bio.length > 160) {
        return res.status(400).json({ message: "Bio must be 160 characters or less" });
      }
      updates.bio = bio.trim();
    }

    if (profilePic) {
      const uploadResponse = await cloudinary.uploader.upload(profilePic);
      updates.profilePic = uploadResponse.secure_url;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: "No profile changes provided" });
    }

    const updatedUser = await User.findByIdAndUpdate(userId, updates, { new: true }).select(
      "-password"
    );

    res.status(200).json(serializeUser(updatedUser));
  } catch (error) {
    console.log("error in update profile:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const checkAuth = async (req, res) => {
  try {
    const profileUser = await ensureProfileDefaults(req.user);
    res.status(200).json(serializeUser(profileUser));
  } catch (error) {
    console.log("Error in checkAuth controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};
