/* Sharing = Caring
   Plain JavaScript on top of Supabase. Who may see what is enforced by the database rules in schema.sql,
   so this file only decides what to show. */

const SUPABASE_URL = 'https://pggxllvyjcckkdscgzll.supabase.co';
const SUPABASE_KEY = 'sb_publishable_DZ5mCJZOnkUh9_gS_waXeQ_mgjKKLge';
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
const APP_URL = location.origin + location.pathname;

/* Invites: a personal link (?from=<id>&n=<name>) remembers who invited you, so they can be suggested as a friend */
const store = { get:k => { try { return localStorage.getItem(k); } catch { return null; } }, set:(k, v) => { try { localStorage.setItem(k, v); } catch {} }, del:k => { try { localStorage.removeItem(k); } catch {} } };
(() => { const q = new URLSearchParams(location.search), f = q.get('from');
  if(f && /^[0-9a-f-]{36}$/i.test(f)){ store.set('sc_from', f); store.set('sc_from_name', (q.get('n') || '').slice(0, 40)); }
  if(location.search) history.replaceState(null, '', APP_URL + location.hash); })();
const inviterId = () => { const v = S.user?.user_metadata?.invited_by || store.get('sc_from'); return v && v !== S.user?.id ? v : null; };
const inviteLink = () => `${APP_URL}?from=${me()}&n=${encodeURIComponent((S.me?.name || '').split(' ')[0])}`;

const CATS = {
  dress:['Dress','Dresses'], jumpsuit:['Jumpsuit','Jumpsuits'], top:['Top','Tops'], skirt:['Skirt','Skirts'],
  trousers:['Trousers','Trousers'], jacket:['Jacket','Jackets'], suit:['Suit','Suits'],
  shoes:['Shoes','Shoes'], bag:['Bag','Bags'], accessories:['Accessory','Accessories']
};
const catLabel = (k, plural) => CATS[k] ? t(CATS[k][plural ? 1 : 0]) : (k || '');
const MATERIALS = ['Sequins','Beaded','Satin','Silk','Velvet','Crepe','Chiffon','Lace','Tulle','Wool','Linen','Cotton','Leather','Other'];
const OCC = ['Wedding','Gala','Party','Dinner','Graduation','Festival'];
const FITS = ['Runs small','True to size','Runs large'];
const range = (a, b, step=1) => Array.from({ length: Math.floor((b-a)/step) + 1 }, (_, i) => a + i*step);
const SIZES = {
  'Letter sizes': ['XXS','XS','S','M','L','XL','XXL','3XL'],
  'EU sizes': range(32, 58, 2).map(n => 'EU ' + n),
  'Shoe sizes': range(35, 47).map(String),
  'Other': ['One size']
};
const SIZE_ORDER = Object.values(SIZES).flat();
const sizeGroups = cat => cat === 'shoes' ? ['Shoe sizes'] : ['bag','accessories'].includes(cat) ? ['Other','Letter sizes']
  : CATS[cat] ? ['Letter sizes','EU sizes','Other'] : ['Letter sizes','EU sizes','Shoe sizes','Other'];
const TERM_GROUPS = [
  { key:'care', label:'Care', ask:'How should it be cleaned?', sug:['Washing machine is fine','Hand wash','Dry clean','Steam, don’t wash','No tumble dryer'] },
  { key:'thanks', label:'Thank-you', ask:'How can friends say thanks?', sug:['Chocolate bar','Bottle of wine','Photo of you in it!','A drink next time'] },
  { key:'terms', label:'Logistics', ask:'Pick-up, return, how long?', sug:['Max. one week','Pick it up at my place'] }
];
const BRAND_SEED = ['Vintage','Handmade'];
const PROFILE_COLS = 'id,name,colour,avatar,avatar_ink,avatar_src';

const S = {
  user:null, me:null, profiles:{}, phones:{}, friends:new Set(), incoming:[], outgoing:[], hearts:new Set(),
  urls:{}, thumbs:{}, urlExp:{}, socialAt:0, pageCache:{}, bg:null, pieces:[], todo:0, tags:{ brand:[], category:[] }, tagsLoaded:false, form:{ care:[], thanks:[], terms:[] }, newFiles:[], more:false,
  f:{owner:'all',cat:'all',size:'all',mat:'all',brand:'all',occ:'all',avail:false,q:''}
};

