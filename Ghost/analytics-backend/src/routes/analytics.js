
const express = require("express");
const router = express.Router();

const db = require("../config/db");

// API nhận dữ liệu lượt xem
router.post("/view", async (req, res) => {
    try {
        // 1. Nhận dữ liệu từ Client
        const { post_id, post_title } = req.body;

        // 2. Kiểm tra dữ liệu
        if (!post_id || typeof post_id !== "string" || !post_id.trim()) {
            return res.status(400).json({
                success: false,
                message: "post_id không hợp lệ"
            });
        }

        // 3. Lưu dữ liệu vào MySQL
        const sql = `
            INSERT INTO page_views (post_id, post_title)
            VALUES (?, ?)
        `;

        const [result] = await db.execute(sql, [
            post_id.trim(),
            post_title || null
        ]);

        // 4. Trả kết quả
        res.status(201).json({
            success: true,
            message: "Ghi nhận lượt xem thành công",
            data: {
                id: result.insertId,
                post_id: post_id,
                post_title: post_title || null
            }
        });

    } catch (error) {
        console.error("Lỗi ghi nhận lượt xem:", error);

        res.status(500).json({
            success: false,
            message: "Không thể ghi nhận lượt xem"
        });
    }
});

module.exports = router;
