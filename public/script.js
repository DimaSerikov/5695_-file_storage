const ws = new WebSocket('ws://localhost:3004');
const uploadForm = document.getElementById('uploadForm');
const fileList = document.getElementById('fileList');
const submitBtn = document.getElementById('submitBtn');

const progressBarBtn = document.createElement('div');
progressBarBtn.classList.add('progress-bar-inner');
submitBtn.appendChild(progressBarBtn);

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);

  switch (data.type) {
    case 'progress':
      progressBarBtn.style.width = `${data.progress}%`;
      break;

    case 'fileList':
      updateFileList(data.files);
      break;

    case 'uploadComplete':
      progressBarBtn.style.width = '100%';

      setTimeout(() => {
        alert(`File uploaded: ${data.fileName}`);
        
        progressBarBtn.style.width = '0%';
        submitBtn.classList.remove('disabled');
        document.getElementById('file').value = '';
        document.getElementById('comment').value = '';
      }, 500);
      break;

    default:
      console.error(`Unknown message type: ${data.type}`);
  }
};

function updateFileList(files) {
  fileList.innerHTML = '';

  files.forEach((file) => {
    const listItem = document.createElement('div');
    listItem.innerHTML = `<a href="./uploads/${file.name}" download>${file.name}</a><p>${file.comment}</p>`;

    fileList.appendChild(listItem);
  });
}

uploadForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const fileInput = document.getElementById('file');
  const commentInput = document.getElementById('comment');
  const file = fileInput.files[0];
  const comment = commentInput.value;

  if (!file || !comment) {
    return;
  }

  submitBtn.classList.add('disabled');
  progressBarBtn.style.width = '0%';

  ws.send(JSON.stringify({ type: 'startUpload', fileName: file.name, comment, totalBytes: file.size }));

  const chunkSize = 16 * 1024;
  let offset = 0;

  async function processChunk() {
    const slice = file.slice(offset, offset + chunkSize);
    const arrayBuffer = await slice.arrayBuffer();
    const base64Chunk = arrayBufferToBase64(arrayBuffer);

    ws.send(JSON.stringify({ type: 'chunk', chunk: base64Chunk }));

    offset += chunkSize;

    if (offset < file.size) {
      setTimeout(processChunk, 0);
    } else {
      ws.send(JSON.stringify({ type: 'endUpload' }));
    }
  }

  processChunk();
});

function arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);

  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}