/* ---------- small helpers ---------- */
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const me = () => S.user.id;
const nm = id => id === me() ? t('You') : (S.profiles[id]?.name || t('Someone'));
const first = id => id === me() ? t('you') : (S.profiles[id]?.name || t('Someone')).split(' ')[0];
const hash = x => { let h = 0; for(const c of String(x)) h = (h*31 + c.charCodeAt(0)) | 0; return Math.abs(h); };
// Textures cropped from Vera's photos, each with a suggested letter colour (complementary on the colour wheel)
const AVATARS = [
  { src:'avatars/a01.jpg', ink:'#86D4F9' },
  { src:'avatars/a02.jpg', ink:'#E299FA' },
  { src:'avatars/a03.jpg', ink:'#F2A40D' },
  { src:'avatars/a04.jpg', ink:'#077B8D' },
  { src:'avatars/a05.jpg', ink:'#0DDEF2' },
  { src:'avatars/a06.jpg', ink:'#328807' },
  { src:'avatars/a07.jpg', ink:'#0DF2D5' },
  { src:'avatars/a08.jpg', ink:'#0B5CD0' },
  { src:'avatars/a09.jpg', ink:'#330DF2' },
  { src:'avatars/a10.jpg', ink:'#B30914' },
  { src:'avatars/a11.jpg', ink:'#0DBEF2' },
  { src:'avatars/a12.jpg', ink:'#0A18BD' },
  { src:'avatars/a13.jpg', ink:'#0DF28A' },
  { src:'avatars/a14.jpg', ink:'#42C1F5' },
  { src:'avatars/a15.jpg', ink:'#F5AC47' },
  { src:'avatars/a16.jpg', ink:'#DEF20D' },
  { src:'avatars/a17.jpg', ink:'#F2A30D' },
  { src:'avatars/a18.jpg', ink:'#0DF2DE' },
  { src:'avatars/a19.jpg', ink:'#0952A5' },
  { src:'avatars/a20.jpg', ink:'#0D0EF2' },
  { src:'avatars/a21.jpg', ink:'#0DF24B' },
  { src:'avatars/a22.jpg', ink:'#A786F9' },
  { src:'avatars/a23.jpg', ink:'#0DF2A6' },
  { src:'avatars/a24.jpg', ink:'#5ACBF6' },
  { src:'avatars/a25.jpg', ink:'#0DF28D' },
  { src:'avatars/a26.jpg', ink:'#0D45F2' },
  { src:'avatars/a27.jpg', ink:'#07528D' },
  { src:'avatars/a28.jpg', ink:'#2A0CE4' },
  { src:'avatars/a29.jpg', ink:'#0DEEF2' },
  { src:'avatars/a30.jpg', ink:'#F2E80D' },
  { src:'avatars/a31.jpg', ink:'#B80A4C' },
  { src:'avatars/a32.jpg', ink:'#090FA5' },
  { src:'avatars/a33.jpg', ink:'#0DF2CB' },
  { src:'avatars/a34.jpg', ink:'#FA99CC' },
  { src:'avatars/a35.jpg', ink:'#0DF2DC' }
];
// Only add new textures at the end: saved choices are stored by position. People who never picked one get one of the first 16, so their picture never changes.
const AV_DEFAULTS = 16, AV_ROW = 7;
const INK_SWATCHES = ['#D66632','#EDA537','#227907','#36ADAC','#054F9B','#EA4570','#C8011D'];
const avatarOf = id => { const a = S.profiles[id]?.avatar; return Number.isInteger(a) && a >= 0 && a < AVATARS.length ? a : hash(id) % AV_DEFAULTS; };
const inkOf = id => { const k = S.profiles[id]?.avatar_ink; return /^#[0-9A-Fa-f]{6}$/.test(k || '') ? k : AVATARS[avatarOf(id)].ink; };
const avStyle = (a, ink) => `background-image:url('${AVATARS[a].src}');color:${ink || AVATARS[a].ink}`;
const initial = id => ((S.profiles[id]?.name || '?').trim()[0] || '?').toUpperCase();
// Own textures: a tiny crop of someone's photo, stored in the public 'avatars' bucket
const customUrl = p => p?.avatar_src ? sb.storage.from('avatars').getPublicUrl(p.avatar_src).data.publicUrl : '';
const isCustom = p => p?.avatar === -1 && !!p?.avatar_src;
const av = (id, cls='') => { const p = S.profiles[id];
  const style = isCustom(p) ? `background-image:url('${esc(customUrl(p))}');color:${/^#[0-9A-Fa-f]{6}$/.test(p.avatar_ink||'') ? p.avatar_ink : '#FFFFFF'}` : avStyle(avatarOf(id), inkOf(id));
  return `<span class="av ${cls}" style="${style}" title="${esc(nm(id))}" aria-hidden="true">${esc(initial(id))}</span>`; };
// Suggested letter colour: opposite hue, brightness nudged until the letter is readable
const toHex = c => '#' + c.map(v => Math.round(v).toString(16).padStart(2,'0')).join('').toUpperCase();
function hsl2rgb(h, s2, l){ const f = n => { const k = (n + h*12) % 12, a = s2*Math.min(l, 1-l); return 255*(l - a*Math.max(-1, Math.min(k-3, 9-k, 1))); }; return [f(0), f(8), f(4)]; }
function rgb2hue(r, g, b){ r/=255; g/=255; b/=255; const mx = Math.max(r,g,b), mn = Math.min(r,g,b), d = mx-mn; if(!d) return 0;
  const h = mx===r ? ((g-b)/d) % 6 : mx===g ? (b-r)/d + 2 : (r-g)/d + 4; return ((h*60 + 360) % 360) / 360; }
const relLum = c => { const [r,g,b] = c.map(v => { v/=255; return v <= .03928 ? v/12.92 : ((v+.055)/1.055)**2.4; }); return .2126*r + .7152*g + .0722*b; };
const contrastOf = (a, b) => { const [x, y] = [relLum(a), relLum(b)].sort((m, n) => n - m); return (x + .05)/(y + .05); };
function complement(r, g, b){
  const h2 = (rgb2hue(r, g, b) + .5) % 1, base = [r, g, b]; let best = null;
  for(let L = .25; L <= .8; L += .01){ const c = hsl2rgb(h2, .9, L); if(contrastOf(c, base) >= 2.4 && (!best || Math.abs(L-.5) < Math.abs(best.L-.5))) best = { L, c }; }
  if(!best){ let top = 0; for(let L = .15; L <= .9; L += .01){ const c = hsl2rgb(h2, .9, L), k = contrastOf(c, base); if(k > top){ top = k; best = { L, c }; } } }
  return toHex(best.c);
}
const norm = x => String(x || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
const uniqCI = arr => { const m = new Map(); arr.filter(Boolean).forEach(x => { const k = norm(x); if(k && !m.has(k)) m.set(k, String(x).trim()); }); return [...m.values()]; };
const fmt = d => d ? new Date(d + 'T12:00').toLocaleDateString(LANG === 'nl' ? 'nl-NL' : 'en-GB', {day:'numeric', month:'short'}) : '';
let toastTimer;
function toast(t){ const el=$('#toast'); el.textContent=t; el.hidden=false; clearTimeout(toastTimer); toastTimer=setTimeout(()=>el.hidden=true, 3200); }
function fail(error, fallback=t('Something went wrong. Try again.')){ console.error(error); toast(error?.message ? `${fallback} (${error.message})` : fallback); }
const field = (id, label, input) => `<div class="field"><label for="${id}">${label}</label>${input}</div>`;
const cleanPhone = p => { let d=String(p||'').replace(/\D/g,''); if(d.startsWith('00')) d=d.slice(2); else if(d.startsWith('0')) d='31'+d.slice(1); return d; };

async function loadProfiles(ids){
  const need = [...new Set(ids)].filter(id => id && !S.profiles[id]);
  if(!need.length) return;
  const { data } = await sb.from('profiles').select(PROFILE_COLS).in('id', need);
  (data||[]).forEach(p => S.profiles[p.id] = p);
}
async function signed(paths){
  const need = [...new Set(paths)].filter(p => p && !S.urls[p]);
  if(!need.length) return;
  const { data } = await sb.storage.from('photos').createSignedUrls(need, 60*60*12);
  (data||[]).forEach(d => { if(d.signedUrl) rememberUrl('u', d.path, d.signedUrl); });
}
/* Keep photo links (valid 12 hours) and the last Pieces page and profile on this device,
   so a reload shows them at once and the browser can reuse photos it already downloaded */
const URL_TTL = 12*3600e3;
function rememberUrl(kind, path, url){ (kind === 't' ? S.thumbs : S.urls)[path] = url; S.urlExp[kind + path] = Date.now() + URL_TTL; saveCacheSoon(); }
let cacheTimer; const saveCacheSoon = () => { clearTimeout(cacheTimer); cacheTimer = setTimeout(saveCache, 800); };
function saveCache(){
  if(!S.user) return;
  const now = Date.now(), urls = {}, pages = {};
  for(const [k, exp] of Object.entries(S.urlExp)){ const u = (k[0] === 't' ? S.thumbs : S.urls)[k.slice(1)]; if(u && exp - now > 3600e3) urls[k] = [u, exp]; }
  ['#/pieces', '#/profile'].forEach(k => { if(S.pageCache[k]) pages[k] = S.pageCache[k]; });
  store.set('sc_cache_' + S.user.id, JSON.stringify({ v:1, at:now, urls, pages }));
}
function loadCache(){
  try {
    const c = JSON.parse(store.get('sc_cache_' + S.user.id) || 'null'); if(!c || c.v !== 1) return;
    const now = Date.now();
    for(const [k, [u, exp]] of Object.entries(c.urls || {})) if(exp - now > 3600e3){ (k[0] === 't' ? S.thumbs : S.urls)[k.slice(1)] = u; S.urlExp[k] = exp; }
    if(now - c.at < 11*3600e3) Object.assign(S.pageCache, c.pages || {});
  } catch { /* a broken cache is simply ignored */ }
}
const sortPhotos = ph => [...(ph||[])].sort((a,b) => ((a.position ?? 1e9) - (b.position ?? 1e9)) || (a.created_at < b.created_at ? -1 : 1));
function photo(p, piece, tag=true, thumb=false){
  const url = p && (thumb ? (S.thumbs[p.path] || S.urls[p.path]) : S.urls[p.path]);
  const inner = url ? `<img src="${esc(url)}" alt="${esc(piece.title)}${p.caption?', '+esc(p.caption):''}" loading="lazy">` : `<span class="none">${esc(catLabel(piece.category) || t('Piece'))}</span>`;
  return `<span class="ph">${inner}${tag && p?.caption ? `<span class="ph-tag">${esc(p.caption)}</span>` : ''}</span>`;
}
const status = p => p.available ? `<span class="status">${t('Available')}</span>` : `<span class="status lent">${t('Lent out')}</span>`;
const heart = (id, cls='') => `<button class="heart ${cls}" data-action="heart" data-id="${id}" aria-pressed="${S.hearts.has(id)}" aria-label="${S.hearts.has(id)?t('Remove from saved'):t('Save this piece')}">${S.hearts.has(id)?'♥':'♡'}</button>`;

/* Photos: convert iPhone HEIC photos, shrink everything to a light JPG before upload */
const isHeic = f => /hei[cf]/i.test(f.type || '') || /\.hei[cf]$/i.test(f.name || '');
const loadScript = src => new Promise((res, rej) => { const el = document.createElement('script'); el.src = src; el.onload = res; el.onerror = () => rej(new Error(t('Could not load the photo converter. Check your connection.'))); document.head.appendChild(el); });
const loadImg = blob => new Promise((res, rej) => { const u = URL.createObjectURL(blob), im = new Image(); im.onload = () => res(im); im.onerror = () => { URL.revokeObjectURL(u); rej(new Error('decode')); }; im.src = u; });
async function decode(file){
  try { return await createImageBitmap(file, { imageOrientation:'from-image' }); } catch(e){}
  try { return await loadImg(file); } catch(e){}
  if(isHeic(file) || !file.type){
    if(!window.heic2any) await loadScript('https://cdn.jsdelivr.net/npm/heic2any@0.0.4/dist/heic2any.min.js');
    const out = await heic2any({ blob:file, toType:'image/jpeg', quality:.9 });
    return await loadImg(Array.isArray(out) ? out[0] : out);
  }
  throw new Error('decode');
}
async function decodeOrThrow(file){
  try { return await decode(file); } catch(e){ throw new Error(t('“{name}” can’t be read. Try a JPG or PNG.', { name: file.name || t('This photo') })); }
}
async function toJpeg(img, max, q){
  const w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
  const k = Math.min(1, max / Math.max(w, h));
  const c = document.createElement('canvas'); c.width = Math.round(w*k); c.height = Math.round(h*k);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', q));
  if(!blob) throw new Error(t('This photo could not be prepared. Try another one.'));
  return blob;
}
async function shrink(file){ return toJpeg(await decodeOrThrow(file), 1600, .82); }

/* Thumbnails: a 520px copy next to every photo ("..._t.jpg"), used in grids so pages load fast */
const thumbOf = path => path.replace(/\.jpg$/, '_t.jpg');
async function uploadPhoto(pieceId, file, caption, position){
  const img = await decodeOrThrow(file);
  const [full, small] = [await toJpeg(img, 1600, .82), await toJpeg(img, 520, .78)];
  const path = `${me()}/${pieceId}/${crypto.randomUUID()}.jpg`;
  const [up, upT] = await Promise.all([
    sb.storage.from('photos').upload(path, full, { contentType:'image/jpeg', cacheControl:'31536000' }),
    sb.storage.from('photos').upload(thumbOf(path), small, { contentType:'image/jpeg', cacheControl:'31536000' })
  ]);
  if(up.error) throw up.error;
  if(upT.error) console.error(upT.error);
  const ins = await sb.from('piece_photos').insert({ piece_id:pieceId, path, caption: caption || null, ...(Number.isInteger(position) ? { position } : {}) });
  if(ins.error) throw ins.error;
}
async function signedThumbs(paths){
  const need = [...new Set(paths.filter(Boolean))].filter(p => !S.thumbs[p]);
  if(!need.length) return;
  const { data } = await sb.storage.from('photos').createSignedUrls(need.map(thumbOf), 60*60*12);
  const missing = [];
  need.forEach((p, i) => { const d = data?.[i]; if(d?.signedUrl && !d.error) rememberUrl('t', p, d.signedUrl); else missing.push(p); });
  if(!missing.length) return;
  await signed(missing);
  missing.forEach(p => { if(S.urls[p]) rememberUrl('t', p, S.urls[p]); });
  // Older photos have no thumbnail yet: their owner's app quietly makes one
  missing.filter(p => p.startsWith(me() + '/')).forEach(p => setTimeout(() => healThumb(p), 1500));
}
async function healThumb(path){
  try {
    const r = await fetch(S.urls[path]); if(!r.ok) return;
    const small = await toJpeg(await decode(await r.blob()), 520, .78);
    await sb.storage.from('photos').upload(thumbOf(path), small, { contentType:'image/jpeg', cacheControl:'31536000' });
  } catch(e){ /* not important: the full photo is used meanwhile */ }
}
// Apply the photo list from the Add/Edit form: removals, new and edited photos, and the order (first = main)
async function savePhotos(pieceId, btn){
  const bad = [], keep = S.plist.filter(x => !x.removed), gone = S.plist.filter(x => x.removed && x.kind === 'old');
  const toUpload = keep.filter(x => x.kind === 'new' || x.replace).length; let n = 0;
  const dropOld = async x => { await sb.from('piece_photos').delete().eq('id', x.id); await sb.storage.from('photos').remove([x.path, thumbOf(x.path)]); };
  for(const x of gone) await dropOld(x);
  for(const [i, x] of keep.entries()){
    if(x.kind === 'new' || x.replace){
      if(btn) btn.textContent = t('Uploading photo {n} of {m}…', { n: ++n, m: toUpload });
      try { await uploadPhoto(pieceId, x.replace || x.file, x.caption, i); if(x.replace) await dropOld(x); }
      catch(e){ console.error(e); bad.push(x.file?.name || t('a photo')); }
    } else if(x.position !== i){
      const { error } = await sb.from('piece_photos').update({ position:i }).eq('id', x.id); if(error) console.error(error);
    }
  }
  if(bad.length) toast(tp(bad.length, '{n} photo couldn’t be read ({names}). Try a JPG or PNG.', '{n} photos couldn’t be read ({names}). Try a JPG or PNG.', { names: bad.join(', ') }));
}

/* Photo editor: drag a 4:5 frame, zoom, rotate. Opens after choosing a photo, and from ✎ on a photo */
let ED = null;
async function openEditor(source, onDone){
  let img; try { img = await decodeOrThrow(source); } catch(e){ return toast(e.message); }
  const w = img.naturalWidth || img.width, h = img.naturalHeight || img.height, k = Math.min(1, 2400 / Math.max(w, h));
  const c = document.createElement('canvas'); c.width = Math.round(w*k); c.height = Math.round(h*k);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  ED = { src:c, frac:1, x:.5, y:.5, onDone, name:(source.name || 'photo').replace(/\.\w+$/, '') + '.jpg' };
  let el = $('#editor');
  if(!el){ el = document.createElement('div'); el.id = 'editor'; el.className = 'editor'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); document.body.appendChild(el); }
  el.innerHTML = `<div class="ed-inner"><h2>${t('Edit photo')}</h2>
    <div class="cropwrap"><div class="cropinner" id="edInner"><img id="edImg" alt="${t('Your photo')}" draggable="false"><div class="cropbox rect" id="edBox"></div></div></div>
    <div class="croprow"><button type="button" class="btn ghost small" data-action="ed-rotate">↻ ${t('Rotate')}</button>
      <div class="field" style="flex:1"><label for="edZoom">${t('Zoom')}</label><input type="range" id="edZoom" min="0" max="60" step="1" value="0"></div></div>
    <div class="actions"><button type="button" class="btn ghost" data-action="ed-cancel">${t('Cancel')}</button><button type="button" class="btn accent" data-action="ed-use">${t('Use photo')}</button></div></div>`;
  el.hidden = false;
  const inner = $('#edInner');
  const move = e => { const b = inner.getBoundingClientRect(); if(!b.width) return; ED.x = (e.clientX - b.left)/b.width; ED.y = (e.clientY - b.top)/b.height; edDraw(); };
  inner.addEventListener('pointerdown', e => { inner.setPointerCapture?.(e.pointerId); move(e); });
  inner.addEventListener('pointermove', e => { if(e.buttons || e.pointerType === 'touch') move(e); });
  edShow();
}
function edShow(){ const im = $('#edImg'); im.onload = edDraw; im.src = ED.src.toDataURL('image/jpeg', .85); }
function edRect(){
  const W = ED.src.width, H = ED.src.height, maxW = Math.min(W, H*4/5), w = maxW*ED.frac, h = w*5/4;
  const cx = Math.min(Math.max(ED.x*W, w/2), W - w/2), cy = Math.min(Math.max(ED.y*H, h/2), H - h/2);
  ED.x = cx/W; ED.y = cy/H;
  return { sx:cx - w/2, sy:cy - h/2, w, h, W };
}
function edDraw(){
  const r = edRect(), im = $('#edImg'), box = $('#edBox'); if(!im || !box) return;
  const k = im.clientWidth / r.W;
  Object.assign(box.style, { left:r.sx*k + 'px', top:r.sy*k + 'px', width:r.w*k + 'px', height:r.h*k + 'px' });
}
function edRotate(){
  const s0 = ED.src, c = document.createElement('canvas'); c.width = s0.height; c.height = s0.width;
  const g = c.getContext('2d'); g.translate(c.width, 0); g.rotate(Math.PI/2); g.drawImage(s0, 0, 0);
  ED.src = c; ED.x = ED.y = .5; edShow();
}
async function edUse(){
  const r = edRect(), outW = Math.min(1280, Math.round(r.w)), c = document.createElement('canvas');
  c.width = outW; c.height = Math.round(outW*5/4);
  c.getContext('2d').drawImage(ED.src, r.sx, r.sy, r.w, r.h, 0, 0, c.width, c.height);
  const blob = await new Promise(res => c.toBlob(res, 'image/jpeg', .9));
  const done = ED.onDone; edClose();
  if(blob) done(new File([blob], ED_name(), { type:'image/jpeg' }));
}
let edLastName = 'photo.jpg'; const ED_name = () => edLastName;
function edClose(){ if(ED) edLastName = ED.name; ED = null; const el = $('#editor'); if(el){ el.hidden = true; el.innerHTML = ''; } }

/* Shared labels: brands and extra categories, one spelling for everyone */
async function loadTags(){
  if(S.tagsLoaded) return;
  const { data, error } = await sb.from('tags').select('kind,name');
  if(error) return console.error(error);
  S.tags = { brand:[], category:[] }; (data || []).forEach(x => S.tags[x.kind]?.push(x.name)); S.tagsLoaded = true;
}
const brandList = () => uniqCI([...BRAND_SEED, ...S.tags.brand, ...S.pieces.map(p => p.brand)]).sort((a,b) => a.localeCompare(b));
async function canonical(kind, value, known){
  const v = String(value || '').trim().replace(/\s+/g, ' '); if(!v) return null;
  const hit = known.find(x => norm(x) === norm(v)); if(hit) return hit;
  const { error } = await sb.from('tags').insert({ kind, name:v });
  if(error && error.code !== '23505') console.error(error);
  S.tags[kind].push(v); return v;
}
async function canonicalCategory(v){
  const n = norm(v);
  for(const [id, labels] of Object.entries(CATS)) if(norm(id) === n || labels.some(l => norm(l) === n || norm(t(l)) === n)) return id;
  return canonical('category', v, S.tags.category);
}

/* ---------- social data (friends, hearts, badge) ---------- */
async function loadSocial(){
  if(S.socialAt && Date.now() - S.socialAt < 30000) return;
  const [fr, he, rq] = await Promise.all([
    sb.from('friendships').select('*').or(`requester.eq.${me()},addressee.eq.${me()}`),
    sb.from('hearts').select('piece_id'),
    sb.from('borrow_requests').select('id,status,owner,borrower')
  ]);
  const rows = fr.data || [];
  S.friends = new Set(rows.filter(r => r.status==='accepted').map(r => r.requester===me() ? r.addressee : r.requester));
  S.incoming = rows.filter(r => r.status==='pending' && r.addressee===me()).map(r => r.requester).filter(id => !S.friends.has(id));
  S.outgoing = rows.filter(r => r.status==='pending' && r.requester===me()).map(r => r.addressee).filter(id => !S.friends.has(id));
  S.hearts = new Set((he.data||[]).map(h => h.piece_id));
  const todo = (rq.data||[]).filter(r => (r.owner===me() && ['pending','returned'].includes(r.status)) || (r.borrower===me() && r.status==='accepted')).length;
  S.todo = todo;
  S.myAsks = (rq.data||[]).filter(r => r.borrower===me()).length;
  await loadProfiles([...S.friends, ...S.incoming, ...S.outgoing]);
  S.socialAt = Date.now();
}

/* ---------- auth ---------- */
// Supabase's messages are technical English; turn them into something a friend understands
function authError(e){
  const m = (e?.message || '').toLowerCase(), c = e?.code || '';
  if(c === 'email_not_confirmed' || m.includes('not confirmed')) return t('Confirm your email first: check your inbox (and spam folder) for our link.');
  if(c === 'invalid_credentials' || m.includes('invalid login')) return t('Email or password is not right.');
  if(c === 'user_already_exists' || m.includes('already registered')) return t('There’s already an account with this email. Log in instead.');
  if(c === 'weak_password' || m.includes('password should') || m.includes('weak password')) return t('That password is too easy to guess. Use at least 8 characters, with letters and numbers.');
  if(c.includes('rate_limit') || m.includes('rate limit') || m.includes('too many')) return t('Too many emails were sent just now. Try again in an hour.');
  if(m.includes('not authorized') || m.includes('sending') || m.includes('smtp')) return t('We couldn’t send you an email. Please tell whoever invited you, so they can fix it.');
  if(m.includes('valid email') || m.includes('invalid email')) return t('That email address doesn’t look right.');
  return t('Something went wrong: ') + (e?.message || t('unknown error'));
}
let authMode = store.get('sc_from') ? 'signup' : 'login', recovering = false;
let lastEmail = '';
function renderAuth(msg='', resend=false){
  $('#header').hidden = true; $('#tabbar').hidden = true; document.body.classList.remove('on-piece');
  if(recovering){
    $('#main').innerHTML = `<div class="auth"><div class="card">
      <img class="logo" src="logo.png" alt="SHARING=CARING" style="filter:var(--logo);max-width:280px;margin:0 auto">
      <h2>${t('Choose a new password')}</h2>
      <form data-form="newpass">${field('npw',t('New password'),'<input type="password" id="npw" minlength="8" autocomplete="new-password" required>')}
      <button class="btn accent">${t('Save password')}</button></form></div></div>`;
    return;
  }
  const signup = authMode === 'signup';
  $('#main').innerHTML = `<div class="auth"><div class="card">

    <img src="logo.png" alt="SHARING=CARING" style="filter:var(--logo);width:100%;max-width:300px;margin:0 auto 4px;display:block">
    ${store.get('sc_from') ? `<p class="invited"><strong>${t('{name} thinks you’ve got great style!', { name: esc(store.get('sc_from_name') || t('Someone')) })}</strong><span>${t('Create an account to see their wardrobe and share yours.')}</span></p>`
      : `<p class="small-print" style="text-align:center">${t('Got friends with style?')} ${t('Browse wardrobes, borrow pieces and shine at your special event!')}</p>`}
    <div class="switch"><button type="button" data-action="authmode" data-m="login" aria-pressed="${!signup}">${t('Log in')}</button><button type="button" data-action="authmode" data-m="signup" aria-pressed="${signup}">${t('Create account')}</button></div>
    <form data-form="${signup?'signup':'login'}">
      ${signup ? field('aName',t('Your name'),'<input type="text" id="aName" autocomplete="name" required>') : ''}
      ${field('aEmail',t('Email'),'<input type="email" id="aEmail" autocomplete="email" required value="'+esc(lastEmail)+'">')}
      ${field('aPw',t('Password'), `<input type="password" id="aPw" minlength="8" autocomplete="${signup?'new-password':'current-password'}" required>`)}
      ${signup ? `<p class="hint">${t('At least 8 characters. We’ll send you an email to confirm your address.')}</p>` : ''}
      ${msg ? `<p class="${msg.startsWith('!')?'error':'small-print'}">${esc(msg.replace(/^!/,''))}</p>` : ''}
      ${resend ? `<button type="button" class="btn ghost small" data-action="resend">${t('Didn’t get it? Send it again')}</button>` : ''}
      <button class="btn accent">${signup ? t('Create account') : t('Log in')}</button>
      ${signup ? '' : `<button type="button" class="linkbtn" data-action="forgot">${t('Forgot your password?')}</button>`}
    </form>${langSwitch()}</div></div>`;
}
const langSwitch = () => `<div class="langsw" role="group" aria-label="Language / Taal"><button type="button" data-action="lang" data-v="en" aria-pressed="${LANG === 'en'}">English</button><button type="button" data-action="lang" data-v="nl" aria-pressed="${LANG === 'nl'}">Nederlands</button></div>`;

/* ---------- navigation ---------- */
const ICON = {
  pieces:'<path d="M12 5a2 2 0 1 1 2 2c-1 .4-2 1-2 2v1M12 10 3 17h18z"/>',
  saved:'<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
  requests:'<path d="M4 8h13l-3-3M20 16H7l3 3"/>',
  friends:'<circle cx="9" cy="9" r="3.2"/><circle cx="17" cy="10" r="2.4"/><path d="M3 19c.6-3 3-4.6 6-4.6s5.4 1.6 6 4.6M15 15.2c2.6-.4 5 .8 6 3.8"/>',
  profile:'<circle cx="12" cy="8.5" r="3.5"/><path d="M5 20c1-3.6 3.6-5.4 7-5.4s6 1.8 7 5.4"/>'
};
/* ---------- what's new: dots in the app, a count on the browser tab ---------- */
// Remembered per person on this device: the newest item/call you have seen, and how many replies each of your calls had
const seenKey = () => 'sc_seen_' + (S.user?.id || '');
const seenGet = () => { try { return JSON.parse(store.get(seenKey()) || '{}'); } catch { return {}; } };
const saveSeen = o => store.set(seenKey(), JSON.stringify({ ...seenGet(), ...o }));
const newRepliesOf = c => c.owner === me() ? Math.max(0, replyCount(c) - ((seenGet().rep || {})[c.id] || 0)) : 0;
const newReplies = () => S.user ? (S.calls || []).reduce((n, c) => n + newRepliesOf(c), 0) : 0;
function markItemsSeen(){
  const times = [...S.pieces, ...(S.calls || [])].filter(x => x.owner !== me()).map(x => x.created_at).filter(Boolean).sort();
  saveSeen({ items: times.length ? times[times.length - 1] : (seenGet().items || new Date().toISOString()) }); S.newItems = 0;
}
// Browser tab: "(3) SHARING=CARING" and a dot on the little icon; the app icon gets a badge where the phone allows it
const BASE_TITLE = document.title; let iconBase = null, iconImg = null;
function showCount(){
  if(!S.user) return;
  const n = (S.todo || 0) + S.incoming.length + newReplies() + (S.newItems || 0);
  document.title = n ? `(${n}) ${BASE_TITLE}` : BASE_TITLE;
  try { n ? navigator.setAppBadge?.(n) : navigator.clearAppBadge?.(); } catch {}
  const link = document.querySelector('link[rel=icon]'); if(!link) return;
  iconBase = iconBase || link.getAttribute('href');
  if(!n){ link.href = iconBase; return; }
  const draw = () => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
    g.drawImage(iconImg, 0, 0, 64, 64); g.fillStyle = '#E5484D'; g.beginPath(); g.arc(50, 14, 13, 0, Math.PI*2); g.fill();
    try { link.href = c.toDataURL('image/png'); } catch {} };
  if(iconImg?.complete) draw(); else { iconImg = new Image(); iconImg.onload = draw; iconImg.src = iconBase; }
}
// Check quietly every 3 minutes while the app is open, and straight away when you come back to it
async function refreshNew(){
  if(!S.user || !S.me?.name) return;
  try {
    S.socialAt = 0;
    await Promise.all([loadSocial(), loadCalls()]);
    const since = seenGet().items;
    if(since){
      const { data } = await sb.from('pieces').select('id').gt('created_at', since).neq('owner', me()).limit(50);
      S.newItems = (data || []).length + (S.calls || []).filter(c => c.owner !== me() && c.created_at > since).length;
    }
    renderNav(S.view || 'pieces');
  } catch(e){ /* not important: we try again later */ }
}
setInterval(() => { if(document.visibilityState === 'visible') refreshNew(); }, 180000);
document.addEventListener('visibilitychange', () => { if(document.visibilityState === 'visible') refreshNew(); });

function renderNav(view){
  $('#header').hidden = false;
  // Language switch in the top bar: shows the other language, one tap switches
  if(!$('#langBtn')){ const b = document.createElement('button'); b.id = 'langBtn'; b.type = 'button'; b.className = 'langbtn';
    const to = LANG === 'nl' ? 'en' : 'nl'; b.dataset.action = 'lang'; b.dataset.v = to; b.textContent = to.toUpperCase();
    b.setAttribute('aria-label', to === 'en' ? t('Switch to English') : t('Switch to Dutch')); b.title = b.getAttribute('aria-label');
    $('#header .addbtn')?.before(b); }
  S.view = view;
  const fr = S.incoming.length, fresh = (S.newItems || 0) + newReplies() > 0;
  const tabs = [['pieces',t('Pieces'),fresh ? '•' : 0],['saved',t('Saved')],['requests',t('Requests'),S.todo],['friends',t('Friends'),fr],['profile',t('You')]];
  const cur = v => view===v || ((view==='piece' || view==='call') && v==='pieces') || (view==='person' && v==='friends') || (view==='edit' && v==='profile');
  $('#nav').innerHTML = tabs.map(([v,l,b]) => `<a class="tab" href="#/${v}" ${cur(v)?'aria-current="page"':''}>${l}${b?`<span class="badge ${b==='•'?'dot':''}">${b==='•'?'':b}</span>`:''}</a>`).join('');
  const bar = $('#tabbar'); bar.hidden = false;
  bar.innerHTML = tabs.map(([v,l,b]) => `<a href="#/${v}" ${cur(v)?'aria-current="page"':''}><span class="ic"><svg viewBox="0 0 24 24" aria-hidden="true">${ICON[v]}</svg>${b?`<span class="badge ${b==='•'?'dot':''}">${b==='•'?'':b}</span>`:''}</span>${l}</a>`).join('');
  showCount();
  document.body.classList.toggle('on-piece', view==='piece');
}
async function route(){
  setBackdrop(null);
  if(!S.user || recovering) return renderAuth();
  const [, view='pieces', id] = (location.hash || '#/pieces').split('/');
  renderNav(view);
  if(!S.me?.name && view !== 'edit'){ location.hash = '#/edit'; return; }
  const views = { pieces:viewPieces, piece:viewPiece, saved:viewSaved, requests:viewRequests, friends:viewFriends, profile:() => viewPerson(me()), welcome:viewWelcome, 'add-friends':viewAddFriends, call:viewCall, edit:viewProfile, person:viewPerson };
  // Show the last version of this page straight away, then refresh it in the background
  const key = location.hash || '#/pieces', cacheable = ['pieces','saved','requests','friends','profile','person','welcome'].includes(view);
  S.fromCache = false;
  if(cacheable && S.pageCache[key]){ $('#main').innerHTML = S.pageCache[key].html; setBackdrop(S.pageCache[key].bg); S.fromCache = true; }
  try { await (views[view] || viewPieces)(id); } catch(e){ fail(e, t('Could not load this page.')); }
  if(cacheable && (location.hash || '#/pieces') === key){ S.pageCache[key] = { html: $('#main').innerHTML, bg: S.bg || null }; saveCacheSoon(); }
}
const loading = (text = t('Loading…')) => { if(!S.fromCache) $('#main').innerHTML = `<p class="loading">${text}</p>`; };
window.addEventListener('hashchange', () => { route(); scrollTo(0,0); });

