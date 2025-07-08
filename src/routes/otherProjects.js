const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const db = require("../config/db");

// Cấu hình multer cho upload ảnh chính
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
  limits: { fileSize: 5 * 1024 * 1024 },
});

// Lấy danh sách other projects (có phân trang)
router.get("/", async (req, res) => {
  try {
    let { page, limit, is_featured } = req.query;
    page = parseInt(page) || 1;
    limit = parseInt(limit) || 0;
    let query =
      "SELECT id, name, main_image, short_intro, detail, is_featured, created_at, updated_at FROM other_projects";
    let where = [];
    let values = [];
    let total = 0;
    if (typeof is_featured !== "undefined") {
      where.push("is_featured = $" + (values.length + 1));
      values.push(is_featured === "true" || is_featured === true);
    }
    if (where.length > 0) {
      query += " WHERE " + where.join(" AND ");
    }
    query += " ORDER BY created_at DESC";
    if (limit > 0) {
      // Lấy tổng số bản ghi
      let countQuery = "SELECT COUNT(*) FROM other_projects";
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
      // Không phân trang
      const result = await db.query(query, values);
      return res.json(result.rows);
    }
  } catch (err) {
    console.error("Error fetching other projects:", err);
    res.status(500).json({ error: "Failed to fetch other projects" });
  }
});

// Lấy chi tiết 1 other project
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query(
      "SELECT * FROM other_projects WHERE id = $1",
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Other project not found" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error("Error fetching other project:", err);
    res.status(500).json({ error: "Failed to fetch other project" });
  }
});

// Thêm mới other project
router.post("/", upload.single("main_image"), async (req, res) => {
  try {
    const { name, detail, short_intro, is_featured } = req.body;
    if (!name) {
      return res.status(400).json({ error: "Name is required" });
    }
    const main_image = req.file ? req.file.filename : null;
    const result = await db.query(
      "INSERT INTO other_projects (name, main_image, detail, short_intro, is_featured) VALUES ($1, $2, $3, $4, $5) RETURNING *",
      [
        name,
        main_image,
        detail,
        short_intro,
        is_featured === "true" || is_featured === true,
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("Error creating other project:", err);
    res.status(500).json({ error: "Failed to create other project" });
  }
});

// Sửa other project
router.put("/:id", upload.single("main_image"), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, detail, short_intro, is_featured } = req.body;
    // Lấy project hiện tại
    const existing = await db.query(
      "SELECT * FROM other_projects WHERE id = $1",
      [id]
    );
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: "Other project not found" });
    }
    let main_image = existing.rows[0].main_image;
    if (req.file) {
      // Xóa ảnh cũ nếu có
      if (main_image) {
        const imagePath = path.join(uploadPath, main_image);
        if (fs.existsSync(imagePath)) {
          fs.unlinkSync(imagePath);
        }
      }
      main_image = req.file.filename;
    }
    const result = await db.query(
      "UPDATE other_projects SET name = COALESCE($1, name), main_image = $2, detail = COALESCE($3, detail), short_intro = COALESCE($4, short_intro), is_featured = COALESCE($5, is_featured), updated_at = CURRENT_TIMESTAMP WHERE id = $6 RETURNING *",
      [
        name,
        main_image,
        detail,
        short_intro,
        typeof is_featured === "undefined"
          ? existing.rows[0].is_featured
          : is_featured === "true" || is_featured === true,
        id,
      ]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error("Error updating other project:", err);
    res.status(500).json({ error: "Failed to update other project" });
  }
});

// Xóa other project
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    // Lấy ảnh trước khi xóa
    const project = await db.query(
      "SELECT main_image FROM other_projects WHERE id = $1",
      [id]
    );
    if (project.rows.length === 0) {
      return res.status(404).json({ error: "Other project not found" });
    }
    // Xóa project
    await db.query("DELETE FROM other_projects WHERE id = $1", [id]);
    // Xóa file ảnh nếu có
    const main_image = project.rows[0].main_image;
    if (main_image) {
      const imagePath = path.join(uploadPath, main_image);
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    }
    res.json({ message: "Other project deleted successfully" });
  } catch (err) {
    console.error("Error deleting other project:", err);
    res.status(500).json({ error: "Failed to delete other project" });
  }
});

module.exports = router;
