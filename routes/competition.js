// fansi-backend/routes/competition.js
const express = require('express');
const path = require('path');
const fs = require('fs');
const router = express.Router();
const multer = require('multer');
const cloudinary = require('cloudinary').v2;

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const upload = multer({ storage: multer.memoryStorage() });

// Load model safely whether it's ESM default export or CJS
let Competition = null;
try {
  const m = require('../models/Competition');
  Competition = m.default || m;
} catch (e) {
  const m = require('../models/competition');
  Competition = m.default || m;
}

/* -----------------------------------------------------------
   Cloudinary upload endpoint
------------------------------------------------------------ */
router.post('/admin/upload-image', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file provided' });
    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: 'fansi-competitions' },
        (error, result) => { if (error) reject(error); else resolve(result); }
      );
      stream.end(req.file.buffer);
    });
    res.json({ url: result.secure_url });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: 'Upload failed' });
  }
});

/* -----------------------------------------------------------
   Serve backend public assets at /api/competitions/assets/*
------------------------------------------------------------ */
const ASSETS_DIR = path.join(__dirname, '..', 'public', 'assets');
router.use('/assets', express.static(ASSETS_DIR, { maxAge: '1h', fallthrough: false }));

function listAssetImages() {
  try {
    const files = fs.readdirSync(ASSETS_DIR);
    return files.filter(f => /\.(png|jpe?g|webp|gif|svg)$/i.test(f)).sort();
  } catch (_) {
    return [];
  }
}

/* -----------------------------------------------------------
   Minimal team list for admin
------------------------------------------------------------ */
const TEAM_OPTIONS = [
  "Arsenal","Manchester United","Manchester City","Chelsea","Liverpool","Tottenham Hotspur",
  "Newcastle United","Aston Villa","West Ham United","Brighton & Hove Albion",
  "Leeds United","Leicester City","Southampton","Ipswich Town","Norwich City","Middlesbrough",
  "Bath Rugby","Bristol Bears","Harlequins","Saracens","Leicester Tigers","Exeter Chiefs","Sale Sharks",
  "Arsenal Women","Chelsea Women","Manchester United Women","Manchester City Women",
  "Tottenham Hotspur Women","Liverpool Women"
];

/* ===========================================================
   ADMIN LIST (HTML)  —  /api/competitions/admin
=========================================================== */
router.get('/admin', async (_req, res) => {
  try {
    const comps = await Competition.find({}).sort({ createdAt: -1 }).lean();

    const rows = comps.map(c => {
      const draw = c.drawDate ? new Date(c.drawDate).toLocaleString() : '';
      return `
        <tr>
          <td>${c.title || ''}</td>
          <td>${c.category || ''}</td>
          <td>${c.league || ''}</td>
          <td>£${Number(c.price || 0).toFixed(2)}</td>
          <td>${draw}</td>
          <td>${c.status || ''}</td>
          <td style="white-space:nowrap; display:flex; gap:6px;">
            <a class="btn" href="/api/competitions/admin/competitions/${c._id}/edit">Edit</a>
            <form method="post" action="/api/competitions/${c._id}/delete" onsubmit="return confirm('Delete this competition?');">
              <button class="btn danger" type="submit">Delete</button>
            </form>
          </td>
        </tr>
      `;
    }).join('');

    res.type('html').send(`<!doctype html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Admin • Competitions</title>
  <style>
    :root{--purple:#332c54;--red:#ff5757;--ink:#2b2740;--ink2:#6b6691;--paper:#f6f4fb;--line:#ece9f5}
    *{box-sizing:border-box}
    body{margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;background:var(--paper);color:var(--ink)}
    .shell{max-width:1100px;margin:24px auto;padding:0 16px}
    h1{margin:0 0 16px;font-size:28px}
    .actions{display:flex;gap:8px;margin-bottom:12px}
    .btn{display:inline-block;background:#efeaff;color:#4b3c77;text-decoration:none;border-radius:10px;padding:8px 12px;font-weight:800;border:0;cursor:pointer}
    .btn.primary{background:var(--red);color:#fff}
    .btn.danger{background:#ffe9e9;color:#b21a1a}
    table{width:100%;border-collapse:collapse;background:#fff;border:1px solid var(--line);border-radius:12px;overflow:hidden}
    th,td{padding:10px;border-bottom:1px solid var(--line);text-align:left;font-size:14px}
    th{background:#faf8ff;color:#4b3c77}
    tr:last-child td{border-bottom:0}
  </style>
</head>
<body>
  <div class="shell">
    <h1>Competitions • Admin</h1>
    <div class="actions">
      <a class="btn primary" href="/api/competitions/admin/competitions/new">+ Create Competition</a>
    </div>
    <table>
      <thead>
        <tr>
          <th>Title</th><th>Category</th><th>Sport</th><th>Price</th><th>Draw</th><th>Status</th><th>Actions</th>
        </tr>
      </thead>
      <tbody>${rows || '<tr><td colspan="7" style="padding:16px;color:#6b6691;">No competitions yet.</td></tr>'}</tbody>
    </table>
  </div>
</body>
</html>`);
  } catch (err) {
    console.error('ADMIN LIST error:', err);
    res.status(500).send('Admin list failed.');
  }
});

