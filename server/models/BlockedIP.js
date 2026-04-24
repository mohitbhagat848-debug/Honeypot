const mongoose = require("mongoose");

const blockedIPSchema = new mongoose.Schema(
  {
    ip: { type: String, required: true, unique: true, index: true },
    reason: String,
    createdBy: String,
  },
  { timestamps: true }
);

module.exports = mongoose.model("BlockedIP", blockedIPSchema);
