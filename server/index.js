require("dotenv").config({
  path: require("path").join(__dirname, "..", ".env"),
  override: true,
});
const http = require("http");
const path = require("path");
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const { Server } = require("socket.io");

const { createHoneypotRouter } = require("../honeypot/router");
const { createInteractionRecorder } = require("./services/logger");
const { blocklistMiddleware, refreshCache } = require("./middleware/blocklist");
const { adminIpFilter } = require("./middleware/adminIpFilter");

const { createAuthRouter } = require("./routes/auth");
const logsRoutes = require("./routes/logs");
const statsRoutes = require("./routes/stats");
const blocklistRoutes = require("./routes/blocklist");
const exportRoutes = require("./routes/export");
const replayRoutes = require("./routes/replay");
const externalRoutes = require("./routes/external");

const PORT = parseInt(process.env.PORT, 10) || 5000;
const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/honeypot_analyzer";

async function main() {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 16) {
    console.warn("Warning: set a strong JWT_SECRET in .env (16+ chars)");
  }

  await mongoose.connect(MONGO_URI, {
    serverSelectionTimeoutMS: 5000, // 5 second timeout
  });
  console.log("MongoDB connected");
  await refreshCache().catch(() => {});

  const app = express();
  app.set("trust proxy", 1); // Trust first proxy (Cloudflare, Nginx, etc.)
  const server = http.createServer(app);

  const io = new Server(server, {
    cors: {
      origin: process.env.CLIENT_ORIGIN?.split(",") || ["http://localhost:5173"],
      methods: ["GET", "POST"],
    },
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) {
      return next(new Error("Unauthorized"));
    }
    try {
      const jwt = require("jsonwebtoken");
      socket.user = jwt.verify(token, process.env.JWT_SECRET);
      next();
    } catch {
      next(new Error("Unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    socket.emit("connected", { ok: true });
  });

  const { recordFromExpressReq } = createInteractionRecorder({ io });
  const authRoutes = createAuthRouter({ recordInteraction: recordFromExpressReq });

  app.use(
    cors({
      origin: process.env.CLIENT_ORIGIN?.split(",") || ["http://localhost:5173"],
      credentials: true,
      allowedHeaders: ["Content-Type", "Authorization", "X-Admin-Device-ID"],
    })
  );
  app.use(express.json({ limit: "256kb" }));

  app.get("/api/health", (req, res) => {
    res.json({
      ok: true,
      service: "honeypot-analyzer-api",
      ethics: "defensive-research-honeypot",
    });
  });

  app.use("/api/auth", adminIpFilter(recordFromExpressReq), authRoutes);
  app.use("/api/logs", adminIpFilter(recordFromExpressReq), logsRoutes);
  app.use("/api/stats", adminIpFilter(recordFromExpressReq), statsRoutes);
  app.use("/api/blocklist", adminIpFilter(recordFromExpressReq), blocklistRoutes);
  app.use("/api/export", adminIpFilter(recordFromExpressReq), exportRoutes);
  app.use("/api/replay", adminIpFilter(recordFromExpressReq), replayRoutes);
  app.use("/api/external", externalRoutes); 

  app.use(
    "/trap",
    blocklistMiddleware(),
    createHoneypotRouter({ recordInteraction: recordFromExpressReq })
  );

  // --- PRODUCTION FRONTEND SERVING ---
  // Serve static files from the React app
  const clientDistPath = path.join(__dirname, "../client/dist");
  app.use(express.static(clientDistPath));

  // Catch-all for React Routing
  app.get("*", (req, res, next) => {
    // If it's an API call that wasn't caught, return a JSON 404
    if (req.path.startsWith("/api/")) {
      return res.status(404).json({ error: "API Route Not Found" });
    }
    
    // Otherwise, serve the React index.html
    res.sendFile(path.join(clientDistPath, "index.html"), (err) => {
      if (err) {
        // If dist folder doesn't exist yet, show a friendly dev message
        res.status(200).send("Backend is running. Please run 'npm run build' to see the dashboard.");
      }
    });
  });

  app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  });

  if (process.env.NODE_ENV !== "production" || !process.env.VERCEL) {
    server.listen(PORT, () => {
      console.log(`API + honeypot listening on http://localhost:${PORT}`);
      console.log(`Trap UI: http://localhost:${PORT}/trap`);
    });
  }

  return app;
}

const appPromise = main().catch((e) => {
  console.error(e);
  process.exit(1);
});

module.exports = async (req, res) => {
  const app = await appPromise;
  app(req, res);
};
