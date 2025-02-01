const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(cors());

const port = process.env.PORT || 3000;
let users = {};

io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id}`);

  socket.on("join-channel", (channelId) => {
    if (!channelId) return;
    
    socket.join(channelId);
    users[socket.id] = channelId;
    console.log(`User ${socket.id} joined channel ${channelId}`);

    updateUserList(channelId);
  });

  socket.on("leave-channel", () => {
    if (!users[socket.id]) return;

    const channelId = users[socket.id];
    socket.leave(channelId);
    delete users[socket.id];
    console.log(`User ${socket.id} left channel ${channelId}`);

    updateUserList(channelId);
  });

  socket.on("disconnect", () => {
    if (!users[socket.id]) return;

    const channelId = users[socket.id];
    delete users[socket.id];
    console.log(`User disconnected: ${socket.id}`);

    updateUserList(channelId);
  });

  socket.on("user-speaking", (data) => {
    const channelId = users[socket.id];
    if (!channelId) return;

    io.to(channelId).emit("user-speaking", data);
  });

  socket.on("webrtc-signal", (data) => {
    const { signal, to } = data;
    if (!to || !users[to] || users[to] !== users[socket.id]) return;

    io.to(to).emit("webrtc-signal", { signal, from: socket.id });
  });
});

function updateUserList(channelId) {
  const channelUsers = Object.keys(users).filter((id) => users[id] === channelId);
  io.to(channelId).emit("update-users", { channelId, users: channelUsers });
}

server.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

app.get("/", (req, res) => {
  res.send("Server is running!");
});