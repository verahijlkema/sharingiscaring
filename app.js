/* Sharing = Caring
   Plain JavaScript on top of Supabase. Who may see what is enforced by the database rules in schema.sql,
   so this file only decides what to show. */

const SUPABASE_URL = 'https://pggxllvyjcckkdscgzll.supabase.co';
const SUPABASE_KEY = 'sb_publishable_DZ5mCJZOnkUh9_gS_waXeQ_mgjKKLge';
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
const APP_URL = location.origin + location.pathname;

const CATS = {
  dress:['Dress','Dresses'], jumpsuit:['Jumpsuit','Jumpsuits'], top:['Top','Tops'], skirt:['Skirt','Skirts'],
  trousers:['Trousers','Trousers'], jacket:['Jacket','Jackets'], suit:['Suit','Suits'],
  shoes:['Shoes','Shoes'], bag:['Bag','Bags'], accessories:['Accessory','Accessories']
};
const catLabel = (k, plural) => CATS[k] ? CATS[k][plural ? 1 : 0] : (k || '');
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
  urls:{}, pieces:[], todo:0, tags:{ brand:[], category:[] }, tagsLoaded:false, form:{ care:[], thanks:[], terms:[] }, newFiles:[], more:false,
  f:{owner:'all',cat:'all',size:'all',mat:'all',brand:'all',occ:'all',avail:false,q:''}
};

/* ---------- small helpers ---------- */
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const me = () => S.user.id;
const nm = id => id === me() ? 'You' : (S.profiles[id]?.name || 'Someone');
const first = id => id === me() ? 'you' : (S.profiles[id]?.name || 'Someone').split(' ')[0];
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
  { src:'avatars/a16.jpg', ink:'#DEF20D' }
];
const INK_SWATCHES = ['#FFFFFF','#0A0A0A','#D66632','#227907','#054F9B','#E0ABA5','#C8011D','#C0B4D7','#EA4570','#EDA537','#96AC31','#36ADAC'];
const avatarOf = id => { const a = S.profiles[id]?.avatar; return Number.isInteger(a) && a >= 0 && a < AVATARS.length ? a : hash(id) % AVATARS.length; };
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
const fmt = d => d ? new Date(d + 'T12:00').toLocaleDateString('en-GB', {day:'numeric', month:'short'}) : '';
let toastTimer;
function toast(t){ const el=$('#toast'); el.textContent=t; el.hidden=false; clearTimeout(toastTimer); toastTimer=setTimeout(()=>el.hidden=true, 3200); }
function fail(error, fallback='Something went wrong. Try again.'){ console.error(error); toast(error?.message ? `${fallback} (${error.message})` : fallback); }
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
  (data||[]).forEach(d => { if(d.signedUrl) S.urls[d.path] = d.signedUrl; });
}
const sortPhotos = ph => [...(ph||[])].sort((a,b) => a.created_at < b.created_at ? -1 : 1);
function photo(p, piece, tag=true){
  const url = p && S.urls[p.path];
  const inner = url ? `<img src="${esc(url)}" alt="${esc(piece.title)}${p.caption?', '+esc(p.caption):''}" loading="lazy">` : `<span class="none">${esc(catLabel(piece.category) || 'Piece')}</span>`;
  return `<span class="ph">${inner}${tag && p?.caption ? `<span class="ph-tag">${esc(p.caption)}</span>` : ''}</span>`;
}
const status = p => p.available ? `<span class="status">Available</span>` : `<span class="status lent">Lent out</span>`;
const heart = (id, cls='') => `<button class="heart ${cls}" data-action="heart" data-id="${id}" aria-pressed="${S.hearts.has(id)}" aria-label="${S.hearts.has(id)?'Remove from saved':'Save'}">${S.hearts.has(id)?'♥':'♡'}</button>`;

/* Photos: convert iPhone HEIC photos, shrink everything to a light JPG before upload */
const isHeic = f => /hei[cf]/i.test(f.type || '') || /\.hei[cf]$/i.test(f.name || '');
const loadScript = src => new Promise((res, rej) => { const el = document.createElement('script'); el.src = src; el.onload = res; el.onerror = () => rej(new Error('Could not load the photo converter. Check your connection.')); document.head.appendChild(el); });
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
async function shrink(file){
  let img;
  try { img = await decode(file); } catch(e){ throw new Error(`“${file.name || 'This photo'}” can’t be read. Try a JPG or PNG.`); }
  const w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
  const k = Math.min(1, 1600 / Math.max(w, h));
  const c = document.createElement('canvas'); c.width = Math.round(w*k); c.height = Math.round(h*k);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', .82));
  if(!blob) throw new Error('This photo could not be prepared. Try another one.');
  return blob;
}
async function uploadPhoto(pieceId, file, caption){
  const blob = await shrink(file);
  const path = `${me()}/${pieceId}/${crypto.randomUUID()}.jpg`;
  const up = await sb.storage.from('photos').upload(path, blob, { contentType:'image/jpeg' });
  if(up.error) throw up.error;
  const ins = await sb.from('piece_photos').insert({ piece_id:pieceId, path, caption: caption || null });
  if(ins.error) throw ins.error;
}
async function uploadMany(pieceId, files, btn){
  const bad = [];
  for(const [i, f] of files.entries()){
    if(btn) btn.textContent = `Uploading photo ${i+1} of ${files.length}…`;
    try { await uploadPhoto(pieceId, f); } catch(e){ console.error(e); bad.push(f.name || 'a photo'); }
  }
  if(bad.length) toast(`${bad.length} photo${bad.length>1?'s':''} couldn’t be read (${bad.join(', ')}). Try a JPG or PNG.`);
}

/* Shared labels: brands and extra categories, one spelling for everyone */
async function loadTags(){
  if(S.tagsLoaded) return;
  const { data, error } = await sb.from('tags').select('kind,name');
  if(error) return console.error(error);
  S.tags = { brand:[], category:[] }; (data || []).forEach(t => S.tags[t.kind]?.push(t.name)); S.tagsLoaded = true;
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
  for(const [id, labels] of Object.entries(CATS)) if(norm(id) === n || labels.some(l => norm(l) === n)) return id;
  return canonical('category', v, S.tags.category);
}

/* ---------- social data (friends, hearts, badge) ---------- */
async function loadSocial(){
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
  await loadProfiles([...S.friends, ...S.incoming, ...S.outgoing]);
}

/* ---------- auth ---------- */
let authMode = 'login', recovering = false;
function renderAuth(msg=''){
  $('#header').hidden = true; $('#tabbar').hidden = true; document.body.classList.remove('on-piece');
  if(recovering){
    $('#main').innerHTML = `<div class="auth"><div class="card">
      <img class="logo" src="logo.png" alt="Sharing = Caring" style="filter:var(--logo);max-width:280px;margin:0 auto">
      <h2>Choose a new password</h2>
      <form data-form="newpass">${field('npw','New password','<input type="password" id="npw" minlength="8" autocomplete="new-password" required>')}
      <button class="btn accent">Save password</button></form></div></div>`;
    return;
  }
  const signup = authMode === 'signup';
  $('#main').innerHTML = `<div class="auth"><div class="card">

    <img src="logo.png" alt="Sharing = Caring" style="filter:var(--logo);width:100%;max-width:300px;margin:0 auto 4px;display:block">
    <p class="small-print" style="text-align:center">Got friends with style? Browse wardrobes, borrow pieces and shine at your special event!</p>
    <div class="switch"><button type="button" data-action="authmode" data-m="login" aria-pressed="${!signup}">Log in</button><button type="button" data-action="authmode" data-m="signup" aria-pressed="${signup}">Create account</button></div>
    <form data-form="${signup?'signup':'login'}">
      ${signup ? field('aName','Your name','<input type="text" id="aName" autocomplete="name" required>') : ''}
      ${field('aEmail','Email','<input type="email" id="aEmail" autocomplete="email" required>')}
      ${field('aPw','Password', `<input type="password" id="aPw" minlength="8" autocomplete="${signup?'new-password':'current-password'}" required>`)}
      ${signup ? '<p class="hint">At least 8 characters. We’ll send you an email to confirm your address.</p>' : ''}
      ${msg ? `<p class="${msg.startsWith('!')?'error':'small-print'}">${esc(msg.replace(/^!/,''))}</p>` : ''}
      <button class="btn accent">${signup ? 'Create account' : 'Log in'}</button>
      ${signup ? '' : '<button type="button" class="linkbtn" data-action="forgot">Forgot your password?</button>'}
    </form></div></div>`;
}

