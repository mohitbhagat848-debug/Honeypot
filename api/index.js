require("dotenv").config();
const app = require("../server/index.js");

// Vercel handles the serverless execution
module.exports = app;
