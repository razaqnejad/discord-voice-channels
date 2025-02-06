const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const mongoose = require("mongoose");

// Connect to MongoDB
const mongoURI = process.env.MONGO_URI || "mongodb://localhost:27017/voicechat";
mongoose.connect(mongoURI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
}).then(() => console.log("Connected to MongoDB"))
.catch(err => console.error("MongoDB connection error:", err));

// Define the database schema for voice chat channels
const channelSchema = new mongoose.Schema({
  channelId: String,
  currentUsers: { type: Number, default: 0 },
  maxUsers: { type: Number, default: 0 }
});
const Channel = mongoose.model("Channel", channelSchema);

// Initialize the Express application
const app = express();
app.use(cors({
  origin: process.env.CLIENT_URL || "*", // Set to a specific domain if required
  methods: ["GET", "POST"]
}));

// Enable trust proxy for proper HTTPS handling in a hosted environment
app.set("trust proxy", 1);

// Create an HTTP server
const server = http.createServer(app);

// Configure WebSocket (Socket.io) for real-time communication
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || "*",
    methods: ["GET", "POST"],
    credentials: true
  }
});

const port = process.env.PORT || 10000;
server.listen(port, "0.0.0.0", () => {
  console.log(`Server is running on port ${port}`);
});

// Store connected users and their respective channels
let users = {};

io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id}`);

  // Handle user joining a voice chat channel
  socket.on("join-channel", (channelId) => {
    if (!channelId) return;
    socket.join(channelId);
    users[socket.id] = channelId;
    console.log(`User ${socket.id} joined channel ${channelId}`);

    // Update or create the channel in the database
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

  // Handle user disconnection
  socket.on("disconnect", () => {
    if (!users[socket.id]) return;
    const channelId = users[socket.id];
    delete users[socket.id];
    console.log(`User disconnected: ${socket.id}`);

    // Update the channel in the database after user leaves
    Channel.findOne({ channelId }).then(channel => {
      if (channel) {
        channel.currentUsers = Math.max(0, channel.currentUsers - 1);
        return channel.save();
      }
    }).catch(err => console.error("Error updating channel:", err));

    updateUserList(channelId);
  });

  // Handle voice activity updates from users
  socket.on("user-speaking", (data) => {
    const channelId = users[socket.id];
    if (!channelId) return;
    console.log(`User ${data.userId} is ${data.isSpeaking ? "speaking" : "not speaking"}`);
    io.to(channelId).emit("user-speaking", data);
  });

  // Relay WebRTC signaling messages between peers
  socket.on("webrtc-signal", (data) => {
    const { signal, to } = data;
    if (!to || !users[to] || users[to] !== users[socket.id]) return;
    console.log(`Relaying WebRTC signal from ${socket.id} to ${to}`);
    io.to(to).emit("webrtc-signal", { signal, from: socket.id });
  });
});

// Function to update the user list for a specific channel
function updateUserList(channelId) {
  const channelUsers = Object.keys(users).filter((id) => users[id] === channelId);
  console.log(`Updating user list for channel ${channelId}: ${channelUsers}`);
  io.to(channelId).emit("update-users", { channelId, users: channelUsers });
}

// Basic route to verify if the server is running
app.get("/", (req, res) => {
  res.send("Server is running!");
});