/* ===========================================================
   CREATE FORM  —  /api/competitions/admin/competitions/new
=========================================================== */
router.get('/admin/competitions/new', (_req, res) => {
  const teamOptions = TEAM_OPTIONS.map(t => `<option value="${t}"></option>`).join('');
  const assets = listAssetImages();
  const assetsJson = JSON.stringify(assets);

  res.type('html').send(`<!doctype html>
<html>
  <head>
    <meta charset="utf-8"/>
    <title>Create Competition</title>
    <style>
      :root{--purple:#332c54;--red:#ff5757;--ink:#2b2740;--ink2:#6b6691;--paper:#f6f4fb;--line:#ece9f5}
      *{box-sizing:border-box}
      body{margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;background:var(--paper);color:var(--ink)}
      .shell{max-width:1100px;margin:24px auto;padding:0 16px}
      h1{margin:0 0 16px;font-size:28px}
      .pill{display:inline-block;padding:4px 8px;border-radius:999px;background:#efeaff;color:#4b3c77;font-size:12px;margin-left:8px}
      .grid{display:grid;grid-template-columns:1fr 420px;gap:20px}
      .card{background:#fff;border:1px solid var(--line);border-radius:12px;padding:14px}
      .row{display:grid;grid-template-columns:180px 1fr;gap:10px;align-items:center;margin:10px 0}
      label{color:#5b527a;font-weight:700;font-size:13px}
      input,select,textarea{padding:10px;border:1px solid #dcd6ef;border-radius:10px;width:100%;background:#fff;color:#2b2740}
      input[type="date"],input[type="time"]{padding:8px 10px}
      textarea{min-height:80px;resize:vertical}
      .hint{font-size:12px;color:#6b6691}
      .actions{margin-top:14px;display:flex;gap:10px}
      button.btn{background:var(--red);color:#fff;border:none;border-radius:10px;padding:10px 14px;font-weight:800;cursor:pointer}
      a.btn{display:inline-block;background:#efeaff;color:#4b3c77;text-decoration:none;border-radius:10px;padding:10px 14px;font-weight:800}
      .prev{position:sticky;top:16px}
      .pcard{position:relative;border:2px solid var(--purple);border-radius:16px;padding:16px;text-align:center}
      .pc-img{margin:0 0 12px;border:1px solid var(--line);border-radius:12px;overflow:hidden;background:#fff;height:180px;display:flex;align-items:center;justify-content:center}
      .pc-img img{width:100%;height:100%;object-fit:cover;display:block}
      .pc-title{color:var(--purple);font-weight:800;margin:6px 0 2px;font-size:18px}
      .pc-date{font-size:12px;color:#7a719a;margin-bottom:10px}
      .pc-prize{color:#332c54;font-weight:700;font-size:13px;margin:8px 0 12px}
      .pc-count{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:0 0 10px}
      .pc-t{background:#f6f4fb;border:1px solid #e6e0ff;border-radius:10px;padding:6px}
      .pc-n{font-weight:800;color:#332c54}
      .pc-l{font-size:11px;color:#6b6691}
      .pc-price{font-weight:800;color:#332c54;margin:8px 0}
      .pc-btn{background:var(--red);color:#fff;border:none;border-radius:10px;padding:10px 14px;font-weight:800;width:100%}
      .group-title{font-size:12px;color:#6b6691;margin:2px 0 6px}
      .thumbs{display:grid;grid-template-columns:repeat(4, 1fr);gap:8px;margin-top:6px}
      .thumb{position:relative;height:64px;border:1px solid #e6e3ee;border-radius:10px;overflow:hidden;background:#fff;cursor:pointer}
      .thumb img{width:100%;height:100%;object-fit:cover;display:block}
      .thumb.sel{outline:3px solid rgba(255,87,87,.35);border-color:#ff5757}
      .empty{padding:8px;border:1px dashed #dcd6ef;border-radius:10px;color:#6b6691;font-size:12px}
      .upload-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:6px}
      .upload-btn{background:#ff5757;color:#fff;border:none;border-radius:8px;padding:6px 12px;font-weight:800;cursor:pointer;font-size:13px}
      .upload-btn:disabled{opacity:0.6;cursor:not-allowed}
      .upload-status{font-size:12px;color:#6b6691}
    </style>
  </head>
  <body>
    <div class="shell">
      <h1>Create Competition <span class="pill">Admin</span></h1>
      <div class="grid">
        <form id="compForm" class="card" method="post" action="/api/competitions">
          <input type="hidden" id="drawDateHidden" name="drawDate"/>
          <div class="row"><label>Category</label>
            <select name="category" id="cat" required>
              <option value="weekly">weekly</option>
              <option value="featured">featured</option>
              <option value="launch">launch</option>
            </select>
          </div>
          <div class="row"><label>Sport</label>
            <select name="league" id="league">
              <option value="">(optional)</option>
              <option>Premier League Football</option>
              <option>Championship Football</option>
              <option>Premiership Rugby</option>
              <option>Women's Super League</option>
              <option>Golf</option>
              <option>Tennis</option>
              <option>F1</option>
            </select>
          </div>
          <div class="row"><label>Title</label><input id="title" name="title" placeholder="e.g. Arsenal vs Manchester United or competition name" required /></div>
          <div class="row"><label>Home Team</label><input name="homeTeam" list="teams" placeholder="(optional) pick or type"/></div>
          <div class="row"><label>Away Team</label><input name="awayTeam" list="teams" placeholder="(optional) pick or type"/></div>
          <datalist id="teams">${teamOptions}</datalist>
          <div class="row"><label>Ticket price (£)</label><input id="price" name="price" type="number" min="0" step="0.01" value="3.00" required/></div>
          <div class="row"><label>Total tickets</label><input id="total" name="totalTickets" type="number" min="1" value="10000"/></div>
          <div class="row"><label>Max per user</label><input id="maxPerUser" name="maxPerUser" type="number" min="1" value="50"/></div>
          <div class="row"><label>Draw date</label><input id="drawDate" type="date" /></div>
          <div class="row"><label>Draw time (hh:mm)</label><input id="drawTime" type="time" value="19:30"/></div>
          <div class="row"><label>Match date</label><input id="date" name="date" placeholder="ISO or text (e.g. This Week)"/></div>
          <div class="row"><label>Location (city)</label><input id="venue" name="venue" placeholder="City or area"/></div>
          <div class="row"><label>Stadium</label><input id="stadium" name="stadium" placeholder="Stadium name"/></div>
          <div class="row"><label>Prize blurb</label><input id="prizeBlurb" name="prizeBlurb" placeholder="Win VIP hospitality tickets..."/></div>

          <div class="row"><label>Card image</label>
            <div style="width:100%">
              <input id="cardImage" name="cardImage" placeholder="(optional) one URL"/>
              <div class="upload-row">
                <input type="file" id="uploadFile1" accept="image/*" style="font-size:12px"/>
                <button type="button" id="uploadBtn1" class="upload-btn">Upload to Cloudinary</button>
                <span id="uploadStatus1" class="upload-status"></span>
              </div>
            </div>
          </div>
          <div class="row"><label></label>
            <div style="width:100%">
              <div class="group-title">Pick ONE for the card (from backend assets)</div>
              <div id="cardThumbs" class="thumbs"></div>
              <div id="cardEmpty" class="empty" style="display:none">No images found in fansi-backend/public/assets.</div>
            </div>
          </div>

          <div class="row"><label>Gallery images</label><textarea id="images" name="images" placeholder="(optional) one URL per line"></textarea></div>
          <div class="row"><label></label>
            <div style="width:100%">
              <div class="group-title">Pick MULTIPLE for the detail page</div>
              <div id="galleryThumbs" class="thumbs"></div>
              <div id="galleryEmpty" class="empty" style="display:none">No images found in fansi-backend/public/assets.</div>
            </div>
          </div>

          <div class="row"><label>Details list (one per line)</label>
            <textarea name="detailsItems">2 x Hospitality Tickets
VIP Seats
Half time refreshments</textarea>
          </div>

          <div class="row"><label>Status</label>
            <select name="status"><option value="live" selected>live</option><option value="draft">draft</option><option value="closed">closed</option></select>
          </div>

          <div class="actions">
            <button class="btn" type="submit">Create Competition</button>
            <a class="btn" href="/api/competitions/admin">Back to Admin List</a>
          </div>

          <p class="hint">Pick one image for the card. Click to select multiple gallery images. These are served from fansi-backend/public/assets.</p>
        </form>

        <aside class="card prev">
          <div class="pcard">
            <div class="pc-img" id="prevImg"><span class="hint">Prize</span></div>
            <div class="pc-title" id="prevTitle">Preview Title</div>
            <div class="pc-date" id="prevDate">Draw: TBC</div>
            <div class="pc-prize" id="prevPrize">Win VIP hospitality tickets...</div>
            <div class="pc-count">
              <div class="pc-t"><div class="pc-n" id="dd">--</div><div class="pc-l">Days</div></div>
              <div class="pc-t"><div class="pc-n" id="hh">--</div><div class="pc-l">Hours</div></div>
              <div class="pc-t"><div class="pc-n" id="mm">--</div><div class="pc-l">Minutes</div></div>
              <div class="pc-t"><div class="pc-n" id="ss">--</div><div class="pc-l">Seconds</div></div>
            </div>
            <div class="pc-price" id="prevPrice">£3.00</div>
            <button class="pc-btn" type="button">Enter Draw</button>
          </div>
        </aside>
      </div>
    </div>

    <script>window.__ASSETS__=${assetsJson};</script>
    <script>
      function text(id, v){ document.getElementById(id).textContent = v; }
      function fmtGBP(x){ try{ return new Intl.NumberFormat(undefined,{style:"currency",currency:"GBP",minimumFractionDigits:2}).format(x||0);}catch(e){return "£"+Number(x||0).toFixed(2);} }
      function buildISO(){ var d=document.getElementById("drawDate").value; var t=document.getElementById("drawTime").value||"19:30"; if(!d) return ""; return d+"T"+t+":00"; }
      var timer=null; function tick(){
        var iso=buildISO();
        if(!iso){["dd","hh","mm","ss"].forEach(function(k){text(k,"--")}); text("prevDate","Draw: TBC"); return;}
        var now=Date.now(); var target=new Date(iso).getTime(); var diff=Math.max(0,target-now);
        var days=Math.floor(diff/86400000); var hours=Math.floor((diff/3600000)%24); var mins=Math.floor((diff/60000)%60); var secs=Math.floor((diff/1000)%60);
        text("dd",String(days).padStart(2,"0")); text("hh",String(hours).padStart(2,"0")); text("mm",String(mins).padStart(2,"0")); text("ss",String(secs).padStart(2,"0"));
        text("prevDate","Draw: "+new Date(iso).toLocaleString());
      }
      function restart(){ if(timer) clearInterval(timer); timer=setInterval(tick,1000); tick(); }
      document.getElementById("title").addEventListener("input", function(){ text("prevTitle", this.value||"Preview Title"); });
      document.getElementById("prizeBlurb").addEventListener("input", function(){ text("prevPrize", this.value||"Win VIP hospitality tickets..."); });
      document.getElementById("price").addEventListener("input", function(){ text("prevPrice", fmtGBP(parseFloat(this.value||0))); });
      document.getElementById("drawDate").addEventListener("change", restart);
      document.getElementById("drawTime").addEventListener("input", restart);
      restart();

      // ---- Image tiles (embedded list, no fetch) ----
      var FILES = Array.isArray(window.__ASSETS__)?window.__ASSETS__:[];
      var cardWrap = null, galWrap = null;

      function addThumb(containerId, url, pickCb){
        var box=document.createElement("div");
        box.className="thumb";
        var img=document.createElement("img");
        img.src=url; img.alt="asset";
        box.appendChild(img);
        box.addEventListener("click", function(){ pickCb(box,url); });
        document.getElementById(containerId).appendChild(box);
        return box;
      }
      function clearSelected(container){
        Array.prototype.forEach.call(container.querySelectorAll(".thumb.sel"), function(n){ n.classList.remove("sel"); });
      }
      (function renderThumbs(){
        cardWrap=document.getElementById("cardThumbs");
        galWrap=document.getElementById("galleryThumbs");
        if(!FILES.length){
          document.getElementById("cardEmpty").style.display="block";
          document.getElementById("galleryEmpty").style.display="block";
          return;
        }
        FILES.forEach(function(name){
          var url="/api/competitions/assets/"+encodeURIComponent(name);

          // Card picker (single)
          addThumb("cardThumbs", url, function(box, pick){
            clearSelected(cardWrap);
            box.classList.add("sel");
            document.getElementById("cardImage").value=pick;
            var prev=document.getElementById("prevImg");
            prev.innerHTML="";
            var im=document.createElement("img"); im.src=pick; prev.appendChild(im);
          });

          // Gallery picker (multi)
          addThumb("galleryThumbs", url, function(box, pick){
            box.classList.toggle("sel");
            var ta=document.getElementById("images");
            var lines=(ta.value||"").split("\n").map(function(s){return s.trim()}).filter(Boolean);
            if(box.classList.contains("sel")){
              if(lines.indexOf(pick)===-1) lines.push(pick);
            } else {
              lines=lines.filter(function(s){return s!==pick;});
            }
            ta.value=lines.join("\n");
          });
        });
      })();

      // Manual card image URL -> preview
      document.getElementById("cardImage").addEventListener("input", function(){
        var v=(this.value||"").trim();
        var prev=document.getElementById("prevImg");
        prev.innerHTML="";
        if(!v){ prev.innerHTML='<span class="hint">Prize</span>'; return;}
        var im=document.createElement("img"); im.src=v; prev.appendChild(im);
      });

      // Ensure drawDate (ISO) is posted
      document.getElementById("compForm").addEventListener("submit", function(){
        document.getElementById("drawDateHidden").value = buildISO();
      });

      // ✅ Cloudinary upload button
      document.getElementById('uploadBtn1').addEventListener('click', async function(){
        var file = document.getElementById('uploadFile1').files[0];
        var status = document.getElementById('uploadStatus1');
        if(!file){ status.textContent='Please select a file first.'; return; }
        this.disabled=true; status.textContent='Uploading...';
        var fd = new FormData(); fd.append('image', file);
        try{
          var res = await fetch('/api/competitions/admin/upload-image',{method:'POST',body:fd});
          var data = await res.json();
          if(!res.ok) throw new Error(data.error||'Upload failed');
          document.getElementById('cardImage').value = data.url;
          status.textContent='\u2705 Uploaded!';
          var prev=document.getElementById('prevImg'); prev.innerHTML='';
          var im=document.createElement('img'); im.src=data.url; prev.appendChild(im);
        }catch(e){ status.textContent='\u274C '+e.message; }
        finally{ this.disabled=false; }
      });
    </script>
  </body>
</html>`);
});

