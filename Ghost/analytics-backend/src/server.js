
const express = require("express");
const cors = require("cors");
require("dotenv").config();

const db = require("./config/db");
const analyticsRoutes = require("./routes/analytics");

const app = express();

app.use(cors());
app.use(express.json());

// Kiểm tra server
app.get("/", (req, res) => {
    res.json({
        message: "Ghost Analytics API is running"
    });
});

// Đăng ký API Analytics
app.use("/api/analytics", analyticsRoutes);

// Kiểm tra kết nối MySQL
db.getConnection()
    .then(connection => {
        console.log("MySQL connected successfully!");
        connection.release();
    })
    .catch(error => {
        console.error("MySQL connection failed:", error.message);
    });

// Khởi chạy server
const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
