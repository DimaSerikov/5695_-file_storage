const ws = new WebSocket('ws://localhost:3004');
const uploadForm = document.getElementById('uploadForm');
const progressBarInner = document.querySelector('.progress-bar-inner');
const fileList = document.getElementById('fileList');

function updateFileList(files) {
  fileList.innerHTML = '';

  files.forEach((file) => {
    const listItem = document.createElement('div');
    listItem.innerHTML = `<a href="/uploads/${file.name}" download>${file.name}</a>`;

    fileList.appendChild(listItem);
  });
}

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.type === 'progress') {
    progressBarInner.style.width = `${data.progress}%`;
  } else if (data.type === 'fileList') {
    updateFileList(data.files);
  }
};

uploadForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const fileInput = document.getElementById('file');
  const file = fileInput.files[0];

  if (!file) {
    return;
  }

  const formData = new FormData();
  formData.append('file', file);

  const xhr = new XMLHttpRequest();
  xhr.open('POST', '/upload', true);

  xhr.upload.onprogress = (event) => {
    const progress = Math.round((event.loaded / event.total) * 100);
    ws.send(JSON.stringify({ type: 'progress', progress }));
  };

  xhr.onload = () => {
    if (xhr.status === 200) {
      progressBarInner.style.width = '0%';
      fileInput.value = '';
    } else {
      const errorMessage = `Error ${xhr.status}: ${xhr.statusText}`;
      alert(errorMessage);
    }
  };

  xhr.onerror = () => {
    alert('Network error occurred during upload.');
  };

  xhr.send(formData);
});