/* ---------- pieces ---------- */
const PIECE_LIST = 'id,owner,title,category,material,size,brand,description,care,thanks,terms,available,created_at,piece_photos(path,caption,created_at,position),worn_to(occasion)';
async function viewPieces(){
  if(!S.pieces.length) loading(t('Loading pieces…'));
  const [, , res] = await Promise.all([loadSocial(), loadTags(), sb.from('pieces').select(PIECE_LIST).order('created_at', {ascending:false}), loadCalls()]);
  S.sugg = S.friends.size < 5 ? await suggestions() : [];
  renderNav('pieces');
  const { data, error } = res;
  if(error) return fail(error, t('Could not load pieces.'));
  S.pieces = data;
  await Promise.all([loadProfiles(data.map(p => p.owner)), signedThumbs(data.map(p => sortPhotos(p.piece_photos)[0]?.path))]);
  markItemsSeen();
  renderPieces(); renderNav('pieces');
}
function tile(p){
  const ph = sortPhotos(p.piece_photos)[0];
  return `<div class="tile"><a class="open" href="#/piece/${p.id}">${photo(ph, p, false, true)}
    <span class="meta"><span class="t-title">${esc(p.title)}</span><span class="mono" style="color:var(--muted)">${esc(catLabel(p.category))} · ${esc(p.size||'')} · ${esc(nm(p.owner))}</span>${status(p)}</span></a>${p.owner===me()?'':heart(p.id)}</div>`;
}
const haystack = p => [p.title, p.description, p.brand, p.material, catLabel(p.category), catLabel(p.category, 1), p.size,
  ...(p.care||[]), ...(p.thanks||[]), ...(p.terms||[]), ...(p.worn_to||[]).map(w => w.occasion), nm(p.owner)].join(' ').toLowerCase();
function matchP(p, skip){
  const f = S.f;
  return (skip==='owner'||f.owner==='all'||p.owner===f.owner) && (skip==='cat'||f.cat==='all'||p.category===f.cat)
    && (f.size==='all'||p.size===f.size) && (f.mat==='all'||p.material===f.mat) && (f.brand==='all'||p.brand===f.brand)
    && (f.occ==='all'||(p.worn_to||[]).some(w => w.occasion===f.occ)) && (!f.avail||p.available)
    && (!f.q || f.q.toLowerCase().split(/\s+/).filter(Boolean).every(w => haystack(p).includes(w)));
}
function renderGrid(){
  const area = $('#grid-area'); if(!area) return;
  const pool = S.pieces, list = pool.filter(p => matchP(p));
  const c = $('#count'); if(c) c.textContent = tp(list.length, '{n} result', '{n} results');
  area.innerHTML = list.length ? `<div class="grid">${list.map(tile).join('')}</div>`
    : pool.length ? `<div class="empty">${S.f.q ? t('Nothing found for “{q}”.', { q: esc(S.f.q) }) : t('Nothing matches these filters.')}<button class="chip" data-action="clear">${t('Clear search and filters')}</button></div>`
    : `<div class="empty">${t('No pieces yet. Start with one of yours: that dress you wore once.')}<button class="btn" data-action="modal" data-m="add">+ ${t('Add a piece')}</button></div>`;
}
function renderPieces(){
  const f = S.f, pool = S.pieces;
  const owners = [...new Set(pool.map(p => p.owner))];
  const catKeys = [...new Set([...Object.keys(CATS), ...pool.map(p => p.category)])];
  const cats = catKeys.map(k => [k, pool.filter(p => p.category===k && matchP(p,'cat')).length]).filter(([k,c]) => c || f.cat===k);
  const opt = (key, vals, lab = x => x) => vals.map(v => `<option value="${esc(v)}" ${f[key]===v?'selected':''}>${esc(lab(v))}</option>`).join('');
  const present = new Set(pool.map(p => p.size).filter(Boolean));
  const groups = Object.entries(SIZES).map(([g, l]) => [g, l.filter(x => present.has(x))]).filter(([, l]) => l.length);
  const odd = [...present].filter(x => !SIZE_ORDER.includes(x)); if(odd.length) groups.push(['Other sizes', odd]);
  const sizeOpts = groups.map(([g, l]) => `<optgroup label="${t(g)}">${l.map(x => `<option value="${esc(x)}" ${f.size===x?'selected':''}>${esc(g==='Shoe sizes' ? t('Shoe')+' '+x : x)}</option>`).join('')}</optgroup>`).join('');
  const mats = [...new Set(pool.map(p => p.material).filter(Boolean))].sort();
  const brands = [...new Set(pool.map(p => p.brand).filter(Boolean))].sort((a,b) => a.localeCompare(b));
  const occs = [...new Set(pool.flatMap(p => (p.worn_to||[]).map(w => w.occasion)))].sort();
  const active = ['owner','cat','size','mat','brand','occ'].some(k => f[k]!=='all') || f.avail || f.q;
  const nOn = ['size','mat','brand','occ'].filter(k => f[k]!=='all').length + (f.avail?1:0);
  const noFriends = !S.friends.size;
  $('#main').innerHTML = `
  <div class="head"><div style="flex:1"><span class="eyebrow">${tp(pool.length, '{n} piece', '{n} pieces')} ${tp(S.friends.size, 'from {n} friend and you', 'from {n} friends and you')}</span>
    <h1>${f.owner==='all' ? t('All pieces') : f.owner===me() ? t('Your pieces') : t('{name}’s pieces', { name: esc(nm(f.owner)) })}</h1>
    <p class="lede">${t('Got friends with style?')}<span class="long"> ${t('Together we have all the pieces to build an epic outfit.')}</span> ${t('Browse wardrobes, borrow pieces and shine at your special event!')}<span class="long"> ${t('It’s a way to take care of your wallet and the environment, and to give our coolest pieces all the love they deserve. &lt;3')}</span></p></div></div>

  ${S.incoming.length ? `<div class="banner"><span>${tp(S.incoming.length, '{n} friend request waiting for you.', '{n} friend requests waiting for you.')}</span><a class="btn small" href="#/friends">${t('See requests')}</a></div>` : ''}
  ${(() => { if(store.get('sc_guide_hidden')) return noFriends ? `<div class="banner"><span>${t('You only see pieces from friends. Add your first friend to start browsing.')}</span><a class="btn small" href="#/friends">${t('Find friends')}</a></div>` : ''; const left = guideLeft(guideState(pool.filter(p => p.owner === me()).length));
     return left ? `<div class="banner"><span><strong>${t('Getting started')}</strong> · ${t('{n} of 4', { n: 4 - left })}</span><a class="btn small" href="#/welcome">${t('Continue')}</a></div>` : ''; })()}
  ${S.friends.size < 5 ? sugCards(S.sugg || []) : ''}
  ${callStrip()}
  ${pool.length ? `<div class="search"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/></svg><input type="search" id="pq" placeholder="${t('Search: midi, silk, split…')}" value="${esc(f.q)}" aria-label="${t('Search pieces')}" autocomplete="off" enterkeyhint="search"></div>` : ''}
  ${owners.length > 1 ? `<div class="friends scroller" role="group" aria-label="${t('Owner')}">
    <button class="friend" data-action="f" data-k="owner" data-v="all" aria-pressed="${f.owner==='all'}"><span class="av all" aria-hidden="true">✦</span>${t('Everyone')}</button>
    ${owners.map(o => `<button class="friend" data-action="f" data-k="owner" data-v="${o}" aria-pressed="${f.owner===o}">${av(o)}${esc(nm(o))} <span class="count mono">${pool.filter(p=>p.owner===o).length}</span></button>`).join('')}
  </div>` : ''}
  ${pool.length ? `<div class="filters scroller" role="group" aria-label="${t('Category')}">
    <button class="chip" data-action="f" data-k="cat" data-v="all" aria-pressed="${f.cat==='all'}">${t('All categories')}</button>
    ${cats.map(([k,c]) => `<button class="chip" data-action="f" data-k="cat" data-v="${esc(k)}" aria-pressed="${f.cat===k}">${esc(catLabel(k, 1))} <span class="mono">${c}</span></button>`).join('')}
  </div>
  <button class="chip morebtn" data-action="morefilters" aria-expanded="${S.more?'true':'false'}">${t('Filters')}${nOn?` <span class="mono">${nOn}</span>`:''} ${S.more?'▴':'▾'}</button>
  <div class="filters more ${S.more?'open':''}">
    <label class="sel"><span>${t('Size')}</span><select data-filter="size"><option value="all">${t('Any')}</option>${sizeOpts}</select></label>
    <label class="sel"><span>${t('Material')}</span><select data-filter="mat"><option value="all">${t('Any')}</option>${opt('mat',mats,x => t(x))}</select></label>
    <label class="sel"><span>${t('Brand')}</span><select data-filter="brand"><option value="all">${t('Any')}</option>${opt('brand',brands)}</select></label>
    <label class="sel"><span>${t('Worn to')}</span><select data-filter="occ"><option value="all">${t('Anything')}</option>${opt('occ',occs,x => t(x))}</select></label>
    <label class="toggle"><input type="checkbox" data-filter="avail" ${f.avail?'checked':''}> ${t('Available now')}</label>
    <span class="grow"></span><span class="mono" id="count" style="color:var(--muted)"></span>
    ${active ? `<button class="chip" data-action="clear">${t('Clear')}</button>` : ''}
  </div>` : ''}
  <div id="grid-area"></div>`;
  renderGrid();
}
function termsBlock(p, mine){
  const rows = TERM_GROUPS.map(g => [g, p[g.key] || []]).filter(([, l]) => l.length);
  return rows.length ? `<div class="tlines">${rows.map(([g, l]) => `<div class="tline"><span class="eyebrow">${t(g.label)}</span><div class="terms">${l.map(x => `<span class="term">${esc(x)}</span>`).join('')}</div></div>`).join('')}</div>`
    : `<p class="small-print">${mine ? t('No terms yet. A chocolate bar counts.') : t('No terms. Just be nice.')}</p>`;
}

let galleryIndex = 0, current = null;
async function viewPiece(id){
  loading();
  const { data:p, error } = await sb.from('pieces').select('*,piece_photos(id,path,caption,added_by,created_at,position),reactions(id,author,body,fit,created_at),worn_to(id,occasion,author)').eq('id', id).maybeSingle();
  if(error) return fail(error, t('Could not load this piece.'));
  if(!p){ $('#main').innerHTML = `<a class="back" href="#/pieces">← ${t('Back to pieces')}</a><div class="empty">${t('This piece is gone, or you are not friends with the owner (anymore).')}</div>`; return; }
  if(current?.id !== p.id) galleryIndex = 0;
  current = p;
  p.photos = sortPhotos(p.piece_photos);
  p.reactions.sort((a,b) => a.created_at < b.created_at ? 1 : -1);
  await Promise.all([loadSocial(), loadTags()]);
  await loadProfiles([p.owner, ...p.photos.map(x=>x.added_by), ...p.reactions.map(r=>r.author), ...p.worn_to.map(w=>w.author)]);
  await signed(p.photos.map(x => x.path));
  renderPiece();
}
function renderPiece(){
  const p = current, mine = p.owner === me();
  const ph = p.photos[galleryIndex] || p.photos[0];
  const fits = FITS.map(f => [f, p.reactions.filter(r => r.fit===f).length]).filter(x => x[1]);
  const worn = {}; p.worn_to.forEach(w => (worn[w.occasion] = worn[w.occasion] || []).push(w.author));
  const ask = p.available ? t('Ask to borrow') : t('Ask for later dates');
  $('#main').innerHTML = `<a class="back" href="#/pieces">← ${t('Back to pieces')}</a>
  <div class="item">
    <div class="swipe-wrap">
      <div class="swipe" id="swipe">${p.photos.length ? p.photos.map(x => photo(x, p)).join('') : photo(null, p)}</div>
      ${p.photos.length > 1 ? `<div class="dots" id="dots">${p.photos.map((x,i) => `<span ${i===0?'class="on"':''}></span>`).join('')}</div>` : ''}
      <button class="btn ghost small" data-action="modal" data-m="photo">+ ${mine ? t('Add a photo') : t('Add your photo')}</button>
    </div>
    <div class="gallery">
      <div class="main">${photo(ph, p)}</div>
      ${ph ? `<div class="credit">${av(ph.added_by,'sm')} ${t('Photo by {name}', { name: esc(nm(ph.added_by)) })}${ph.added_by===me()||mine ? ` · <button class="linkbtn" data-action="delphoto" data-id="${ph.id}" data-path="${esc(ph.path)}">${t('Remove photo')}</button>` : ''}</div>` : ''}
      <div class="thumbs">
        ${p.photos.map((x,i) => `<button class="thumb" data-action="ph" data-i="${i}" aria-pressed="${i===galleryIndex}" aria-label="${t('Photo {n}', { n: i+1 })}">${photo(x, p)}</button>`).join('')}
        <button class="addph" data-action="modal" data-m="photo">+ ${mine ? t('Add a photo') : t('Add your photo')}</button>
      </div>
    </div>
    <div class="info">
      <div><span class="eyebrow">${mine ? t('Your piece') : t('From {name}', { name: `<a class="plain" href="#/person/${p.owner}">${esc(nm(p.owner))}</a>` })}</span><h1 style="margin-top:6px">${esc(p.title)}</h1>
        <p class="lede">${[p.brand, catLabel(p.category)].filter(Boolean).map(esc).join(' · ')}</p>
        ${p.description ? `<p class="desc">${esc(p.description)}</p>` : ''}</div>
      <div class="actions">
        ${mine ? `<button class="btn ghost" data-action="modal" data-m="edit">${t('Edit')}</button>`
               : `<button class="btn accent" data-action="modal" data-m="borrow">${ask}</button>${heart(p.id,'inline')}`}
        ${p.buy_url ? `<a class="btn ghost" href="${esc(p.buy_url)}" target="_blank" rel="noopener">${t('Where to buy it')} ↗</a>` : ''}
      </div>
      <dl class="facts">
        <dt>${t('Size')}</dt><dd class="mono">${esc(p.category==='shoes' && /^\d/.test(p.size||'') ? 'EU '+p.size : (p.size || '–'))}</dd>
        <dt>${t('Material')}</dt><dd>${esc(p.material ? t(p.material) : '–')}</dd>
        <dt>${t('Status')}</dt><dd>${status(p)}</dd>
      </dl>
      <div class="section">
        <div class="head"><h2>${mine ? t('Your terms') : t('{name}’s terms', { name: esc(nm(p.owner)) })}</h2>${mine ? `<button class="btn ghost small" data-action="modal" data-m="edit">${t('Edit')}</button>` : ''}</div>
        ${termsBlock(p, mine)}
      </div>
      <div class="section">
        <div class="head"><h2>${t('Worn to')}</h2><button class="btn ghost small" data-action="modal" data-m="worn">+ ${t('Add where')}</button></div>
        ${Object.keys(worn).length ? `<div class="wornlist">${Object.entries(worn).map(([o,b]) => `<span class="wchip">${esc(t(o))} <span class="mono">×${b.length}</span><span class="avs">${[...new Set(b)].map(x=>av(x,'sm')).join('')}</span></span>`).join('')}</div>` : `<p class="small-print">${t('Not worn out yet.')}</p>`}
      </div>
      <div class="section">
        <div class="head"><h2>${t('Reactions')}</h2><button class="btn ghost small" data-action="modal" data-m="react">${t('Say something')}</button></div>
        ${fits.length ? `<p class="small-print">${t('Fit, according to the group:')} ${fits.map(([f,c]) => `${t(f).toLowerCase()} (${c})`).join(', ')}</p>` : ''}
        ${p.reactions.length ? p.reactions.map(r => `<div class="review"><div class="rhead">${av(r.author,'sm')}<strong>${esc(nm(r.author))}</strong>${r.fit?`<span class="pill">${esc(t(r.fit))}</span>`:''}${r.author===me()?`<button class="linkbtn" data-action="delreact" data-id="${r.id}">${t('Delete')}</button>`:''}</div><p>${esc(r.body)}</p></div>`).join('')
          : `<p class="small-print">${t('No reactions yet. Be the first to hype it up.')}</p>`}
      </div>
    </div>
  </div>
  ${mine ? '' : `<div class="actionbar"><button class="btn accent" data-action="modal" data-m="borrow">${ask}</button>${heart(p.id,'inline')}</div>`}`;
  const sw = $('#swipe'), dots = $('#dots');
  if(sw && dots) sw.addEventListener('scroll', () => { const i = Math.round(sw.scrollLeft / sw.clientWidth); [...dots.children].forEach((d,j) => d.classList.toggle('on', i===j)); }, { passive:true });
}

/* ---------- saved ---------- */
async function viewSaved(){
  loading();
  await loadSocial();
  const ids = [...S.hearts];
  let list = [];
  if(ids.length){
    const { data, error } = await sb.from('pieces').select(PIECE_LIST).in('id', ids);
    if(error) return fail(error);
    list = data; await Promise.all([loadProfiles(list.map(p=>p.owner)), signedThumbs(list.map(p => sortPhotos(p.piece_photos)[0]?.path))]);
  }
  $('#main').innerHTML = `<div class="head"><div><span class="eyebrow">${t('{n} hearted', { n: list.length })}</span><h1>${t('Saved')}</h1><p class="lede">${t('Pieces you have your eye on.')}</p></div></div>
  ${list.length ? `<div class="grid">${list.map(tile).join('')}</div>` : ''}`;
}

