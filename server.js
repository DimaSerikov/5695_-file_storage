const express = require('express');
const WebSocket = require('ws');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3004;

const uploadsPerIP = {};
const fileData = [];

// Limitation flow for each client
const uploadLimitMiddleware = (req, res, next) => {
  const clientIP = req.ip;
  if (!uploadsPerIP[clientIP]) {
    uploadsPerIP[clientIP] = 0;
  }

  if (uploadsPerIP[clientIP] >= 3) {
    return res.status(429).json({ error: 'Upload limit reached (max 3 files per IP)' });
  }

  next();
};

// Refresh limits 
setInterval(() => {
  for (const ip in uploadsPerIP) {
    uploadsPerIP[ip] = 0;
  }
}, 24 * 60 * 60 * 1000);

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath);
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 },
});

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File size exceeds 2MB' });
    }
  }
  if (err) {
    return res.status(500).json({ error: err.message });
  }
  next();
});

app.use(express.static(path.join(__dirname, 'public')));

function getFileList() {
  const uploadPath = path.join(__dirname, 'uploads');
  if (!fs.existsSync(uploadPath)) return [];
  return fs.readdirSync(uploadPath).map((file) => ({ name: file }));
}

app.post('/upload', uploadLimitMiddleware, upload.single('file'), (req, res) => {
  const clientIP = req.ip;
  uploadsPerIP[clientIP] += 1;

  const fileEntry = {
    name: req.file.originalname,
  };
  fileData.push(fileEntry);

  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ type: 'fileList', files: fileData }));
    }
  });

  res.json({ message: 'File uploaded successfully', fileName: req.file.originalname });
});

const server = app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
  console.log('Client connected');

  ws.send(JSON.stringify({ type: 'fileList', files: getFileList() }));

  ws.on('message', (message) => {
    const data = JSON.parse(message);
    if (data.type === 'progress') {
      ws.send(JSON.stringify({ type: 'progress', progress: data.progress }));
    }
  });

  ws.on('close', () => {
    console.log('Client disconnected');
  });

  ws.on('error', (err) => {
    console.error('WebSocket error:', err);
  });
});