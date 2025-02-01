const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const net = require("net");

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

let users = {}; // ذخیره کاربران متصل به Voice Channels

io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id}`);

  // کاربر به Voice Channel اضافه می‌شود
  socket.on("join-channel", (channelId) => {
    socket.join(channelId);
    users[socket.id] = channelId;
    console.log(`User ${socket.id} joined channel ${channelId}`);

    io.to(channelId).emit("update-users", {
      channelId,
      users: Object.keys(users).filter((id) => users[id] === channelId),
    });
  });

  // مدیریت ارسال و دریافت سیگنال‌های WebRTC
  socket.on("webrtc-signal", (data) => {
    const { signal, to } = data;
    io.to(to).emit("webrtc-signal", { signal, from: socket.id });
  });

  // زمانی که کاربر از کانال خارج می‌شود
  socket.on("leave-channel", () => {
    const channelId = users[socket.id];
    if (channelId) {
      socket.leave(channelId);
      delete users[socket.id]; // حذف کاربر از لیست

      console.log(`User ${socket.id} left channel ${channelId}`);

      // ارسال لیست جدید کاربران به همه‌ی اعضای چنل
      io.to(channelId).emit("update-users", {
        channelId,
        users: Object.keys(users).filter((id) => users[id] === channelId),
      });
    }
  });


  // زمانی که کاربر قطع می‌شود
  socket.on("disconnect", () => {
    const channelId = users[socket.id];
    if (channelId) {
      delete users[socket.id];
      io.to(channelId).emit("update-users", {
        channelId,
        users: Object.keys(users).filter((id) => users[id] === channelId),
      });
    }
    console.log(`User disconnected: ${socket.id}`);
  });

  socket.on("user-speaking", (data) => {
    console.log(`Received user-speaking: ${data.userId} isSpeaking: ${data.isSpeaking}`);
    const channelId = users[socket.id];
    if (channelId) {
        io.to(channelId).emit("user-speaking", data);
    }
  });
});

// بررسی اگر پورت اشغال بود، سرور اجرا نشود
const checkPort = (port) => {
  return new Promise((resolve, reject) => {
    const tester = net.createServer()
      .once("error", (err) => {
        if (err.code === "EADDRINUSE") {
          console.log(`Port ${port} is already in use. Trying another port...`);
          resolve(false);
        } else {
          reject(err);
        }
      })
      .once("listening", () => {
        tester.close();
        resolve(true);
      })
      .listen(port);
  });
};

// اجرا کردن سرور فقط اگر پورت اشغال نباشد
checkPort(port).then((available) => {
  if (available) {
    server.listen(port, () => {
      console.log(`Server is running on port ${port}`);
    });
  } else {
    console.error(`Port ${port} is not available. Please restart the server.`);
  }
});

// مسیر اصلی برای تست سرور
app.get("/", (req, res) => {
  res.send("Server is running!");
});