/* ---------- requests ---------- */
let REQS = [];
async function viewRequests(){
  loading();
  const [, res] = await Promise.all([loadSocial(), sb.from('borrow_requests').select('*,pieces(id,title,category,piece_photos(path,created_at,position))').order('created_at', {ascending:false})]);
  renderNav('requests');
  const { data, error } = res;
  if(error) return fail(error);
  REQS = data;
  const others = [...new Set(data.map(r => r.owner===me() ? r.borrower : r.owner))];
  const [, { data:ph }] = await Promise.all([
    loadProfiles(others),
    sb.from('contacts').select('user_id,phone').in('user_id', others),
    signedThumbs(data.map(r => sortPhotos(r.pieces?.piece_photos)[0]?.path))
  ]);
  (ph||[]).forEach(c => S.phones[c.user_id] = c.phone);
  const inc = data.filter(r => r.owner===me()), out = data.filter(r => r.borrower===me());
  $('#main').innerHTML = `<div class="head"><div><h1>${t('Requests')}</h1><p class="lede">${t('Borrowers keep things moving: they set the dates and mark when a piece is back. Owners say yes and confirm.')}</p></div></div>
  <div class="stack">
    <section class="section" style="border:0;padding:0"><h2>${t('Lent out')}</h2>${inc.length ? inc.map(reqRow).join('') : `<p class="small-print">${t('No one has asked yet.')}</p>`}</section>
    <section class="section"><h2>${t('Borrowed from')}</h2>${out.length ? out.map(reqRow).join('') : `<p class="small-print">${t('You have not asked anyone yet.')}</p>`}</section>
  </div>`;
}
function chatText(r){
  const other = r.owner===me() ? r.borrower : r.owner, title = r.pieces?.title || t('piece');
  return r.owner===me()
    ? t('Hi {name}! About my {title} ({from} until {until}): when do you want to pick it up?', { name: first(other), title, from: fmt(r.date_from), until: fmt(r.date_until) })
    : t('Hi {name}! I asked for your {title} on SHARING=CARING ({from} until {until}). When suits you for pick-up?', { name: first(other), title, from: fmt(r.date_from), until: fmt(r.date_until) });
}
const otherOf = r => r.owner===me() ? r.borrower : r.owner;
const waLink = r => `https://wa.me/${cleanPhone(S.phones[otherOf(r)])}?text=${encodeURIComponent(chatText(r))}`;
// Signal opens the chat by number but can't pre-fill text, so the message is copied for pasting
const signalBtn = (r, cls='btn ghost small') => S.phones[otherOf(r)] ? `<a class="${cls}" href="https://signal.me/#p/+${cleanPhone(S.phones[otherOf(r)])}" target="_blank" rel="noopener" data-action="signal" data-msg="${esc(chatText(r))}">Signal</a>` : '';
async function copyMsg(t){ try { await navigator.clipboard.writeText(t); toast(t('Message copied: paste it in Signal')); } catch { /* clipboard blocked: Signal still opens */ } }
function reqRow(r){
  const owner = r.owner===me(), other = owner ? r.borrower : r.owner, o = esc(nm(other)), p = r.pieces;
  const piece = p ? { title:p.title, category:p.category } : { title:t('Piece'), category:'' };
  const A = (s,l,g) => `<button class="btn small ${g?'ghost':''}" data-action="req" data-id="${r.id}" data-s="${s}">${l}</button>`;
  const T = (c,l) => `<span class="st ${c}">${l}</span>`;
  const W = `<a class="btn ghost small" href="${waLink(r)}" target="_blank" rel="noopener">WhatsApp</a>` + signalBtn(r);
  let line, act;
  if(owner){
    line = t(r.status==='pending' ? '{name} asks for your {title}' : '{name} borrows your {title}', { name: `<strong>${o}</strong>`, title: `<strong>${esc(piece.title)}</strong>` });
    act = { pending:A('accepted',t('Lend it'))+A('declined',t('Decline'),1), accepted:T('accepted',t('With {name}', { name:o }))+W, returned:A('confirmed',t('Confirm it’s back'))+A('accepted',t('Not back yet'),1), confirmed:T('',t('Back home')), declined:T('',t('Declined')), cancelled:T('',t('Cancelled')) }[r.status];
    if(r.status==='returned') line += `<p class="flag">${t('{name} says it’s back. Check it and confirm.', { name:o })}</p>`;
  }else{
    line = t(r.status==='pending' ? 'You asked for {name}’s {title}' : 'You borrow {name}’s {title}', { name: `<strong>${o}</strong>`, title: `<strong>${esc(piece.title)}</strong>` });
    act = { pending:T('pending',t('Waiting for {name}', { name:o }))+W+A('cancelled',t('Cancel'),1), accepted:A('returned',t('I brought it back'))+W, returned:T('pending',t('Waiting for {name} to confirm', { name:o })), confirmed:T('',t('Done, thank you!')), declined:T('',t('Declined')), cancelled:T('',t('Cancelled')) }[r.status];
    if(r.status==='accepted') line += `<p class="flag">${t('{name} said yes! Bring it back by {date}.', { name:o, date:fmt(r.date_until) })}</p>`;
  }
  const thumb = p ? `<a href="#/piece/${p.id}" aria-label="${t('Open {title}', { title: esc(p.title) })}">${photo(sortPhotos(p.piece_photos)[0], piece, false, true)}</a>` : photo(null, piece, false);
  return `<div class="row-card">${thumb}<div style="min-width:0"><div>${line}</div><p class="mono">${t('{from} until {until}', { from: fmt(r.date_from), until: fmt(r.date_until) })}</p>${r.message?`<p>“${esc(r.message)}”</p>`:''}</div><div class="actions">${act}</div></div>`;
}

/* ---------- looking for: ask your friends for a piece ---------- */
const todayISO = () => new Date().toISOString().slice(0, 10);
const callOpen = c => c.status === 'open' && (!c.needed_by || c.needed_by >= todayISO());
// Several categories and sizes are stored comma-separated in the same fields: "dress,skirt" and "XS,S"
const callList = v => String(v || '').split(',').map(x => x.trim()).filter(Boolean);
const sizeLabel = x => /^\d+$/.test(x) ? t('Shoe') + ' ' + x : x;
const callMeta = c => [callList(c.category).map(k => catLabel(k)).join(' / '), callList(c.size).map(sizeLabel).join(', '), c.needed_by ? t('by {date}', { date: fmt(c.needed_by) }) : ''].filter(Boolean).join(' · ');
const callLink = id => `${APP_URL}#/call/${id}`;
// The message is editable in the share window; the link is always added at the end
const callShareMsg = c => t('I’m looking for: {what}{meta}. Got something I could borrow?', { what: c.what, meta: callMeta(c) ? ' (' + callMeta(c) + ')' : '' });
const replyCount = c => c.call_replies?.[0]?.count ?? 0;
// S.calls stays null when the database update hasn't run yet, so the row simply doesn't show
async function loadCalls(){
  let res; try { res = await sb.from('calls').select('id,owner,what,details,category,size,needed_by,status,created_at,call_replies(count)').order('created_at', { ascending:false }); } catch(e){ res = { error:e }; }
  const { data, error } = res;
  if(error){ S.calls = null; return; }
  S.calls = (data || []).filter(callOpen);
  await loadProfiles(S.calls.map(c => c.owner));
}
function callCard(c){
  const n = replyCount(c);
  const pen = c.owner === me() ? `<button type="button" class="lpen" data-action="call-pen" data-id="${c.id}" aria-label="${t('Edit call')}" title="${t('Edit call')}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4"/></svg></button>` : '';
  return `<div class="lwrap"><a class="lcard" href="#/call/${c.id}"><span class="lwho">${av(c.owner, 'sm')}${c.owner === me() ? t('You') : esc(first(c.owner))}</span>
    <strong>${esc(c.what)}</strong>${callMeta(c) ? `<span class="lmeta">${esc(callMeta(c))}</span>` : ''}${newRepliesOf(c) ? `<span class="lrep new">${tp(newRepliesOf(c), '{n} new reply', '{n} new replies')}</span>` : n ? `<span class="lrep">${tp(n, '{n} reply', '{n} replies')}</span>` : ''}</a>${pen}</div>`;
}
// Calls sit in their own grey box above the search, so the search clearly belongs to the pieces below.
// No open calls: just one calm line, like the other notices.
const callStrip = () => S.calls == null ? ''
  : !S.calls.length ? `<div class="banner callbanner"><span>${t('Need something for an event? Ask all your friends at once.')}</span><button class="btn ghost small" data-action="modal" data-m="call">+ ${t('Post a call')}</button></div>`
  : `<section class="looking"><div class="lhead"><h2>${t('Looking for')} <span class="lcount">${S.calls.length}</span></h2><button class="btn ghost small" data-action="modal" data-m="call">+ ${t('Post a call')}</button></div>
    <div class="lrow">${S.calls.map(callCard).join('')}</div></section>`;

async function viewCall(id){
  loading();
  const [cr, rr] = await Promise.all([
    sb.from('calls').select('*').eq('id', id).maybeSingle(),
    sb.from('call_replies').select('*').eq('call_id', id).order('created_at'),
    loadSocial(),
    S.pieces.length ? null : sb.from('pieces').select(PIECE_LIST).order('created_at', { ascending:false }).then(r => { if(r.data) S.pieces = r.data; })
  ]);
  renderNav('call');
  const c = cr.data;
  if(!c){ $('#main').innerHTML = `<a class="back" href="#/pieces">← ${t('Pieces')}</a><div class="head"><div><h1>${t('Not found')}</h1><p class="lede">${t('This call was removed, or only friends of the person who posted it can see it.')}</p></div></div>`; return; }
  S.call = c; S.replies = rr.data || [];
  if(c.owner === me()){ const rep = seenGet().rep || {}; rep[c.id] = S.replies.length; saveSeen({ rep }); (S.calls || []).forEach(x => { if(x.id === c.id) x.call_replies = [{ count:S.replies.length }]; }); }
  const mine = c.owner === me(), open = callOpen(c), f = first(c.owner);
  const cCats = callList(c.category), cSizes = callList(c.size);
  const byCat = S.pieces.filter(p => p.owner !== me() && (!cCats.length || cCats.includes(p.category)));
  const exact = byCat.filter(p => !cSizes.length || cSizes.includes(p.size)), matches = (exact.length ? exact : byCat).slice(0, 6);
  const seen = id => S.pieces.find(p => p.id === id);
  await Promise.all([
    loadProfiles([c.owner, ...S.replies.map(r => r.author)]),
    signedThumbs([...matches, ...S.replies.map(r => seen(r.piece_id)).filter(Boolean)].map(p => sortPhotos(p.piece_photos)[0]?.path))
  ]);
  const replyRow = r => {
    const p = seen(r.piece_id), who = esc(first(r.author)), isMe = r.author === me();
    const lock = !p && r.piece_id && !isMe && !S.friends.has(r.author);
    const thumb = p ? `<a href="#/piece/${p.id}" aria-label="${t('Open {title}', { title: esc(p.title) })}">${photo(sortPhotos(p.piece_photos)[0], p, false, true)}</a>` : `<a href="#/person/${r.author}">${av(r.author, 'lg')}</a>`;
    const ttl = `<strong>${esc(p?.title || r.piece_title || t('a piece'))}</strong>`;
    const line = r.piece_id ? (isMe ? t('You have {title}', { title: ttl }) : t('{name} has {title}', { name: `<strong>${who}</strong>`, title: ttl })) : (isMe ? t('You replied') : t('{name} replied', { name: `<strong>${who}</strong>` }));
    const acts = [
      p && !isMe && mine ? `<a class="btn small" href="#/piece/${p.id}">${t('Ask to borrow')}</a>` : '',
      lock ? (S.outgoing.includes(r.author) ? `<span class="st pending">${t('Friend request sent')}</span>`
        : S.incoming.includes(r.author) ? `<button class="btn small" data-action="fr-accept" data-id="${r.author}">${t('Accept {name}', { name: who })}</button>`
        : `<button class="btn ghost small" data-action="fr-add" data-id="${r.author}">${t('Add {name} as a friend', { name: who })}</button>`) : '',
      isMe || mine ? `<button class="linkbtn" data-action="reply-del" data-id="${r.id}">${t('Remove')}</button>` : ''
    ].join('');
    return `<div class="row-card reply">${thumb}<div style="min-width:0"><div>${line}</div>${r.note ? `<p>“${esc(r.note)}”</p>` : ''}${lock ? `<p class="small-print">${t('Become friends with {name} to see the photo.', { name: who })}</p>` : ''}</div><div class="actions">${acts}</div></div>`;
  };
  const just = S.justPosted === c.id; S.justPosted = null;
  $('#main').innerHTML = `<a class="back" href="#/pieces">← ${t('Pieces')}</a>
  <div class="head"><div><span class="eyebrow">${mine ? t('You are looking for') : t('{name} is looking for', { name: esc(f) })}</span><h1>${esc(c.what)}</h1>
    ${callMeta(c) ? `<p class="mono">${esc(callMeta(c))}</p>` : ''}${c.details ? `<p class="lede">${esc(c.details)}</p>` : ''}
    ${!open ? `<p><span class="st ${c.status === 'found' ? 'accepted' : ''}">${c.status === 'found' ? t('Found!') : t('Closed')}</span></p>` : ''}</div></div>
  <div class="stack">
    ${mine && open ? `<section class="card ${just ? 'justposted' : ''}" style="max-width:none">${just ? `<h3>${t('Now tell your friends')}</h3><p class="small-print">${t('Most people only open the app when they need something, so share your call where they already are.')}</p>` : ''}
      <div class="actions"><button class="btn small" data-action="call-share">${t('Share')}</button>
      <button class="btn ghost small" data-action="call-found">${t('Found it!')}</button><button class="btn ghost small" data-action="call-edit">${t('Edit')}</button><button class="linkbtn" data-action="call-del">${t('Delete')}</button></div></section>` : ''}
    ${mine && !open ? `<div class="actions"><button class="btn ghost small" data-action="call-edit">${t('Edit and open again')}</button><button class="linkbtn" data-action="call-del">${t('Delete')}</button></div>` : ''}
    ${!mine && open ? `<section class="card" style="max-width:none"><h3>${t('Can you help {name}?', { name: esc(f) })}</h3><p class="small-print">${t('Pick something from your pieces, or add it if it’s not on here yet.')}</p>
      <div class="actions"><button class="btn small" data-action="reply-open">${t('I have something')}</button></div></section>` : ''}
    <section class="section" style="border:0;padding:0"><h2>${t('Replies')}</h2>${S.replies.length ? S.replies.map(replyRow).join('') : `<p class="small-print">${mine ? t('No replies yet.') : t('No replies yet. Be the first!')}</p>`}</section>
    ${mine && open && matches.length ? `<section class="section"><h2>${t('Maybe already here')}</h2><p class="small-print">${exact.length && cSizes.length ? t('Pieces from your friends in this category and size.') : t('Pieces from your friends in this category.')}</p><div class="grid">${matches.map(tile).join('')}</div></section>` : ''}
  </div>`;
}
// Size choices follow the ticked categories (shoe sizes for shoes, and so on); ticked sizes stay ticked
function callSizeField(startCats, startSizes){
  const cats = startCats || [...document.querySelectorAll('[name=cCat]:checked')].map(x => x.value);
  const keep = new Set(startSizes || [...document.querySelectorAll('[name=cSize]:checked')].map(x => x.value));
  const groups = cats.length ? [...new Set(cats.flatMap(sizeGroups))] : ['Letter sizes', 'EU sizes'];
  const order = Object.keys(SIZES).filter(g => groups.includes(g));
  return order.map(g => `<span class="hint sizegroup">${t(g)}</span><div class="opts">${SIZES[g].map(x => `<label><input type="checkbox" name="cSize" value="${x}" ${keep.has(x) ? 'checked' : ''}> ${x}</label>`).join('')}</div>`).join('');
}
function callForm(){
  const c = S.editCall || {}, cats = callList(c.category), sizes = callList(c.size);
  return `<span class="eyebrow">${S.editCall ? t('Edit call') : t('New call')}</span><h2>${t('Ask your friends')}</h2><form data-form="call">
    ${field('cWhat', t('What are you looking for?'), `<input type="text" id="cWhat" required maxlength="120" placeholder="${t('e.g. A long dress for a gala')}" value="${esc(c.what || '')}">`)}
    <div class="field"><span class="legend">${t('Category')}</span><div class="opts" id="cCats">${Object.keys(CATS).map(k => `<label><input type="checkbox" name="cCat" value="${k}" ${cats.includes(k) ? 'checked' : ''}> ${t(CATS[k][0])}</label>`).join('')}</div></div>
    <div class="field"><span class="legend">${t('Size')}</span><div id="cSizes">${callSizeField(cats, sizes)}</div></div>
    <p class="hint">${t('Tick as many as you like. Nothing ticked means anything goes.')}</p>
    ${field('cBy', t('Needed by (optional)'), `<input type="date" id="cBy" min="${todayISO()}" value="${esc(c.needed_by || '')}">`)}
    ${field('cDetails', t('Anything else? (optional)'), `<textarea id="cDetails" maxlength="500" placeholder="${t('Colour, style, how formal it is…')}">${esc(c.details || '')}</textarea>`)}
    <p class="hint">${t('All your friends can see this, until the date has passed or you found something.')}</p>
    <div class="actions">${cancel}<button class="btn accent">${S.editCall ? t('Save') : t('Post')}</button></div></form>`;
}
function replyForm(){
  const own = S.pieces.filter(p => p.owner === me());
  return `<span class="eyebrow">${t('Reply to {name}', { name: esc(first(S.call.owner)) })}</span><h2>${t('I have something')}</h2><form data-form="reply">
    <div class="replynew"><button type="button" class="btn accent" data-action="reply-add">+ ${t('Add it as a new piece')}</button>
      <p class="small-print">${t('Add a photo and a few details. It goes on your profile and is sent as your reply.')}</p></div>
    ${own.length ? `<div class="field"><span class="legend">${t('Or pick one of your pieces')}</span><div class="pickpiece">${own.map(p => `<label>${photo(sortPhotos(p.piece_photos)[0], p, false, true)}<span><input type="radio" name="rPiece" value="${p.id}"> ${esc(p.title)}</span></label>`).join('')}
      <label class="nopiece"><span><input type="radio" name="rPiece" value="" ${own.length ? '' : 'checked'}> ${t('No piece, just a note')}</span></label></div></div>` : ''}
    ${field('rNote', t('Note (optional)'), `<textarea id="rNote" maxlength="300" placeholder="${t('e.g. It’s floor length, a bit tight at the waist')}"></textarea>`)}
    <div class="actions">${cancel}<button class="btn">${t('Send')}</button></div></form>`;
}

