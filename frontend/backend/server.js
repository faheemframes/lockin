require("dotenv").config();

const express = require("express");
const cors = require("cors");

const userRoutes = require("./src/routes/userRoutes");
const missionRoutes = require("./src/routes/missionRoutes");
const messageRoutes = require("./src/routes/messageRoutes");
const recapRoutes = require("./src/routes/recapRoutes");
const taskRoutes = require("./src/routes/taskRoutes");
const followRoutes = require("./src/routes/followRoutes");
const feedRoutes = require("./src/routes/feedRoutes");
const collegeRoutes = require("./src/routes/collegeRoutes");
const authRoutes = require("./src/routes/authRoutes");
const interestRoutes = require("./src/routes/interestRoutes");
const { errorHandler, notFound } = require("./src/middleware/errorHandler");
const postRoutes = require("./src/routes/posts");

const app = express();
const port = process.env.PORT || 4000;

app.use(
  cors({
    origin: (origin, callback) => {
      callback(null, origin || "*");
    },
    credentials: true
  })
);
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "LOCKIN API" });
});

const { requireAuth } = require("./src/middleware/auth");

app.use("/api/auth", authRoutes);
app.use("/api/users", requireAuth, userRoutes);
app.use("/api/missions", missionRoutes);
app.use("/api/messages", requireAuth, messageRoutes);
app.use("/api/recaps", requireAuth, recapRoutes);
app.use("/api/tasks", requireAuth, taskRoutes);
app.use("/api/follow", requireAuth, followRoutes);
app.use("/api/feed", requireAuth, feedRoutes);
app.use("/api/colleges", requireAuth, collegeRoutes);
app.use("/api/interests", interestRoutes);
app.use("/api/posts", requireAuth, postRoutes);

app.use(notFound);
app.use(errorHandler);

if (require.main === module) {
  app.listen(port, process.env.HOST || "0.0.0.0", () => {
    console.log(`LOCKIN API running on port ${port}`);
  });
}

module.exports = app;
