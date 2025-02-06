const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const mongoose = require("mongoose");

const mongoURI = process.env.MONGO_URI;
mongoose.connect(mongoURI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
}).then(() => console.log("Connected to MongoDB"))
.catch(err => console.error("MongoDB connection error:", err));

const channelSchema = new mongoose.Schema({
  channelId: String,
  currentUsers: { type: Number, default: 0 },
  maxUsers: { type: Number, default: 0 }
});

const Channel = mongoose.model("Channel", channelSchema);

const app = express();
app.use(cors({
  origin: "https://discord-voicechannels.vercel.app",
  methods: ["GET", "POST"]
}));

// Redirect HTTP to HTTPS (ONLY if Render is serving HTTP)
app.use((req, res, next) => {
  if (req.headers["x-forwarded-proto"] !== "https") {
    return res.redirect("https://" + req.headers.host + req.url);
  }
  next();
});

// Use HTTP instead of HTTPS
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "https://discord-voicechannels.vercel.app",
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Explicitly listen on `process.env.PORT`
const port = process.env.PORT || 10000;
server.listen(port, "0.0.0.0", () => {
  console.log(`Server is running on port ${port}`);
});

let users = {};

io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id}`);

  socket.on("join-channel", (channelId) => {
    if (!channelId) return;
    socket.join(channelId);
    users[socket.id] = channelId;
    console.log(`User ${socket.id} joined channel ${channelId}`);

    Channel.findOne({ channelId }).then(channel => {
      if (!channel) {
        channel = new Channel({ channelId, currentUsers: 1, maxUsers: 1 });
      } else {
        channel.currentUsers += 1;
        if (channel.currentUsers > channel.maxUsers) {
          channel.maxUsers = channel.currentUsers;
        }
      }
      return channel.save();
    }).catch(err => console.error("Error updating channel:", err));

    updateUserList(channelId);
  });

  socket.on("disconnect", () => {
    if (!users[socket.id]) return;
    const channelId = users[socket.id];
    delete users[socket.id];
    console.log(`User disconnected: ${socket.id}`);

    Channel.findOne({ channelId }).then(channel => {
      if (channel) {
        channel.currentUsers = Math.max(0, channel.currentUsers - 1);
        return channel.save();
      }
    }).catch(err => console.error("Error updating channel:", err));

    updateUserList(channelId);
  });

  socket.on("user-speaking", (data) => {
    const channelId = users[socket.id];
    if (!channelId) return;
    console.log(`User ${data.userId} is ${data.isSpeaking ? "speaking" : "not speaking"}`);
    io.to(channelId).emit("user-speaking", data);
  });

  socket.on("webrtc-signal", (data) => {
    const { signal, to } = data;
    if (!to || !users[to] || users[to] !== users[socket.id]) return;
    console.log(`Relaying WebRTC signal from ${socket.id} to ${to}`);
    io.to(to).emit("webrtc-signal", { signal, from: socket.id });
  });
});

function updateUserList(channelId) {
  const channelUsers = Object.keys(users).filter((id) => users[id] === channelId);
  console.log(`Updating user list for channel ${channelId}: ${channelUsers}`);
  io.to(channelId).emit("update-users", { channelId, users: channelUsers });
}

server.listen(port, () => {
  console.log(`Server is running securely on port ${port}`);
});

app.get("/", (req, res) => {
  res.send("Server is running!");
});