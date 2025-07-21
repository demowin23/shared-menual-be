const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const db = require("../config/db");

const uploadPath = process.env.UPLOAD_PATH || "uploads";
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const fileName = file.originalname.replace(/[^a-zA-Z0-9.]/g, "-");
    cb(null, `${Date.now()}-${fileName}`);
  },
});

const fileFilter = (req, file, cb) => {
  if (!file.originalname.match(/\.(jpg|jpeg|png|gif|webp)$/)) {
    return cb(new Error("Only image files are allowed!"), false);
  }
  cb(null, true);
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // Tăng lên 50MB
    files: 1, // Giới hạn 1 file
    fieldSize: 10 * 1024 * 1024, // Giới hạn field size 10MB
  },
});

// Lấy danh sách news (có phân trang, lọc is_featured)
router.get("/", async (req, res) => {
  try {
    let { page, limit, is_featured, type } = req.query;
    page = parseInt(page) || 1;
    limit = parseInt(limit) || 0;
    let query =
      "SELECT id, title, image, short_intro, content, is_featured, type, created_at, updated_at FROM news";
    let where = [];
    let values = [];
    let total = 0;
    if (typeof is_featured !== "undefined") {
      where.push("is_featured = $" + (values.length + 1));
      values.push(is_featured === "true" || is_featured === true);
    }
    if (typeof type !== "undefined" && type !== "") {
      where.push("type = $" + (values.length + 1));
      values.push(type);
    }
    if (where.length > 0) {
      query += " WHERE " + where.join(" AND ");
    }
    query += " ORDER BY created_at DESC";
    if (limit > 0) {
      let countQuery = "SELECT COUNT(*) FROM news";
      if (where.length > 0) countQuery += " WHERE " + where.join(" AND ");
      const totalResult = await db.query(countQuery, values);
      total = parseInt(totalResult.rows[0].count);
      const offset = (page - 1) * limit;
      query +=
        " LIMIT $" + (values.length + 1) + " OFFSET $" + (values.length + 2);
      values.push(limit, offset);
      const result = await db.query(query, values);
      return res.json({
        data: result.rows,
        total,
        page,
        totalPages: Math.ceil(total / limit),
      });
    } else {
      const result = await db.query(query, values);
      return res.json(result.rows);
    }
  } catch (err) {
    console.error("Error fetching news:", err);
    res.status(500).json({ error: "Failed to fetch news" });
  }
});

// Lấy chi tiết 1 news
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query("SELECT * FROM news WHERE id = $1", [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "News not found" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error("Error fetching news:", err);
    res.status(500).json({ error: "Failed to fetch news" });
  }
});

// Thêm mới news
router.post("/", upload.single("image"), async (req, res) => {
  try {
    const { title, content, short_intro, is_featured, type } = req.body;
    if (!title) {
      return res.status(400).json({ error: "Title is required" });
    }
    const image = req.file ? req.file.filename : null;
    const result = await db.query(
      "INSERT INTO news (title, content, image, short_intro, is_featured, type) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *",
      [
        title,
        content,
        image,
        short_intro,
        is_featured === "true" || is_featured === true,
        type || "news",
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("Error creating news:", err);
    res.status(500).json({ error: "Failed to create news" });
  }
});

// Sửa news
router.put("/:id", upload.single("image"), async (req, res) => {
  try {
    const { id } = req.params;
    const { title, content, short_intro, is_featured, type } = req.body;
    // Lấy news hiện tại
    const existing = await db.query("SELECT * FROM news WHERE id = $1", [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: "News not found" });
    }
    let image = existing.rows[0].image;
    if (req.file) {
      // Xóa ảnh cũ nếu có
      if (image) {
        const imagePath = path.join(uploadPath, image);
        if (fs.existsSync(imagePath)) {
          fs.unlinkSync(imagePath);
        }
      }
      image = req.file.filename;
    }
    const result = await db.query(
      "UPDATE news SET title = COALESCE($1, title), content = COALESCE($2, content), image = $3, short_intro = COALESCE($4, short_intro), is_featured = COALESCE($5, is_featured), type = COALESCE($6, type), updated_at = CURRENT_TIMESTAMP WHERE id = $7 RETURNING *",
      [
        title,
        content,
        image,
        short_intro,
        typeof is_featured === "undefined"
          ? existing.rows[0].is_featured
          : is_featured === "true" || is_featured === true,
        type || existing.rows[0].type || "news",
        id,
      ]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error("Error updating news:", err);
    res.status(500).json({ error: "Failed to update news" });
  }
});

// Xóa news
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    // Lấy ảnh trước khi xóa
    const news = await db.query("SELECT image FROM news WHERE id = $1", [id]);
    if (news.rows.length === 0) {
      return res.status(404).json({ error: "News not found" });
    }
    // Xóa news
    await db.query("DELETE FROM news WHERE id = $1", [id]);
    // Xóa file ảnh nếu có
    const image = news.rows[0].image;
    if (image) {
      const imagePath = path.join(uploadPath, image);
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    }
    res.json({ message: "News deleted successfully" });
  } catch (err) {
    console.error("Error deleting news:", err);
    res.status(500).json({ error: "Failed to delete news" });
  }
});

module.exports = router;
