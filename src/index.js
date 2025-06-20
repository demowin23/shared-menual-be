const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 4000;

// Create uploads directory if it doesn't exist
const uploadPath = process.env.UPLOAD_PATH || 'uploads';
if (!fs.existsSync(uploadPath)) {
  fs.mkdirSync(uploadPath, { recursive: true });
}

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, '..', uploadPath)));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date() });
});

// Routes
app.use('/api/projects', require('./routes/projects'));

// Start server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
  console.log(`Upload directory: ${path.resolve(uploadPath)}`);
}); 