/* ===========================================================
   EDIT FORM  —  /api/competitions/admin/competitions/:id/edit
=========================================================== */
router.get('/admin/competitions/:id/edit', async (req, res) => {
  try {
    const c = await Competition.findById(req.params.id).lean();
    if (!c) return res.status(404).send('Not found');

    const teamOptions = TEAM_OPTIONS.map(t => `<option value="${t}"></option>`).join('');
    const assets = listAssetImages();
    const assetsJson = JSON.stringify(assets);
    const imagesText = (Array.isArray(c.images) ? c.images : []).join('\n');
    const d = c.drawDate ? new Date(c.drawDate) : null;
    const dateVal = d ? String(d.toISOString()).slice(0,10) : '';
    const timeVal = d ? String(d.toISOString()).slice(11,16) : '19:30';

    res.type('html').send(`<!doctype html>
<html>
  <head>
    <meta charset="utf-8"/>
    <title>Edit Competition</title>
    <style>
      :root{--purple:#332c54;--red:#ff5757;--ink:#2b2740;--ink2:#6b6691;--paper:#f6f4fb;--line:#ece9f5}
      *{box-sizing:border-box}
      body{margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;background:var(--paper);color:var(--ink)}
      .shell{max-width:1100px;margin:24px auto;padding:0 16px}
      h1{margin:0 0 16px;font-size:28px}
      .grid{display:grid;grid-template-columns:1fr 420px;gap:20px}
      .card{background:#fff;border:1px solid var(--line);border-radius:12px;padding:14px}
      .row{display:grid;grid-template-columns:180px 1fr;gap:10px;align-items:center;margin:10px 0}
      label{color:#5b527a;font-weight:700;font-size:13px}
      input,select,textarea{padding:10px;border:1px solid #dcd6ef;border-radius:10px;width:100%;background:#fff;color:#2b2740}
      textarea{min-height:80px;resize:vertical}
      .actions{margin-top:14px;display:flex;gap:10px}
      button.btn{background:var(--red);color:#fff;border:none;border-radius:10px;padding:10px 14px;font-weight:800;cursor:pointer}
      a.btn{display:inline-block;background:#efeaff;color:#4b3c77;text-decoration:none;border-radius:10px;padding:10px 14px;font-weight:800}
      .prev{position:sticky;top:16px}
      .pcard{position:relative;border:2px solid var(--purple);border-radius:16px;padding:16px;text-align:center}
      .pc-img{margin:0 0 12px;border:1px solid var(--line);border-radius:12px;overflow:hidden;background:#fff;height:180px;display:flex;align-items:center;justify-content:center}
      .pc-img img{width:100%;height:100%;object-fit:cover;display:block}
      .pc-title{color:#332c54;font-weight:800;margin:6px 0 2px;font-size:18px}
      .pc-date{font-size:12px;color:#7a719a;margin-bottom:10px}
      .pc-count{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:0 0 10px}
      .group-title{font-size:12px;color:#6b6691;margin:2px 0 6px}
      .thumbs{display:grid;grid-template-columns:repeat(4, 1fr);gap:8px;margin-top:6px}
      .thumb{position:relative;height:64px;border:1px solid #e6e3ee;border-radius:10px;overflow:hidden;background:#fff;cursor:pointer}
      .thumb img{width:100%;height:100%;object-fit:cover;display:block}
      .thumb.sel{outline:3px solid rgba(255,87,87,.35);border-color:#ff5757}
      .upload-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:6px}
      .upload-btn{background:#ff5757;color:#fff;border:none;border-radius:8px;padding:6px 12px;font-weight:800;cursor:pointer;font-size:13px}
      .upload-btn:disabled{opacity:0.6;cursor:not-allowed}
      .upload-status{font-size:12px;color:#6b6691}
    </style>
  </head>
  <body>
    <div class="shell">
      <h1>Edit Competition</h1>
      <div class="grid">
        <form id="editForm" class="card" method="post" action="/api/competitions/${c._id}">
          <input type="hidden" id="drawDateHidden" name="drawDate"/>
          <div class="row"><label>Category</label>
            <select name="category" id="cat" required>
              <option value="weekly"${c.category==='weekly'?' selected':''}>weekly</option>
              <option value="featured"${c.category==='featured'?' selected':''}>featured</option>
              <option value="launch"${c.category==='launch'?' selected':''}>launch</option>
            </select>
          </div>
          <div class="row"><label>Sport</label>
            <select name="league" id="league">
              <option value="">(optional)</option>
              <option${c.league==='Premier League Football'?' selected':''}>Premier League Football</option>
              <option${c.league==='Championship Football'?' selected':''}>Championship Football</option>
              <option${c.league==='Premiership Rugby'?' selected':''}>Premiership Rugby</option>
              <option${c.league==="Women's Super League"?' selected':''}>Women's Super League</option>
              <option${c.league==='Golf'?' selected':''}>Golf</option>
              <option${c.league==='Tennis'?' selected':''}>Tennis</option>
              <option${c.league==='F1'?' selected':''}>F1</option>
            </select>
          </div>
          <div class="row"><label>Title</label><input id="title" name="title" value="${(c.title||'').replace(/"/g,'&quot;')}" required /></div>
          <div class="row"><label>Home Team</label><input name="homeTeam" list="teams" value="${(c.homeTeam||'').replace(/"/g,'&quot;')}" placeholder="(optional) pick or type"/></div>
          <div class="row"><label>Away Team</label><input name="awayTeam" list="teams" value="${(c.awayTeam||'').replace(/"/g,'&quot;')}" placeholder="(optional) pick or type"/></div>
          <datalist id="teams">${teamOptions}</datalist>
          <div class="row"><label>Ticket price (£)</label><input id="price" name="price" type="number" min="0" step="0.01" value="${Number(c.price||0).toFixed(2)}" required/></div>
          <div class="row"><label>Total tickets</label><input id="total" name="totalTickets" type="number" min="1" value="${c.totalTickets||10000}"/></div>
          <div class="row"><label>Max per user</label><input id="maxPerUser" name="maxPerUser" type="number" min="1" value="${c.maxPerUser||50}"/></div>
          <div class="row"><label>Draw date</label><input id="drawDate" type="date" value="${dateVal}"/></div>
          <div class="row"><label>Draw time (hh:mm)</label><input id="drawTime" type="time" value="${timeVal}"/></div>
          <div class="row"><label>Match date</label><input id="date" name="date" value="${(c.date||'').replace(/"/g,'&quot;')}" placeholder="ISO or text (e.g. This Week)"/></div>
          <div class="row"><label>Location (city)</label><input id="venue" name="venue" value="${(c.venue||'').replace(/"/g,'&quot;')}" placeholder="City or area"/></div>
          <div class="row"><label>Stadium</label><input id="stadium" name="stadium" value="${(c.stadium||'').replace(/"/g,'&quot;')}" placeholder="Stadium name"/></div>
          <div class="row"><label>Prize blurb</label><input id="prizeBlurb" name="prizeBlurb" value="${(c.prizeBlurb||'').replace(/"/g,'&quot;')}" placeholder="Win VIP hospitality tickets..."/></div>

          <div class="row"><label>Card image</label>
            <div style="width:100%">
              <input id="cardImage" name="cardImage" value="${(c.prizeImage||'').replace(/"/g,'&quot;')}" placeholder="(optional) one URL"/>
              <div class="upload-row">
                <input type="file" id="uploadFile1" accept="image/*" style="font-size:12px"/>
                <button type="button" id="uploadBtn1" class="upload-btn">Upload to Cloudinary</button>
                <span id="uploadStatus1" class="upload-status"></span>
              </div>
            </div>
          </div>
          <div class="row"><label></label>
            <div style="width:100%">
              <div class="group-title">Pick ONE for the card (from backend assets)</div>
              <div id="cardThumbs" class="thumbs"></div>
            </div>
          </div>

          <div class="row"><label>Gallery images</label><textarea id="images" name="images" placeholder="(optional) one URL per line">${imagesText}</textarea></div>
          <div class="row"><label></label>
            <div style="width:100%">
              <div class="group-title">Pick MULTIPLE for the detail page</div>
              <div id="galleryThumbs" class="thumbs"></div>
            </div>
          </div>

          <div class="row"><label>Details list (one per line)</label>
            <textarea name="detailsItems">${Array.isArray(c.detailsItems)?c.detailsItems.join('\n'):""}</textarea>
          </div>

          <div class="row"><label>Status</label>
            <select name="status">
              <option value="live"${c.status==='live'?' selected':''}>live</option>
              <option value="draft"${c.status==='draft'?' selected':''}>draft</option>
              <option value="closed"${c.status==='closed'?' selected':''}>closed</option>
            </select>
          </div>

          <div class="actions">
            <button class="btn" type="submit">Save Changes</button>
            <a class="btn" href="/api/competitions/admin">Back to Admin List</a>
          </div>
        </form>

        <aside class="card prev">
          <div class="pcard">
            <div class="pc-img" id="prevImg">${c.prizeImage?('<img src="'+c.prizeImage+'"/>'):'<span class="hint">Prize</span>'}</div>
            <div class="pc-title" id="prevTitle">${(c.title||'Preview Title')}</div>
            <div class="pc-date" id="prevDate">${c.drawDate?('Draw: '+new Date(c.drawDate).toLocaleString()):'Draw: TBC'}</div>
            <div class="pc-count">
              <div class="pc-t"><div class="pc-n" id="dd">--</div><div class="pc-l">Days</div></div>
              <div class="pc-t"><div class="pc-n" id="hh">--</div><div class="pc-l">Hours</div></div>
              <div class="pc-t"><div class="pc-n" id="mm">--</div><div class="pc-l">Minutes</div></div>
              <div class="pc-t"><div class="pc-n" id="ss">--</div><div class="pc-l">Seconds</div></div>
            </div>
          </div>
        </aside>
      </div>
    </div>

    <script>window.__ASSETS__=${assetsJson}; window.__PRIZE__=${JSON.stringify(c.prizeImage||'')}; window.__GALLERY__=${JSON.stringify(c.images||[])};</script>
    <script>
      function text(id, v){ document.getElementById(id).textContent = v; }
      function buildISO(){ var d=document.getElementById("drawDate").value; var t=document.getElementById("drawTime").value||"19:30"; if(!d) return ""; return d+"T"+t+":00"; }
      var timer=null; function tick(){
        var iso=buildISO(); if(!iso){["dd","hh","mm","ss"].forEach(function(k){text(k,"--")}); document.getElementById("prevDate").textContent="Draw: TBC"; return;}
        var now=Date.now(), target=new Date(iso).getTime(), diff=Math.max(0,target-now);
        var d=Math.floor(diff/86400000), h=Math.floor((diff/3600000)%24), m=Math.floor((diff/60000)%60), s=Math.floor((diff/1000)%60);
        document.getElementById("dd").textContent=String(d).padStart(2,"0");
        document.getElementById("hh").textContent=String(h).padStart(2,"0");
        document.getElementById("mm").textContent=String(m).padStart(2,"0");
        document.getElementById("ss").textContent=String(s).padStart(2,"0");
        document.getElementById("prevDate").textContent="Draw: "+new Date(iso).toLocaleString();
      }
      function restart(){ if(timer) clearInterval(timer); timer=setInterval(tick,1000); tick(); }
      document.getElementById("title").addEventListener("input", function(){ text("prevTitle", this.value||"Preview Title"); });
      document.getElementById("drawDate").addEventListener("change", restart);
      document.getElementById("drawTime").addEventListener("input", restart);
      restart();

      var FILES = Array.isArray(window.__ASSETS__)?window.__ASSETS__:[];
      var SELECTED_PRIZE = window.__PRIZE__ || "";
      var SELECTED_GALLERY = Array.isArray(window.__GALLERY__)?window.__GALLERY__:[];
      var cardWrap = document.getElementById("cardThumbs");
      var galWrap = document.getElementById("galleryThumbs");

      function addThumb(container, url, onClick){
        var box=document.createElement("div");
        box.className="thumb";
        var img=document.createElement("img");
        img.src=url; img.alt="asset";
        box.appendChild(img);
        box.addEventListener("click", function(){ onClick(box, url); });
        container.appendChild(box);
        return box;
      }
      function markSelected(box){ box.classList.add("sel"); }
      function clearSelected(container){
        Array.prototype.forEach.call(container.querySelectorAll(".thumb.sel"), function(n){ n.classList.remove("sel"); });
      }

      FILES.forEach(function(name){
        var url="/api/competitions/assets/"+encodeURIComponent(name);
        var b1=addThumb(cardWrap, url, function(box, pick){
          clearSelected(cardWrap); markSelected(box);
          document.getElementById("cardImage").value=pick;
          var prev=document.getElementById("prevImg"); prev.innerHTML=""; var im=document.createElement("img"); im.src=pick; prev.appendChild(im);
        });
        if (SELECTED_PRIZE && url===SELECTED_PRIZE) markSelected(b1);

        var b2=addThumb(galWrap, url, function(box, pick){
          box.classList.toggle("sel");
          var ta=document.getElementById("images");
          var lines=(ta.value||"").split("\n").map(function(s){return s.trim()}).filter(Boolean);
          if (box.classList.contains("sel")) { if (lines.indexOf(pick)===-1) lines.push(pick); }
          else { lines=lines.filter(function(s){return s!==pick}); }
          ta.value=lines.join("\n");
        });
        if (SELECTED_GALLERY.indexOf(url) !== -1) markSelected(b2);
      });

      document.getElementById("cardImage").addEventListener("input", function(){
        var v=(this.value||"").trim();
        var prev=document.getElementById("prevImg");
        prev.innerHTML="";
        if(!v){ return; }
        var im=document.createElement("img"); im.src=v; prev.appendChild(im);
      });

      document.getElementById("editForm").addEventListener("submit", function(){
        document.getElementById("drawDateHidden").value = buildISO();
      });

      // ✅ Cloudinary upload button
      document.getElementById('uploadBtn1').addEventListener('click', async function(){
        var file = document.getElementById('uploadFile1').files[0];
        var status = document.getElementById('uploadStatus1');
        if(!file){ status.textContent='Please select a file first.'; return; }
        this.disabled=true; status.textContent='Uploading...';
        var fd = new FormData(); fd.append('image', file);
        try{
          var res = await fetch('/api/competitions/admin/upload-image',{method:'POST',body:fd});
          var data = await res.json();
          if(!res.ok) throw new Error(data.error||'Upload failed');
          document.getElementById('cardImage').value = data.url;
          status.textContent='\u2705 Uploaded!';
          var prev=document.getElementById('prevImg'); prev.innerHTML='';
          var im=document.createElement('img'); im.src=data.url; prev.appendChild(im);
        }catch(e){ status.textContent='\u274C '+e.message; }
        finally{ this.disabled=false; }
      });
    </script>
  </body>
</html>`);
  } catch (err) {
    console.error('EDIT FORM error:', err);
    res.status(500).send('Edit form failed.');
  }
});

