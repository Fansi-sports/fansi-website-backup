// fansi-backend/public/admin-upload.js
// Handles Cloudinary image uploads on the admin create and edit pages

document.getElementById('cardUploadBtn').addEventListener('click', function() {
  var file = document.getElementById('cardUploadFile').files[0];
  var statusEl = document.getElementById('cardUploadStatus');
  var thumb = document.getElementById('cardUploadThumb');
  if (!file) { statusEl.textContent = 'Please select an image first.'; return; }
  this.disabled = true;
  statusEl.textContent = 'Uploading...';
  statusEl.style.color = '#6b6691';
  var fd = new FormData();
  fd.append('image', file);
  var btn = this;
  fetch('/admin/upload-image', { method: 'POST', body: fd })
    .then(function(r) { return r.json().then(function(d) { return { ok: r.ok, d: d }; }); })
    .then(function(result) {
      if (!result.ok) throw new Error(result.d.error || 'Upload failed');
      document.getElementById('cardImage').value = result.d.url;
      thumb.src = result.d.url;
      thumb.style.display = 'block';
      statusEl.textContent = 'Uploaded successfully!';
      statusEl.style.color = '#0a7d32';
      var prev = document.getElementById('prevImg');
      if (prev) {
        prev.innerHTML = '';
        var im = document.createElement('img');
        im.src = result.d.url;
        prev.appendChild(im);
      }
      btn.disabled = false;
    })
    .catch(function(err) {
      statusEl.textContent = 'Error: ' + err.message;
      statusEl.style.color = '#a12727';
      btn.disabled = false;
    });
});

document.getElementById('galleryUploadBtn').addEventListener('click', function() {
  var files = document.getElementById('galleryUploadFile').files;
  var statusEl = document.getElementById('galleryUploadStatus');
  var thumb = document.getElementById('galleryUploadThumb');
  if (!files || files.length === 0) { statusEl.textContent = 'Please select at least one image.'; return; }
  var total = files.length;
  var uploaded = 0;
  var btn = this;
  var lastUrl = '';
  btn.disabled = true;
  statusEl.textContent = 'Uploading ' + total + ' image(s)...';
  statusEl.style.color = '#6b6691';
  Array.prototype.forEach.call(files, function(file) {
    var fd = new FormData();
    fd.append('image', file);
    fetch('/admin/upload-image', { method: 'POST', body: fd })
      .then(function(r) { return r.json().then(function(d) { return { ok: r.ok, d: d }; }); })
      .then(function(result) {
        if (!result.ok) throw new Error(result.d.error || 'Upload failed');
        var ta = document.getElementById('images');
        ta.value = ta.value ? ta.value + '\n' + result.d.url : result.d.url;
        lastUrl = result.d.url;
        uploaded++;
        if (uploaded === total) {
          thumb.src = lastUrl;
          thumb.style.display = 'block';
          statusEl.textContent = total + ' image(s) uploaded and added!';
          statusEl.style.color = '#0a7d32';
          btn.disabled = false;
        }
      })
      .catch(function(err) {
        statusEl.textContent = 'Error: ' + err.message;
        statusEl.style.color = '#a12727';
        btn.disabled = false;
      });
  });
});