/* ---------- navigation ---------- */
const ICON = {
  pieces:'<path d="M12 5a2 2 0 1 1 2 2c-1 .4-2 1-2 2v1M12 10 3 17h18z"/>',
  saved:'<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
  requests:'<path d="M4 8h13l-3-3M20 16H7l3 3"/>',
  friends:'<circle cx="9" cy="9" r="3.2"/><circle cx="17" cy="10" r="2.4"/><path d="M3 19c.6-3 3-4.6 6-4.6s5.4 1.6 6 4.6M15 15.2c2.6-.4 5 .8 6 3.8"/>',
  profile:'<circle cx="12" cy="8.5" r="3.5"/><path d="M5 20c1-3.6 3.6-5.4 7-5.4s6 1.8 7 5.4"/>'
};
function renderNav(view){
  $('#header').hidden = false;
  const fr = S.incoming.length;
  const tabs = [['pieces','Pieces'],['saved','Saved'],['requests','Requests',S.todo],['friends','Friends',fr],['profile','You']];
  const cur = v => view===v || (view==='piece' && v==='pieces') || (view==='person' && v==='friends') || (view==='edit' && v==='profile');
  $('#nav').innerHTML = tabs.map(([v,l,b]) => `<a class="tab" href="#/${v}" ${cur(v)?'aria-current="page"':''}>${l}${b?`<span class="badge">${b}</span>`:''}</a>`).join('');
  const bar = $('#tabbar'); bar.hidden = false;
  bar.innerHTML = tabs.map(([v,l,b]) => `<a href="#/${v}" ${cur(v)?'aria-current="page"':''}><span class="ic"><svg viewBox="0 0 24 24" aria-hidden="true">${ICON[v]}</svg>${b?`<span class="badge">${b}</span>`:''}</span>${l}</a>`).join('');
  document.body.classList.toggle('on-piece', view==='piece');
}
async function route(){
  setBackdrop(null);
  if(!S.user || recovering) return renderAuth();
  const [, view='pieces', id] = (location.hash || '#/pieces').split('/');
  renderNav(view);
  if(!S.me?.name && view !== 'edit'){ location.hash = '#/edit'; return; }
  const views = { pieces:viewPieces, piece:viewPiece, saved:viewSaved, requests:viewRequests, friends:viewFriends, profile:() => viewPerson(me()), edit:viewProfile, person:viewPerson };
  try { await (views[view] || viewPieces)(id); } catch(e){ fail(e, 'Could not load this page.'); }
}
window.addEventListener('hashchange', () => { route(); scrollTo(0,0); });