/* ===========================================================
   JSON API
=========================================================== */

router.get('/seed-sample-featured', async (_req, res) => {
  try {
    const comp = await Competition.create({
      title: "Arsenal vs Manchester United",
      league: "Premier League Football",
      category: "featured",
      homeTeam: "Arsenal",
      awayTeam: "Manchester United",
      price: 3,
      totalTickets: 10000,
      date: "2025-10-05T16:30:00",
      drawDate: "2025-09-26T19:30:00",
      venue: "London",
      stadium: "Emirates Stadium",
      prizeBlurb: "Win VIP hospitality tickets to a top fixture this week",
      prizeImage: "/api/competitions/assets/PrizeImage.jpg",
      images: ["/api/competitions/assets/stadium.jpg", "/api/competitions/assets/sports-crowd.jpg"],
      detailsItems: ["2 x Hospitality Tickets", "VIP Seats", "Half time refreshments"],
      status: "live"
    });
    res.status(201).json(comp);
  } catch (err) {
    console.error('SEED featured error:', err);
    res.status(400).json({ message: err.message });
  }
});

router.get('/seed-sample-weekly', async (_req, res) => {
  try {
    const comp = await Competition.create({
      title: "Premiership Rugby Weekly Draw",
      league: "Premiership Rugby",
      category: "weekly",
      price: 3,
      totalTickets: 10000,
      date: "This Week",
      drawDate: "2025-09-26T19:30:00",
      venue: "",
      stadium: "",
      prizeBlurb: "Win VIP hospitality tickets to a top fixture this week",
      prizeImage: "/api/competitions/assets/RugbyPrizeImage.jpg",
      images: ["/api/competitions/assets/stadium.jpg", "/api/competitions/assets/sports-crowd.jpg"],
      detailsItems: ["2 x Hospitality Tickets", "VIP Seats", "Half time refreshments"],
      status: "live"
    });
    res.status(201).json(comp);
  } catch (err) {
    console.error('SEED weekly error:', err);
    res.status(400).json({ message: err.message });
  }
});

