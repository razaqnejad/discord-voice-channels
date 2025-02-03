const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { ExpressPeerServer } = require("peer");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Create PeerJS Server and attach it to Express
const peerServer = ExpressPeerServer(server, {
  path: "/peerjs",
  debug: true
});
app.use("/peerjs", peerServer);

const port = process.env.PORT || 3000;
let users = {};

io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id}`);

  socket.on("join-channel", (channelId) => {
    const { peerId, channelId: channelIdFromData } = data;
    if (!peerId || !channelIdFromData) return;

    socket.join(channelIdFromData);
    users[socket.id] = { peerId, channelId: channelIdFromData };
    console.log(`User ${socket.id} (Peer: ${peerId}) joined channel ${channelIdFromData}`);

    updateUserList(channelIdFromData);
  });

  socket.on("leave-channel", () => {
    if (!users[socket.id]) return;

    const channelId = users[socket.id].channelId;
    socket.leave(channelId);
    delete users[socket.id];
    console.log(`User ${socket.id} left channel ${channelId}`);

    updateUserList(channelId);
  });

  socket.on("disconnect", () => {
    if (!users[socket.id]) return;

    const channelId = users[socket.id].channelId;
    delete users[socket.id];
    console.log(`User disconnected: ${socket.id}`);

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
  const channelUsers = Object.values(users)
    .filter(user => user.channelId === channelId)
    .map(user => user.peerId);

  console.log(`Updating user list for channel ${channelId}: ${channelUsers}`);
  io.to(channelId).emit("update-users", { channelId, users: channelUsers });
}

server.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

app.get("/", (req, res) => {
  res.send("Server is running!");
});
