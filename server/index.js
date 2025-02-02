const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { ExpressPeerServer } = require("peer");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type"],
    credentials: true
  },
  transports: ["polling", "websocket"] // Allow both transports
});

const peerServer = ExpressPeerServer(server, {
  debug: true,
  path: "/peerjs",
});
app.use("/peerjs", peerServer);

const port = process.env.PORT || 3000;
let users = {};

server.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});

app.get("/", (req, res) => {
  res.send("Server is running!");
});

io.on("connection", (socket) => {
    console.log(`User connected: ${socket.id}`);

    socket.on("join-channel", ({ peerId, channelId }) => {
        if (!peerId || !channelId) return;

        socket.join(channelId);
        users[socket.id] = { peerId, channelId };
        io.to(channelId).emit("user-joined", { peerId });

        socket.broadcast.to(channelId).emit("user-connected", peerId);
        updateUserList(channelId);
    });

    socket.on("leave-channel", () => {
        removeUser(socket);
    });

    socket.on("disconnect", () => {
        removeUser(socket);
    });
});

function removeUser(socket) {
    if (!users[socket.id]) return;

    const { channelId, peerId } = users[socket.id];
    delete users[socket.id];
    console.log(`User disconnected: ${socket.id} (Peer: ${peerId})`);

    socket.broadcast.to(channelId).emit("user-disconnected", peerId);
    updateUserList(channelId);
}

function updateUserList(channelId) {
    const channelUsers = Object.values(users)
        .filter(user => user.channelId === channelId)
        .map(user => user.peerId);

    io.to(channelId).emit("update-users", { channelId, users: channelUsers });
}