// EcoScan: ONE file for Vercel. Put it at api/index.js in your GitHub repo.
// Visiting https://YOUR-SITE.vercel.app/api opens the app (GET); scans are sent back here (POST).
// Set OPENROUTER_API_KEY (and optionally OPENROUTER_MODEL) in Vercel > Settings > Environment Variables, then redeploy.

const SYSTEM = `You are EcoScan, a recycling assistant for Singapore. You receive 1-4 photos of ONE item from different sides. Use NEA (National Environment Agency) household recycling guidelines: the blue recycling bin accepts clean, dry, empty paper, cardboard, rigid plastics (resin codes 1, 2, 5 bottles and containers), metal cans and glass bottles/jars. Not accepted: soft plastics/film/bags, food waste, greasy paper, polystyrene, drinking glass, ceramics, mirrors, light bulbs, composite/mixed-material items. Batteries, electronics, and lamps need special e-waste drop-off points. Read any visible labels and resin codes.
Respond with ONLY one JSON object, no markdown, in this shape:
{"item":"short name","material":"material and resin code if visible","status":"recyclable"|"after_prep"|"not_recyclable"|"special","status_label":"2-4 words","where":"which bin or place, short","steps":["2-4 short imperative steps"],"why":"1-2 sentences","confidence":0-100}
If the photos show no identifiable item, set item to "Unknown item", status "not_recyclable", confidence below 30, and ask for a clearer photo in why.`;

function parseJSON(t) {
  try { return JSON.parse(t); } catch (e) {}
  const m = String(t).match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch (e) {} }
  return null;
}

module.exports = async function handler(req, res) {
  if (req.method === "GET" || req.method === "HEAD") {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=0, must-revalidate");
    return res.status(200).send(PAGE);
  }
  if (req.method !== "POST") return res.status(405).json({ error: "Use GET or POST." });

  const key = process.env.OPENROUTER_API_KEY;
  if (!key) return res.status(500).json({ error: "The server has no OPENROUTER_API_KEY set." });

  const photos = req.body && req.body.photos;
  const ok = Array.isArray(photos) && photos.length >= 1 && photos.length <= 4 &&
    photos.every(p => typeof p === "string" && p.startsWith("data:image/") && p.length < 1500000);
  if (!ok) return res.status(400).json({ error: "Send 1 to 4 small images." });

  try {
    const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: "Bearer " + key, "Content-Type": "application/json", "X-Title": "EcoScan" },
      body: JSON.stringify({
        model: process.env.OPENROUTER_MODEL || "openrouter/free",
        temperature: 0.2,
        max_tokens: 900,
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: [
            { type: "text", text: `Here are ${photos.length} photo(s) of one item. Which bin does it go in, in Singapore?` },
            ...photos.map(p => ({ type: "image_url", image_url: { url: p } }))
          ] }
        ]
      })
    });
    if (r.status === 401 || r.status === 403) return res.status(502).json({ error: "OpenRouter rejected the server's key." });
    if (r.status === 429) return res.status(429).json({ error: "Free limit reached. Wait a minute and try again." });
    if (!r.ok) return res.status(502).json({ error: "The AI service returned an error (" + r.status + ")." });
    const data = await r.json();
    const msg = data.choices && data.choices[0] && data.choices[0].message;
    const out = parseJSON((msg && msg.content) || "");
    if (!out || !out.item) return res.status(502).json({ error: "Couldn't read the answer. Try clearer photos." });
    return res.status(200).json(out);
  } catch (e) {
    return res.status(502).json({ error: "Couldn't reach the AI service." });
  }
};
module.exports.config = { maxDuration: 60 };

