const express = require('express');
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3004;

const uploadDir = path.join(__dirname, 'uploads');

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(uploadDir));

const server = app.listen(PORT, () => console.log(`Server running on port:${PORT}`));
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
  console.log('WebSocket client connected');

  sendFileList(ws);

  ws.on('message', (message) => {
    const data = JSON.parse(message);

    switch (data.type) {
      case 'startUpload': {
        const filePath = path.join(uploadDir, data.fileName);
        ws.uploadStream = fs.createWriteStream(filePath);
        ws.uploadedBytes = 0;
        ws.totalBytes = data.totalBytes;
        ws.fileName = data.fileName;
        ws.comment = data.comment;
        break;
      }

      case 'chunk': {
        const chunk = Buffer.from(data.chunk, 'base64');
        ws.uploadStream.write(chunk);
        ws.uploadedBytes += chunk.length;

        const progress = Math.round((ws.uploadedBytes / ws.totalBytes) * 100);
        ws.send(JSON.stringify({ type: 'progress', progress }));
        break;
      }

      case 'endUpload': {
        ws.uploadStream.end();

        const commentFilePath = path.join(uploadDir, `${ws.fileName}.comment.json`);
        fs.writeFileSync(commentFilePath, JSON.stringify({ comment: ws.comment }));

        console.log(`File uploaded: ${ws.fileName}`);
        ws.send(JSON.stringify({ type: 'uploadComplete', fileName: ws.fileName }));

        broadcastFileList();
        break;
      }

      default:
        console.error(`Unknown message type: ${data.type}`);
    }
  });

  ws.on('close', () => {
    console.log('WebSocket client disconnected');
  });
});

function getFileList() {
  return fs.readdirSync(uploadDir).filter((file) => !file.endsWith('.comment.json')).map((file) => {
    const commentFile = path.join(uploadDir, `${file}.comment.json`);
    const comment = fs.existsSync(commentFile) ? JSON.parse(fs.readFileSync(commentFile)).comment : '';

    return { name: file, comment };
  });
}

function broadcastFileList() {
  const fileList = getFileList();
  wss.clients.forEach((client) => {
    if (client.readyState !== WebSocket.OPEN) {
      return;
    }
    client.send(JSON.stringify({ type: 'fileList', files: fileList }));
  });
}

function sendFileList(ws) {
  const fileList = getFileList();
  
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'fileList', files: fileList }));
  }
}