/* ---------- friends ---------- */
async function viewFriends(){
  loading();
  const fr = [...S.friends];
  const [sugg, pc] = await Promise.all([suggestions(), fr.length ? sb.from('pieces').select('owner').in('owner', fr) : { data:[] }]);
  renderNav('friends');
  const count = {}; (pc.data || []).forEach(x => count[x.owner] = (count[x.owner] || 0) + 1);
  const pieces = id => { const n = count[id] || 0; return n ? tp(n, '{n} piece', '{n} pieces') : t('No pieces yet'); };
  const person = (id, actions, sub='') => `<div class="row-card person"><a href="#/person/${id}" aria-label="${t('See {name}’s profile', { name: esc(nm(id)) })}">${av(id,'lg')}</a><div style="min-width:0"><a class="plain" href="#/person/${id}"><strong>${esc(nm(id))}</strong></a>${sub?`<p>${sub}</p>`:''}</div><div class="actions">${actions}</div></div>`;
  $('#main').innerHTML = `<div class="head"><div><h1>${t('Friends')}</h1><p class="lede">${t('Friendship works both ways: you only see each other’s pieces once you both say yes.')}</p></div></div>
  <div class="stack">
    ${S.incoming.length ? `<section class="section" style="border:0;padding:0"><h2>${t('Asked you')}</h2>${S.incoming.map(id => person(id, `<button class="btn small" data-action="fr-accept" data-id="${id}">${t('Accept')}</button><button class="btn ghost small" data-action="fr-remove" data-id="${id}">${t('Ignore')}</button>`)).join('')}</section>` : ''}
    ${sugCards(sugg)}
    <section class="card" style="max-width:none">
      <h3>${t('Invite your friends')}</h3>
      <div class="actions">${inviteButtons()}</div>
    </section>
    <section class="section" style="border:0;padding:0"><h2>${t('Find people')}</h2>
      <form data-form="search" class="actions" style="display:flex"><div class="field" style="flex:1;min-width:0"><input type="search" id="q" placeholder="${t('Search by name')}" aria-label="${t('Search by name')}" required></div><button class="btn">${t('Search')}</button></form>
      <div id="results"></div></section>
    ${S.outgoing.length ? `<section class="section"><h2>${t('Waiting for a yes')}</h2>${S.outgoing.map(id => person(id, `<button class="btn ghost small" data-action="fr-remove" data-id="${id}">${t('Cancel')}</button>`)).join('')}</section>` : ''}
    <section class="section"><h2>${t('Your friends')}</h2>${S.friends.size ? fr.map(id => person(id, `<button class="linkbtn" data-action="fr-remove" data-id="${id}" data-confirm="1">${t('Remove')}</button>`, pieces(id))).join('') : `<p class="small-print">${t('No friends yet. Invite someone and search for their name.')}</p>`}</section>
  </div>`;
}
/* Suggestions: whoever invited you first, then friends of your friends (most mutual friends first) */
async function suggestions(){
  await loadSocial();
  const mine = [...S.friends], inv = inviterId(), via = {}, hidden = hiddenSugg();
  if(mine.length){
    let res; try { res = await sb.from('friendships').select('requester,addressee').eq('status', 'accepted')
      .or(mine.map(f => `requester.eq.${f},addressee.eq.${f}`).join(',')); } catch(e){ res = {}; }
    // a friendship between one of your friends and someone you don't know yet = a suggestion, "via" that friend
    (res.data || []).forEach(r => {
      const [a, b] = [r.requester, r.addressee], f = S.friends.has(a) ? a : S.friends.has(b) ? b : null, x = f === a ? b : a;
      if(f && x !== me() && !S.friends.has(x)) (via[x] = via[x] || new Set()).add(f);
    });
  }
  const list = [];
  if(inv && !S.friends.has(inv)) list.push({ id:inv, invited:true, via:[] });
  Object.entries(via).sort((a, b) => b[1].size - a[1].size).forEach(([id, v]) => { if(id !== inv && !hidden.includes(id)) list.push({ id, mutual:v.size, via:[...v] }); });
  await loadProfiles(list.map(x => x.id));
  return list.filter(x => S.profiles[x.id]).slice(0, 12);
}
const hiddenSugg = () => (store.get('sc_sugg_hide') || '').split(',').filter(Boolean);
// "Friends with Noor and Sanne", like Instagram does it
function mutualText(x){
  if(x.invited) return t('Invited you');
  const n = x.via.map(f => esc(first(f)));
  return n.length === 1 ? t('Friends with {a}', { a:n[0] }) : n.length === 2 ? t('Friends with {a} and {b}', { a:n[0], b:n[1] })
    : t('Friends with {a}, {b} and {n} more', { a:n[0], b:n[1], n:n.length - 2 });
}
// "People you may know": a row of cards with one-tap add, and × to hide someone for good
function sugCards(list){
  list = list.filter(x => !S.friends.has(x.id) && !S.outgoing.includes(x.id) && !S.incoming.includes(x.id));
  if(!list.length) return '';
  return `<section class="looking sugcards"><div class="lhead"><h2>${t('People you may know')}</h2></div><div class="srow">${list.map(x => `<div class="scard">
    ${x.invited ? '' : `<button type="button" class="sx" data-action="sugg-hide" data-id="${x.id}" aria-label="${t('Hide')}" title="${t('Hide')}">×</button>`}
    <a class="plain scenter" href="#/person/${x.id}">${av(x.id, 'xl')}<strong>${esc(nm(x.id))}</strong></a>
    <span class="smut">${x.via.length ? `<span class="avs">${x.via.slice(0, 2).map(f => av(f, 'sm')).join('')}</span>` : ''}${mutualText(x)}</span>
    <button class="btn small" data-action="fr-add" data-id="${x.id}" aria-label="${t('Add {name} as a friend', { name: esc(first(x.id)) })}">${t('Add')}</button></div>`).join('')}</div></section>`;
}
function sugRow(x){
  const act = S.incoming.includes(x.id) ? `<button class="btn small" data-action="fr-accept" data-id="${x.id}">${t('Accept')}</button>`
    : S.outgoing.includes(x.id) ? `<span class="st pending">${t('Asked')}</span>`
    : `<button class="btn small" data-action="fr-add" data-id="${x.id}">${t('Add friend')}</button>`;
  const sub = mutualText(x);
  return `<div class="row-card person"><a href="#/person/${x.id}">${av(x.id,'lg')}</a><div style="min-width:0"><a class="plain" href="#/person/${x.id}"><strong>${esc(nm(x.id))}</strong></a><p>${sub}</p></div><div class="actions">${act}</div></div>`;
}
/* Right after sign-up: add friends first, starting with whoever sent you the link */
async function viewAddFriends(){
  loading();
  await loadSocial();
  const inv = inviterId();
  if(inv){
    await loadProfiles([inv]);
    const known = S.friends.has(inv) || S.outgoing.includes(inv), flag = 'sc_asked_' + inv;
    // Asked once on your behalf; if you press Undo we never ask again
    if(S.profiles[inv] && !known && !store.get(flag)){
      store.set(flag, '1');
      const q = S.incoming.includes(inv)
        ? sb.from('friendships').update({ status:'accepted' }).eq('requester', inv).eq('addressee', me())
        : sb.from('friendships').insert({ addressee:inv });
      const { error } = await q; if(!error){ S.socialAt = 0; S.pageCache = {}; await loadSocial(); }
    }
  }
  const sugg = (await suggestions()).filter(x => x.id !== inv);
  renderNav('add-friends');
  const f = inv && S.profiles[inv] ? first(inv) : '';
  const invCard = !f ? '' : `<section class="card invcard" style="max-width:none"><div class="row-card person" style="border:0;padding:0;background:none">${av(inv,'lg')}<div style="min-width:0"><strong>${esc(nm(inv))}</strong><p>${t('Invited you')}</p></div><div class="actions">${
      S.friends.has(inv) ? `<span class="st accepted">${t('Friends')}</span>`
    : S.outgoing.includes(inv) ? `<span class="st pending">${t('Asked')}</span><button class="linkbtn" data-action="fr-remove" data-id="${inv}">${t('Undo')}</button>`
    : `<button class="btn small" data-action="fr-add" data-id="${inv}">${t('Add friend')}</button>`}</div></div>
    ${S.outgoing.includes(inv) ? `<p class="small-print">${t('We sent {name} a friend request for you. Once {name} says yes, you see each other’s pieces.', { name: esc(f) })}</p>` : ''}</section>`;
  $('#main').innerHTML = `<div class="head"><div><span class="eyebrow">${t('Getting started')}</span><h1>${t('Add your friends')}</h1><p class="lede">${t('You only see each other’s pieces once you’re friends.')}</p></div></div>
  <div class="stack">
    ${invCard}
    ${sugg.length ? `<section class="section" style="border:0;padding:0"><h2>${t('Suggested')}</h2>${sugg.map(sugRow).join('')}</section>` : ''}
    <section class="section" style="border:0;padding:0"><h2>${t('Find people')}</h2>
      <form data-form="search" class="actions" style="display:flex"><div class="field" style="flex:1;min-width:0"><input type="search" id="q" placeholder="${t('Search by name')}" aria-label="${t('Search by name')}" required></div><button class="btn">${t('Search')}</button></form>
      <div id="results"></div></section>
    <section class="section" style="border:0;padding:0"><h2>${t('Not on here yet?')}</h2><p class="small-print">${t('Send them your personal link. When they join, you’re asked to be friends straight away.')}</p>
      <div class="actions">${inviteButtons()}</div></section>
    <div class="actions"><a class="btn accent" href="#/welcome">${t('Next')}</a></div>
  </div>`;
}
const inviteButtons = () => `<button class="btn small" data-action="copy">${t('Copy invite link')}</button>
  <a class="btn ghost small" href="https://wa.me/?text=${encodeURIComponent(t('Psst… someone thinks you’ve got great style: me! Join me on SHARING=CARING, so we can borrow each other’s fancy clothes') + ' ' + inviteLink())}" target="_blank" rel="noopener">${t('Share in WhatsApp')}</a>`;

/* Getting started guide */
function guideState(ownPieces){
  return { profile: !!S.me?.name && Number.isInteger(S.me?.avatar), friends: S.friends.size > 0 || S.outgoing.length > 0,
           piece: ownPieces > 0, borrow: (S.myAsks || 0) > 0 || !!store.get('sc_guide_browsed') };
}
const skipped = () => (store.get('sc_guide_skip') || '').split(',').filter(Boolean);
// A step counts as finished when it's done or skipped
const guideLeft = st => Object.keys(st).filter(k => !st[k] && !skipped().includes(k)).length;
async function viewWelcome(){
  loading();
  const [sugg, own] = await Promise.all([suggestions(), sb.from('pieces').select('id').eq('owner', me())]);
  renderNav('welcome');
  const st = guideState((own.data || []).length), sk = skipped(), left = guideLeft(st), done = 4 - left;
  const first = Object.keys(st).find(k => !st[k] && !sk.includes(k));
  const step = (n, key, title, text, body) => { const isDone = st[key], isSkip = !isDone && sk.includes(key);
    return `<li class="gstep ${isDone ? 'done' : ''} ${isSkip ? 'skipped' : ''} ${first === key ? 'now' : ''}">
    <span class="gnum" aria-hidden="true">${isDone ? '✓' : n}</span><div class="gbody"><h3>${title}${isDone ? `<span class="visually-hidden"> (${t('done')})</span>` : ''}</h3>${text ? `<p>${text}</p>` : ''}${body || ''}
    ${isDone ? '' : isSkip ? `<span class="small-print">${t('Skipped for now')}</span>` : `<button class="linkbtn skip" data-action="guide-skip" data-k="${key}">${t('Skip for now')}</button>`}</div></li>`; };
  $('#main').innerHTML = `<div class="head"><div><span class="eyebrow">${t('Getting started')} · ${t('{n} of 4', { n: done })}</span><h1>${S.me?.name ? t('Welcome, {name}!', { name: esc(S.me.name.split(' ')[0]) }) : t('Welcome!')}</h1></div></div>
  <ol class="guide">
    ${step(1, 'profile', t('Make it yours'), t('Your name and picture.'),
      `<div class="actions"><a class="btn ${st.profile ? 'ghost' : ''} small" href="#/edit">${t('Edit profile')}</a></div>`)}
    ${step(2, 'friends', t('Add your friends'), t('You only see each other’s profile once you’re friends.'),
      `${sugg.length ? `<div class="sugg">${sugg.map(sugRow).join('')}</div>` : ''}
       <p class="small-print">${t('Someone missing? Send them your personal link.')}</p>
       <div class="actions">${inviteButtons()}</div>`)}
    ${step(3, 'piece', t('Add your first piece'), '',
      `<div class="actions"><button class="btn ${st.piece ? 'ghost' : ''} small" data-action="modal" data-m="add">+ ${t('Add a piece')}</button></div>`)}
    ${step(4, 'borrow', t('Start borrowing'), '',
      `<div class="actions"><a class="btn ${st.borrow ? 'ghost' : ''} small" href="#/pieces" data-action="guide-browse">${t('Browse pieces')}</a></div>`)}
  </ol>
  <div class="actions" style="margin-top:20px">${left === 0 ? `<span class="small-print">${t('You’re all set. Happy sharing!')}</span>` : ''}
    <button class="linkbtn" data-action="guide-hide">${left === 0 ? t('Close the guide') : t('Hide this guide')}</button></div>`;
}

async function search(q){
  const { data, error } = await sb.from('profiles').select(PROFILE_COLS).ilike('name', `%${q.replace(/[%_]/g,'')}%`).neq('id', me()).limit(20);
  if(error) return fail(error);
  data.forEach(p => S.profiles[p.id] = p);
  $('#results').innerHTML = data.length ? data.map(p => {
    const state = S.friends.has(p.id) ? `<span class="st accepted">${t('Friends')}</span>`
      : S.outgoing.includes(p.id) ? `<span class="st pending">${t('Waiting')}</span>`
      : S.incoming.includes(p.id) ? `<button class="btn small" data-action="fr-accept" data-id="${p.id}">${t('Accept')}</button>`
      : `<button class="btn small" data-action="fr-add" data-id="${p.id}">${t('Add friend')}</button>`;
    return `<div class="row-card person">${av(p.id,'lg')}<div style="min-width:0"><strong>${esc(p.name)}</strong></div><div class="actions">${state}</div></div>`;
  }).join('') : `<p class="small-print">${t('No one found. Check the spelling, or send them the invite link.')}</p>`;
}

/* ---------- profile ---------- */
async function viewPerson(id){
  loading();
  const mine = id === me();
  // Everything at once; the database only returns what you may see, so this is safe for non-friends too
  const [, , a, b, c, callsRes] = await Promise.all([
    loadSocial(), loadProfiles([id]),
    sb.from('profile_extras').select('bio,backdrop').eq('user_id', id).maybeSingle(),
    sb.from('pieces').select(PIECE_LIST).eq('owner', id).order('created_at', { ascending:false }),
    sb.from('friendships').select('requester,addressee').eq('status', 'accepted').or(`requester.eq.${id},addressee.eq.${id}`),
    Promise.resolve().then(() => sb.from('calls').select('id,owner,what,details,category,size,needed_by,status,created_at,call_replies(count)').eq('owner', id).order('created_at', { ascending:false })).catch(e => ({ error:e }))
  ]);
  const myCalls = friend0 => (S.profileCalls = friend0 && !callsRes.error ? (callsRes.data || []).filter(callOpen) : []);
  renderNav(mine ? 'profile' : 'person');
  const friend = mine || S.friends.has(id);
  let ex = null, pieces = [], theirFriends = [];
  if(friend){
    ex = a.data; pieces = b.data || [];
    theirFriends = [...new Set((c.data || []).map(r => r.requester === id ? r.addressee : r.requester))];
    await Promise.all([loadProfiles(theirFriends), signed([ex?.backdrop]), signedThumbs(pieces.map(p => sortPhotos(p.piece_photos)[0]?.path))]);
    // people you know first, then the rest
    theirFriends.sort((x, y) => (x === me() ? -2 : S.friends.has(x) ? -1 : 0) - (y === me() ? -2 : S.friends.has(y) ? -1 : 0) || nm(x).localeCompare(nm(y)));
  }
  S.flist = { id, mine, list: theirFriends };
  const bd = ex?.backdrop && S.urls[ex.backdrop];
  const action = mine ? ''
    : friend ? '' : S.outgoing.includes(id) ? `<span class="st pending">${t('Waiting for a yes')}</span>`
    : S.incoming.includes(id) ? `<button class="btn small" data-action="fr-accept" data-id="${id}">${t('Accept')}</button>`
    : `<button class="btn small" data-action="fr-add" data-id="${id}">${t('Add friend')}</button>`;
  $('#main').innerHTML = `${mine ? '' : `<a class="back" href="#/friends">← ${t('Friends')}</a>`}
  <section class="pcard profile ${mine ? 'mine' : ''}">
    ${mine ? `<a class="pedit" href="#/edit" aria-label="${t('Edit profile')}" title="${t('Edit profile')}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4"/></svg></a>` : ''}
    <div class="phead">${av(id,'xxl')}<h1 class="pname">${(() => { const [f, ...r] = (id === me() ? (S.me?.name || t('You')) : nm(id)).trim().split(/\s+/); return esc(f) + (r.length ? '<br>' + esc(r.join(' ')) : ''); })()}</h1>
      <div class="pinfo">
        ${friend ? `<span class="pstats">${tp(pieces.length, '{n} piece', '{n} pieces')}<span class="sep" aria-hidden="true">|</span>${theirFriends.length ? `<button type="button" class="pstat-link" data-action="modal" data-m="flist">${tp(theirFriends.length, '{n} friend', '{n} friends')}</button>` : t('0 friends')}</span>` : ''}
        ${ex?.bio ? `<p class="pbio">${esc(ex.bio)}</p>` : mine ? `<p class="pbio empty-bio"><a href="#/edit">${t('Add a bio and a closet photo')} →</a></p>` : ''}
      </div></div>
  </section>
  ${(friend && theirFriends.length) || action ? `<div class="pfloat friends scroller">${action ? `<span class="pact">${action}</span>` : ''}${(friend ? theirFriends : []).map(f => {
        const known = f === me() || S.friends.has(f), waiting = S.outgoing.includes(f);
        return `<a class="friend" href="#/person/${f}">${av(f)}${esc(f === me() ? t('You') : nm(f))}${known ? '' : waiting ? ` <span class="count mono">${t('asked')}</span>` : ' <span class="count">+</span>'}</a>`;
      }).join('')}</div>` : ''}
  ${(() => { const cl = myCalls(friend); return cl.length ? `<section class="looking pcalls"><div class="lhead"><h2>${t('Looking for')} <span class="lcount">${cl.length}</span></h2>${mine ? `<button class="btn ghost small" data-action="modal" data-m="call">+ ${t('Post a call')}</button>` : ''}</div>
    <div class="lrow">${cl.map(callCard).join('')}</div></section>` : ''; })()}
  <section class="pcard ppieces">
  ${mine ? `<div class="grid">${pieces.map(tile).join('')}<button class="tile addpiece" data-action="modal" data-m="add"><span class="plus" aria-hidden="true">+</span><span>${t('Add a piece')}</span></button></div>`
   : friend ? (pieces.length ? `<div class="grid">${pieces.map(tile).join('')}</div>` : `<div class="empty">${t('No pieces here yet.')}</div>`)
           : `<div class="empty">${t('You only see someone’s wardrobe once you are friends.')}</div>`}
  </section>`;
  setBackdrop(bd);
}