// ===== The web page (HTML, CSS and JS) =====
const PAGE = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#fbfbf8">
<title>EcoScan</title>
<meta name="description" content="Scan everyday items and get instant, accurate recycling advice for Singapore.">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,700;9..144,800&family=Caveat:wght@600&family=DM+Sans:wght@400;500;700&display=swap" rel="stylesheet">
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' rx='22' fill='%232a5bd7'/><text x='50' y='68' font-size='56' text-anchor='middle' fill='white'>♻</text></svg>">
<style>
:root{--bg:#fbfbf8;--paper:#fff;--ink:#1e1e1e;--muted:#5d5d5d;--line:#e2e0d8;--blue:#2a5bd7;--blue-d:#1f46a8;--blue-l:#e7edfc;--red:#d94040;--yellow:#ffe14d;
--ok:#15704a;--ok-bg:#dff3e7;--warn:#7a4f00;--warn-bg:#ffefc2;--bad:#9b2525;--bad-bg:#fbe1e1;--sp:#1f46a8;--sp-bg:#e1e9fc;--cam:#0b1220;
--serif:'Fraunces',Georgia,serif;--hand:'Caveat','Comic Sans MS',cursive;--sans:'DM Sans',-apple-system,system-ui,sans-serif}
:root[data-theme="dark"]{--bg:#16161a;--paper:#1f2026;--ink:#f4f2ea;--muted:#b0aea6;--line:#34343a;--blue:#7aa0ff;--blue-d:#9ab6ff;--blue-l:#222c4a;--red:#ff8686;
--ok:#6fdca4;--ok-bg:#16332a;--warn:#ffd27a;--warn-bg:#3a2e12;--bad:#ff9a9a;--bad-bg:#3b1c1c;--sp:#9db8ff;--sp-bg:#222c4a;--cam:#05080f}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#16161a;--paper:#1f2026;--ink:#f4f2ea;--muted:#b0aea6;--line:#34343a;--blue:#7aa0ff;--blue-d:#9ab6ff;--blue-l:#222c4a;--red:#ff8686;
--ok:#6fdca4;--ok-bg:#16332a;--warn:#ffd27a;--warn-bg:#3a2e12;--bad:#ff9a9a;--bad-bg:#3b1c1c;--sp:#9db8ff;--sp-bg:#222c4a;--cam:#05080f}}
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
:root{padding-top:env(safe-area-inset-top,0px)}
html{scroll-padding-top:env(safe-area-inset-top,0px)}
body{margin:0;background:var(--bg);color:var(--ink);font-family:var(--sans);line-height:1.5;-webkit-font-smoothing:antialiased}
body::before{content:"";position:fixed;inset:0 0 auto;height:env(safe-area-inset-top,0px);background:var(--bg);z-index:6}
button,input{font:inherit;color:inherit}button{cursor:pointer}
:focus-visible{outline:3px solid var(--blue);outline-offset:3px;border-radius:8px}
.app{max-width:520px;margin:0 auto;min-height:100vh;min-height:100dvh;background:var(--bg);display:flex;flex-direction:column}
@media (min-width:560px){body{background:#efede3}.app{border-inline:2px solid var(--ink)}}
.top{position:sticky;top:env(safe-area-inset-top,0px);z-index:5;display:flex;align-items:center;justify-content:space-between;padding:12px 16px;background:var(--bg);border-bottom:2px solid var(--ink)}
.brand{display:flex;align-items:center;gap:10px;font-family:var(--serif);font-weight:800;font-size:1.4rem;letter-spacing:-.01em}
.logo{width:34px;height:34px;border-radius:10px;background:var(--blue);display:grid;place-items:center;border:2px solid var(--ink)}
.xp{background:var(--yellow);color:#1e1e1e;font-weight:700;font-size:.82rem;padding:5px 13px;border-radius:99px;border:2px solid var(--ink)}
main{flex:1;padding:22px 16px calc(100px + env(safe-area-inset-bottom,0px))}
.screen[hidden]{display:none}
h2{margin:0 0 6px;font-family:var(--serif);font-weight:800;font-size:2rem;line-height:1.05;letter-spacing:-.015em}
.sq::after{content:"";display:block;width:150px;height:10px;margin-top:8px;background:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 150 10'%3E%3Cpath d='M2 6c20-4 30 3 50 0s32-5 52-1 32 2 44-2' stroke='%23d94040' stroke-width='3.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E") no-repeat}
.sub{margin:12px 0 18px;color:var(--muted)}
.card{background:var(--paper);border:2px solid var(--ink);border-radius:18px;padding:14px;margin-bottom:14px}
.view{position:relative;background:var(--cam);border-radius:10px;aspect-ratio:4/3;overflow:hidden;display:grid;place-items:center;color:#9fb0cc;text-align:center}
.view video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.guide{position:absolute;left:50%;top:9%;width:30%;height:70%;transform:translateX(-50%);border:2px solid rgba(255,255,255,.75);border-radius:16px;pointer-events:none}
.thumbs{position:absolute;inset:0;display:grid;grid-template-columns:1fr 1fr;gap:2px;background:var(--cam)}
.thumbs img{width:100%;height:100%;object-fit:cover}
.tag{position:absolute;left:12px;bottom:12px;background:#fff;color:#1e1e1e;font-weight:700;font-size:.9rem;padding:7px 14px;border-radius:10px;max-width:88%}
.steps{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:14px 0 8px}
.steps div{font-size:.78rem;font-weight:700;color:var(--muted);border-top:6px solid var(--line);border-radius:4px;padding-top:6px}
.steps div.on{color:var(--ink);border-color:var(--blue)}
.steps div.done{color:var(--ink);border-color:var(--ink)}
.btn{display:flex;align-items:center;justify-content:center;gap:10px;width:100%;border-radius:14px;padding:13px;font-weight:700;border:2px solid var(--ink);background:var(--paper);margin-top:12px;box-shadow:0 3px 0 var(--ink);transition:transform .08s,box-shadow .08s}
.btn:active{transform:translateY(2px);box-shadow:0 1px 0 var(--ink)}
.btn.p{background:var(--blue);color:#fff}
.btn:disabled{opacity:.55}
.btn svg{width:18px;height:18px}
.lookup{display:flex;gap:10px;margin-top:18px;align-items:center}
.lookup input{flex:1;min-width:0;padding:12px 14px;border:2px solid var(--ink);border-radius:14px;background:var(--bg)}
.lookup .btn{width:auto;margin:0;padding:11px 18px}
.msg{font-size:.9rem;padding:11px 13px;border-radius:12px;background:var(--bad-bg);color:var(--bad);margin-top:14px;border:2px solid var(--bad)}
.award{background:var(--yellow);color:#1e1e1e;font-weight:700;padding:9px 14px;border-radius:12px;margin-bottom:14px;border:2px solid var(--ink)}
.res{padding:0;overflow:hidden}
.res .head{display:flex;gap:12px;align-items:center;padding:16px;font-family:var(--serif);font-weight:800;font-size:1.25rem;border-bottom:2px solid var(--ink)}
.res .ico{width:40px;height:40px;border-radius:50%;background:#fff;color:inherit;display:grid;place-items:center;flex:none;border:2px solid currentColor}
.res .ico svg{width:20px;height:20px}
.res.recyclable .head{background:var(--ok-bg);color:var(--ok)}
.res.after_prep .head{background:var(--warn-bg);color:var(--warn)}
.res.not_recyclable .head{background:var(--bad-bg);color:var(--bad)}
.res.special .head{background:var(--sp-bg);color:var(--sp)}
.res .body{padding:6px 16px 16px}
.lab{font-family:var(--hand);font-weight:600;font-size:1.35rem;color:var(--red);margin:14px 0 0;line-height:1.1}
.itm{font-family:var(--serif);font-size:1.8rem;font-weight:800;line-height:1.1;margin-top:4px}
.mat{color:var(--muted);font-size:.92rem}
.res ul{list-style:none;padding:0;margin:6px 0 0}
.res li{padding-left:28px;position:relative;margin:7px 0}
.res li::before{content:"";position:absolute;left:3px;top:.35em;width:12px;height:7px;border-left:2.5px solid var(--ok);border-bottom:2.5px solid var(--ok);transform:rotate(-45deg)}
.bar{height:10px;background:var(--line);border-radius:9px;overflow:hidden;margin-top:8px;border:2px solid var(--ink)}
.bar i{display:block;height:100%;background:var(--ink)}
.foot{font-size:.84rem;color:var(--muted);padding:13px 16px;border-top:2px solid var(--ink)}
.art{display:block;width:100%;text-align:left;background:var(--paper);border:2px solid var(--ink);border-radius:16px;padding:14px;margin-bottom:12px}
.art .row{display:flex;justify-content:space-between;align-items:center}
.chip{background:var(--blue-l);color:var(--blue);font-size:.76rem;font-weight:700;padding:3px 11px;border-radius:99px;border:2px solid var(--ink);color:var(--ink)}
.read{font-size:.82rem;font-weight:700;color:var(--ok)}
.read.new{color:var(--blue)}
.art h3{margin:10px 0 0;font-family:var(--serif);font-size:1.2rem;font-weight:800;line-height:1.2}
.art p{margin:8px 0 0;color:var(--muted)}
.art[aria-expanded="false"] p{display:none}
.catbox{background:var(--blue-l);border-radius:12px;padding:14px 10px 4px;display:grid;place-items:center;border:2px solid var(--ink)}
.catbox svg{width:190px;height:auto}
.speech{background:var(--bg);border:2px solid var(--ink);border-radius:14px;padding:10px 14px;font-weight:700;margin:12px 0}
.lvl{display:flex;justify-content:space-between;align-items:center;gap:8px}
.lvl b{font-family:var(--serif);font-size:1.5rem;font-weight:800}
.catbar{height:10px;background:var(--bg);border-radius:9px;overflow:hidden;margin:10px 0 8px;border:2px solid var(--ink)}
.catbar i{display:block;height:100%;background:var(--blue);transition:width .4s}
.stats{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:6px}
.stat{background:var(--paper);border:2px solid var(--ink);border-radius:14px;padding:10px 14px}
.stat b{display:block;font-family:var(--serif);font-size:1.9rem;font-weight:800;line-height:1.1}
.stat span{color:var(--muted);font-size:.84rem}
.cl{display:grid;gap:8px}
.cl div{display:flex;justify-content:space-between;border:2px solid var(--ink);border-radius:12px;padding:9px 14px;font-weight:700;background:var(--paper)}
.cl div.lock{border-color:var(--line);color:var(--muted);font-weight:500}
.cl div.cur{background:var(--yellow);color:#1e1e1e}
.tabs{position:fixed;left:50%;transform:translateX(-50%);bottom:0;width:100%;max-width:520px;display:flex;background:var(--bg);border-top:2px solid var(--ink);padding-bottom:env(safe-area-inset-bottom,0px);z-index:5}
.tabs button{flex:1;background:none;border:0;padding:10px 0 12px;color:var(--muted);font-weight:700;font-size:.8rem;display:grid;gap:3px;justify-items:center;position:relative}
.tabs button[aria-selected="true"]{color:var(--blue)}
.tabs button[aria-selected="true"]::before{content:"";position:absolute;top:-2px;left:25%;right:25%;height:4px;background:var(--blue);border-radius:0 0 4px 4px}
.tabs svg{width:22px;height:22px}
@media (prefers-reduced-motion:reduce){*{transition:none!important}}
</style>
</head>
<body>

<svg width="0" height="0" style="position:absolute" aria-hidden="true">
  <symbol id="cat" viewBox="0 0 360 400">
    <polygon points="30,40 112,100 20,128" fill="#ff9d3b"/><polygon points="46,70 86,98 42,110" fill="#ff8fb1"/>
    <polygon points="330,40 248,100 340,128" fill="#ff9d3b"/><polygon points="314,70 274,98 318,110" fill="#ff8fb1"/>
    <ellipse cx="180" cy="175" rx="150" ry="132" fill="#ff9d3b"/>
    <g stroke="#d9770f" stroke-width="10" stroke-linecap="round"><path d="M140 72v30M180 68v36M220 72v30"/></g>
    <ellipse cx="125" cy="190" rx="30" ry="38" fill="#111"/><ellipse cx="235" cy="190" rx="30" ry="38" fill="#111"/>
    <circle cx="115" cy="174" r="9" fill="#fff"/><circle cx="225" cy="174" r="9" fill="#fff"/>
    <circle cx="135" cy="203" r="5" fill="#fff"/><circle cx="245" cy="203" r="5" fill="#fff"/>
    <path d="M170 228h20l-10 12z" fill="#ff8fb1"/><path d="M162 248q18 14 36 0" stroke="#111" stroke-width="4" fill="none" stroke-linecap="round"/>
    <g stroke="#999" stroke-width="4" stroke-linecap="round"><path d="M18 220l72 8M18 250l76-8M342 220l-72 8M342 250l-76-8"/></g>
    <rect x="42" y="300" width="276" height="96" rx="16" fill="#2a5bd7"/>
    <g stroke="#2146a8" stroke-width="6" stroke-linecap="round"><path d="M82 322v50M130 322v50M230 322v50M278 322v50"/></g>
    <rect x="24" y="282" width="312" height="30" rx="12" fill="#2146a8"/>
    <ellipse cx="110" cy="284" rx="36" ry="17" fill="#ff9d3b"/><ellipse cx="250" cy="284" rx="36" ry="17" fill="#ff9d3b"/>
    <circle cx="180" cy="352" r="26" fill="#ffe14d"/>
  </symbol>
</svg>

<div class="app">
  <header class="top">
    <div class="brand"><span class="logo"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M17 2l4 4-4 4"/><path d="M3 11V9a3 3 0 013-3h15"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v2a3 3 0 01-3 3H3"/></svg></span>EcoScan</div>
    <div class="right">
      <button class="xp" id="xpPill" aria-label="Open cats">Level 1 · 0 XP</button>
    </div>
  </header>

  <main>
    <!-- SCAN -->
    <section class="screen" id="s-scan">
      <div id="scanArea">
        <h2 class="sq">Check if it can be recycled</h2>
        <p class="sub">Rotate a bottle in front of your camera. EcoScan reads it from four sides and checks it against NEA recycling guidelines.</p>
        <div class="card">
          <div class="view" id="view">
            <span id="viewTxt" style="padding:20px;font-size:.92rem">Camera is off. Start a scan or upload photos.</span>
            <video id="vid" playsinline muted hidden></video>
            <div class="guide" id="guide"></div>
            <div class="thumbs" id="thumbs" hidden></div>
            <div class="tag" id="tag" hidden></div>
          </div>
          <div class="steps" id="steps"><div class="on">Front</div><div>Side</div><div>Back</div><div>Cap or base</div></div>
          <button class="btn p" id="startBtn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg><span id="startTxt">Start 360 scan</span></button>
          <button class="btn" id="upBtn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>Upload photos</button>
          <button class="btn p" id="goBtn" hidden>Check this item</button>
          <button class="btn" id="resetBtn" hidden>Clear photos</button>
          <input type="file" id="file" accept="image/*" multiple hidden>
          <div class="lookup"><input id="q" type="text" placeholder="Or type an item, e.g. glass jar" aria-label="Item name"><button class="btn" id="qBtn">Look up</button></div>
          <div class="msg" id="err" hidden></div>
        </div>
      </div>
      <div id="result"></div>
    </section>

    <!-- LEARN -->
    <section class="screen" id="s-learn" hidden>
      <h2 class="sq">Learn the rules</h2>
      <p class="sub">Short reads on what goes where. Each new article earns 15 XP toward your next cat.</p>
      <div id="articles"></div>
    </section>

    <!-- CATS -->
    <section class="screen" id="s-cats" hidden>
      <div class="card">
        <div class="catbox"><svg viewBox="0 0 360 400" role="img" aria-label="Your cat in a recycling bin"><use href="#cat"/></svg></div>
        <div class="speech" id="speech">Nice, that goes in the blue bin.</div>
        <div class="lvl"><b id="catName">Huh Cat</b><span class="chip" id="catLvl">Level 1</span></div>
        <div class="sub" id="catDesc" style="margin:2px 0 0"></div>
        <div class="catbar"><i id="catBar" style="width:0"></i></div>
        <div class="sub" id="catNext" style="margin:0"></div>
      </div>
      <div class="stats" id="stats"></div>
      <div class="lab" style="margin:20px 0 8px">Cats to unlock</div>
      <div class="cl" id="catList"></div>
      <button class="btn" id="wipe" style="margin-top:18px">Reset progress</button>
    </section>
  </main>

  <nav class="tabs" role="tablist" aria-label="App sections">
    <button role="tab" aria-selected="true" data-t="scan"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>Scan</button>
    <button role="tab" aria-selected="false" data-t="learn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 016.5 17H20V3H6.5A2.5 2.5 0 004 5.5z"/><path d="M4 19.5A2.5 2.5 0 006.5 22H20v-5"/></svg>Learn</button>
    <button role="tab" aria-selected="false" data-t="cats"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="4" r="2"/><circle cx="18" cy="8" r="2"/><circle cx="4" cy="8" r="2"/><path d="M12 22c-4 0-7-2-7-5 0-2 2-4 4-5l3-1 3 1c2 1 4 3 4 5 0 3-3 5-7 5z"/></svg>Cats</button>
  </nav>
</div>

<script>
"use strict";
/* ============ CONFIG ============ */
const SCAN_XP = 25, ARTICLE_XP = 15;
const CATS = [
  {n:"Huh Cat",xp:0,d:"Confused, but trying his best."},
  {n:"Banana Cat",xp:40,d:"Peels back the rules, one scan at a time."},
  {n:"Popcat",xp:100,d:"Every correct bin gets a pop."},
  {n:"Maxwell",xp:200,d:"Spinning toward a cleaner island."},
  {n:"Chipi Chipi",xp:340,d:"Sorting to the beat."},
  {n:"Nyan Cat",xp:520,d:"Recycling legend. Rainbow optional."}
];
const ARTICLES = [
  {id:"basics",tag:"Basics",t:"Clean, dry, empty",b:"Recyclables go in the blue bin only when they are clean, dry and empty. Food and liquid left inside can spoil a whole bag of paper and plastic. A quick rinse and a shake dry is enough. Don't bag your recyclables; put them in loose."},
  {id:"plastic",tag:"Plastic",t:"Plastic bottles are in",b:"Rigid plastic bottles and containers (like PET drink bottles and HDPE milk or detergent bottles) can go in the blue bin once rinsed. Soft, stretchy plastics such as cling film, snack wrappers and plastic bags are generally not accepted. Check the resin code on the base."},
  {id:"glass",tag:"Glass",t:"Glass: bottles and jars only",b:"Bottles and jars can be recycled. Drinking glasses, mirrors, ceramics and light bulbs melt at different temperatures and contaminate recycled glass, so they belong in general waste (or special drop-off for bulbs)."},
  {id:"paper",tag:"Paper",t:"Paper and cardboard",b:"Clean paper, newspapers and flattened cardboard boxes are accepted. Greasy or food-soiled paper, like the bottom of a pizza box, is not. Remove tape and plastic where you can, and flatten boxes to save space."},
  {id:"battery",tag:"Batteries",t:"Batteries are not blue-bin items",b:"Batteries and small electronics can start fires in collection trucks and need proper drop-off. Look for e-waste and battery collection points at retailers and public locations listed on nea.gov.sg."},
  {id:"food",tag:"Food",t:"Food waste is not recyclable",b:"Leftover food and wet waste don't go in the blue bin. They go in general waste unless your estate or building runs a food waste scheme. Keeping food out of your recyclables keeps everything else clean."}
];

/* ============ STATE ============ */
const $ = s => document.querySelector(s);
const store = {
  get(k,d){try{const v=localStorage.getItem(k);return v===null?d:JSON.parse(v)}catch(e){return d}},
  set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}
};
const blank = () => ({xp:0,scans:0,read:[],byStatus:{recyclable:0,after_prep:0,not_recyclable:0,special:0}});
let state = {...blank(),...store.get("ecoscan_state",{})};
const save = () => store.set("ecoscan_state",state);
const levelOf = xp => CATS.reduce((l,c,i)=>xp>=c.xp?i:l,0);
const esc = s => String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

let photos = [], stream = null, count = 3, timer = null;
const LABELS = ["Show the front label","Turn to the side","Show the back","Show the cap or base"];

/* ============ TABS & XP ============ */
function showTab(t){
  document.querySelectorAll(".tabs button").forEach(b=>b.setAttribute("aria-selected",b.dataset.t===t));
  ["scan","learn","cats"].forEach(n=>$("#s-"+n).hidden = n!==t);
  if(t!=="scan") stopCam();
  if(t==="cats") renderCats();
  window.scrollTo(0,0);
}
document.querySelectorAll(".tabs button").forEach(b=>b.onclick=()=>showTab(b.dataset.t));
$("#xpPill").onclick=()=>showTab("cats");
function renderXP(){ $("#xpPill").textContent = \`Level \${levelOf(state.xp)+1} · \${state.xp} XP\`; }
function addXP(n){
  const before = levelOf(state.xp);
  state.xp += n; save(); renderXP();
  const after = levelOf(state.xp);
  return after>before ? CATS[after].n : null;
}

/* ============ CAMERA / PHOTOS ============ */
function renderPhotos(){
  const n = photos.length, th = $("#thumbs");
  th.innerHTML = photos.map(p=>\`<img src="\${p}" alt="Captured photo">\`).join("");
  th.hidden = !n || !!stream;
  $("#guide").hidden = !th.hidden;
  $("#viewTxt").hidden = n>0 || !!stream;
  [...$("#steps").children].forEach((el,i)=>{el.className = i<n?"done":(i===n&&n<4?"on":"")});
  $("#resetBtn").hidden = !n;
  $("#goBtn").hidden = !n || !!stream;
  $("#upBtn").hidden = !!stream;
  $("#startTxt").textContent = stream ? "Stop scan" : (n?"Scan again":"Start 360 scan");
  const tag = $("#tag"); tag.hidden = !stream;
  if(stream) tag.textContent = \`\${LABELS[Math.min(n,3)]} (\${Math.max(count,0)})\`;
}
function stopCam(){
  clearTimeout(timer);
  if(stream){stream.getTracks().forEach(t=>t.stop());stream=null}
  $("#vid").hidden = true; $("#vid").srcObject = null;
  renderPhotos();
}
function shrink(src,max=800){
  return new Promise(res=>{
    const img = new Image();
    img.onload=()=>{
      const r = Math.min(1,max/Math.max(img.width,img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width*r); c.height = Math.round(img.height*r);
      c.getContext("2d").drawImage(img,0,0,c.width,c.height);
      res(c.toDataURL("image/jpeg",.8));
    };
    img.src = src;
  });
}
async function capture(){
  const v = $("#vid"); if(!v.videoWidth) return;
  const c = document.createElement("canvas");
  c.width = v.videoWidth; c.height = v.videoHeight;
  c.getContext("2d").drawImage(v,0,0);
  photos.push(await shrink(c.toDataURL("image/jpeg",.9)));
}
function tick(){
  if(!stream) return;
  if(count>0){ renderPhotos(); count--; timer=setTimeout(tick,1000); }
  else capture().then(()=>{ if(photos.length>=4) stopCam(); else { count=3; tick(); } });
}
async function startCam(){
  showErr(); photos=[]; $("#result").innerHTML="";
  try{
    stream = await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:"environment"}},audio:false});
    const v = $("#vid"); v.srcObject = stream; v.hidden = false; await v.play();
    count = 3; tick();
  }catch(e){
    stream = null; renderPhotos();
    showErr("Camera unavailable. Allow camera access in Safari settings, or use Upload photos or type the item below.");
  }
}
$("#startBtn").onclick = ()=> stream ? stopCam() : startCam();
$("#upBtn").onclick = ()=>$("#file").click();
$("#file").onchange = async e=>{
  showErr();
  const files = [...e.target.files].slice(0,4-photos.length);
  for(const f of files){
    const url = await new Promise(r=>{const fr=new FileReader();fr.onload=()=>r(fr.result);fr.readAsDataURL(f)});
    photos.push(await shrink(url));
  }
  e.target.value=""; renderPhotos();
};
$("#resetBtn").onclick = ()=>{photos=[];showErr();stopCam()};
function showErr(m){ const el=$("#err"); if(!m){el.hidden=true;return} el.hidden=false; el.textContent=m; }

/* ============ AI (your Vercel function at /api/scan holds the key) ============ */
async function analyse(){
  const btn=$("#goBtn"); btn.disabled=true; btn.textContent="Checking…"; showErr();
  try{
    const ctl=new AbortController(); const to=setTimeout(()=>ctl.abort(),60000);
    const r=await fetch("/api",{method:"POST",headers:{"Content-Type":"application/json"},signal:ctl.signal,body:JSON.stringify({photos})});
    clearTimeout(to);
    let data={}; try{data=await r.json()}catch(e){}
    if(!r.ok||!data.item) throw new Error(r.status===404?"Photo scan isn't set up on this page.":(data.error||\`Scan failed (\${r.status}).\`));
    showResult(data);
  }catch(e){
    showErr((e.name==="AbortError"?"The scan took too long.":/fetch/i.test(e.message)?"Couldn't reach the scanner.":e.message)+" You can type the item name below instead.");
  }finally{btn.disabled=false;btn.textContent="Check this item"}
}
$("#goBtn").onclick = analyse;

/* ============ RESULT ============ */
const ICONS = {
  recyclable:'<path d="M5 12l5 5 9-10"/>',
  after_prep:'<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18v.5"/>',
  not_recyclable:'<path d="M6 6l12 12M18 6L6 18"/>',
  special:'<path d="M12 8v5M12 16v.5"/><circle cx="12" cy="12" r="9"/>'
};
function showResult(o){
  const st = ICONS[o.status] ? o.status : "not_recyclable";
  const conf = Math.max(0,Math.min(100,Math.round(+o.confidence||0)));
  state.scans++; state.byStatus[st]=(state.byStatus[st]||0)+1;
  const up = addXP(SCAN_XP);
  const steps = Array.isArray(o.steps)?o.steps:[];
  $("#result").innerHTML = \`
    <div class="award">+\${SCAN_XP} XP\${up?\` · New cat unlocked: \${esc(up)}!\`:""}</div>
    <div class="card res \${st}">
      <div class="head"><span class="ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">\${ICONS[st]}</svg></span>\${esc(o.status_label||st.replace("_"," "))}</div>
      <div class="body">
        <div class="lab">Item</div><div class="itm">\${esc(o.item)}</div><div class="mat">\${esc(o.material)}</div>
        <div class="lab">Where it goes</div><div>\${esc(o.where)}</div>
        \${steps.length?\`<div class="lab">What to do</div><ul>\${steps.map(s=>\`<li>\${esc(s)}</li>\`).join("")}</ul>\`:""}
        <div class="lab">Why</div><div>\${esc(o.why)}</div>
        <div class="lab">Confidence · \${conf}%</div><div class="bar" role="progressbar" aria-valuenow="\${conf}" aria-valuemin="0" aria-valuemax="100"><i style="width:\${conf}%"></i></div>
      </div>
      <div class="foot">Based on NEA recycling guidelines. Rules can change, so confirm at nea.gov.sg if you're unsure.</div>
    </div>
    <button class="btn p" id="again">Scan another item</button>\`;
  $("#scanArea").hidden = true;
  $("#again").onclick = ()=>{photos=[];$("#result").innerHTML="";$("#scanArea").hidden=false;renderPhotos();window.scrollTo(0,0)};
  speak(st);
  window.scrollTo(0,0);
}
function speak(st){
  $("#speech").textContent = {recyclable:"Nice, that goes in the blue bin.",after_prep:"Rinse it first, then it goes in the blue bin.",not_recyclable:"Not this time. That one goes in general waste.",special:"Careful! That needs a special drop-off."}[st];
}

/* ============ OFFLINE LOOKUP (no AI needed) ============ */
const E = (k,item,material,status,status_label,where,steps,why)=>({k,item,material,status,status_label,where,steps,why,confidence:90});
const DB = [
 E(["pet","water bottle","plastic bottle","bottle","soft drink","mineral water","drink bottle"],"PET water bottle","PET plastic · resin code 1","after_prep","Recyclable after prep","Blue recycling bin, after you rinse it",["Pour out what's left","Rinse it and let it dry","Put it in the blue bin"],"Singapore's blue bin takes clean, dry plastic bottles. Liquid left inside can spoil other recyclables."),
 E(["detergent","shampoo","hdpe","milk bottle","laundry"],"Detergent or milk bottle","HDPE plastic · resin code 2","after_prep","Recyclable after prep","Blue recycling bin, after you rinse it",["Empty it fully","Rinse and let it dry","Put it in the blue bin"],"Rigid plastic containers are accepted when clean and dry."),
 E(["can","aluminium can","aluminum can","soda can","drink can","tin can","tin"],"Metal can","Aluminium or steel","after_prep","Recyclable after prep","Blue recycling bin",["Empty it","Give it a quick rinse","Put it in the blue bin"],"Metal cans are accepted when empty and free of food."),
 E(["cardboard","box","parcel","carton box"],"Cardboard box","Cardboard","after_prep","Recyclable after prep","Blue recycling bin",["Remove tape and plastic where you can","Flatten the box","Put it in the blue bin"],"Clean, dry cardboard is accepted. Flattening saves space."),
 E(["paper","newspaper","magazine","office paper","book","envelope","flyer"],"Paper","Paper","recyclable","Recyclable","Blue recycling bin",["Keep it clean and dry","Put it in loose, not in a bag"],"Clean, dry paper is accepted."),
 E(["glass","jar","glass bottle","wine bottle","sauce jar"],"Glass bottle or jar","Glass","after_prep","Recyclable after prep","Blue recycling bin",["Empty it","Rinse it","Put it in the blue bin"],"Glass bottles and jars are accepted when clean."),
 E(["drinking glass","glassware","ceramic","mug","plate","bowl","mirror","cup"],"Drinking glass, ceramic or mirror","Mixed glass or ceramic","not_recyclable","Not recyclable","General waste",["Wrap broken pieces safely","Put it in general waste"],"These melt at different temperatures and contaminate recycled glass."),
 E(["plastic bag","cling film","cling wrap","film","snack wrapper","wrapper","chip bag","sachet","bubble wrap"],"Soft plastic or wrapper","Soft plastic film","not_recyclable","Not recyclable","General waste",["Put it in general waste","Reuse bags where you can"],"Soft, stretchy plastics are generally not accepted in the blue bin."),
 E(["styrofoam","polystyrene","foam","takeaway box"],"Styrofoam","Polystyrene foam · resin code 6","not_recyclable","Not recyclable","General waste",["Put it in general waste"],"Foam is generally not accepted in the blue bin."),
 E(["coffee cup","paper cup","disposable cup","takeaway cup"],"Disposable cup","Paper with plastic lining","not_recyclable","Not recyclable","General waste",["Empty it","Put it in general waste"],"The plastic lining makes it a mixed material."),
 E(["pizza","greasy","oily","food stained","soiled paper"],"Greasy or food-soiled paper","Paper with food","not_recyclable","Not recyclable","General waste",["Tear off any clean part to recycle","Put the soiled part in general waste"],"Grease and food ruin paper recycling."),
 E(["food","leftover","leftovers","fruit peel","peel","scraps","rice","bones"],"Food waste","Organic waste","not_recyclable","Not for the blue bin","General waste, or your estate's food waste scheme",["Drain liquids","Bag it and bin it"],"Food waste contaminates recyclables."),
 E(["battery","batteries"],"Battery","Battery","special","Special drop-off","An e-waste or battery collection point",["Don't put it in any bin","Tape the terminals of big batteries","Drop it at a collection point"],"Batteries can start fires in collection trucks."),
 E(["phone","charger","laptop","cable","electronic","electronics","e-waste","ewaste","appliance","headphone","headphones","power bank"],"Electronic item","E-waste","special","Special drop-off","An e-waste collection point",["Don't put it in any bin","Find a drop-off point on nea.gov.sg"],"Electronics contain materials that need proper handling."),
 E(["bulb","lamp","light bulb","fluorescent"],"Light bulb or lamp","Glass, metal, mixed","special","Special drop-off","A lamp collection point",["Don't put it in the blue bin","Find a drop-off point on nea.gov.sg"],"Bulbs melt at different temperatures and need special handling."),
 E(["clothes","shirt","textile","shoe","shoes","jeans"],"Clothes and textiles","Fabric","special","Donate or textile bin","A donation point or textile bin",["Wash and dry it","Donate it if it's still wearable"],"Textiles don't go in the blue bin.")
];
function lookup(q){
  q=q.toLowerCase().trim(); if(!q) return null;
  let best=null,len=0;
  for(const e of DB) for(const k of e.k){
    if(k.length>len && new RegExp("\\\\b"+k.replace(/[.*+?^\${}()|[\\]\\\\]/g,"\\\\$&")+"s?\\\\b").test(q)){best=e;len=k.length}
  }
  return best;
}
$("#qBtn").onclick = ()=>{
  const hit = lookup($("#q").value);
  if(!hit){showErr("Not in the built-in list. Try a word like bottle, can, paper or battery.");return}
  showErr(); const {k,...o}=hit; showResult(o);
};
$("#q").addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();$("#qBtn").click()}});

/* ============ LEARN ============ */
function renderArticles(){
  $("#articles").innerHTML = ARTICLES.map(a=>{
    const read = state.read.includes(a.id);
    return \`<button class="art" data-id="\${a.id}" aria-expanded="false">
      <div class="row"><span class="chip g">\${a.tag}</span>\${read?'<span class="read">✓ Read</span>':'<span class="read new">+15 XP</span>'}</div>
      <h3>\${a.t}</h3><p>\${a.b}</p></button>\`;
  }).join("");
  document.querySelectorAll(".art").forEach(b=>b.onclick=()=>{
    const open = b.getAttribute("aria-expanded")==="true";
    b.setAttribute("aria-expanded",!open);
    const id = b.dataset.id;
    if(!open && !state.read.includes(id)){
      state.read.push(id);
      const up = addXP(ARTICLE_XP);
      const r = b.querySelector(".read"); r.className="read";
      r.textContent = \`✓ Read · +\${ARTICLE_XP} XP\${up?\` · \${up} unlocked!\`:""}\`;
      save();
    }
  });
}

/* ============ CATS / STATS ============ */
function renderCats(){
  const l = levelOf(state.xp), c = CATS[l], nx = CATS[l+1];
  $("#catName").textContent = c.n; $("#catLvl").textContent = "Level "+(l+1); $("#catDesc").textContent = c.d;
  $("#catBar").style.width = (nx ? ((state.xp-c.xp)/(nx.xp-c.xp))*100 : 100)+"%";
  $("#catNext").textContent = nx ? \`\${nx.xp-state.xp} XP until \${nx.n}\` : "Max level reached.";
  const good = (state.byStatus.recyclable||0)+(state.byStatus.after_prep||0);
  $("#stats").innerHTML = [[state.scans,"Items scanned"],[good,"Items recyclable"],[state.read.length+"/"+ARTICLES.length,"Articles read"],[state.xp,"Total XP"]]
    .map(([n,t])=>\`<div class="stat"><b>\${n}</b><span>\${t}</span></div>\`).join("");
  $("#catList").innerHTML = CATS.map((k,i)=>\`<div class="\${i===l?"cur":i>l?"lock":""}"><span>\${k.n}</span><span>\${k.xp} XP</span></div>\`).join("");
}
let wipeArm=false;
$("#wipe").onclick = ()=>{
  if(!wipeArm){wipeArm=true;$("#wipe").textContent="Tap again to reset everything";setTimeout(()=>{wipeArm=false;$("#wipe").textContent="Reset progress"},4000);return}
  wipeArm=false;$("#wipe").textContent="Reset progress";
  state=blank(); save(); renderXP(); renderArticles(); renderCats();
};

/* ============ INIT ============ */
renderXP(); renderArticles(); renderPhotos();
</script>
</body>
</html>
`;
