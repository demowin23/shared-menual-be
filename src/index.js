const express = require("express");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const https = require("https");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 4000;

// Create uploads directory if it doesn't exist
const uploadPath = process.env.UPLOAD_PATH || "uploads";
if (!fs.existsSync(uploadPath)) {
  fs.mkdirSync(uploadPath, { recursive: true });
}

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static(path.join(__dirname, "..", uploadPath)));

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "OK", timestamp: new Date() });
});

// Routes
app.use("/api/projects", require("./routes/projects"));
app.use("/api/other-projects", require("./routes/otherProjects"));

// SSL config
let useHttps = false;
let sslKey, sslCert;
try {
  const keyPath = process.env.SSL_KEY_PATH || "key.pem";
  const certPath = process.env.SSL_CERT_PATH || "cert.pem";
  if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
    sslKey = fs.readFileSync(keyPath);
    sslCert = fs.readFileSync(certPath);
    useHttps = true;
  }
} catch (e) {
  console.warn("Không thể đọc file SSL, server sẽ chạy HTTP.");
}

// Start server
if (useHttps) {
  https.createServer({ key: sslKey, cert: sslCert }, app).listen(port, () => {
    console.log(`HTTPS server is running on port ${port}`);
    console.log(`Upload directory: ${path.resolve(uploadPath)}`);
  });
} else {
  app.listen(port, () => {
    console.log(`HTTP server is running on port ${port}`);
    console.log(`Upload directory: ${path.resolve(uploadPath)}`);
  });
}
