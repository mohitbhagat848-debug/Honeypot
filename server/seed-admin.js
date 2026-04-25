const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const mongoose = require("mongoose");
const User = require("./models/User");

async function seed() {
  try {
    const mongoUri = process.env.MONGO_URI;
    const email = (process.env.ADMIN_EMAIL || "developer201004@gmail.com").toLowerCase();
    const password = process.env.ADMIN_PASSWORD || "Radhikarani@2010";

    if (!mongoUri) {
      console.error("Error: MONGO_URI not found in .env");
      process.exit(1);
    }

    console.log("Connecting to MongoDB...");
    await mongoose.connect(mongoUri);
    console.log("Connected.");

    // Check if user already exists
    const existing = await User.findOne({ email });
    if (existing) {
      console.log(`User ${email} already exists. Updating password...`);
      existing.passwordHash = await User.hashPassword(password);
      await existing.save();
      console.log("Password updated successfully.");
    } else {
      console.log(`Creating admin user: ${email}...`);
      const passwordHash = await User.hashPassword(password);
      const newUser = new User({
        email,
        passwordHash,
        role: "admin"
      });
      await newUser.save();
      console.log("Admin user created successfully.");
    }

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error("Seed error:", err);
    process.exit(1);
  }
}

seed();