/* ---------- pieces ---------- */
const PIECE_LIST = 'id,owner,title,category,material,size,brand,description,care,thanks,terms,available,created_at,piece_photos(path,caption,created_at),worn_to(occasion)';
async function viewPieces(){
  if(!S.pieces.length) $('#main').innerHTML = '<p class="loading">Loading pieces…</p>';
  await Promise.all([loadSocial(), loadTags()]); renderNav('pieces');
  const { data, error } = await sb.from('pieces').select(PIECE_LIST).order('created_at', {ascending:false});
  if(error) return fail(error, 'Could not load pieces.');
  S.pieces = data;
  await loadProfiles(data.map(p => p.owner));
  await signed(data.map(p => sortPhotos(p.piece_photos)[0]?.path));
  renderPieces();
}
function tile(p){
  const ph = sortPhotos(p.piece_photos)[0];
  return `<div class="tile"><a class="open" href="#/piece/${p.id}">${photo(ph, p, false)}
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
  const c = $('#count'); if(c) c.textContent = `${list.length} result${list.length===1?'':'s'}`;
  area.innerHTML = list.length ? `<div class="grid">${list.map(tile).join('')}</div>`
    : pool.length ? `<div class="empty">${S.f.q ? `Nothing found for “${esc(S.f.q)}”.` : 'Nothing matches these filters.'}<button class="chip" data-action="clear">Clear search and filters</button></div>`
    : `<div class="empty">No pieces yet. Start with one of yours: that dress you wore once.<button class="btn" data-action="modal" data-m="add">+ Add a piece</button></div>`;
}
function renderPieces(){
  const f = S.f, pool = S.pieces;
  const owners = [...new Set(pool.map(p => p.owner))];
  const catKeys = [...new Set([...Object.keys(CATS), ...pool.map(p => p.category)])];
  const cats = catKeys.map(k => [k, pool.filter(p => p.category===k && matchP(p,'cat')).length]).filter(([k,c]) => c || f.cat===k);
  const opt = (key, vals) => vals.map(v => `<option value="${esc(v)}" ${f[key]===v?'selected':''}>${esc(v)}</option>`).join('');
  const present = new Set(pool.map(p => p.size).filter(Boolean));
  const groups = Object.entries(SIZES).map(([g, l]) => [g, l.filter(x => present.has(x))]).filter(([, l]) => l.length);
  const odd = [...present].filter(x => !SIZE_ORDER.includes(x)); if(odd.length) groups.push(['Other sizes', odd]);
  const sizeOpts = groups.map(([g, l]) => `<optgroup label="${g}">${l.map(x => `<option value="${esc(x)}" ${f.size===x?'selected':''}>${esc(g==='Shoe sizes' ? 'Shoe '+x : x)}</option>`).join('')}</optgroup>`).join('');
  const mats = [...new Set(pool.map(p => p.material).filter(Boolean))].sort();
  const brands = [...new Set(pool.map(p => p.brand).filter(Boolean))].sort((a,b) => a.localeCompare(b));
  const occs = [...new Set(pool.flatMap(p => (p.worn_to||[]).map(w => w.occasion)))].sort();
  const active = ['owner','cat','size','mat','brand','occ'].some(k => f[k]!=='all') || f.avail || f.q;
  const nOn = ['size','mat','brand','occ'].filter(k => f[k]!=='all').length + (f.avail?1:0);
  const noFriends = !S.friends.size;
  $('#main').innerHTML = `
  <div class="head"><div style="flex:1"><span class="eyebrow">${pool.length} pieces from ${S.friends.size} friend${S.friends.size===1?'':'s'} and you</span>
    <h1>${f.owner==='all' ? 'All pieces' : f.owner===me() ? 'Your pieces' : esc(nm(f.owner))+'’s pieces'}</h1>
    <p class="lede">Got friends with style?<span class="long"> Together we have all the pieces to build an epic outfit.</span> Browse wardrobes, borrow pieces and shine at your special event!<span class="long"> It’s a way to take care of your wallet and the environment, and to give our coolest pieces all the love they deserve. &lt;3</span></p></div></div>
  ${noFriends ? `<div class="banner"><span>You only see pieces from friends. Add your first friend to start browsing.</span><a class="btn small" href="#/friends">Find friends</a></div>` : ''}
  ${S.incoming.length ? `<div class="banner"><span>${S.incoming.length} friend request${S.incoming.length>1?'s':''} waiting for you.</span><a class="btn small" href="#/friends">See requests</a></div>` : ''}
  ${pool.length ? `<div class="search"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/></svg><input type="search" id="pq" placeholder="Search: midi, silk, split, chocolate…" value="${esc(f.q)}" aria-label="Search pieces" autocomplete="off" enterkeyhint="search"></div>` : ''}
  ${owners.length > 1 ? `<div class="friends scroller" role="group" aria-label="Owner">
    <button class="friend" data-action="f" data-k="owner" data-v="all" aria-pressed="${f.owner==='all'}"><span class="av all" aria-hidden="true">✦</span>Everyone</button>
    ${owners.map(o => `<button class="friend" data-action="f" data-k="owner" data-v="${o}" aria-pressed="${f.owner===o}">${av(o)}${esc(nm(o))} <span class="count mono">${pool.filter(p=>p.owner===o).length}</span></button>`).join('')}
  </div>` : ''}
  ${pool.length ? `<div class="filters scroller" role="group" aria-label="Category">
    <button class="chip" data-action="f" data-k="cat" data-v="all" aria-pressed="${f.cat==='all'}">All categories</button>
    ${cats.map(([k,c]) => `<button class="chip" data-action="f" data-k="cat" data-v="${esc(k)}" aria-pressed="${f.cat===k}">${esc(catLabel(k, 1))} <span class="mono">${c}</span></button>`).join('')}
  </div>
  <button class="chip morebtn" data-action="morefilters" aria-expanded="${S.more?'true':'false'}">Filters${nOn?` <span class="mono">${nOn}</span>`:''} ${S.more?'▴':'▾'}</button>
  <div class="filters more ${S.more?'open':''}">
    <label class="sel"><span>Size</span><select data-filter="size"><option value="all">Any</option>${sizeOpts}</select></label>
    <label class="sel"><span>Material</span><select data-filter="mat"><option value="all">Any</option>${opt('mat',mats)}</select></label>
    <label class="sel"><span>Brand</span><select data-filter="brand"><option value="all">Any</option>${opt('brand',brands)}</select></label>
    <label class="sel"><span>Worn to</span><select data-filter="occ"><option value="all">Anything</option>${opt('occ',occs)}</select></label>
    <label class="toggle"><input type="checkbox" data-filter="avail" ${f.avail?'checked':''}> Available now</label>
    <span class="grow"></span><span class="mono" id="count" style="color:var(--muted)"></span>
    ${active ? '<button class="chip" data-action="clear">Clear</button>' : ''}
  </div>` : ''}
  <div id="grid-area"></div>`;
  renderGrid();
}
function termsBlock(p, mine){
  const rows = TERM_GROUPS.map(g => [g, p[g.key] || []]).filter(([, l]) => l.length);
  return rows.length ? `<div class="tlines">${rows.map(([g, l]) => `<div class="tline"><span class="eyebrow">${g.label}</span><div class="terms">${l.map(t => `<span class="term">${esc(t)}</span>`).join('')}</div></div>`).join('')}</div>`
    : `<p class="small-print">${mine ? 'No terms yet. A chocolate bar counts.' : 'No terms. Just be nice.'}</p>`;
}

let galleryIndex = 0, current = null;
async function viewPiece(id){
  $('#main').innerHTML = '<p class="loading">Loading…</p>';
  const { data:p, error } = await sb.from('pieces').select('*,piece_photos(id,path,caption,added_by,created_at),reactions(id,author,body,fit,created_at),worn_to(id,occasion,author)').eq('id', id).maybeSingle();
  if(error) return fail(error, 'Could not load this piece.');
  if(!p){ $('#main').innerHTML = `<a class="back" href="#/pieces">← Back to pieces</a><div class="empty">This piece is gone, or you are not friends with the owner (anymore).</div>`; return; }
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
  const ask = p.available ? 'Ask to borrow' : 'Ask for later dates';
  $('#main').innerHTML = `<a class="back" href="#/pieces">← Back to pieces</a>
  <div class="item">
    <div class="swipe-wrap">
      <div class="swipe" id="swipe">${p.photos.length ? p.photos.map(x => photo(x, p)).join('') : photo(null, p)}</div>
      ${p.photos.length > 1 ? `<div class="dots" id="dots">${p.photos.map((x,i) => `<span ${i===0?'class="on"':''}></span>`).join('')}</div>` : ''}
      <button class="btn ghost small" data-action="modal" data-m="photo">+ Add ${mine?'a':'your'} photo</button>
    </div>
    <div class="gallery">
      <div class="main">${photo(ph, p)}</div>
      ${ph ? `<div class="credit">${av(ph.added_by,'sm')} Photo by ${esc(nm(ph.added_by))}${ph.added_by===me()||mine ? ` · <button class="linkbtn" data-action="delphoto" data-id="${ph.id}" data-path="${esc(ph.path)}">Remove photo</button>` : ''}</div>` : ''}
      <div class="thumbs">
        ${p.photos.map((x,i) => `<button class="thumb" data-action="ph" data-i="${i}" aria-pressed="${i===galleryIndex}" aria-label="Photo ${i+1}">${photo(x, p)}</button>`).join('')}
        <button class="addph" data-action="modal" data-m="photo">+ Add ${mine?'a':'your'} photo</button>
      </div>
    </div>
    <div class="info">
      <div><span class="eyebrow">${mine ? 'Your piece' : `From <a class="plain" href="#/person/${p.owner}">${esc(nm(p.owner))}</a>`}</span><h1 style="margin-top:6px">${esc(p.title)}</h1>
        <p class="lede">${[p.brand, catLabel(p.category)].filter(Boolean).map(esc).join(' · ')}</p>
        ${p.description ? `<p class="desc">${esc(p.description)}</p>` : ''}</div>
      <div class="actions">
        ${mine ? `<button class="btn ghost" data-action="modal" data-m="edit">Edit</button>`
               : `<button class="btn accent" data-action="modal" data-m="borrow">${ask}</button>${heart(p.id,'inline')}`}
        ${p.buy_url ? `<a class="btn ghost" href="${esc(p.buy_url)}" target="_blank" rel="noopener">Where to buy it ↗</a>` : ''}
      </div>
      <dl class="facts">
        <dt>Size</dt><dd class="mono">${esc(p.category==='shoes' && /^\d/.test(p.size||'') ? 'EU '+p.size : (p.size || '–'))}</dd>
        <dt>Material</dt><dd>${esc(p.material || '–')}</dd>
        <dt>Status</dt><dd>${status(p)}</dd>
      </dl>
      <div class="section">
        <div class="head"><h2>${mine ? 'Your terms' : esc(nm(p.owner))+'’s terms'}</h2>${mine?'<button class="btn ghost small" data-action="modal" data-m="edit">Edit</button>':''}</div>
        ${termsBlock(p, mine)}
      </div>
      <div class="section">
        <div class="head"><h2>Worn to</h2><button class="btn ghost small" data-action="modal" data-m="worn">+ Add where</button></div>
        ${Object.keys(worn).length ? `<div class="wornlist">${Object.entries(worn).map(([o,b]) => `<span class="wchip">${esc(o)} <span class="mono">×${b.length}</span><span class="avs">${[...new Set(b)].map(x=>av(x,'sm')).join('')}</span></span>`).join('')}</div>` : '<p class="small-print">Not worn out yet.</p>'}
      </div>
      <div class="section">
        <div class="head"><h2>Reactions</h2><button class="btn ghost small" data-action="modal" data-m="react">Say something</button></div>
        ${fits.length ? `<p class="small-print">Fit, according to the group: ${fits.map(([f,c]) => `${f.toLowerCase()} (${c})`).join(', ')}</p>` : ''}
        ${p.reactions.length ? p.reactions.map(r => `<div class="review"><div class="rhead">${av(r.author,'sm')}<strong>${esc(nm(r.author))}</strong>${r.fit?`<span class="pill">${esc(r.fit)}</span>`:''}${r.author===me()?`<button class="linkbtn" data-action="delreact" data-id="${r.id}">Delete</button>`:''}</div><p>${esc(r.body)}</p></div>`).join('')
          : '<p class="small-print">No reactions yet. Be the first to hype it up.</p>'}
      </div>
    </div>
  </div>
  ${mine ? '' : `<div class="actionbar"><button class="btn accent" data-action="modal" data-m="borrow">${ask}</button>${heart(p.id,'inline')}</div>`}`;
  const sw = $('#swipe'), dots = $('#dots');
  if(sw && dots) sw.addEventListener('scroll', () => { const i = Math.round(sw.scrollLeft / sw.clientWidth); [...dots.children].forEach((d,j) => d.classList.toggle('on', i===j)); }, { passive:true });
}

/* ---------- saved ---------- */
async function viewSaved(){
  $('#main').innerHTML = '<p class="loading">Loading…</p>';
  await loadSocial();
  const ids = [...S.hearts];
  let list = [];
  if(ids.length){
    const { data, error } = await sb.from('pieces').select(PIECE_LIST).in('id', ids);
    if(error) return fail(error);
    list = data; await loadProfiles(list.map(p=>p.owner)); await signed(list.map(p => sortPhotos(p.piece_photos)[0]?.path));
  }
  $('#main').innerHTML = `<div class="head"><div><span class="eyebrow">${list.length} hearted</span><h1>Saved</h1><p class="lede">Pieces you have your eye on.</p></div></div>
  ${list.length ? `<div class="grid">${list.map(tile).join('')}</div>` : ''}`;
}

/* ---------- requests ---------- */
let REQS = [];
async function viewRequests(){
  $('#main').innerHTML = '<p class="loading">Loading…</p>';
  await loadSocial(); renderNav('requests');
  const { data, error } = await sb.from('borrow_requests').select('*,pieces(id,title,category,piece_photos(path,created_at))').order('created_at', {ascending:false});
  if(error) return fail(error);
  REQS = data;
  const others = data.map(r => r.owner===me() ? r.borrower : r.owner);
  await loadProfiles(others);
  const { data:ph } = await sb.from('contacts').select('user_id,phone').in('user_id', [...new Set(others)]);
  (ph||[]).forEach(c => S.phones[c.user_id] = c.phone);
  await signed(data.map(r => sortPhotos(r.pieces?.piece_photos)[0]?.path));
  const inc = data.filter(r => r.owner===me()), out = data.filter(r => r.borrower===me());
  $('#main').innerHTML = `<div class="head"><div><h1>Requests</h1><p class="lede">Borrowers keep things moving: they set the dates and mark when a piece is back. Owners say yes and confirm.</p></div></div>
  <div class="stack">
    <section class="section" style="border:0;padding:0"><h2>Lent out</h2>${inc.length ? inc.map(reqRow).join('') : '<p class="small-print">No one has asked yet.</p>'}</section>
    <section class="section"><h2>Borrowed from</h2>${out.length ? out.map(reqRow).join('') : '<p class="small-print">You have not asked anyone yet.</p>'}</section>
  </div>`;
}
function chatText(r){
  const other = r.owner===me() ? r.borrower : r.owner, title = r.pieces?.title || 'piece';
  return r.owner===me()
    ? `Hi ${first(other)}! About my ${title} (${fmt(r.date_from)} until ${fmt(r.date_until)}): when do you want to pick it up?`
    : `Hi ${first(other)}! I asked for your ${title} on Sharing = Caring (${fmt(r.date_from)} until ${fmt(r.date_until)}). When suits you for pick-up?`;
}
const otherOf = r => r.owner===me() ? r.borrower : r.owner;
const waLink = r => `https://wa.me/${cleanPhone(S.phones[otherOf(r)])}?text=${encodeURIComponent(chatText(r))}`;
// Signal opens the chat by number but can't pre-fill text, so the message is copied for pasting
const signalBtn = (r, cls='btn ghost small') => S.phones[otherOf(r)] ? `<a class="${cls}" href="https://signal.me/#p/+${cleanPhone(S.phones[otherOf(r)])}" target="_blank" rel="noopener" data-action="signal" data-msg="${esc(chatText(r))}">Signal</a>` : '';
async function copyMsg(t){ try { await navigator.clipboard.writeText(t); toast('Message copied: paste it in Signal'); } catch { /* clipboard blocked: Signal still opens */ } }
function reqRow(r){
  const owner = r.owner===me(), other = owner ? r.borrower : r.owner, o = esc(nm(other)), p = r.pieces;
  const piece = p ? { title:p.title, category:p.category } : { title:'Piece', category:'' };
  const A = (s,l,g) => `<button class="btn small ${g?'ghost':''}" data-action="req" data-id="${r.id}" data-s="${s}">${l}</button>`;
  const T = (c,l) => `<span class="st ${c}">${l}</span>`;
  const W = `<a class="btn ghost small" href="${waLink(r)}" target="_blank" rel="noopener">WhatsApp</a>` + signalBtn(r);
  let line, act;
  if(owner){
    line = `<strong>${o}</strong> ${r.status==='pending'?'asks for':'borrows'} your <strong>${esc(piece.title)}</strong>`;
    act = { pending:A('accepted','Lend it')+A('declined','Decline',1), accepted:T('accepted','With '+o)+W, returned:A('confirmed','Confirm it’s back')+A('accepted','Not back yet',1), confirmed:T('','Back home'), declined:T('','Declined'), cancelled:T('','Cancelled') }[r.status];
    if(r.status==='returned') line += `<p class="flag">${o} says it’s back. Check it and confirm.</p>`;
  }else{
    line = `You ${r.status==='pending'?'asked':'borrow'} <strong>${o}</strong>’s <strong>${esc(piece.title)}</strong>`;
    act = { pending:T('pending','Waiting for '+o)+W+A('cancelled','Cancel',1), accepted:A('returned','I brought it back')+W, returned:T('pending','Waiting for '+o+' to confirm'), confirmed:T('','Done, thank you!'), declined:T('','Declined'), cancelled:T('','Cancelled') }[r.status];
    if(r.status==='accepted') line += `<p class="flag">${o} said yes! Bring it back by ${fmt(r.date_until)}.</p>`;
  }
  const thumb = p ? `<a href="#/piece/${p.id}" aria-label="Open ${esc(p.title)}">${photo(sortPhotos(p.piece_photos)[0], piece, false)}</a>` : photo(null, piece, false);
  return `<div class="row-card">${thumb}<div style="min-width:0"><div>${line}</div><p class="mono">${fmt(r.date_from)} until ${fmt(r.date_until)}</p>${r.message?`<p>“${esc(r.message)}”</p>`:''}</div><div class="actions">${act}</div></div>`;
}

/* ---------- friends ---------- */
async function viewFriends(){
  $('#main').innerHTML = '<p class="loading">Loading…</p>';
  await loadSocial(); renderNav('friends');
  const person = (id, actions, sub='') => `<div class="row-card person"><a href="#/person/${id}" aria-label="See ${esc(nm(id))}’s profile">${av(id,'lg')}</a><div style="min-width:0"><a class="plain" href="#/person/${id}"><strong>${esc(nm(id))}</strong></a>${sub?`<p>${sub}</p>`:''}</div><div class="actions">${actions}</div></div>`;
  $('#main').innerHTML = `<div class="head"><div><h1>Friends</h1><p class="lede">Friendship works both ways: you only see each other’s pieces once you both say yes.</p></div></div>
  <div class="stack">
    <section class="card" style="max-width:none">
      <h3>Invite your friends</h3>
      <p class="small-print">Send them this link. Once they have an account, search for their name below.</p>
      <div class="actions"><code class="mono" style="overflow-wrap:anywhere">${esc(APP_URL)}</code><button class="btn small" data-action="copy">Copy link</button>
      <a class="btn ghost small" href="https://wa.me/?text=${encodeURIComponent('Join me on Sharing = Caring, so we can borrow each other’s fancy clothes: '+APP_URL)}" target="_blank" rel="noopener">Share in WhatsApp</a></div>
    </section>
    ${S.incoming.length ? `<section class="section" style="border:0;padding:0"><h2>Asked you</h2>${S.incoming.map(id => person(id, `<button class="btn small" data-action="fr-accept" data-id="${id}">Accept</button><button class="btn ghost small" data-action="fr-remove" data-id="${id}">Ignore</button>`)).join('')}</section>` : ''}
    <section class="section" style="border:0;padding:0"><h2>Find people</h2>
      <form data-form="search" class="actions" style="display:flex"><div class="field" style="flex:1;min-width:0"><input type="search" id="q" placeholder="Search by name" aria-label="Search by name" required></div><button class="btn">Search</button></form>
      <div id="results"></div></section>
    ${S.outgoing.length ? `<section class="section"><h2>Waiting for a yes</h2>${S.outgoing.map(id => person(id, `<button class="btn ghost small" data-action="fr-remove" data-id="${id}">Cancel</button>`)).join('')}</section>` : ''}
    <section class="section"><h2>Your friends</h2>${S.friends.size ? [...S.friends].map(id => person(id, `<button class="linkbtn" data-action="fr-remove" data-id="${id}" data-confirm="1">Remove</button>`)).join('') : '<p class="small-print">No friends yet. Invite someone and search for their name.</p>'}</section>
  </div>`;
}
async function search(q){
  const { data, error } = await sb.from('profiles').select(PROFILE_COLS).ilike('name', `%${q.replace(/[%_]/g,'')}%`).neq('id', me()).limit(20);
  if(error) return fail(error);
  data.forEach(p => S.profiles[p.id] = p);
  $('#results').innerHTML = data.length ? data.map(p => {
    const state = S.friends.has(p.id) ? '<span class="st accepted">Friends</span>'
      : S.outgoing.includes(p.id) ? '<span class="st pending">Waiting</span>'
      : S.incoming.includes(p.id) ? `<button class="btn small" data-action="fr-accept" data-id="${p.id}">Accept</button>`
      : `<button class="btn small" data-action="fr-add" data-id="${p.id}">Add friend</button>`;
    return `<div class="row-card person">${av(p.id,'lg')}<div style="min-width:0"><strong>${esc(p.name)}</strong></div><div class="actions">${state}</div></div>`;
  }).join('') : '<p class="small-print">No one found. Check the spelling, or send them the invite link.</p>';
}

/* ---------- profile ---------- */
async function viewPerson(id){
  $('#main').innerHTML = '<p class="loading">Loading…</p>';
  const mine = id === me(), friend = mine || S.friends.has(id);
  await loadSocial(); await loadProfiles([id]); renderNav(mine ? 'profile' : 'person');
  let ex = null, pieces = [], theirFriends = [];
  if(friend){
    const [a, b, c] = await Promise.all([
      sb.from('profile_extras').select('bio,backdrop').eq('user_id', id).maybeSingle(),
      sb.from('pieces').select(PIECE_LIST).eq('owner', id).order('created_at', { ascending:false }),
      sb.from('friendships').select('requester,addressee').eq('status', 'accepted').or(`requester.eq.${id},addressee.eq.${id}`)
    ]);
    ex = a.data; pieces = b.data || [];
    theirFriends = [...new Set((c.data || []).map(r => r.requester === id ? r.addressee : r.requester))];
    await loadProfiles(theirFriends);
    // people you know first, then the rest
    theirFriends.sort((x, y) => (x === me() ? -2 : S.friends.has(x) ? -1 : 0) - (y === me() ? -2 : S.friends.has(y) ? -1 : 0) || nm(x).localeCompare(nm(y)));
    await signed([ex?.backdrop, ...pieces.map(p => sortPhotos(p.piece_photos)[0]?.path)]);
  }
  const bd = ex?.backdrop && S.urls[ex.backdrop];
  const action = mine ? '<a class="btn ghost small" href="#/edit">Edit<span class="long">&nbsp;profile</span></a>'
    : friend ? '' : S.outgoing.includes(id) ? '<span class="st pending">Waiting for a yes</span>'
    : S.incoming.includes(id) ? `<button class="btn small" data-action="fr-accept" data-id="${id}">Accept</button>`
    : `<button class="btn small" data-action="fr-add" data-id="${id}">Add friend</button>`;
  $('#main').innerHTML = `${mine ? '' : '<a class="back" href="#/friends">← Friends</a>'}
  <section class="pcard profile">
    <div class="phead">${av(id,'xxl')}<div class="pname"><h1>${esc(nm(id) === 'You' ? (S.me?.name || 'You') : nm(id))}</h1>${friend ? `<span class="eyebrow">${pieces.length} piece${pieces.length===1?'':'s'} to share</span>` : ''}</div><div class="actions">${action}</div></div>
    ${ex?.bio ? `<p class="bio">${esc(ex.bio)}</p>` : mine ? `<p class="bio small-print"><a href="#/edit">Add a bio and a closet photo →</a></p>` : ''}
    ${friend && theirFriends.length ? `<div class="pfriends"><span class="eyebrow">${theirFriends.length} friend${theirFriends.length===1?'':'s'}</span>
      <div class="friends scroller">${theirFriends.map(f => {
        const known = f === me() || S.friends.has(f), waiting = S.outgoing.includes(f);
        return `<a class="friend" href="#/person/${f}">${av(f)}${esc(f === me() ? 'You' : nm(f))}${known ? '' : waiting ? ' <span class="count mono">asked</span>' : ' <span class="count">+</span>'}</a>`;
      }).join('')}</div></div>` : ''}
  </section>
  <section class="pcard ppieces">
  ${mine ? `<div class="grid">${pieces.map(tile).join('')}<button class="tile addpiece" data-action="modal" data-m="add"><span class="plus" aria-hidden="true">+</span><span>Add a piece</span></button></div>`
   : friend ? (pieces.length ? `<div class="grid">${pieces.map(tile).join('')}</div>` : `<div class="empty">No pieces here yet.</div>`)
           : `<div class="empty">You only see someone’s wardrobe once you are friends.</div>`}
  </section>`;
  setBackdrop(bd);
}

// Closet photo as the full page background behind the profile (Hyves-style)
function setBackdrop(url){
  let el = $('#pageBg');
  if(!el){ el = document.createElement('div'); el.id = 'pageBg'; el.setAttribute('aria-hidden', 'true'); document.body.prepend(el); }
  el.style.backgroundImage = url ? `url('${url.replace(/'/g, '%27')}')` : '';
  document.body.classList.toggle('has-bg', !!url);
}

let backdropFile = null, backdropRemove = false;
async function viewProfile(){
  const [{ data:c }, { data:ex }] = await Promise.all([
    sb.from('contacts').select('phone').eq('user_id', me()).maybeSingle(),
    sb.from('profile_extras').select('bio,backdrop').eq('user_id', me()).maybeSingle()
  ]);
  S.myExtras = ex || {}; backdropFile = null; backdropRemove = false; S.customBlob = null; S.customUrl = null; S.customSug = null;
  if(ex?.backdrop) await signed([ex.backdrop]);
  const welcome = !S.me?.name;
  setTimeout(renderInk, 0);
  $('#main').innerHTML = `${welcome ? '' : '<a class="back" href="#/profile">← Your profile</a>'}<div class="head"><div><h1>${welcome ? 'Welcome!' : 'Edit profile'}</h1><p class="lede">${welcome ? 'Tell your friends who you are.' : esc(S.user.email)}</p></div></div>
  <div class="card">
    <form data-form="profile">
      ${field('pName','Your name','<input type="text" id="pName" autocomplete="name" required value="'+esc(S.me?.name||'')+'">')}
      ${field('pPhone','Phone number (for WhatsApp or Signal)','<input type="tel" id="pPhone" autocomplete="tel" placeholder="+31 6 12345678" value="'+esc(c?.phone||'')+'">')}
      <p class="hint">Only your friends can see your number. They use it to plan pick-ups with you on WhatsApp or Signal.</p>
      <div class="field"><span class="legend">Your picture</span>
        <div class="avrow"><span class="av xxl" id="avPreview" aria-hidden="true">${esc(initial(me()))}</span>
          <p class="hint">Pick a texture, then a colour for your letter.</p></div>
        <span class="legend sub">Texture</span>
        <div class="avpick">${AVATARS.map((t, i) => `<label class="av xl" style="background-image:url('${t.src}')"><input type="radio" name="pAv" value="${i}" ${!isCustom(S.me) && avatarOf(me())===i?'checked':''} aria-label="Texture ${i+1}"></label>`).join('')}
          <label class="av xl" id="customTile" ${isCustom(S.me) || S.me?.avatar_src ? `style="background-image:url('${esc(customUrl(S.me))}')"` : 'hidden'}><input type="radio" name="pAv" value="-1" ${isCustom(S.me)?'checked':''} aria-label="Your own texture"></label></div>
        <label class="btn ghost small filebtn maketex">+ Make your own texture<input type="file" id="texFile" accept="image/*,.heic,.heif"></label>
        <span class="legend sub">Letter colour</span>
        <div class="inkpick" id="inkPick"></div>
        <input type="hidden" id="pInk" value="${esc(S.me?.avatar_ink || '')}">
      </div>
      ${field('pBio','Bio (optional)','<textarea id="pBio" maxlength="300" placeholder="e.g. Hey! I’m Sara and I love sustainability and making my own clothes.">'+esc(ex?.bio||'')+'</textarea>')}
      <div class="field"><span class="legend">Closet photo (optional)</span>
        <div class="backdrop small" id="bdPreview" ${ex?.backdrop && S.urls[ex.backdrop] ? `style="background-image:url('${esc(S.urls[ex.backdrop])}')"` : ''}></div>
        <div class="actions"><label class="btn ghost small filebtn"><input type="file" id="bdFile" accept="image/*,.heic,.heif">Choose photo</label>
        <button type="button" class="linkbtn" data-action="bd-remove" ${ex?.backdrop ? '' : 'hidden'} id="bdRemove">Remove</button></div>
        <p class="hint">The background of your profile page. Bio and closet photo are only visible to friends.</p></div>
      <div class="actions"><button class="btn accent">Save</button>${welcome ? '' : '<a class="btn ghost" href="#/profile">Cancel</a>'}</div>
    </form>
  </div>
  ${welcome ? '' : `<div style="margin-top:28px" class="actions"><button class="btn ghost" data-action="logout">Log out</button></div>`}`;
}

/* Profile picture editor: live preview, suggested colour first */
function renderInk(){
  const box = $('#inkPick'); if(!box) return;
  const a = +(document.querySelector('[name=pAv]:checked')?.value ?? avatarOf(me())), custom = a === -1, cur = $('#pInk').value;
  const sug = custom ? (S.customSug || S.me?.avatar_ink || '#FFFFFF') : AVATARS[a].ink;
  const ink = cur || sug, sw = (c, label) => `<button type="button" class="ink ${norm(c)===norm(ink)?'on':''}" style="background:${c}" data-action="ink" data-v="${c}" aria-label="${label}" title="${label}"></button>`;
  box.innerHTML = `<button type="button" class="ink sugg ${!cur?'on':''}" style="background:${sug}" data-action="ink" data-v="" aria-label="Suggested colour">Suggested</button>`
    + INK_SWATCHES.filter(c => norm(c) !== norm(sug)).map(c => sw(c, c)).join('')
    + `<label class="ink custom" title="Any colour"><input type="color" id="inkCustom" value="${ink}" aria-label="Any colour">+</label>`;
  const pv = $('#avPreview');
  if(pv) pv.setAttribute('style', custom ? `background-image:url('${esc(S.customUrl || customUrl(S.me))}');color:${ink}` : avStyle(a, ink));
}

/* Make your own texture: drag a small square over your photo; it can never be big enough to show the whole thing */
let crop = null;
async function startCrop(file){
  let img; try { img = await decode(file); } catch(e){ return toast('That photo can’t be read. Try a JPG or PNG.'); }
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
  if(!S.customBlob) return toast('That didn’t work. Try another photo.');
  S.customUrl = URL.createObjectURL(S.customBlob);
  closeModal();
  const tile = $('#customTile'); tile.hidden = false; tile.style.backgroundImage = `url('${S.customUrl}')`; tile.querySelector('input').checked = true;
  $('#pInk').value = ''; renderInk();
}

/* ---------- dialogs ---------- */
function tgRender(g){
  const grp = TERM_GROUPS.find(x => x.key === g), cur = S.form[g];
  const misplaced = g === 'terms' ? /dry|clean|wash|steam|iron|chocolate|wine|photo|drink|flowers/i : null;
  const sug = uniqCI([...grp.sug, ...S.pieces.flatMap(p => p[g] || [])]).filter(x => !cur.some(c => norm(c) === norm(x)) && !(misplaced && misplaced.test(x))).slice(0, 8);
  return `<span class="legend">${grp.label} <span class="hint">${grp.ask}</span></span>
    <div class="terms">${cur.map((t, i) => `<button type="button" class="term on" data-action="tg-del" data-g="${g}" data-i="${i}" aria-label="Remove ${esc(t)}">${esc(t)} <span aria-hidden="true">×</span></button>`).join('')}${sug.map(x => `<button type="button" class="term sug" data-action="tg-add" data-g="${g}" data-v="${esc(x)}">+ ${esc(x)}</button>`).join('')}</div>
    <div class="ownrow"><input type="text" class="tg-input" data-g="${g}" id="tg-in-${g}" placeholder="Add your own" aria-label="Add your own: ${grp.label}"><button type="button" class="btn ghost small" data-action="tg-own" data-g="${g}">Add</button></div>`;
}
const termFields = () => `<div class="field"><span class="legend big">Borrowing terms</span><p class="hint">Tap a suggestion or add your own. Friends see these before they ask.</p></div>
  ${TERM_GROUPS.map(g => `<div class="field tgroup" id="tg-${g.key}">${tgRender(g.key)}</div>`).join('')}`;
function catField(cur){
  const custom = uniqCI([...S.tags.category, ...S.pieces.map(p => p.category).filter(c => c && !CATS[c])]);
  const opts = [...Object.keys(CATS).map(k => [k, CATS[k][0]]), ...custom.map(c => [c, c])];
  if(cur && !opts.some(([v]) => v === cur)) opts.push([cur, cur]);
  return `<div class="field"><span class="legend">Category</span><div class="opts" id="catOpts">${opts.map(([v, l], i) => `<label><input type="radio" name="iCat" value="${esc(v)}" ${(cur ? cur === v : i === 0) ? 'checked' : ''}> ${esc(l)}</label>`).join('')}<button type="button" class="chip addchip" data-action="cat-new">+ New category</button></div>
    <div class="ownrow" id="catNew" hidden><input type="text" id="iCatNew" placeholder="e.g. Hats, Capes, Kimonos" aria-label="New category"><button type="button" class="btn ghost small" data-action="cat-add">Add</button></div></div>`;
}
function sizeSelect(cat, cur){
  const groups = sizeGroups(cat), def = cur || (['bag','accessories'].includes(cat) ? 'One size' : '');
  let html = groups.map(g => `<optgroup label="${g}">${SIZES[g].map(x => `<option value="${x}" ${def===x?'selected':''}>${g==='Shoe sizes' ? 'EU '+x : x}</option>`).join('')}</optgroup>`).join('');
  if(def && !groups.some(g => SIZES[g].includes(def))) html = `<option value="${esc(def)}" selected>${esc(def)}</option>` + html;
  return `<select id="iSize" required><option value="" ${def?'':'selected'} disabled>Choose a size</option>${html}</select>`;
}
function photoField(p){
  const old = p ? p.photos.map(x => `<div class="pthumb">${photo(x, p, false)}${(x.added_by===me() || p.owner===me()) ? `<button type="button" class="x" data-action="delphoto-edit" data-id="${x.id}" data-path="${esc(x.path)}" aria-label="Remove photo">×</button>` : ''}</div>`).join('') : '';
  return `<div class="field"><span class="legend">Photos</span><div class="pgrid" id="pgrid">${old}<span id="newprev" class="contents"></span>
    <label class="addtile"><input type="file" id="iFiles" accept="image/*,.heic,.heif" multiple>+ Add photos</label></div></div>`;
}
function renderNewPrev(){
  const el = $('#newprev'); if(!el) return;
  el.innerHTML = S.newFiles.map((f, i) => `<div class="pthumb"><span class="ph preview" data-name="${esc(f.name)}"><img src="${URL.createObjectURL(f)}" alt=""></span><button type="button" class="x" data-action="drop-new" data-i="${i}" aria-label="Don’t add this photo">×</button></div>`).join('');
}
function brandSug(){
  const box = $('#brandSug'); if(!box) return;
  const raw = $('#iBrand').value.trim(), v = norm(raw), all = brandList();
  const exact = all.find(b => norm(b) === v);
  const list = all.filter(b => !v || norm(b).includes(v)).filter(b => norm(b) !== v).slice(0, 8);
  box.innerHTML = list.map(b => `<button type="button" class="term sug" data-action="brand-pick" data-v="${esc(b)}">${esc(b)}</button>`).join('')
    + (raw && !exact ? `<span class="hint">“${esc(raw)}” will be added as a new label.</span>`
      : exact && exact !== raw ? `<span class="hint">Will be saved as “${esc(exact)}”.</span>` : '');
}
const pieceFields = (p={}) => `
  ${field('iTitle','Name','<input type="text" id="iTitle" required value="'+esc(p.title||'')+'">')}
  ${field('iDesc','Description (optional)','<textarea id="iDesc" placeholder="e.g. flowy fabric, twirls amazing, …">'+esc(p.description||'')+'</textarea>')}
  ${catField(p.category)}
  <div class="two"><div class="field" id="sizeField"><label for="iSize">Size</label>${sizeSelect(p.category || 'dress', p.size)}</div>${field('iMat','Material',`<select id="iMat"><option value="">Choose</option>${MATERIALS.map(m => `<option ${p.material===m?'selected':''}>${m}</option>`).join('')}</select>`)}</div>
  <div class="field"><label for="iBrand">Brand</label><input type="text" id="iBrand" autocomplete="off" placeholder="e.g. Zara, or Vintage" value="${esc(p.brand||'')}"><div class="suggest" id="brandSug"></div></div>
  ${termFields()}
  ${field('iBuy','Where to buy it (optional link)','<input type="url" id="iBuy" placeholder="https://" value="'+esc(p.buy_url||'')+'">')}`;
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
const cancel = '<button type="button" class="btn ghost" data-action="close">Cancel</button>';

function openModal(m){
  const p = current; let h = '';
  if(m==='add' || m==='edit'){
    const src = m==='edit' ? p : {};
    S.form = { care:[...(src.care||[])], thanks:[...(src.thanks||[])], terms:[...(src.terms||[])] }; S.newFiles = [];
  }
  if(m==='add') h = `<span class="eyebrow">Your pieces</span><h2>Add a piece</h2><form data-form="add">${photoField()}${pieceFields()}
    <div class="actions">${cancel}<button class="btn accent">Add to my pieces</button></div></form>`;
  if(m==='edit') h = `<span class="eyebrow">Your piece</span><h2>Edit</h2><form data-form="edit">${photoField(p)}${pieceFields(p)}
    <label class="toggle"><input type="checkbox" id="iAvail" ${p.available?'checked':''}> Available to borrow</label>
    <div class="actions" style="justify-content:space-between"><button type="button" class="btn danger small" data-action="modal" data-m="delete">Delete piece</button><span class="actions">${cancel}<button class="btn save">Save</button></span></div></form>`;
  if(m==='delete') h = `<h2>Delete “${esc(p.title)}”?</h2><p style="margin:0">This removes the piece, its photos, reactions and requests for everyone. You can’t undo it.</p>
    <div class="actions">${cancel}<button class="btn danger" data-action="delpiece">Yes, delete it</button></div>`;
  if(m==='photo') h = `<span class="eyebrow">${esc(p.title)}</span><h2>Add a photo</h2><form data-form="photo">
    ${field('pFile','Photo','<input type="file" id="pFile" accept="image/*,.heic,.heif" required>')}
    ${field('pCap','Where was this? (optional)','<input type="text" id="pCap" placeholder="e.g. At Lotte’s wedding">')}
    <div class="actions">${cancel}<button class="btn">Add to gallery</button></div></form>`;
  if(m==='react') h = `<span class="eyebrow">${esc(p.title)}</span><h2>Say something</h2><form data-form="react">
    ${field('rTxt','Your reaction','<textarea id="rTxt" placeholder="Obsessed? Wore it? Spill." required></textarea>')}
    <div class="field"><span class="legend">Fit (optional, if you wore it)</span><div class="opts">${FITS.map(f => `<label><input type="radio" name="rFit" value="${f}"> ${f}</label>`).join('')}</div></div>
    <p class="hint">Text only. Photos go in the gallery so everyone sees them.</p>
    <div class="actions">${cancel}<button class="btn">Post</button></div></form>`;
  if(m==='worn') h = `<span class="eyebrow">${esc(p.title)}</span><h2>Where was it worn?</h2><form data-form="worn">
    <div class="field"><span class="legend">Occasion</span><div class="opts">${OCC.map((o,i) => `<label><input type="radio" name="wO" value="${o}" ${i===0?'checked':''}> ${o}</label>`).join('')}</div></div>
    ${field('wOther','Something else?','<input type="text" id="wOther" placeholder="e.g. Opera, Prom, Christmas dinner">')}
    <div class="actions">${cancel}<button class="btn">Add</button></div></form>`;
  if(m==='borrow'){ const today = new Date().toISOString().slice(0,10), o = esc(nm(p.owner)); h = `<span class="eyebrow">Ask ${o}</span><h2>Borrow “${esc(p.title)}”</h2>
    <form data-form="borrow"><div class="two">${field('bFrom','Need it from',`<input type="date" id="bFrom" min="${today}" required>`)}${field('bTo','Until',`<input type="date" id="bTo" min="${today}" required>`)}</div>
    ${field('bMsg','What’s it for?','<textarea id="bMsg" placeholder="e.g. Lotte’s wedding on Saturday! Could I pick it up Friday evening?" required></textarea>')}
    <div class="field"><span class="legend">${o}’s terms</span>${termsBlock(p, false)}</div>
    <div class="etiquette"><span class="eyebrow">Borrowing etiquette</span><ul>
      <li><strong>Return it in the same or better state</strong> than you got it.</li>
      <li><strong>Bring it back on time.</strong> Need it longer? Ask before your return date, not after.</li>
      <li><strong>Accidents happen.</strong> If something gets damaged or stained, tell ${o} straight away and propose a fix: cleaning, a repair or paying towards it.</li>
      <li><strong>You plan pick-up and return</strong>, at a time that suits ${o}. Mark it as returned in Requests.</li>
      <li><strong>Share the love.</strong> Add a photo of you wearing it to the gallery.</li></ul></div>
    <div class="actions">${cancel}<button class="btn accent">Send request</button></div></form>`; }
  if(m==='sent'){ const r = sentReq; h = `<span class="eyebrow">Request sent</span><h2>Now plan the pick-up</h2>
    <p style="margin:0">${esc(nm(r.owner))} sees your request in the app. Send a quick message to agree on when you pick it up.${S.phones[r.owner] ? ' For Signal, the message is copied so you can paste it.' : ''}</p>
    ${S.phones[r.owner] ? '' : `<p class="hint">${esc(nm(r.owner))} hasn’t added a phone number, so you’ll pick the chat yourself.</p>`}
    <div class="actions"><button type="button" class="btn ghost" data-action="close">Later</button><a class="btn accent" href="${waLink(r)}" target="_blank" rel="noopener" data-action="close">Open WhatsApp</a>${signalBtn(r, 'btn ghost')}</div>`; }
  if(m==='crop') h = `<h2>Make your own texture</h2>
    <p class="hint">Drag the square to a spot you love: a colour, a fabric, a pattern.</p>
    <div class="cropwrap"><div class="cropinner" id="cropInner"><img id="cropImg" src="${crop.src.toDataURL('image/jpeg', .85)}" alt="Your photo" draggable="false"><div class="cropbox" id="cropBox"></div></div></div>
    <div class="croprow"><canvas id="cropPrev" class="cropprev" width="176" height="176" aria-label="Preview"></canvas>
      <div class="field" style="flex:1"><label for="cropSize">Zoom</label><input type="range" id="cropSize" min="3" max="12" step="0.5" value="${15 - crop.frac*100}"></div></div>
    <div class="actions">${cancel}<button type="button" class="btn accent" data-action="crop-use">Use this texture</button></div>`;
  $('#sheet').innerHTML = h; $('#overlay').hidden = false;
  if(m==='add' || m==='edit') brandSug();
  if(m==='crop') bindCrop();
}
let sentReq = null;
const closeModal = () => { $('#overlay').hidden = true; $('#sheet').innerHTML = ''; S.newFiles = []; };

/* ---------- forms ---------- */
document.addEventListener('submit', async e => {
  e.preventDefault();
  const form = e.target, k = form.dataset.form, btn = form.querySelector('button:not([type=button])');
  if(btn) btn.disabled = true;
  try { await handlers[k]?.(form); } catch(err){ fail(err); }
  if(btn && document.body.contains(btn)) btn.disabled = false;
});
const handlers = {
  async login(){
    const { error } = await sb.auth.signInWithPassword({ email:$('#aEmail').value.trim(), password:$('#aPw').value });
    if(error) renderAuth(error.message.includes('confirm') ? '!Confirm your email first: check your inbox for our link.' : '!Email or password is not right.');
  },
  async signup(){
    const { data, error } = await sb.auth.signUp({ email:$('#aEmail').value.trim(), password:$('#aPw').value, options:{ data:{ name:$('#aName').value.trim() }, emailRedirectTo:APP_URL } });
    if(error) return renderAuth('!' + error.message);
    if(!data.session) { authMode = 'login'; renderAuth('Almost there! Click the link in the email we just sent you, then log in.'); }
  },
  async newpass(){
    const { error } = await sb.auth.updateUser({ password:$('#npw').value });
    if(error) return fail(error);
    recovering = false; toast('Password saved'); start();
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
        const up = await sb.storage.from('avatars').upload(path, S.customBlob, { contentType:'image/jpeg' }); if(up.error) throw up.error;
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
      const up = await sb.storage.from('photos').upload(path, blob, { contentType:'image/jpeg' }); if(up.error) throw up.error;
      backdrop = path;
    } else if(backdropRemove) backdrop = null;
    const c2 = await sb.from('profile_extras').upsert({ user_id:me(), bio: $('#pBio').value.trim() || null, backdrop }); if(c2.error) throw c2.error;
    if(old && old !== backdrop) await sb.storage.from('photos').remove([old]);
    toast('Saved'); location.hash = welcomeSave ? '#/pieces' : '#/profile';
  },
  async add(form){
    const btn = form.querySelector('.btn.accent');
    btn.textContent = 'Saving…';
    const { data, error } = await sb.from('pieces').insert(await readPiece()).select('id').single();
    if(error){ btn.textContent = 'Add to my pieces'; throw error; }
    await uploadMany(data.id, S.newFiles, btn);
    closeModal(); toast('Added to your pieces'); location.hash = '#/piece/' + data.id;
  },
  async edit(form){
    const btn = form.querySelector('.btn.save');
    btn.textContent = 'Saving…';
    const { error } = await sb.from('pieces').update({ ...(await readPiece()), available:$('#iAvail').checked }).eq('id', current.id);
    if(error){ btn.textContent = 'Save'; throw error; }
    const n = S.newFiles.length;
    await uploadMany(current.id, S.newFiles, btn);
    if(n) galleryIndex = current.photos.length;
    closeModal(); toast('Saved'); viewPiece(current.id);
  },
  async photo(){
    const f = $('#pFile').files[0]; if(!f) return;
    $('#sheet button:not(.ghost)').textContent = 'Uploading…';
    try { await uploadPhoto(current.id, f, $('#pCap').value.trim()); }
    catch(e){ console.error(e); $('#sheet button:not(.ghost)').textContent = 'Add to gallery'; return toast(e.message || 'The photo could not be added.'); }
    galleryIndex = current.photos.length; closeModal(); toast('Photo added'); viewPiece(current.id);
  },
  async react(){
    const fit = document.querySelector('[name=rFit]:checked')?.value || null;
    const { error } = await sb.from('reactions').insert({ piece_id:current.id, body:$('#rTxt').value.trim(), fit });
    if(error) throw error; closeModal(); viewPiece(current.id);
  },
  async worn(){
    const occasion = $('#wOther').value.trim() || document.querySelector('[name=wO]:checked').value;
    const { error } = await sb.from('worn_to').insert({ piece_id:current.id, occasion });
    if(error) throw error; closeModal(); toast('Added: ' + occasion); viewPiece(current.id);
  },
  async borrow(){
    const from = $('#bFrom').value, until = $('#bTo').value;
    if(until < from) return toast('“Until” is before “Need it from”.');
    const { data, error } = await sb.from('borrow_requests').insert({ piece_id:current.id, date_from:from, date_until:until, message:$('#bMsg').value.trim() }).select('*,pieces(id,title)').single();
    if(error) throw error;
    const { data:c } = await sb.from('contacts').select('phone').eq('user_id', data.owner).maybeSingle();
    S.phones[data.owner] = c?.phone; sentReq = data; openModal('sent');
  },
  async search(){ await search($('#q').value.trim()); }
};