// Closet photo as the full page background behind the profile (Hyves-style)
function setBackdrop(url){
  let el = $('#pageBg');
  if(!el){ el = document.createElement('div'); el.id = 'pageBg'; el.setAttribute('aria-hidden', 'true'); document.body.prepend(el); }
  S.bg = url || null;
  el.style.backgroundImage = url ? `url('${url.replace(/'/g, '%27')}')` : '';
  document.body.classList.toggle('has-bg', !!url);
}

let backdropFile = null, backdropRemove = false;
async function viewProfile(){
  const [{ data:c }, { data:ex }] = await Promise.all([
    sb.from('contacts').select('phone').eq('user_id', me()).maybeSingle(),
    sb.from('profile_extras').select('bio,backdrop').eq('user_id', me()).maybeSingle()
  ]);
  S.myExtras = ex || {}; S.avAll = false; S.avRow = null; backdropFile = null; backdropRemove = false; S.customBlob = null; S.customUrl = null; S.customSug = null;
  if(ex?.backdrop) await signed([ex.backdrop]);
  const welcome = !S.me?.name;
  setTimeout(renderInk, 0);
  $('#main').innerHTML = `${welcome ? '' : `<a class="back" href="#/profile">← ${t('Your profile')}</a>`}<div class="head"><div><h1>${welcome ? t('Welcome!') : t('Edit profile')}</h1><p class="lede">${welcome ? t('Tell your friends who you are.') : esc(S.user.email)}</p></div></div>
  <div class="card">
    <form data-form="profile">
      ${field('pName',t('Your name'),'<input type="text" id="pName" autocomplete="name" required value="'+esc(S.me?.name||'')+'">')}
      ${field('pPhone',t('Phone number (for WhatsApp or Signal)'),'<input type="tel" id="pPhone" autocomplete="tel" placeholder="+31 6 12345678" value="'+esc(c?.phone||'')+'">')}
      <p class="hint">${t('Only your friends can see your number. They use it to plan pick-ups with you on WhatsApp or Signal.')}</p>
      <div class="field"><span class="legend">${t('Your picture')}</span>
        <div class="avrow"><span class="av xxl" id="avPreview" aria-hidden="true">${esc(initial(me()))}</span>
          <p class="hint">${t('Pick a texture, then a colour for your letter.')}</p></div>
        <span class="legend sub">${t('Texture')}</span>
        <div class="avpick"><div id="avTiles" class="avtiles">${avTiles(isCustom(S.me) ? -1 : avatarOf(me()))}</div></div>
        <div class="actions avmore"><button type="button" class="btn ghost small" data-action="av-surprise">${t('Generate')}</button>
          <button type="button" class="linkbtn" data-action="av-all" id="avAllBtn">${t('Show all')}</button></div>
        <span class="legend sub">${t('Letter colour')}</span>
        <div class="inkpick" id="inkPick"></div>
        <input type="hidden" id="pInk" value="${esc(S.me?.avatar_ink || '')}">
      </div>
      ${field('pBio',t('Bio (optional)'),`<textarea id="pBio" maxlength="300" placeholder="${t('e.g. Hey! I’m Sara and I love sustainability and making my own clothes.')}">${esc(ex?.bio||'')}</textarea>`)}
      <div class="field"><span class="legend">${t('Closet photo (optional)')}</span>
        <div class="backdrop small" id="bdPreview" ${ex?.backdrop && S.urls[ex.backdrop] ? `style="background-image:url('${esc(S.urls[ex.backdrop])}')"` : ''}></div>
        <div class="actions"><label class="btn ghost small filebtn"><input type="file" id="bdFile" accept="image/*,.heic,.heif">${t('Choose photo')}</label>
        <button type="button" class="linkbtn" data-action="bd-remove" ${ex?.backdrop ? '' : 'hidden'} id="bdRemove">${t('Remove')}</button></div>
        <p class="hint">${t('The background of your profile page. Bio and closet photo are only visible to friends.')}</p></div>
      <div class="field"><span class="legend">${t('Language')}</span>${langSwitch()}</div>
      <div class="actions"><button class="btn accent">${t('Save')}</button>${welcome ? '' : `<a class="btn ghost" href="#/profile">${t('Cancel')}</a>`}</div>
    </form>
  </div>
  ${welcome ? '' : `<div style="margin-top:28px" class="actions"><button class="btn ghost" data-action="logout">${t('Log out')}</button></div>`}`;
}

