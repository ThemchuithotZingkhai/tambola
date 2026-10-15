import "dotenv/config";
import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
// ADDED: Resolve the server-owned upload folder used for room music assets.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { connectDB } from "./config/db.js";
import authRoutes from "./routes/authRoutes.js";
import roomRoutes from "./routes/roomRoutes.js";
import bookingRoutes from "./routes/bookingRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import { startGameEngine } from "./utils/gameEngine.js";

import dns from "dns";

dns.setServers(["1.1.1.1", "8.8.8.8"]);

const app = express(),
    PORT = process.env.PORT || 5000;
const serverDirectory = path.dirname(fileURLToPath(import.meta.url));
// CHANGED: Resolve the Vite production build from server.js so deployment works
// regardless of whether the process starts from the project root or /server.
const clientDistDirectory = path.resolve(serverDirectory, "../../client/dist");
app.use(cors({ origin: process.env.CLIENT_URL || "http://localhost:5173" }));
app.use(express.json());
// ADDED: Make uploaded room tracks available to authorized clients by their room music URL.
app.use("/media/music", express.static(path.join(serverDirectory, "uploads", "music"), { fallthrough: false }));
app.use("/api/auth", rateLimit({ windowMs: 15 * 60000, limit: 30 }));
app.get("/api/health", (_, res) => res.json({ ok: true }));
app.use("/api/auth", authRoutes);
app.use("/api/rooms", roomRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/admin", adminRoutes);

// CHANGED: Serve the built React application in production. Without this,
// the request for / and the Vite /assets/*.js files reaches the JSON 404 handler.
if (process.env.NODE_ENV === "production") {
    app.use(express.static(clientDistDirectory));

    // CHANGED: Support React client-side routes while leaving missing API and
    // asset requests as real 404 responses instead of returning index.html.
    app.get("/{*splat}", (req, res, next) => {
        const isApiOrMediaRequest =
            req.path.startsWith("/api/") || req.path.startsWith("/media/");
        const isAssetRequest = Boolean(path.extname(req.path));

        if (isApiOrMediaRequest || isAssetRequest) return next();

        res.sendFile(path.join(clientDistDirectory, "index.html"));
    });
}

app.use((_, res) => res.status(404).json({ message: "Route not found" }));
app.use((e, _, res, __) =>
    res.status(500).json({ message: e.message || "Internal server error" }),
);
connectDB()
    .then(() => {
        startGameEngine();

        app.listen(PORT, () => {
            console.log(
                `Server running on port ${PORT}`,
            );
        });
    })
    .catch((error) => {
        console.error(
            "Database connection failed:",
            error,
        );
    });
