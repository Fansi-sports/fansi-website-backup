// fansi-backend/routes/admin.js
const express = require("express");
const router = express.Router();
const multer = require("multer");
const cloudinary = require("cloudinary").v2;

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Multer - store in memory before uploading to Cloudinary
const upload = multer({ storage: multer.memoryStorage() });

// loads model
let Competition = null;
try {
  const m = require("../models/Competition");
  Competition = m.default || m;
} catch (e) {
  const m = require("../models/competition");
  Competition = m.default || m;
}

// ✅ NEW: Image upload endpoint
router.post("/upload-image", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file provided" });

    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: "fansi-competitions" },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      stream.end(req.file.buffer);
    });

    res.json({ url: result.secure_url });
  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).json({ error: "Upload failed" });
  }
});

// ✅ NEW: Get all uploaded images from Cloudinary
router.get("/images", async (req, res) => {
  try {
    const result = await cloudinary.search
      .expression("folder:fansi-competitions")
      .sort_by("created_at", "desc")
      .max_results(50)
      .execute();
    const urls = result.resources.map((r) => r.secure_url);
    res.json({ images: urls });
  } catch (err) {
    console.error("Cloudinary search error:", err);
    res.json({ images: [] });
  }
});

router.get("/competitions/new", (_req, res) => {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.end(`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Admin — Fansi</title>
<style>
  :root{--p:#332c54;--r:#ff5757;--bg:#f7f5fb}
  body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;margin:0;background:var(--bg);color:var(--p)}
  .wrap{max-width:980px;margin:24px auto;padding:16px}
  h1{margin:0 0 12px 0}
  form{background:#fff;border:1px solid #ece9f5;border-radius:12px;padding:16px}
  .row{display:grid;grid-template-columns:1fr 1fr;gap:12px}
  .row-3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px}
  .field{display:flex;flex-direction:column;margin-bottom:12px}
  label{font-weight:700;font-size:13px;margin-bottom:6px}
  input,select,textarea{border:1px solid #ddd;border-radius:8px;padding:10px;font-size:14px;color:var(--p)}
  textarea{min-height:80px}
  .hint{font-size:12px;color:#6b648b;margin-top:4px}
  .btn{margin-top:8px;background:var(--r);color:#fff;border:none;border-radius:10px;padding:12px 16px;font-weight:800;cursor:pointer}
  .btn:disabled{opacity:.6;cursor:not-allowed}
  .btn-grey{margin-top:8px;background:#6b648b;color:#fff;border:none;border-radius:10px;padding:12px 16px;font-weight:800;cursor:pointer}
  .note{margin-top:12px;font-size:13px}
  .ok{color:#0a7d32}
  .err{color:#a12727}
  .links a{display:inline-block;margin-right:12px}
  .manage{margin-top:22px;background:#fff;border:1px solid #ece9f5;border-radius:12px;padding:16px}
  .toolbar{display:flex;gap:8px;align-items:center;margin-bottom:10px;flex-wrap:wrap}
  .table{width:100%;border-collapse:collapse}
  .table th,.table td{border-bottom:1px solid #eee;padding:8px 6px;font-size:14px;text-align:left;vertical-align:middle}
  .danger{background:#ffe9e9;color:#a12727}
  .small{font-size:12px;color:#6b648b}
  .btn-edit{margin-top:0;background:#efeaff;color:var(--p);border:none;border-radius:10px;padding:12px 16px;font-weight:800;cursor:pointer;text-decoration:none;display:inline-flex;align-items:center;justify-content:center;}
  .actionsCell{display:flex;gap:10px;align-items:center}

  /* Upload section */
  .upload-section{background:#fff;border:1px solid #ece9f5;border-radius:12px;padding:16px;margin-bottom:22px}
  .upload-section h2{margin:0 0 12px 0;font-size:16px}
  .upload-row{display:flex;gap:12px;align-items:center;flex-wrap:wrap}
  .upload-preview{margin-top:12px}
  .upload-preview img{width:120px;height:80px;object-fit:cover;border-radius:8px;border:2px solid #ece9f5}
  .upload-url{margin-top:8px;font-size:12px;color:#6b648b;word-break:break-all}
  .copy-btn{background:#efeaff;color:var(--p);border:none;border-radius:8px;padding:6px 12px;font-size:12px;font-weight:700;cursor:pointer}

  /* Image gallery */
  .img-gallery{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}
  .img-gallery img{width:100px;height:70px;object-fit:cover;border-radius:8px;border:2px solid #ece9f5;cursor:pointer;transition:border-color 0.2s}
  .img-gallery img:hover{border-color:var(--r)}
  .img-gallery img.selected{border-color:var(--r);border-width:3px}
</style>
</head>
<body>
<div class="wrap">
  <h1>🏆 Fansi Admin</h1>

  <!-- IMAGE UPLOAD SECTION -->
  <div class="upload-section">
    <h2>📸 Upload Image to Cloudinary</h2>
    <div class="upload-row">
      <input type="file" id="imageFile" accept="image/*"/>
      <button class="btn" id="uploadBtn" type="button">Upload Image</button>
      <span class="small" id="uploadStatus"></span>
    </div>
    <div class="upload-preview" id="uploadPreview" style="display:none">
      <img id="uploadedImg" src="" alt="Uploaded"/>
      <div class="upload-url" id="uploadedUrl"></div>
      <button class="copy-btn" id="copyBtn" type="button">📋 Copy URL</button>
    </div>
  </div>

  <!-- IMAGE LIBRARY -->
  <div class="upload-section">
    <h2>🖼️ Image Library (click to copy URL)</h2>
    <button class="btn-grey" id="loadImagesBtn" type="button">Load Images</button>
    <div class="img-gallery" id="imgGallery"></div>
  </div>

  <h2>Create a Competition</h2>
  <form id="compForm">
    <div class="row">
      <div class="field">
        <label for="category">Category</label>
        <select id="category" name="category" required>
          <option value="weekly" selected>Weekly</option>
          <option value="featured">Featured</option>
          <option value="launch">Launch</option>
        </select>
        <div class="hint">Choose Weekly for rolling draws, Featured for headline draws, Launch for launch comps.</div>
      </div>
      <div class="field">
        <label for="league">League</label>
        <input id="league" name="league" placeholder="Premier League Football"/>
      </div>
    </div>

    <div class="field">
      <label for="title">Title</label>
      <input id="title" name="title" required placeholder="Win 4 x Hospitality Tickets to a Top Fixture"/>
    </div>

    <div class="field">
      <label for="prizeBlurb">Prize blurb (optional)</label>
      <textarea id="prizeBlurb" name="prizeBlurb" placeholder="Win VIP hospitality tickets to a top fixture this week"></textarea>
    </div>

    <div class="row-3">
      <div class="field">
        <label for="price">Ticket price (£)</label>
        <input id="price" name="price" type="number" step="0.01" value="3" required/>
      </div>
      <div class="field">
        <label for="totalTickets">Total tickets</label>
        <input id="totalTickets" name="totalTickets" type="number" value="10000" required/>
      </div>
      <div class="field">
        <label for="maxPerUser">Max per user</label>
        <input id="maxPerUser" name="maxPerUser" type="number" value="50" required/>
      </div>
    </div>

    <div class="row">
      <div class="field">
        <label for="drawDateDate">Draw date</label>
        <input id="drawDateDate" type="date" required/>
      </div>
      <div class="field">
        <label for="drawDateTime">Draw time</label>
        <input id="drawDateTime" type="time" value="19:30" required/>
      </div>
    </div>

    <div class="row">
      <div class="field">
        <label for="venue">Location (city)</label>
        <input id="venue" name="venue" placeholder="London"/>
      </div>
      <div class="field">
        <label for="stadium">Stadium</label>
        <input id="stadium" name="stadium" placeholder="Emirates Stadium"/>
      </div>
    </div>

    <div class="field">
      <label for="matchDateText">Match date</label>
      <input id="matchDateText" name="date" placeholder="This Week"/>
    </div>

    <div class="field">
      <label for="prizeImage">Card image URL (paste Cloudinary URL here)</label>
      <input id="prizeImage" name="prizeImage" placeholder="https://res.cloudinary.com/..."/>
      <div class="hint">Upload an image above, then paste the URL here for the card image.</div>
    </div>

    <div class="field">
      <label for="images">Gallery image URLs (one per line)</label>
      <textarea id="images" name="images" placeholder="https://res.cloudinary.com/...&#10;https://res.cloudinary.com/..."></textarea>
      <div class="hint">Paste multiple Cloudinary URLs here for the detail page gallery.</div>
    </div>

    <div class="field">
      <label for="detailsItems">Details list (one per line)</label>
      <textarea id="detailsItems" name="detailsItems" placeholder="2 x Hospitality Tickets&#10;VIP Seats&#10;Half time refreshments"></textarea>
    </div>

    <button class="btn" id="createBtn" type="submit">Create Competition</button>
    <div class="note" id="msg"></div>
    <div class="links" id="links"></div>
  </form>

  <div class="manage">
    <div class="toolbar">
      <strong>Manage Competitions</strong>
      <button class="btn" id="loadBtn" type="button">Load list</button>
      <span class="small">Shows all competitions</span>
    </div>
    <div id="listWrap"></div>
  </div>
</div>

<script>
// ---- Upload ----
const uploadBtn = document.getElementById('uploadBtn');
const uploadStatus = document.getElementById('uploadStatus');
const uploadPreview = document.getElementById('uploadPreview');
const uploadedImg = document.getElementById('uploadedImg');
const uploadedUrl = document.getElementById('uploadedUrl');
const copyBtn = document.getElementById('copyBtn');

uploadBtn.addEventListener('click', async () => {
  const file = document.getElementById('imageFile').files[0];
  if (!file) { uploadStatus.textContent = 'Please select an image first.'; return; }

  uploadBtn.disabled = true;
  uploadStatus.textContent = 'Uploading...';

  const formData = new FormData();
  formData.append('image', file);

  try {
    const res = await fetch('/admin/upload-image', { method: 'POST', body: formData });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Upload failed');

    uploadedImg.src = data.url;
    uploadedUrl.textContent = data.url;
    uploadPreview.style.display = 'block';
    uploadStatus.textContent = '✅ Uploaded!';

    // auto-fill the card image field
    document.getElementById('prizeImage').value = data.url;
  } catch (err) {
    uploadStatus.textContent = '❌ ' + err.message;
  } finally {
    uploadBtn.disabled = false;
  }
});

copyBtn.addEventListener('click', () => {
  const url = uploadedUrl.textContent;
  navigator.clipboard.writeText(url).then(() => {
    copyBtn.textContent = '✅ Copied!';
    setTimeout(() => copyBtn.textContent = '📋 Copy URL', 2000);
  });
});

// ---- Image Library ----
const loadImagesBtn = document.getElementById('loadImagesBtn');
const imgGallery = document.getElementById('imgGallery');

loadImagesBtn.addEventListener('click', async () => {
  loadImagesBtn.disabled = true;
  loadImagesBtn.textContent = 'Loading...';
  try {
    const res = await fetch('/admin/images');
    const data = await res.json();
    imgGallery.innerHTML = '';
    if (!data.images || data.images.length === 0) {
      imgGallery.innerHTML = '<div class="small">No images uploaded yet.</div>';
      return;
    }
    data.images.forEach(url => {
      const img = document.createElement('img');
      img.src = url;
      img.title = 'Click to copy URL';
      img.addEventListener('click', () => {
        navigator.clipboard.writeText(url).then(() => {
          img.style.borderColor = '#0a7d32';
          setTimeout(() => img.style.borderColor = '', 1500);
        });
        // Also fill in the card image field
        document.getElementById('prizeImage').value = url;
      });
      imgGallery.appendChild(img);
    });
  } catch (err) {
    imgGallery.innerHTML = '<div class="err">Failed to load images.</div>';
  } finally {
    loadImagesBtn.disabled = false;
    loadImagesBtn.textContent = 'Load Images';
  }
});

// ---- Create Competition ----
function toISO(dateStr, timeStr){
  if(!dateStr) return "";
  const t = timeStr && timeStr.length ? timeStr : "00:00";
  return dateStr + "T" + t + ":00";
}

const form = document.getElementById('compForm');
const msg = document.getElementById('msg');
const links = document.getElementById('links');
const btn = document.getElementById('createBtn');
const listWrap = document.getElementById('listWrap');
const loadBtn = document.getElementById('loadBtn');

form.addEventListener('submit', async (e)=>{
  e.preventDefault();
  msg.textContent = "";
  links.innerHTML = "";
  btn.disabled = true;

  const data = {
    category: document.getElementById('category').value,
    league: document.getElementById('league').value.trim(),
    title: document.getElementById('title').value.trim(),
    prizeBlurb: document.getElementById('prizeBlurb').value.trim(),
    price: parseFloat(document.getElementById('price').value || "0"),
    totalTickets: parseInt(document.getElementById('totalTickets').value || "10000", 10),
    maxPerUser: parseInt(document.getElementById('maxPerUser').value || "50", 10),
    drawDate: toISO(document.getElementById('drawDateDate').value, document.getElementById('drawDateTime').value),
    venue: document.getElementById('venue').value.trim(),
    stadium: document.getElementById('stadium').value.trim(),
    date: document.getElementById('matchDateText').value.trim(),
    prizeImage: document.getElementById('prizeImage').value.trim(),
    images: document.getElementById('images').value.split("\\n").map(s=>s.trim()).filter(Boolean),
    detailsItems: document.getElementById('detailsItems').value.split("\\n").map(s=>s.trim()).filter(Boolean),
    status: "live"
  };

  try{
    const res = await fetch("/api/competitions", {
      method:"POST",
      headers:{ "Content-Type":"application/json" },
      body: JSON.stringify(data)
    });
    if(!res.ok){ const t = await res.text(); throw new Error("HTTP " + res.status + ": " + t); }
    const created = await res.json();
    msg.innerHTML = '<span class="ok">Created! ID: <code>'+created.id+'</code></span>';
    form.reset();
    document.getElementById('price').value = "3";
    document.getElementById('totalTickets').value = "10000";
    document.getElementById('maxPerUser').value = "50";
    document.getElementById('drawDateTime').value = "19:30";
  }catch(err){
    msg.innerHTML = '<span class="err">'+err.message+'</span>';
  }finally{
    btn.disabled = false;
  }
});

// ---- Manage List ----
async function loadList(){
  listWrap.innerHTML = "Loading…";
  try{
    const res = await fetch('/api/competitions');
    if(!res.ok) throw new Error('HTTP '+res.status);
    const data = await res.json();
    if(!Array.isArray(data) || data.length===0){
      listWrap.innerHTML = '<div class="small">No competitions found.</div>';
      return;
    }
    const rows = data.map(c => {
      const dd = (c.drawDate || '').toString();
      const id = c.id;
      const editHref = '/admin/competitions/' + encodeURIComponent(id) + '/edit';
      return '<tr data-id="'+id+'">' +
        '<td>'+ (c.category || '-') + '</td>' +
        '<td>'+ (c.league || '-') + '</td>' +
        '<td>'+ (c.title || '-') + '</td>' +
        '<td>'+ dd + '</td>' +
        '<td><div class="actionsCell">' +
          '<a class="btn-edit" href="'+editHref+'">Edit</a>' +
          '<button class="btn danger" data-del="'+id+'">Delete</button>' +
        '</div></td>' +
      '</tr>';
    }).join('');
    listWrap.innerHTML = '<table class="table"><thead><tr><th>Category</th><th>League</th><th>Title</th><th>Draw Date</th><th>Action</th></tr></thead><tbody>'+rows+'</tbody></table>';
  }catch(err){
    listWrap.innerHTML = '<div class="err">'+err.message+'</div>';
  }
}

async function handleDelete(id){
  if(!confirm('Delete this competition? This cannot be undone.')) return;
  try{
    const res = await fetch('/api/competitions/'+id, { method: 'DELETE' });
    if(!res.ok){ const t = await res.text(); throw new Error('HTTP '+res.status+': '+t); }
    const tr = listWrap.querySelector('tr[data-id="'+id+'"]');
    if(tr) tr.remove();
  }catch(err){
    alert('Delete failed: '+err.message);
  }
}

loadBtn.addEventListener('click', loadList);
listWrap.addEventListener('click', (e)=>{
  const id = e.target && e.target.getAttribute('data-del');
  if(id) handleDelete(id);
});
</script>
</body>
</html>`);
});

module.exports = router;