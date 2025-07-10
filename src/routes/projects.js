const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const db = require("../config/db");

// Configure multer for file uploads
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
  // Accept images only
  if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/)) {
    return cb(new Error("Only image files are allowed!"), false);
  }
  cb(null, true);
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
});

// Get all projects, filter by areas (id and all children)
router.get("/", async (req, res) => {
  const { areas, page = 1, pageSize = 10 } = req.query;
  const pageNum = parseInt(page, 10) > 0 ? parseInt(page, 10) : 1;
  const sizeNum = parseInt(pageSize, 10) > 0 ? parseInt(pageSize, 10) : 10;
  const offset = (pageNum - 1) * sizeNum;
  try {
    let projects, total;
    if (!areas) {
      // Không có param, trả về toàn bộ (có phân trang)
      const totalResult = await db.query("SELECT COUNT(*) FROM projects");
      total = parseInt(totalResult.rows[0].count, 10);
      const result = await db.query(
        "SELECT * FROM projects ORDER BY created_at DESC LIMIT $1 OFFSET $2",
        [sizeNum, offset]
      );
      projects = result.rows;
    } else {
      // Lấy tất cả id con (bao gồm cả id gốc)
      const areaId = areas;
      const areaIdsResult = await db.query(
        `
        WITH RECURSIVE area_tree AS (
          SELECT id FROM areas WHERE id = $1
          UNION ALL
          SELECT a.id FROM areas a
          INNER JOIN area_tree at ON a.parent_id = at.id
        )
        SELECT id FROM area_tree
      `,
        [areaId]
      );
      const areaIds = areaIdsResult.rows.map((row) => row.id.toString());
      // Lọc project có areas thuộc danh sách này (có phân trang)
      const totalResult = await db.query(
        `SELECT COUNT(*) FROM projects WHERE areas = ANY($1::text[])`,
        [areaIds]
      );
      total = parseInt(totalResult.rows[0].count, 10);
      const result = await db.query(
        `SELECT * FROM projects WHERE areas = ANY($1::text[]) ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
        [areaIds, sizeNum, offset]
      );
      projects = result.rows;
    }
    res.json({
      data: projects,
      pagination: {
        page: pageNum,
        pageSize: sizeNum,
        total,
      },
    });
  } catch (err) {
    console.error("Error fetching projects:", err);
    res.status(500).json({ error: "Failed to fetch projects" });
  }
});

// Get a single project
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query("SELECT * FROM projects WHERE id = $1", [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Project not found" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error("Error fetching project:", err);
    res.status(500).json({ error: "Failed to fetch project" });
  }
});

// Create a new project
router.post("/", upload.array("images", 20), async (req, res) => {
  try {
    const { name, areas, detail } = req.body;
    if (!name) {
      return res.status(400).json({ error: "Name is required" });
    }
    const images = req.files ? req.files.map((file) => file.filename) : [];
    const result = await db.query(
      "INSERT INTO projects (name, areas, detail, images) VALUES ($1, $2, $3, $4) RETURNING *",
      [name, areas, detail, images]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("Error creating project:", err);
    res.status(500).json({ error: "Failed to create project" });
  }
});

// Update a project
router.put("/:id", upload.array("images", 20), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, areas, detail } = req.body;
    // Get existing project
    const existingProject = await db.query(
      "SELECT * FROM projects WHERE id = $1",
      [id]
    );
    if (existingProject.rows.length === 0) {
      return res.status(404).json({ error: "Project not found" });
    }
    // Combine existing images with new uploads
    const existingImages = existingProject.rows[0].images || [];
    const newImages = req.files ? req.files.map((file) => file.filename) : [];
    const images = [...existingImages, ...newImages];
    const result = await db.query(
      "UPDATE projects SET name = COALESCE($1, name), areas = COALESCE($2, areas), detail = COALESCE($3, detail), images = $4, updated_at = CURRENT_TIMESTAMP WHERE id = $5 RETURNING *",
      [name || existingProject.rows[0].name, areas, detail, images, id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error("Error updating project:", err);
    res.status(500).json({ error: "Failed to update project" });
  }
});

// Delete a project
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    // Get project images before deletion
    const project = await db.query(
      "SELECT images FROM projects WHERE id = $1",
      [id]
    );
    if (project.rows.length === 0) {
      return res.status(404).json({ error: "Project not found" });
    }
    // Delete the project
    await db.query("DELETE FROM projects WHERE id = $1", [id]);
    // Delete associated image files
    const images = project.rows[0].images || [];
    images.forEach((image) => {
      const imagePath = path.join(uploadPath, image);
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    });
    res.json({ message: "Project deleted successfully" });
  } catch (err) {
    console.error("Error deleting project:", err);
    res.status(500).json({ error: "Failed to delete project" });
  }
});

module.exports = router;