/* Texture picker: one row of 7 (your pick + random ones + a "+" to make your own), with Surprise me and Show all, so 35 textures don't overwhelm */
const shuffled = arr => { const a = [...arr]; for(let i = a.length - 1; i > 0; i--){ const j = Math.floor(Math.random()*(i+1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
function avTiles(sel){
  const cu = S.customUrl || customUrl(S.me), n = AV_ROW - 1 - (cu ? 1 : 0);
  if(!S.avRow || (sel >= 0 && !S.avRow.slice(0, n).includes(sel))){
    S.avRow = (sel >= 0 ? [sel] : []).concat(shuffled(AVATARS.map((_, i) => i).filter(i => i !== sel)));
  }
  const list = S.avAll ? AVATARS.map((_, i) => i) : S.avRow.slice(0, n);
  return list.map(i => `<label class="av xl" style="background-image:url('${AVATARS[i].src}')"><input type="radio" name="pAv" value="${i}" ${sel===i?'checked':''} aria-label="${t('Texture {n}', { n: i+1 })}"></label>`).join('')
    + (cu ? `<label class="av xl" id="customTile" style="background-image:url('${esc(cu)}')"><input type="radio" name="pAv" value="-1" ${sel===-1?'checked':''} aria-label="${t('Your own texture')}"></label>` : '')
    + `<label class="av xl addtex" title="${t('Make your own texture from a photo')}"><input type="file" id="texFile" accept="image/*,.heic,.heif" aria-label="${t('Make your own texture from a photo')}"><span aria-hidden="true">+</span></label>`;
}
const avSel = () => +(document.querySelector('[name=pAv]:checked')?.value ?? -2);
function renderAvTiles(sel = avSel()){ const box = $('#avTiles'); if(box) box.innerHTML = avTiles(sel);
  const b = $('#avAllBtn'); if(b) b.textContent = S.avAll ? t('Show fewer') : t('Show all'); }
function avSurprise(){
  const cur = avSel(), pool = AVATARS.map((_, i) => i).filter(i => i !== cur), pick = pool[Math.floor(Math.random()*pool.length)];
  if(!S.avAll) S.avRow = [pick].concat((S.avRow || []).filter(i => i !== pick));
  renderAvTiles(pick); $('#pInk').value = ''; renderInk();
}

/* Profile picture editor: live preview, suggested colour first */
function renderInk(){
  const box = $('#inkPick'); if(!box) return;
  const a = +(document.querySelector('[name=pAv]:checked')?.value ?? avatarOf(me())), custom = a === -1, cur = $('#pInk').value;
  const sug = custom ? (S.customSug || S.me?.avatar_ink || '#FFFFFF') : AVATARS[a].ink;
  const ink = cur || sug, sw = (c, label) => `<button type="button" class="ink ${norm(c)===norm(ink)?'on':''}" style="background:${c}" data-action="ink" data-v="${c}" aria-label="${label}" title="${label}"></button>`;
  const own = !!cur && !INK_SWATCHES.some(c => norm(c) === norm(cur));
  // First circle: the suggested colour, and tapping it also opens a picker for any colour
  box.innerHTML = `<label class="ink pick ${!cur || own ? 'on' : ''}" style="background:${own ? cur : sug}" title="${t('Suggested colour, or tap to pick any colour')}"><input type="color" id="inkCustom" value="${own ? cur : sug}" data-action="ink-sug" data-v="${sug}" aria-label="${t('Suggested colour, or pick any colour')}"><span aria-hidden="true">+</span></label>`
    + INK_SWATCHES.map(c => sw(c, c)).join('');
  const pv = $('#avPreview');
  if(pv) pv.setAttribute('style', custom ? `background-image:url('${esc(S.customUrl || customUrl(S.me))}');color:${ink}` : avStyle(a, ink));
}

/* Make your own texture: drag a small square over your photo; it can never be big enough to show the whole thing */
let crop = null;
async function startCrop(file){
  let img; try { img = await decode(file); } catch(e){ return toast(t('That photo can’t be read. Try a JPG or PNG.')); }
  const w = img.naturalWidth || img.width, h = img.naturalHeight || img.height, k = Math.min(1, 1400 / Math.max(w, h));
  const c = document.createElement('canvas'); c.width = Math.round(w*k); c.height = Math.round(h*k);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  crop = { src:c, frac:.08, x:.5, y:.5 };
  openModal('crop');
}
function cropRect(){
  const W = crop.src.width, H = crop.src.height, side = crop.frac * Math.min(W, H);
  const cx = Math.min(Math.max(crop.x*W, side/2), W - side/2), cy = Math.min(Math.max(crop.y*H, side/2), H - side/2);
  crop.x = cx/W; crop.y = cy/H;
  return { side, sx: cx - side/2, sy: cy - side/2, W, H };
}
function drawCrop(){
  const r = cropRect(), img = $('#cropImg'), box = $('#cropBox'), pv = $('#cropPrev'); if(!img) return;
  const k = img.clientWidth / r.W;
  Object.assign(box.style, { left: r.sx*k + 'px', top: r.sy*k + 'px', width: r.side*k + 'px', height: r.side*k + 'px' });
  const g = pv.getContext && pv.getContext('2d'); if(g) g.drawImage(crop.src, r.sx, r.sy, r.side, r.side, 0, 0, pv.width, pv.height);
}
function bindCrop(){
  const inner = $('#cropInner'); if(!inner) return;
  const move = e => { const b = inner.getBoundingClientRect(); if(!b.width) return; crop.x = (e.clientX - b.left)/b.width; crop.y = (e.clientY - b.top)/b.height; drawCrop(); };
  inner.addEventListener('pointerdown', e => { inner.setPointerCapture?.(e.pointerId); move(e); });
  inner.addEventListener('pointermove', e => { if(e.buttons || e.pointerType === 'touch') move(e); });
  $('#cropImg').addEventListener('load', drawCrop); drawCrop();
}
async function finishCrop(){
  const r = cropRect(), c = document.createElement('canvas'); c.width = c.height = 200;
  const g = c.getContext('2d'); g.drawImage(crop.src, r.sx, r.sy, r.side, r.side, 0, 0, 200, 200);
  const d = g.getImageData(0, 0, 200, 200).data; let R = 0, G = 0, B = 0;
  for(let i = 0; i < d.length; i += 4){ R += d[i]; G += d[i+1]; B += d[i+2]; }
  const n = d.length/4; S.customSug = complement(R/n, G/n, B/n);
  S.customBlob = await new Promise(res => c.toBlob(res, 'image/jpeg', .85));
  if(!S.customBlob) return toast(t('That didn’t work. Try another photo.'));
  S.customUrl = URL.createObjectURL(S.customBlob);
  closeModal();
  renderAvTiles(-1);
  $('#pInk').value = ''; renderInk();
}

/* ---------- dialogs ---------- */
function tgRender(g){
  const grp = TERM_GROUPS.find(x => x.key === g), cur = S.form[g];
  const misplaced = g === 'terms' ? /dry|clean|wash|steam|iron|chocolate|wine|photo|drink|flowers|stomer|was|stoom|strijk|chocola|wijn|foto|drankje|bloemen/i : null;
  const sug = uniqCI([...grp.sug.map(x => t(x)), ...S.pieces.flatMap(p => p[g] || [])]).filter(x => !cur.some(c => norm(c) === norm(x)) && !(misplaced && misplaced.test(x))).slice(0, 8);
  return `<span class="legend">${t(grp.label)} <span class="hint">${t(grp.ask)}</span></span>
    <div class="terms">${cur.map((x, i) => `<button type="button" class="term on" data-action="tg-del" data-g="${g}" data-i="${i}" aria-label="${t('Remove {x}', { x: esc(x) })}">${esc(x)} <span aria-hidden="true">×</span></button>`).join('')}${sug.map(x => `<button type="button" class="term sug" data-action="tg-add" data-g="${g}" data-v="${esc(x)}">+ ${esc(x)}</button>`).join('')}</div>
    <div class="ownrow"><input type="text" class="tg-input" data-g="${g}" id="tg-in-${g}" placeholder="${t('Add your own')}" aria-label="${t('Add your own')}: ${t(grp.label)}"><button type="button" class="btn ghost small" data-action="tg-own" data-g="${g}">${t('Add')}</button></div>`;
}
const termFields = () => `<div class="field"><span class="legend big">${t('Borrowing terms')}</span><p class="hint">${t('Tap a suggestion or add your own. Friends see these before they ask.')}</p></div>
  ${TERM_GROUPS.map(g => `<div class="field tgroup" id="tg-${g.key}">${tgRender(g.key)}</div>`).join('')}`;
function catField(cur){
  const custom = uniqCI([...S.tags.category, ...S.pieces.map(p => p.category).filter(c => c && !CATS[c])]);
  const opts = [...Object.keys(CATS).map(k => [k, t(CATS[k][0])]), ...custom.map(c => [c, c])];
  if(cur && !opts.some(([v]) => v === cur)) opts.push([cur, cur]);
  return `<div class="field"><span class="legend">${t('Category')}</span><div class="opts" id="catOpts">${opts.map(([v, l], i) => `<label><input type="radio" name="iCat" value="${esc(v)}" ${(cur ? cur === v : i === 0) ? 'checked' : ''}> ${esc(l)}</label>`).join('')}<button type="button" class="chip addchip" data-action="cat-new">+ ${t('New category')}</button></div>
    <div class="ownrow" id="catNew" hidden><input type="text" id="iCatNew" placeholder="${t('e.g. Hats, Capes, Kimonos')}" aria-label="${t('New category')}"><button type="button" class="btn ghost small" data-action="cat-add">${t('Add')}</button></div></div>`;
}
function sizeSelect(cat, cur){
  const groups = sizeGroups(cat), def = cur || (['bag','accessories'].includes(cat) ? 'One size' : '');
  let html = groups.map(g => `<optgroup label="${t(g)}">${SIZES[g].map(x => `<option value="${x}" ${def===x?'selected':''}>${g==='Shoe sizes' ? 'EU '+x : x}</option>`).join('')}</optgroup>`).join('');
  if(def && !groups.some(g => SIZES[g].includes(def))) html = `<option value="${esc(def)}" selected>${esc(def)}</option>` + html;
  return `<select id="iSize" required><option value="" ${def?'':'selected'} disabled>${t('Choose a size')}</option>${html}</select>`;
}
function photoField(p){
  return `<div class="field"><span class="legend">${t('Photos')}</span><div class="pgrid" id="pgrid"></div>
    <p class="hint">${t('The first photo is the main one. Use ★ to make another photo the main one.')}</p></div>`;
}
const plistUrl = x => x.replace ? URL.createObjectURL(x.replace) : x.kind === 'new' ? (x.url || (x.url = URL.createObjectURL(x.file))) : (S.thumbs[x.path] || S.urls[x.path] || '');
function renderPlist(){
  const el = $('#pgrid'); if(!el) return;
  const list = S.plist.map((x, i) => [x, i]).filter(([x]) => !x.removed);
  el.innerHTML = list.map(([x, i], pos) => `<div class="pthumb ${pos === 0 ? 'main' : ''}">
      <span class="ph preview" data-name="${esc(x.file?.name || t('Photo'))}"><img src="${esc(plistUrl(x))}" alt=""></span>
      ${pos === 0 ? `<span class="mainlabel">${t('Main')}</span>` : ''}
      <div class="pctrl">
        ${pos > 0 ? `<button type="button" data-action="pl-main" data-i="${i}" aria-label="${t('Make this the main photo')}" title="${t('Make main')}">★</button>` : ''}
        ${pos > 0 ? `<button type="button" data-action="pl-move" data-i="${i}" data-d="-1" aria-label="${t('Move earlier')}">‹</button>` : ''}
        ${pos < list.length - 1 ? `<button type="button" data-action="pl-move" data-i="${i}" data-d="1" aria-label="${t('Move later')}">›</button>` : ''}
        ${x.kind === 'new' || x.mine ? `<button type="button" data-action="pl-edit" data-i="${i}" aria-label="${t('Crop or rotate')}" title="${t('Crop or rotate')}">✎</button>` : ''}
      </div>
      <button type="button" class="x" data-action="pl-remove" data-i="${i}" aria-label="${t('Remove photo')}">×</button></div>`).join('')
    + `<label class="addtile"><input type="file" id="iFiles" accept="image/*,.heic,.heif" multiple>+ ${t('Add photos')}</label>`;
}
function plMove(i, d){
  const vis = S.plist.map((x, k) => k).filter(k => !S.plist[k].removed), pos = vis.indexOf(i), to = vis[pos + d];
  if(to === undefined) return; [S.plist[i], S.plist[to]] = [S.plist[to], S.plist[i]]; renderPlist();
}
async function plEdit(i){
  const x = S.plist[i];
  let src = x.replace || x.file;
  if(!src){ try { const r = await fetch(S.urls[x.path] || (await signed([x.path]), S.urls[x.path])); src = new File([await r.blob()], 'photo.jpg', { type:'image/jpeg' }); } catch(e){ return toast(t('This photo can’t be edited right now.')); } }
  openEditor(src, f => { if(x.kind === 'new') { x.file = f; x.url = null; } else x.replace = f; renderPlist(); });
}
async function addFiles(files){
  const arr = [...files]; if(!arr.length) return;
  if(arr.length === 1) return openEditor(arr[0], f => { S.plist.push({ kind:'new', file:f }); renderPlist(); });
  arr.forEach(f => S.plist.push({ kind:'new', file:f })); renderPlist();
  toast(t('Tap ✎ on a photo to crop or rotate it'));
}

function brandSug(){
  const box = $('#brandSug'); if(!box) return;
  const raw = $('#iBrand').value.trim(), v = norm(raw), all = brandList();
  const exact = all.find(b => norm(b) === v);
  const list = all.filter(b => !v || norm(b).includes(v)).filter(b => norm(b) !== v).slice(0, 8);
  box.innerHTML = list.map(b => `<button type="button" class="term sug" data-action="brand-pick" data-v="${esc(b)}">${esc(b)}</button>`).join('')
    + (raw && !exact ? `<span class="hint">${t('“{v}” will be added as a new label.', { v: esc(raw) })}</span>`
      : exact && exact !== raw ? `<span class="hint">${t('Will be saved as “{v}”.', { v: esc(exact) })}</span>` : '');
}
const pieceFields = (p={}) => `
  ${field('iTitle',t('Name'),'<input type="text" id="iTitle" required value="'+esc(p.title||'')+'">')}
  ${field('iDesc',t('Description (optional)'),`<textarea id="iDesc" placeholder="${t('e.g. flowy fabric, twirls amazing, …')}">${esc(p.description||'')}</textarea>`)}
  ${catField(p.category)}
  <div class="two"><div class="field" id="sizeField"><label for="iSize">${t('Size')}</label>${sizeSelect(p.category || 'dress', p.size)}</div>${field('iMat',t('Material'),`<select id="iMat"><option value="">${t('Choose')}</option>${MATERIALS.map(m => `<option value="${m}" ${p.material===m?'selected':''}>${t(m)}</option>`).join('')}</select>`)}</div>
  <div class="field"><label for="iBrand">${t('Brand')}</label><input type="text" id="iBrand" autocomplete="off" placeholder="${t('e.g. Zara, or Vintage')}" value="${esc(p.brand||'')}"><div class="suggest" id="brandSug"></div></div>
  ${termFields()}
  ${field('iBuy',t('Where to buy it (optional link)'),'<input type="url" id="iBuy" placeholder="https://" value="'+esc(p.buy_url||'')+'">')}`;
async function readPiece(){
  const catEl = document.querySelector('[name=iCat]:checked');
  const category = catEl ? await canonicalCategory(catEl.value) : 'dress';
  const brand = $('#iBrand').value.trim() ? await canonical('brand', $('#iBrand').value, brandList()) : null;
  return { title:$('#iTitle').value.trim(), description:$('#iDesc').value.trim() || null, category, size:$('#iSize').value,
    material:$('#iMat').value || null, brand, care:[...S.form.care], thanks:[...S.form.thanks], terms:[...S.form.terms], buy_url:$('#iBuy').value.trim() || null };
}
function tgOwn(g){
  const inp = $('#tg-in-' + g), v = inp.value.trim().replace(/\s+/g, ' ');
  if(v && !S.form[g].some(c => norm(c) === norm(v))) S.form[g].push(v);
  $('#tg-' + g).innerHTML = tgRender(g); $('#tg-in-' + g).focus();
}
function catAdd(){
  const inp = $('#iCatNew'), v = inp.value.trim().replace(/\s+/g, ' '); if(!v) return;
  const radios = [...document.querySelectorAll('[name=iCat]')];
  let hit = radios.find(r => norm(r.value) === norm(v) || norm(r.parentNode.textContent) === norm(v));
  if(!hit){
    const lab = document.createElement('label'); lab.innerHTML = `<input type="radio" name="iCat" value="${esc(v)}"> ${esc(v)}`;
    $('#catOpts').insertBefore(lab, $('#catOpts .addchip')); hit = lab.firstChild;
  }
  hit.checked = true; inp.value = ''; $('#catNew').hidden = true; updateSizes();
}
function updateSizes(){
  const cat = document.querySelector('[name=iCat]:checked')?.value || 'dress', cur = $('#iSize')?.value;
  const keep = cur && sizeGroups(cat).some(g => SIZES[g].includes(cur)) ? cur : '';
  $('#iSize').outerHTML = sizeSelect(cat, keep);
}
// A new piece for a call starts with the call's first category and a matching size
const replyPrefill = () => { const cats = callList(S.call?.category), sizes = callList(S.call?.size), cat = cats[0] || undefined;
  return { category:cat, size:sizes.find(x => sizeGroups(cat || 'dress').some(g => SIZES[g].includes(x))) }; };
const cancel = `<button type="button" class="btn ghost" data-action="close">${t('Cancel')}</button>`;

function openModal(m){
  const p = current; let h = '';
  if(m==='add' || m==='edit'){
    const src = m==='edit' ? p : {};
    S.form = { care:[...(src.care||[])], thanks:[...(src.thanks||[])], terms:[...(src.terms||[])] }; S.newFiles = [];
    S.plist = m === 'edit' ? (src.photos || []).map(x => ({ kind:'old', id:x.id, path:x.path, caption:x.caption, position:x.position, mine:true })) : [];
  }
  if(m==='call') h = callForm();
  if(m==='reply') h = replyForm();
  if(m==='share') h = `<span class="eyebrow">${t('Share')}</span><h2>${t('Share your call')}</h2>
    ${field('shMsg', t('Your message'), `<textarea id="shMsg" maxlength="600">${esc(callShareMsg(S.call))}</textarea>`)}
    <p class="hint">${t('The link to your call is added at the end.')}</p><p class="mono sharelink">${esc(callLink(S.call.id))}</p>
    <div class="actions"><button type="button" class="btn accent" data-action="share-wa">${t('Share in WhatsApp')}</button><button type="button" class="btn ghost" data-action="share-link">${t('Copy link')}</button><button type="button" class="linkbtn" data-action="close">${t('Close')}</button></div>`;
  if(m==='add') h = `<span class="eyebrow">${S.replyTo ? t('For {name}’s call', { name: esc(first(S.call.owner)) }) : t('Your pieces')}</span><h2>${t('Add a piece')}</h2><form data-form="add">${photoField()}${pieceFields(S.replyTo ? replyPrefill() : {})}
    <div class="actions">${cancel}<button class="btn accent">${t('Add to my pieces')}</button></div></form>`;
  if(m==='edit') h = `<span class="eyebrow">${t('Your piece')}</span><h2>${t('Edit')}</h2><form data-form="edit">${photoField(p)}${pieceFields(p)}
    <label class="toggle"><input type="checkbox" id="iAvail" ${p.available?'checked':''}> ${t('Available to borrow')}</label>
    <div class="actions" style="justify-content:space-between"><button type="button" class="btn danger small" data-action="modal" data-m="delete">${t('Delete piece')}</button><span class="actions">${cancel}<button class="btn save">${t('Save')}</button></span></div></form>`;
  if(m==='delete') h = `<h2>${t('Delete “{title}”?', { title: esc(p.title) })}</h2><p style="margin:0">${t('This removes the piece, its photos, reactions and requests for everyone. You can’t undo it.')}</p>
    <div class="actions">${cancel}<button class="btn danger" data-action="delpiece">${t('Yes, delete it')}</button></div>`;
  if(m==='photo') h = `<span class="eyebrow">${esc(p.title)}</span><h2>${t('Add a photo')}</h2><form data-form="photo">
    <div class="field"><span class="legend">${t('Photo')}</span><div class="pgrid" id="pOne"><label class="addtile"><input type="file" id="pFile" accept="image/*,.heic,.heif">+ ${t('Choose photo')}</label></div></div>
    ${field('pCap',t('Where was this? (optional)'),`<input type="text" id="pCap" placeholder="${t('e.g. At Lotte’s wedding')}">`)}
    <div class="actions">${cancel}<button class="btn">${t('Add to gallery')}</button></div></form>`;
  if(m==='react') h = `<span class="eyebrow">${esc(p.title)}</span><h2>${t('Say something')}</h2><form data-form="react">
    ${field('rTxt',t('Your reaction'),`<textarea id="rTxt" placeholder="${t('Obsessed? Wore it? Spill.')}" required></textarea>`)}
    <div class="field"><span class="legend">${t('Fit (optional, if you wore it)')}</span><div class="opts">${FITS.map(f => `<label><input type="radio" name="rFit" value="${f}"> ${t(f)}</label>`).join('')}</div></div>
    <p class="hint">${t('Text only. Photos go in the gallery so everyone sees them.')}</p>
    <div class="actions">${cancel}<button class="btn">${t('Post')}</button></div></form>`;
  if(m==='worn') h = `<span class="eyebrow">${esc(p.title)}</span><h2>${t('Where was it worn?')}</h2><form data-form="worn">
    <div class="field"><span class="legend">${t('Occasion')}</span><div class="opts">${OCC.map((o,i) => `<label><input type="radio" name="wO" value="${o}" ${i===0?'checked':''}> ${t(o)}</label>`).join('')}</div></div>
    ${field('wOther',t('Something else?'),`<input type="text" id="wOther" placeholder="${t('e.g. Opera, Prom, Christmas dinner')}">`)}
    <div class="actions">${cancel}<button class="btn">${t('Add')}</button></div></form>`;
  if(m==='borrow'){ const today = new Date().toISOString().slice(0,10), o = esc(nm(p.owner)); h = `<span class="eyebrow">${t('Ask {name}', { name: o })}</span><h2>${t('Borrow “{title}”', { title: esc(p.title) })}</h2>
    <form data-form="borrow"><div class="two">${field('bFrom',t('Need it from'),`<input type="date" id="bFrom" min="${today}" required>`)}${field('bTo',t('Until'),`<input type="date" id="bTo" min="${today}" required>`)}</div>
    ${field('bMsg',t('What’s it for?'),`<textarea id="bMsg" placeholder="${t('e.g. Lotte’s wedding on Saturday! Could I pick it up Friday evening?')}" required></textarea>`)}
    <div class="field"><span class="legend">${t('{name}’s terms', { name: o })}</span>${termsBlock(p, false)}</div>
    <div class="etiquette"><span class="eyebrow">${t('Borrowing etiquette')}</span><ul>
      <li>${t('<strong>Return it in the same or better state</strong> than you got it.')}</li>
      <li>${t('<strong>Bring it back on time.</strong> Need it longer? Ask before your return date, not after.')}</li>
      <li>${t('<strong>Accidents happen.</strong> If something gets damaged or stained, tell {name} straight away and propose a suitable fix.', { name: o })}</li>
      <li>${t('<strong>You plan pick-up and return</strong>, at a time that suits {name}. Mark it as returned in Requests.', { name: o })}</li>
      <li>${t('<strong>Share the love.</strong> Add a photo of you wearing it to the gallery.')}</li></ul></div>
    <div class="actions">${cancel}<button class="btn accent">${t('Send request')}</button></div></form>`; }
  if(m==='flist'){ const { id, mine, list } = S.flist;
    const act = f => f === me() ? `<span class="st">${t('You')}</span>` : S.friends.has(f) ? `<span class="st accepted">${t('Friends')}</span>`
      : S.outgoing.includes(f) ? `<span class="st pending">${t('Asked')}</span>`
      : S.incoming.includes(f) ? `<button class="btn small" data-action="fr-accept" data-id="${f}">${t('Accept')}</button>`
      : `<button class="btn small" data-action="fr-add" data-id="${f}">${t('Add friend')}</button>`;
    h = `<span class="eyebrow">${tp(list.length, '{n} friend', '{n} friends')}</span><h2>${mine ? t('Your friends') : t('{name}’s friends', { name: esc(nm(id).split(' ')[0]) })}</h2>
    <div class="flist">${list.map(f => `<div class="row-card person"><a href="#/person/${f}" data-action="close" aria-label="${t('See {name}’s profile', { name: esc(nm(f)) })}">${av(f,'lg')}</a>
      <div style="min-width:0"><a class="plain" href="#/person/${f}" data-action="close"><strong>${esc(f === me() ? (S.me?.name || t('You')) : nm(f))}</strong></a></div><div class="actions">${act(f)}</div></div>`).join('')}</div>
    <div class="actions"><button type="button" class="btn ghost" data-action="close">${t('Close')}</button></div>`; }
  if(m==='sent'){ const r = sentReq; h = `<span class="eyebrow">${t('Request sent')}</span><h2>${t('Now plan the pick-up')}</h2>
    <p style="margin:0">${t('{name} sees your request in the app. Send a quick message to agree on when you pick it up.', { name: esc(nm(r.owner)) })}${S.phones[r.owner] ? ' ' + t('For Signal, the message is copied so you can paste it.') : ''}</p>
    ${S.phones[r.owner] ? '' : `<p class="hint">${t('{name} hasn’t added a phone number, so you’ll pick the chat yourself.', { name: esc(nm(r.owner)) })}</p>`}
    <div class="actions"><button type="button" class="btn ghost" data-action="close">${t('Later')}</button><a class="btn accent" href="${waLink(r)}" target="_blank" rel="noopener" data-action="close">${t('Open WhatsApp')}</a>${signalBtn(r, 'btn ghost')}</div>`; }
  if(m==='crop') h = `<h2>${t('Make your own texture')}</h2>
    <p class="hint">${t('Drag the square to a spot you love: a colour, a fabric, a pattern.')}</p>
    <div class="cropwrap"><div class="cropinner" id="cropInner"><img id="cropImg" src="${crop.src.toDataURL('image/jpeg', .85)}" alt="${t('Your photo')}" draggable="false"><div class="cropbox" id="cropBox"></div></div></div>
    <div class="croprow"><canvas id="cropPrev" class="cropprev" width="176" height="176" aria-label="${t('Preview')}"></canvas>
      <div class="field" style="flex:1"><label for="cropSize">${t('Zoom')}</label><input type="range" id="cropSize" min="3" max="12" step="0.5" value="${15 - crop.frac*100}"></div></div>
    <div class="actions">${cancel}<button type="button" class="btn accent" data-action="crop-use">${t('Use this texture')}</button></div>`;
  $('#sheet').innerHTML = h; $('#overlay').hidden = false;
  if(m==='add' || m==='edit'){ brandSug(); renderPlist(); }
  if(m==='crop') bindCrop();
}
let sentReq = null;
const closeModal = () => { S.replyTo = null; S.editCall = null; $('#overlay').hidden = true; $('#sheet').innerHTML = ''; S.newFiles = []; S.plist = []; S.onePhoto = null; edClose(); };

/* ---------- forms ---------- */
document.addEventListener('submit', async e => {
  e.preventDefault();
  if(!['search','login','signup'].includes(e.target.dataset.form)) S.pageCache = {};
  const form = e.target, k = form.dataset.form, btn = form.querySelector('button:not([type=button])');
  if(btn) btn.disabled = true;
  try { await handlers[k]?.(form); } catch(err){ fail(err); }
  if(btn && document.body.contains(btn)) btn.disabled = false;
});
const handlers = {
  async login(){
    lastEmail = $('#aEmail').value.trim();
    const { error } = await sb.auth.signInWithPassword({ email:lastEmail, password:$('#aPw').value });
    if(error) renderAuth('!' + authError(error), error.code === 'email_not_confirmed' || /not confirmed/i.test(error.message || ''));
  },
  async signup(){
    lastEmail = $('#aEmail').value.trim();
    const { data, error } = await sb.auth.signUp({ email:lastEmail, password:$('#aPw').value, options:{ data:{ name:$('#aName').value.trim(), ...(store.get('sc_from') ? { invited_by: store.get('sc_from') } : {}) }, emailRedirectTo:APP_URL } });
    if(error) return renderAuth('!' + authError(error));
    if(!data.session) { authMode = 'login'; renderAuth(t('Almost there! Click the link in the email we just sent you, then log in.'), true); }
  },
  async newpass(){
    const { error } = await sb.auth.updateUser({ password:$('#npw').value });
    if(error) return fail(error);
    recovering = false; toast(t('Password saved')); start();
  },
  async profile(){
    const welcomeSave = !S.me?.name;
    const name = $('#pName').value.trim(), phone = $('#pPhone').value.trim();
    const picked = document.querySelector('[name=pAv]:checked');
    let avatar = picked ? +picked.value : (isCustom(S.me) ? -1 : avatarOf(me()));
    let avatar_ink = $('#pInk').value || null, avatar_src = S.me?.avatar_src || null, oldSrc = null;
    if(avatar === -1){
      if(S.customBlob){
        const path = `${me()}/${crypto.randomUUID()}.jpg`;
        const up = await sb.storage.from('avatars').upload(path, S.customBlob, { contentType:'image/jpeg', cacheControl:'31536000' }); if(up.error) throw up.error;
        oldSrc = avatar_src; avatar_src = path; S.customBlob = null;
      }
      if(!avatar_src) avatar = avatarOf(me());
      else if(!avatar_ink) avatar_ink = S.customSug || '#FFFFFF';
    }
    const a = await sb.from('profiles').update({ name, avatar, avatar_ink, avatar_src }).eq('id', me()); if(a.error) throw a.error;
    if(oldSrc) await sb.storage.from('avatars').remove([oldSrc]);
    const b = await sb.from('contacts').update({ phone: phone || null }).eq('user_id', me()); if(b.error) throw b.error;
    S.me = { ...S.me, name, avatar, avatar_ink, avatar_src }; S.profiles[me()] = { ...S.me };
    let backdrop = S.myExtras?.backdrop || null;
    const old = backdrop;
    if(backdropFile){
      const blob = await shrink(backdropFile), path = `${me()}/profile/${crypto.randomUUID()}.jpg`;
      const up = await sb.storage.from('photos').upload(path, blob, { contentType:'image/jpeg', cacheControl:'31536000' }); if(up.error) throw up.error;
      backdrop = path;
    } else if(backdropRemove) backdrop = null;
    const c2 = await sb.from('profile_extras').upsert({ user_id:me(), bio: $('#pBio').value.trim() || null, backdrop }); if(c2.error) throw c2.error;
    if(old && old !== backdrop) await sb.storage.from('photos').remove([old]);
    toast(t('Saved.')); location.hash = welcomeSave ? '#/add-friends' : '#/profile';
  },
  async add(form){
    const btn = form.querySelector('.btn.accent'), replyTo = S.replyTo;
    btn.textContent = t('Saving…');
    const { data, error } = await sb.from('pieces').insert(await readPiece()).select('id').single();
    if(error){ btn.textContent = t('Add to my pieces'); throw error; }
    await savePhotos(data.id, btn);
    S.pieces = [];
    if(replyTo){
      const r = await sb.from('call_replies').insert({ call_id:replyTo, piece_id:data.id, piece_title:$('#iTitle').value.trim() });
      closeModal(); if(r.error) return fail(r.error, t('Added to your pieces, but the reply didn’t send.'));
      toast(t('Added, and sent as a reply')); location.hash = '#/call/' + replyTo; return route();
    }
    closeModal(); toast(t('Added to your pieces')); location.hash = '#/piece/' + data.id;
  },
  async edit(form){
    const btn = form.querySelector('.btn.save');
    btn.textContent = t('Saving…');
    const { error } = await sb.from('pieces').update({ ...(await readPiece()), available:$('#iAvail').checked }).eq('id', current.id);
    if(error){ btn.textContent = t('Save'); throw error; }
    await savePhotos(current.id, btn);
    galleryIndex = 0;
    closeModal(); toast(t('Saved.')); viewPiece(current.id);
  },
  async photo(){
    const f = S.onePhoto; if(!f) return toast(t('Choose a photo first'));
    $('#sheet button:not(.ghost)').textContent = t('Uploading…');
    try { await uploadPhoto(current.id, f, $('#pCap').value.trim()); S.onePhoto = null; }
    catch(e){ console.error(e); $('#sheet button:not(.ghost)').textContent = t('Add to gallery'); return toast(e.message || t('The photo could not be added.')); }
    galleryIndex = current.photos.length; closeModal(); toast(t('Photo added')); viewPiece(current.id);
  },
  async react(){
    const fit = document.querySelector('[name=rFit]:checked')?.value || null;
    const { error } = await sb.from('reactions').insert({ piece_id:current.id, body:$('#rTxt').value.trim(), fit });
    if(error) throw error; closeModal(); viewPiece(current.id);
  },
  async worn(){
    const occasion = $('#wOther').value.trim() || document.querySelector('[name=wO]:checked').value;
    const { error } = await sb.from('worn_to').insert({ piece_id:current.id, occasion });
    if(error) throw error; closeModal(); toast(t('Added: {o}', { o: t(occasion) })); viewPiece(current.id);
  },
  async borrow(){
    const from = $('#bFrom').value, until = $('#bTo').value;
    if(until < from) return toast(t('“Until” is before “Need it from”.'));
    const { data, error } = await sb.from('borrow_requests').insert({ piece_id:current.id, date_from:from, date_until:until, message:$('#bMsg').value.trim() }).select('*,pieces(id,title)').single();
    if(error) throw error;
    S.socialAt = 0;
    const { data:c } = await sb.from('contacts').select('phone').eq('user_id', data.owner).maybeSingle();
    S.phones[data.owner] = c?.phone; sentReq = data; openModal('sent');
  },
  async search(){ await search($('#q').value.trim()); },
  async call(){
    const ticked = n => [...document.querySelectorAll(`[name=${n}]:checked`)].map(x => x.value).join(',') || null;
    const row = { what:$('#cWhat').value.trim(), category:ticked('cCat'), size:ticked('cSize'), needed_by:$('#cBy').value || null, details:$('#cDetails').value.trim() || null };
    if(S.editCall){ // editing means you're still looking, so a closed call opens again
      const id = S.editCall.id, { error } = await sb.from('calls').update({ ...row, status:'open' }).eq('id', id); if(error) throw error;
      closeModal(); S.pageCache = {}; toast(t('Saved.')); return route();
    }
    const { data, error } = await sb.from('calls').insert(row).select('id').single(); if(error) throw error;
    closeModal(); S.justPosted = data.id; location.hash = '#/call/' + data.id;
  },
  async reply(){
    const pid = document.querySelector('[name=rPiece]:checked')?.value || null, note = $('#rNote').value.trim() || null;
    if(!pid && !note) return toast(t('Pick a piece or write a note'));
    const p = pid && S.pieces.find(x => x.id === pid);
    const { error } = await sb.from('call_replies').insert({ call_id:S.call.id, piece_id:pid, piece_title:p ? p.title : null, note }); if(error) throw error;
    closeModal(); toast(t('Sent to {name}', { name: first(S.call.owner) })); route();
  }
};

/* ---------- clicks ---------- */
document.addEventListener('click', async e => {
  if(e.target.id === 'overlay') return closeModal();
  const a = e.target.closest('[data-action]'); if(!a) return;
  if(/^(fr-|req$|heart$|guide-)/.test(a.dataset.action)){ S.socialAt = 0; S.pageCache = {}; }
  const d = a.dataset;
  try {
    switch(d.action){
      case 'authmode': authMode = d.m; renderAuth(); break;
      case 'resend': {
        const email = $('#aEmail')?.value.trim() || lastEmail;
        if(!email) return renderAuth('!' + t('Fill in your email first.'));
        lastEmail = email;
        const { error } = await sb.auth.resend({ type:'signup', email, options:{ emailRedirectTo:APP_URL } });
        renderAuth(error ? '!' + authError(error) : t('Sent! Check your inbox and spam folder, then log in here.'), !!error); break;
      }
      case 'forgot': {
        const email = $('#aEmail').value.trim();
        if(!email) return renderAuth('!' + t('Fill in your email first, then tap “Forgot your password?” again.'));
        const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo:APP_URL });
        renderAuth(error ? '!' + authError(error) : t('If that email has an account, a reset link is on its way. Check your spam folder too.')); break;
      }
      case 'logout': await sb.auth.signOut(); break;
      case 'lang': {
        if(d.v === LANG) break;
        store.set('sc_lang', d.v);
        // pages remembered on this device are in the old language
        if(S.user) store.del('sc_cache_' + S.user.id);
        location.reload(); break;
      }
      case 'modal': openModal(d.m); break;
      case 'reply-open': await signedThumbs(S.pieces.filter(p => p.owner === me()).map(p => sortPhotos(p.piece_photos)[0]?.path)); openModal('reply'); break;
      case 'reply-add': { const id = S.call.id; closeModal(); S.replyTo = id; openModal('add'); break; }
      case 'reply-del': { const { error } = await sb.from('call_replies').delete().eq('id', d.id); if(error) throw error; route(); break; }
      case 'call-share': openModal('share'); break;
      case 'sugg-hide': { store.set('sc_sugg_hide', [...new Set([...hiddenSugg(), d.id])].join(',')); S.pageCache = {};
        const row = a.closest('.srow'); a.closest('.scard').remove(); if(row && !row.children.length) row.closest('.sugcards').remove(); break; }
      case 'share-wa': { const msg = ($('#shMsg')?.value || '').trim(); window.open(`https://wa.me/?text=${encodeURIComponent((msg ? msg + ' ' : '') + callLink(S.call.id))}`, '_blank', 'noopener'); break; }
      case 'share-link': try { await navigator.clipboard.writeText(callLink(S.call.id)); toast(t('Link copied')); } catch { toast(t('Copy the link by hand')); } break;
      case 'call-pen': { const c = (S.calls || []).concat(S.profileCalls || []).find(x => x.id === d.id); if(!c) break; S.call = c; S.editCall = c; openModal('call'); break; }
      case 'call-edit': S.editCall = S.call; openModal('call'); break;
      case 'call-found': { const { error } = await sb.from('calls').update({ status:'found' }).eq('id', S.call.id); if(error) throw error; S.pageCache = {}; toast(t('Yay! Your call is closed')); route(); break; }
      case 'call-del': {
        if(a.textContent !== t('Tap again to delete')){ a.textContent = t('Tap again to delete'); return; }
        const { error } = await sb.from('calls').delete().eq('id', S.call.id); if(error) throw error;
        S.pageCache = {}; toast(t('Deleted')); location.hash = '#/pieces'; break;
      }
      case 'close': closeModal(); break;
      case 'f': S.f[d.k] = d.v; renderPieces(); break;
      case 'morefilters': S.more = !S.more; renderPieces(); break;
      case 'clear': S.f = { owner:'all', cat:'all', size:'all', mat:'all', brand:'all', occ:'all', avail:false, q:'' }; renderPieces(); break;
      case 'bd-remove': backdropFile = null; backdropRemove = true; $('#bdPreview').style.backgroundImage = ''; a.hidden = true; break;
      case 'crop-use': await finishCrop(); break;
      case 'ink': $('#pInk').value = d.v; renderInk(); break;
      case 'ink-sug': { // back to the suggestion; the picker still opens for anyone who wants another colour
        $('#pInk').value = ''; a.value = d.v; a.parentElement.style.background = d.v;
        document.querySelectorAll('#inkPick .ink').forEach(x => x.classList.toggle('on', x === a.parentElement));
        const pv = $('#avPreview'); if(pv) pv.style.color = d.v; break; }
      case 'av-surprise': avSurprise(); break;
      case 'av-all': S.avAll = !S.avAll; renderAvTiles(); break;
      case 'signal': copyMsg(d.msg); break;
      case 'tg-add': S.form[d.g].push(d.v); $('#tg-' + d.g).innerHTML = tgRender(d.g); break;
      case 'tg-del': S.form[d.g].splice(+d.i, 1); $('#tg-' + d.g).innerHTML = tgRender(d.g); break;
      case 'tg-own': tgOwn(d.g); break;
      case 'cat-new': $('#catNew').hidden = false; $('#iCatNew').focus(); break;
      case 'cat-add': catAdd(); break;
      case 'brand-pick': $('#iBrand').value = d.v; brandSug(); break;
      case 'pl-remove': { const x = S.plist[+d.i]; if(x.kind === 'new') S.plist.splice(+d.i, 1); else x.removed = true; renderPlist(); break; }
      case 'pl-main': { const [x] = S.plist.splice(+d.i, 1); S.plist.unshift(x); renderPlist(); break; }
      case 'pl-move': plMove(+d.i, +d.d); break;
      case 'pl-edit': plEdit(+d.i); break;
      case 'one-edit': openEditor(S.onePhoto, ed => { S.onePhoto = ed; $('#pOne .ph img').src = URL.createObjectURL(ed); }); break;
      case 'ed-rotate': edRotate(); break;
      case 'ed-cancel': edClose(); break;
      case 'ed-use': await edUse(); break;
      case 'delphoto-edit': {
        const { error } = await sb.from('piece_photos').delete().eq('id', d.id); if(error) throw error;
        await sb.storage.from('photos').remove([d.path, thumbOf(d.path)]);
        current.photos = current.photos.filter(x => x.id !== d.id); galleryIndex = 0;
        a.closest('.pthumb').remove(); toast(t('Photo removed')); break;
      }
      case 'ph': galleryIndex = +d.i; renderPiece(); break;
      case 'heart': {
        const id = d.id, on = S.hearts.has(id);
        const { error } = on ? await sb.from('hearts').delete().eq('user_id', me()).eq('piece_id', id) : await sb.from('hearts').insert({ piece_id:id });
        if(error) throw error;
        on ? S.hearts.delete(id) : S.hearts.add(id);
        a.setAttribute('aria-pressed', !on); a.textContent = on ? '♡' : '♥'; toast(on ? t('Removed from saved') : t('Saved')); break;
      }
      case 'req': {
        const { error } = await sb.from('borrow_requests').update({ status:d.s }).eq('id', d.id);
        if(error) throw error;
        toast(t({ accepted:'Done', declined:'Request declined', returned:'Marked as returned. The owner will confirm.', confirmed:'Back home. Thanks for sharing!', cancelled:'Request cancelled' }[d.s]));
        viewRequests(); break;
      }
      case 'fr-add': {
        const { error } = await sb.from('friendships').insert({ addressee:d.id }); if(error) throw error;
        toast(t('Friend request sent to {name}', { name: nm(d.id) })); { const fl = !!$('#sheet .flist'); await route(); if(fl) openModal('flist'); } break;
      }
      case 'fr-accept': {
        const { error } = await sb.from('friendships').update({ status:'accepted' }).eq('requester', d.id).eq('addressee', me()); if(error) throw error;
        toast(t('You and {name} are friends now', { name: nm(d.id) })); { const fl = !!$('#sheet .flist'); await route(); if(fl) openModal('flist'); } break;
      }
      case 'fr-remove': {
        if(d.confirm && a.textContent !== t('Tap again to remove')){ a.textContent = t('Tap again to remove'); return; }
        const r1 = await sb.from('friendships').delete().eq('requester', me()).eq('addressee', d.id);
        const r2 = await sb.from('friendships').delete().eq('requester', d.id).eq('addressee', me());
        if(r1.error || r2.error) throw (r1.error || r2.error);
        toast(t('Done')); route(); break;
      }
      case 'guide-skip': store.set('sc_guide_skip', [...new Set([...skipped(), d.k])].join(',')); viewWelcome(); break;
      case 'guide-browse': store.set('sc_guide_browsed', '1'); break;
      case 'guide-hide': store.set('sc_guide_hidden', '1'); location.hash = '#/pieces'; break;
      case 'copy':
        try { await navigator.clipboard.writeText(inviteLink()); toast(t('Link copied')); } catch { toast(t('Copy the link by hand')); } break;
      case 'delphoto': {
        await sb.from('piece_photos').delete().eq('id', d.id);
        await sb.storage.from('photos').remove([d.path, thumbOf(d.path)]);
        galleryIndex = 0; toast(t('Photo removed')); viewPiece(current.id); break;
      }
      case 'delreact': {
        const { error } = await sb.from('reactions').delete().eq('id', d.id); if(error) throw error; viewPiece(current.id); break;
      }
      case 'delpiece': {
        const paths = current.photos.filter(x => x.added_by === me()).map(x => x.path);
        const { error } = await sb.from('pieces').delete().eq('id', current.id); if(error) throw error;
        if(paths.length) await sb.storage.from('photos').remove([...paths, ...paths.map(thumbOf)]);
        closeModal(); toast(t('Piece deleted')); location.hash = '#/pieces'; break;
      }
    }
  } catch(err){ fail(err); }
});
document.addEventListener('change', e => {
  if(e.target.id === 'iFiles'){ const f = [...e.target.files]; e.target.value = ''; return addFiles(f); }
  if(e.target.id === 'pFile' && e.target.files[0]){ const f = e.target.files[0]; e.target.value = '';
    return openEditor(f, ed => { S.onePhoto = ed; $('#pOne').innerHTML = `<div class="pthumb main"><span class="ph"><img src="${URL.createObjectURL(ed)}" alt=""></span><div class="pctrl"><button type="button" data-action="one-edit" aria-label="${t('Crop or rotate')}">✎</button></div></div><label class="addtile"><input type="file" id="pFile" accept="image/*,.heic,.heif">${t('Choose another')}</label>`; }); }
  if(e.target.name === 'iCat') return updateSizes();
  if(e.target.name === 'cCat'){ const box = $('#cSizes'); if(box) box.innerHTML = callSizeField(); return; }
  if(e.target.name === 'pAv') return renderInk();
  if(e.target.id === 'texFile' && e.target.files[0]){ const f = e.target.files[0]; e.target.value = ''; return startCrop(f); }
  if(e.target.id === 'bdFile' && e.target.files[0]){ backdropFile = e.target.files[0]; backdropRemove = false;
    $('#bdPreview').style.backgroundImage = `url('${URL.createObjectURL(backdropFile)}')`; $('#bdRemove').hidden = false; return; }
  const k = e.target.dataset.filter; if(!k) return;
  S.f[k] = e.target.type === 'checkbox' ? e.target.checked : e.target.value; renderPieces();
});
document.addEventListener('keydown', e => {
  if(e.key === 'Escape' && !$('#overlay').hidden) closeModal();
  if(e.key === 'Enter' && e.target.classList?.contains('tg-input')){ e.preventDefault(); tgOwn(e.target.dataset.g); }
  if(e.key === 'Enter' && e.target.id === 'iCatNew'){ e.preventDefault(); catAdd(); }
  if(e.key === 'Enter' && e.target.id === 'iBrand'){ e.preventDefault(); }
});
document.addEventListener('input', e => {
  if(e.target.id === 'pq'){ S.f.q = e.target.value; renderGrid(); }
  if(e.target.id === 'iBrand') brandSug();
  if(e.target.id === 'pName'){ const pv = $('#avPreview'); if(pv) pv.textContent = (e.target.value.trim()[0] || '?').toUpperCase(); }
  if(e.target.id === 'edZoom' && ED){ ED.frac = 1 - (+e.target.value)/100; edDraw(); }
  if(e.target.id === 'cropSize'){ crop.frac = (15 - +e.target.value)/100; drawCrop(); }
  if(e.target.id === 'inkCustom'){ $('#pInk').value = e.target.value.toUpperCase(); const pv = $('#avPreview'); if(pv) pv.style.color = e.target.value;
    document.querySelectorAll('#inkPick .ink').forEach(x => x.classList.toggle('on', x.classList.contains('pick'))); e.target.parentElement.style.background = e.target.value; }
});
// A photo that can't be shown gets a clear placeholder instead of a broken-image icon
document.addEventListener('error', e => { const ph = e.target?.tagName === 'IMG' && e.target.closest('.ph'); if(ph) ph.classList.add('broken'); }, true);

/* ---------- start ---------- */
document.documentElement.lang = LANG;
(() => { const l = document.querySelector('.addbtn .lbl'); if(l) l.textContent = ' ' + t('Add a piece'); })();
async function start(){
  const { data:{ session } } = await sb.auth.getSession();
  S.user = session?.user || null;
  if(!S.user) return renderAuth();
  loadCache();
  const first = S.pageCache[location.hash || '#/pieces'];
  if(first){ $('#header').hidden = false; $('#main').innerHTML = first.html; setBackdrop(first.bg); }
  const [{ data }] = await Promise.all([sb.from('profiles').select(PROFILE_COLS).eq('id', me()).maybeSingle(), loadTags(), loadSocial()]);
  S.me = data || { id:me(), name:'' }; S.profiles[me()] = S.me;
  await route(); refreshNew();
}
sb.auth.onAuthStateChange((event, session) => {
  if(event === 'PASSWORD_RECOVERY'){ recovering = true; S.user = session?.user; return renderAuth(); }
  if(event === 'SIGNED_IN' && !S.user) { setTimeout(start, 0); }
  if(event === 'SIGNED_OUT'){ if(S.user) store.del('sc_cache_' + S.user.id); S.urlExp = {}; S.user = null; S.pieces = []; S.urls = {}; S.thumbs = {}; S.socialAt = 0; S.pageCache = {}; S.profiles = {}; S.tagsLoaded = false; location.hash = ''; renderAuth(); }
});
start();