/* ---------- clicks ---------- */
document.addEventListener('click', async e => {
  if(e.target.id === 'overlay') return closeModal();
  const a = e.target.closest('[data-action]'); if(!a) return;
  const d = a.dataset;
  try {
    switch(d.action){
      case 'authmode': authMode = d.m; renderAuth(); break;
      case 'forgot': {
        const email = $('#aEmail').value.trim();
        if(!email) return renderAuth('!Fill in your email first, then tap “Forgot your password?” again.');
        const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo:APP_URL });
        renderAuth(error ? '!' + error.message : 'If that email has an account, a reset link is on its way.'); break;
      }
      case 'logout': await sb.auth.signOut(); break;
      case 'modal': openModal(d.m); break;
      case 'close': closeModal(); break;
      case 'f': S.f[d.k] = d.v; renderPieces(); break;
      case 'morefilters': S.more = !S.more; renderPieces(); break;
      case 'clear': S.f = { owner:'all', cat:'all', size:'all', mat:'all', brand:'all', occ:'all', avail:false, q:'' }; renderPieces(); break;
      case 'bd-remove': backdropFile = null; backdropRemove = true; $('#bdPreview').style.backgroundImage = ''; a.hidden = true; break;
      case 'crop-use': await finishCrop(); break;
      case 'ink': $('#pInk').value = d.v; renderInk(); break;
      case 'signal': copyMsg(d.msg); break;
      case 'tg-add': S.form[d.g].push(d.v); $('#tg-' + d.g).innerHTML = tgRender(d.g); break;
      case 'tg-del': S.form[d.g].splice(+d.i, 1); $('#tg-' + d.g).innerHTML = tgRender(d.g); break;
      case 'tg-own': tgOwn(d.g); break;
      case 'cat-new': $('#catNew').hidden = false; $('#iCatNew').focus(); break;
      case 'cat-add': catAdd(); break;
      case 'brand-pick': $('#iBrand').value = d.v; brandSug(); break;
      case 'drop-new': S.newFiles.splice(+d.i, 1); renderNewPrev(); break;
      case 'delphoto-edit': {
        const { error } = await sb.from('piece_photos').delete().eq('id', d.id); if(error) throw error;
        await sb.storage.from('photos').remove([d.path]);
        current.photos = current.photos.filter(x => x.id !== d.id); galleryIndex = 0;
        a.closest('.pthumb').remove(); toast('Photo removed'); break;
      }
      case 'ph': galleryIndex = +d.i; renderPiece(); break;
      case 'heart': {
        const id = d.id, on = S.hearts.has(id);
        const { error } = on ? await sb.from('hearts').delete().eq('user_id', me()).eq('piece_id', id) : await sb.from('hearts').insert({ piece_id:id });
        if(error) throw error;
        on ? S.hearts.delete(id) : S.hearts.add(id);
        a.setAttribute('aria-pressed', !on); a.textContent = on ? '♡' : '♥'; toast(on ? 'Removed from saved' : 'Saved'); break;
      }
      case 'req': {
        const { error } = await sb.from('borrow_requests').update({ status:d.s }).eq('id', d.id);
        if(error) throw error;
        toast({ accepted:'Done', declined:'Request declined', returned:'Marked as returned. The owner will confirm.', confirmed:'Back home. Thanks for sharing!', cancelled:'Request cancelled' }[d.s]);
        viewRequests(); break;
      }
      case 'fr-add': {
        const { error } = await sb.from('friendships').insert({ addressee:d.id }); if(error) throw error;
        toast(`Friend request sent to ${nm(d.id)}`); route(); break;
      }
      case 'fr-accept': {
        const { error } = await sb.from('friendships').update({ status:'accepted' }).eq('requester', d.id).eq('addressee', me()); if(error) throw error;
        toast(`You and ${nm(d.id)} are friends now`); route(); break;
      }
      case 'fr-remove': {
        if(d.confirm && a.textContent !== 'Tap again to remove'){ a.textContent = 'Tap again to remove'; return; }
        const r1 = await sb.from('friendships').delete().eq('requester', me()).eq('addressee', d.id);
        const r2 = await sb.from('friendships').delete().eq('requester', d.id).eq('addressee', me());
        if(r1.error || r2.error) throw (r1.error || r2.error);
        toast('Done'); route(); break;
      }
      case 'copy':
        try { await navigator.clipboard.writeText(APP_URL); toast('Link copied'); } catch { toast('Copy the link by hand'); } break;
      case 'delphoto': {
        await sb.from('piece_photos').delete().eq('id', d.id);
        await sb.storage.from('photos').remove([d.path]);
        galleryIndex = 0; toast('Photo removed'); viewPiece(current.id); break;
      }
      case 'delreact': {
        const { error } = await sb.from('reactions').delete().eq('id', d.id); if(error) throw error; viewPiece(current.id); break;
      }
      case 'delpiece': {
        const paths = current.photos.filter(x => x.added_by === me()).map(x => x.path);
        const { error } = await sb.from('pieces').delete().eq('id', current.id); if(error) throw error;
        if(paths.length) await sb.storage.from('photos').remove(paths);
        closeModal(); toast('Piece deleted'); location.hash = '#/pieces'; break;
      }
    }
  } catch(err){ fail(err); }
});
document.addEventListener('change', e => {
  if(e.target.id === 'iFiles'){ S.newFiles.push(...e.target.files); e.target.value = ''; return renderNewPrev(); }
  if(e.target.name === 'iCat') return updateSizes();
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
  if(e.target.id === 'cropSize'){ crop.frac = (15 - +e.target.value)/100; drawCrop(); }
  if(e.target.id === 'inkCustom'){ $('#pInk').value = e.target.value.toUpperCase(); const pv = $('#avPreview'); if(pv) pv.style.color = e.target.value; }
});
// A photo that can't be shown gets a clear placeholder instead of a broken-image icon
document.addEventListener('error', e => { const ph = e.target?.tagName === 'IMG' && e.target.closest('.ph'); if(ph) ph.classList.add('broken'); }, true);

/* ---------- start ---------- */
async function start(){
  const { data:{ session } } = await sb.auth.getSession();
  S.user = session?.user || null;
  if(!S.user) return renderAuth();
  const { data } = await sb.from('profiles').select(PROFILE_COLS).eq('id', me()).maybeSingle();
  S.me = data || { id:me(), name:'' }; S.profiles[me()] = S.me;
  await loadTags();
  route();
}
sb.auth.onAuthStateChange((event, session) => {
  if(event === 'PASSWORD_RECOVERY'){ recovering = true; S.user = session?.user; return renderAuth(); }
  if(event === 'SIGNED_IN' && !S.user) { setTimeout(start, 0); }
  if(event === 'SIGNED_OUT'){ S.user = null; S.pieces = []; S.urls = {}; S.profiles = {}; S.tagsLoaded = false; location.hash = ''; renderAuth(); }
});
start();