router.get('/create-weekly', async (req, res) => {
  try {
    const {
      title,
      league = '',
      price = '3',
      date = '',
      drawDate = '',
      venue = '',
      stadium = '',
      prizeBlurb = 'Win VIP hospitality tickets to a top fixture this week',
    } = req.query || {};

    if (!title || !drawDate) {
      return res.status(400).json({
        message: "Please provide at least 'title' and 'drawDate' query params."
      });
    }

    const comp = await Competition.create({
      title, league, category: "weekly", price: Number(price),
      totalTickets: 10000, date, drawDate, venue, stadium, prizeBlurb,
      images: ["/api/competitions/assets/stadium.jpg", "/api/competitions/assets/sports-crowd.jpg"],
      status: "live"
    });
    res.status(201).json(comp);
  } catch (err) {
    console.error('CREATE weekly error:', err);
    res.status(400).json({ message: err.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const { status, category } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (category) filter.category = category;
    const comps = await Competition.find(filter).sort({ drawDate: 1, createdAt: -1 });
    res.json(comps);
  } catch (err) {
    console.error('GET /competitions error:', err);
    res.status(500).json({ message: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const comp = await Competition.findById(req.params.id);
    if (!comp) return res.status(404).json({ message: 'Competition not found' });
    res.json(comp);
  } catch (err) {
    console.error('❌ Fetch by ID error:', err);
    res.status(500).json({ message: err.message });
  }
});

router.post('/', express.urlencoded({ extended: true }), express.json(), async (req, res) => {
  try {
    const body = req.body || {};
    let images = [];
    if (Array.isArray(body.images)) { images = body.images; }
    else if (typeof body.images === 'string' && body.images.trim()) {
      images = body.images.split(/[\n,]+/).map(s => s.trim()).filter(Boolean);
    }
    const compPayload = {
      title: body.title, league: body.league || '', category: body.category,
      homeTeam: body.homeTeam || '', awayTeam: body.awayTeam || '',
      price: Number(body.price),
      totalTickets: body.totalTickets ? Number(body.totalTickets) : 10000,
      soldTickets: body.soldTickets ? Number(body.soldTickets) : 0,
      maxPerUser: body.maxPerUser ? Number(body.maxPerUser) : 50,
      date: body.date || '', drawDate: body.drawDate || '',
      venue: body.venue || '', stadium: body.stadium || '',
      prizeBlurb: body.prizeBlurb || '',
      prizeImage: body.cardImage || (images[0] || ''),
      images,
      detailsTitle: body.detailsTitle || 'Competition Details',
      detailsIntro: body.detailsIntro || 'Win Hospitality Tickets to a Top Fixture',
      detailsItems: Array.isArray(body.detailsItems) ? body.detailsItems
                  : (typeof body.detailsItems === 'string' && body.detailsItems.trim()
                      ? body.detailsItems.split("\n").map(s => s.trim()).filter(Boolean) : []),
      status: body.status || 'live', sport: body.sport || '', match: body.match || '',
      entries: body.entries ? Number(body.entries) : 0, winner: body.winner || ''
    };
    if (!compPayload.title || !compPayload.category || compPayload.price == null || Number.isNaN(compPayload.price)) {
      return res.status(400).json({ message: 'title, category and price are required' });
    }
    const comp = await Competition.create(compPayload);
    if ((req.headers['content-type'] || '').includes('application/x-www-form-urlencoded')) {
      return res.redirect('/api/competitions/admin');
    }
    res.status(201).json(comp);
  } catch (err) {
    console.error('POST /competitions error:', err);
    res.status(400).json({ message: err.message });
  }
});

router.post('/:id', express.urlencoded({ extended: true }), express.json(), async (req, res) => {
  try {
    const body = req.body || {};
    let images = [];
    if (Array.isArray(body.images)) { images = body.images; }
    else if (typeof body.images === 'string' && body.images.trim()) {
      images = body.images.split(/[\n,]+/).map(s => s.trim()).filter(Boolean);
    }
    const payload = {
      title: body.title, league: body.league || '', category: body.category,
      homeTeam: body.homeTeam || '', awayTeam: body.awayTeam || '',
      price: Number(body.price),
      totalTickets: body.totalTickets ? Number(body.totalTickets) : 10000,
      soldTickets: body.soldTickets ? Number(body.soldTickets) : 0,
      maxPerUser: body.maxPerUser ? Number(body.maxPerUser) : 50,
      date: body.date || '', drawDate: body.drawDate || '',
      venue: body.venue || '', stadium: body.stadium || '',
      prizeBlurb: body.prizeBlurb || '',
      prizeImage: body.cardImage || (images[0] || ''),
      images,
      detailsTitle: body.detailsTitle || 'Competition Details',
      detailsIntro: body.detailsIntro || 'Win Hospitality Tickets to a Top Fixture',
      detailsItems: Array.isArray(body.detailsItems) ? body.detailsItems
                  : (typeof body.detailsItems === 'string' && body.detailsItems.trim()
                      ? body.detailsItems.split("\n").map(s => s.trim()).filter(Boolean) : []),
      status: body.status || 'live', sport: body.sport || '', match: body.match || '',
      entries: body.entries ? Number(body.entries) : 0, winner: body.winner || ''
    };
    await Competition.findByIdAndUpdate(req.params.id, payload, { new: true });
    return res.redirect('/api/competitions/admin');
  } catch (err) {
    console.error('UPDATE /competitions/:id error:', err);
    res.status(400).send('Update failed: ' + err.message);
  }
});

router.post('/:id/delete', async (req, res) => {
  try {
    await Competition.findByIdAndDelete(req.params.id);
    return res.redirect('/api/competitions/admin');
  } catch (err) {
    console.error('DELETE (admin) error:', err);
    res.status(400).send('Delete failed: ' + err.message);
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const del = await Competition.findByIdAndDelete(req.params.id);
    if (!del) return res.status(404).json({ message: 'Competition not found' });
    res.json({ success: true, id: req.params.id });
  } catch (err) {
    console.error('DELETE /competitions/:id error:', err);
    res.status(400).json({ message: err.message });
  }
});

module.exports = router;