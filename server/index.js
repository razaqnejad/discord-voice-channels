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
let users = {}; // Store peerId and channelId mappings

io.on("connection", (socket) => {
    console.log(`User connected: ${socket.id}`);

    // User joins a channel
    socket.on("join-channel", (data) => {
        const { peerId, channelId } = data;
        if (!peerId || !channelId) return;

        socket.join(channelId);
        users[socket.id] = { peerId, channelId };

        console.log(`User ${socket.id} (Peer: ${peerId}) joined channel ${channelId}`);

        // Notify others in the channel
        socket.broadcast.to(channelId).emit("user-connected", peerId);
        updateUserList(channelId);
    });

    // User leaves a channel
    socket.on("leave-channel", () => {
        if (!users[socket.id]) return;

        const { channelId, peerId } = users[socket.id];
        socket.leave(channelId);
        delete users[socket.id];

        console.log(`User ${socket.id} (Peer: ${peerId}) left channel ${channelId}`);

        // Notify others in the channel
        socket.broadcast.to(channelId).emit("user-disconnected", peerId);
        updateUserList(channelId);
    });

    // Handle disconnection
    socket.on("disconnect", () => {
        if (!users[socket.id]) return;

        const { channelId, peerId } = users[socket.id];
        delete users[socket.id];

        console.log(`User disconnected: ${socket.id} (Peer: ${peerId})`);

        // Notify others in the channel
        socket.broadcast.to(channelId).emit("user-disconnected", peerId);
        updateUserList(channelId);
    });
});

// Update the list of active users in a channel
function updateUserList(channelId) {
    const channelUsers = Object.values(users)
        .filter(user => user.channelId === channelId)
        .map(user => user.peerId);

    console.log(`Updating user list for channel ${channelId}: ${channelUsers}`);
    io.to(channelId).emit("update-users", { channelId, users: channelUsers });
}

// Start the server
server.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});

// Root Route
app.get("/", (req, res) => {
    res.send("Server is running!");
});
