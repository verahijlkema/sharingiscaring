/* Sharing = Caring
   Plain JavaScript on top of Supabase. Who may see what is enforced by the database rules in schema.sql,
   so this file only decides what to show. */

const SUPABASE_URL = 'https://pggxllvyjcckkdscgzll.supabase.co';
const SUPABASE_KEY = 'sb_publishable_DZ5mCJZOnkUh9_gS_waXeQ_mgjKKLge';
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
const APP_URL = location.origin + location.pathname;

const CATS = {
  dress:['Dress','Dresses'], jumpsuit:['Jumpsuit','Jumpsuits'], top:['Top','Tops'], skirt:['Skirt','Skirts'],
  trousers:['Trousers','Trousers'], jacket:['Blazer or jacket','Jackets & blazers'], suit:['Suit','Suits & tailoring'],
  shoes:['Shoes','Shoes'], bag:['Bag','Bags'], accessories:['Accessory','Accessories']
};
const MATERIALS = ['Sequins','Beaded','Satin','Silk','Velvet','Crepe','Chiffon','Lace','Tulle','Wool','Linen','Cotton','Leather','Other'];
const OCC = ['Wedding','Gala','Party','Dinner','Graduation','Festival'];
const TERMS = ['Dry-clean before you return it','Steam it, don’t wash it','Hand-wash only','Max. one week','Bring a chocolate bar','Photo of you in it, or it didn’t happen','No red wine (good luck)'];
const FITS = ['Runs small','True to size','Runs large'];
const COLOURS = ['#D9D4F2','#F2D3C6','#CFE4D8','#F4E3B5','#C9DCEF','#E8CFDD','#F0D9C2','#D3E6C9'];

const S = {
  user:null, me:null, profiles:{}, phones:{}, friends:new Set(), incoming:[], outgoing:[], hearts:new Set(),
  urls:{}, pieces:[], todo:0,
  f:{owner:'all',cat:'all',size:'all',mat:'all',occ:'all',avail:false}
};

/* ---------- small helpers ---------- */
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const me = () => S.user.id;
const nm = id => id === me() ? 'You' : (S.profiles[id]?.name || 'Someone');
const first = id => id === me() ? 'you' : (S.profiles[id]?.name || 'Someone').split(' ')[0];
const av = (id, cls='') => `<span class="av ${cls}" style="background:${esc(S.profiles[id]?.colour || '#E5E1DC')}" aria-hidden="true">${esc((S.profiles[id]?.name || '?').trim()[0] || '?').toUpperCase()}</span>`;
const fmt = d => d ? new Date(d + 'T12:00').toLocaleDateString('en-GB', {day:'numeric', month:'short'}) : '';
let toastTimer;
function toast(t){ const el=$('#toast'); el.textContent=t; el.hidden=false; clearTimeout(toastTimer); toastTimer=setTimeout(()=>el.hidden=true, 3200); }
function fail(error, fallback='Something went wrong. Try again.'){ console.error(error); toast(error?.message ? `${fallback} (${error.message})` : fallback); }
const field = (id, label, input) => `<div class="field"><label for="${id}">${label}</label>${input}</div>`;
const cleanPhone = p => { let d=String(p||'').replace(/\D/g,''); if(d.startsWith('00')) d=d.slice(2); else if(d.startsWith('0')) d='31'+d.slice(1); return d; };

async function loadProfiles(ids){
  const need = [...new Set(ids)].filter(id => id && !S.profiles[id]);
  if(!need.length) return;
  const { data } = await sb.from('profiles').select('id,name,colour').in('id', need);
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
  const inner = url ? `<img src="${esc(url)}" alt="${esc(piece.title)}${p.caption?', '+esc(p.caption):''}" loading="lazy">` : `<span class="none">${esc(CATS[piece.category]?.[0] || 'Piece')}</span>`;
  return `<span class="ph">${inner}${tag && p?.caption ? `<span class="ph-tag">${esc(p.caption)}</span>` : ''}</span>`;
}
const status = p => p.available ? `<span class="status">Available</span>` : `<span class="status lent">Lent out</span>`;
const heart = (id, cls='') => `<button class="heart ${cls}" data-action="heart" data-id="${id}" aria-pressed="${S.hearts.has(id)}" aria-label="${S.hearts.has(id)?'Remove from saved':'Save'}">${S.hearts.has(id)?'♥':'♡'}</button>`;

/* Shrink photos on the phone before upload: faster and lighter on storage */
async function shrink(file){
  try{
    const img = await createImageBitmap(file, { imageOrientation:'from-image' });
    const s = Math.min(1, 1600 / Math.max(img.width, img.height));
    const c = document.createElement('canvas'); c.width = Math.round(img.width*s); c.height = Math.round(img.height*s);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return await new Promise(r => c.toBlob(b => r(b || file), 'image/jpeg', 0.82));
  }catch(e){ return file; }
}
async function uploadPhoto(pieceId, file, caption){
  const blob = await shrink(file);
  const path = `${me()}/${pieceId}/${crypto.randomUUID()}.jpg`;
  const up = await sb.storage.from('photos').upload(path, blob, { contentType:'image/jpeg' });
  if(up.error) throw up.error;
  const ins = await sb.from('piece_photos').insert({ piece_id:pieceId, path, caption: caption || null });
  if(ins.error) throw ins.error;
}

/* ---------- social data (friends, hearts, badge) ---------- */
async function loadSocial(){
  const [fr, he, rq] = await Promise.all([
    sb.from('friendships').select('*'),
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
  $('#header').hidden = true;
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
    <p class="small-print" style="text-align:center">Got friends with style? Browse their wardrobes, borrow a piece and shine at your event!</p>
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
function renderNav(view){
  $('#header').hidden = false;
  const fr = S.incoming.length;
  const tabs = [['pieces','Pieces'],['saved','Saved'],['requests','Requests',S.todo],['friends','Friends',fr],['profile','You']];
  $('#nav').innerHTML = tabs.map(([v,l,b]) => `<a class="tab" href="#/${v}" ${view===v||(view==='piece'&&v==='pieces')?'aria-current="page"':''}>${l}${b?`<span class="badge">${b}</span>`:''}</a>`).join('');
}
async function route(){
  if(!S.user || recovering) return renderAuth();
  const [, view='pieces', id] = (location.hash || '#/pieces').split('/');
  renderNav(view);
  if(!S.me?.name && view !== 'profile'){ location.hash = '#/profile'; return; }
  const views = { pieces:viewPieces, piece:viewPiece, saved:viewSaved, requests:viewRequests, friends:viewFriends, profile:viewProfile };
  try { await (views[view] || viewPieces)(id); } catch(e){ fail(e, 'Could not load this page.'); }
}
window.addEventListener('hashchange', () => { route(); scrollTo(0,0); });

/* ---------- pieces ---------- */
const PIECE_LIST = 'id,owner,title,category,material,size,brand,available,created_at,piece_photos(path,caption,created_at),worn_to(occasion)';
async function viewPieces(){
  if(!S.pieces.length) $('#main').innerHTML = '<p class="loading">Loading pieces…</p>';
  await loadSocial(); renderNav('pieces');
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
    <span class="meta"><span class="t-title">${esc(p.title)}</span><span class="mono" style="color:var(--muted)">${esc(CATS[p.category]?.[0]||'')} · ${esc(p.size||'')} · ${esc(nm(p.owner))}</span>${status(p)}</span></a>${p.owner===me()?'':heart(p.id)}</div>`;
}
function renderPieces(){
  const f = S.f, pool = S.pieces;
  const match = (p, skip) => (skip==='owner'||f.owner==='all'||p.owner===f.owner) && (skip==='cat'||f.cat==='all'||p.category===f.cat)
    && (f.size==='all'||p.size===f.size) && (f.mat==='all'||p.material===f.mat)
    && (f.occ==='all'||(p.worn_to||[]).some(w => w.occasion===f.occ)) && (!f.avail||p.available);
  const list = pool.filter(p => match(p));
  const owners = [...new Set(pool.map(p => p.owner))];
  const cats = Object.keys(CATS).map(k => [k, pool.filter(p => p.category===k && match(p,'cat')).length]).filter(([k,c]) => c || f.cat===k);
  const opt = (key, vals) => vals.map(v => `<option ${f[key]===v?'selected':''}>${esc(v)}</option>`).join('');
  const sizes = [...new Set(pool.map(p => p.size).filter(Boolean))].sort();
  const mats = [...new Set(pool.map(p => p.material).filter(Boolean))].sort();
  const occs = [...new Set(pool.flatMap(p => (p.worn_to||[]).map(w => w.occasion)))].sort();
  const active = ['owner','cat','size','mat','occ'].some(k => f[k]!=='all') || f.avail;
  const noFriends = !S.friends.size;
  $('#main').innerHTML = `
  <div class="head"><div style="flex:1"><span class="eyebrow">${pool.length} pieces from ${S.friends.size} friend${S.friends.size===1?'':'s'} and you</span>
    <h1>${f.owner==='all' ? 'All pieces' : f.owner===me() ? 'Your pieces' : esc(nm(f.owner))+'’s pieces'}</h1>
    <p class="lede">Got friends with style? Together you have even more pieces to build an epic outfit. Browse their wardrobes, borrow a piece and shine at your event! It’s a way to take care of your wallet and the environment, and to give your coolest pieces the love they deserve.</p></div></div>
  ${noFriends ? `<div class="banner"><span>You only see pieces from friends. Add your first friend to start browsing.</span><a class="btn small" href="#/friends">Find friends</a></div>` : ''}
  ${S.incoming.length ? `<div class="banner"><span>${S.incoming.length} friend request${S.incoming.length>1?'s':''} waiting for you.</span><a class="btn small" href="#/friends">See requests</a></div>` : ''}
  ${owners.length > 1 ? `<div class="friends" role="group" aria-label="Owner">
    <button class="friend" data-action="f" data-k="owner" data-v="all" aria-pressed="${f.owner==='all'}"><span class="av all" aria-hidden="true">✦</span>Everyone</button>
    ${owners.map(o => `<button class="friend" data-action="f" data-k="owner" data-v="${o}" aria-pressed="${f.owner===o}">${av(o)}${esc(nm(o))} <span class="count mono">${pool.filter(p=>p.owner===o).length}</span></button>`).join('')}
  </div>` : ''}
  ${pool.length ? `<div class="filters" role="group" aria-label="Category">
    <button class="chip" data-action="f" data-k="cat" data-v="all" aria-pressed="${f.cat==='all'}">All categories</button>
    ${cats.map(([k,c]) => `<button class="chip" data-action="f" data-k="cat" data-v="${k}" aria-pressed="${f.cat===k}">${CATS[k][1]} <span class="mono">${c}</span></button>`).join('')}
  </div>
  <div class="filters">
    <label class="sel"><span>Size</span><select data-filter="size"><option value="all">Any</option>${opt('size',sizes)}</select></label>
    <label class="sel"><span>Material</span><select data-filter="mat"><option value="all">Any</option>${opt('mat',mats)}</select></label>
    <label class="sel"><span>Worn to</span><select data-filter="occ"><option value="all">Anything</option>${opt('occ',occs)}</select></label>
    <label class="toggle"><input type="checkbox" data-filter="avail" ${f.avail?'checked':''}> Available now</label>
    <span class="grow"></span><span class="mono" style="color:var(--muted)">${list.length} result${list.length===1?'':'s'}</span>
    ${active ? '<button class="chip" data-action="clear">Clear filters</button>' : ''}
  </div>` : ''}
  ${list.length ? `<div class="grid">${list.map(tile).join('')}</div>`
    : pool.length ? `<div class="empty">Nothing matches these filters.<button class="chip" data-action="clear">Clear filters</button></div>`
    : `<div class="empty">No pieces yet. Start with one of yours: that dress you wore once.<button class="btn" data-action="modal" data-m="add">+ Add a piece</button></div>`}`;
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
  await loadSocial();
  await loadProfiles([p.owner, ...p.photos.map(x=>x.added_by), ...p.reactions.map(r=>r.author), ...p.worn_to.map(w=>w.author)]);
  await signed(p.photos.map(x => x.path));
  renderPiece();
}
function renderPiece(){
  const p = current, mine = p.owner === me();
  const ph = p.photos[galleryIndex] || p.photos[0];
  const fits = FITS.map(f => [f, p.reactions.filter(r => r.fit===f).length]).filter(x => x[1]);
  const worn = {}; p.worn_to.forEach(w => (worn[w.occasion] = worn[w.occasion] || []).push(w.author));
  $('#main').innerHTML = `<a class="back" href="#/pieces">← Back to pieces</a>
  <div class="item">
    <div class="gallery">
      <div class="main">${photo(ph, p)}</div>
      ${ph ? `<div class="credit">${av(ph.added_by,'sm')} Photo by ${esc(nm(ph.added_by))}${ph.added_by===me()||mine ? ` · <button class="linkbtn" data-action="delphoto" data-id="${ph.id}" data-path="${esc(ph.path)}">Remove photo</button>` : ''}</div>` : ''}
      <div class="thumbs">
        ${p.photos.map((x,i) => `<button class="thumb" data-action="ph" data-i="${i}" aria-pressed="${i===galleryIndex}" aria-label="Photo ${i+1}">${photo(x, p)}</button>`).join('')}
        <button class="addph" data-action="modal" data-m="photo">+ Add ${mine?'a':'your'} photo</button>
      </div>
    </div>
    <div class="info">
      <div><span class="eyebrow">${mine ? 'Your piece' : 'From '+esc(nm(p.owner))}</span><h1 style="margin-top:6px">${esc(p.title)}</h1>
        <p class="lede">${[p.brand, CATS[p.category]?.[0]].filter(Boolean).map(esc).join(' · ')}</p></div>
      <div class="actions">
        ${mine ? `<button class="btn ghost" data-action="modal" data-m="edit">Edit piece</button>`
               : `<button class="btn accent" data-action="modal" data-m="borrow">${p.available ? 'Ask to borrow' : 'Ask for later dates'}</button>${heart(p.id,'inline')}`}
        ${p.buy_url ? `<a class="btn ghost" href="${esc(p.buy_url)}" target="_blank" rel="noopener">Where to buy it ↗</a>` : ''}
      </div>
      <dl class="facts">
        <dt>Size</dt><dd class="mono">${esc(p.size || '–')}</dd>
        <dt>Material</dt><dd>${esc(p.material || '–')}</dd>
        <dt>Status</dt><dd>${status(p)}</dd>
      </dl>
      <div class="section">
        <div class="head"><h2>${mine ? 'Your terms' : esc(nm(p.owner))+'’s terms'}</h2>${mine?'<button class="btn ghost small" data-action="modal" data-m="edit">Edit</button>':''}</div>
        ${p.terms.length ? `<div class="terms">${p.terms.map(t=>`<span class="term">${esc(t)}</span>`).join('')}</div>` : `<p class="small-print">${mine ? 'No terms yet. A chocolate bar counts.' : 'No terms. Just be nice.'}</p>`}
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
  </div>`;
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
  $('#main').innerHTML = `<div class="head"><div><span class="eyebrow">${list.length} hearted</span><h1>Saved</h1><p class="lede">Pieces you have your eye on. Event lists are coming next.</p></div></div>
  ${list.length ? `<div class="grid">${list.map(tile).join('')}</div>` : '<div class="empty">Tap ♡ on a friend’s piece to keep it here.</div>'}`;
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
    <section class="section" style="border:0;padding:0"><h2>Your pieces out</h2>${inc.length ? inc.map(reqRow).join('') : '<p class="small-print">No one has asked yet.</p>'}</section>
    <section class="section"><h2>What you borrow</h2>${out.length ? out.map(reqRow).join('') : '<p class="small-print">You have not asked anyone yet.</p>'}</section>
  </div>`;
}
function waLink(r){
  const other = r.owner===me() ? r.borrower : r.owner, phone = cleanPhone(S.phones[other]);
  const title = r.pieces?.title || 'piece';
  const text = r.owner===me()
    ? `Hi ${first(other)}! About my ${title} (${fmt(r.date_from)} until ${fmt(r.date_until)}): when do you want to pick it up?`
    : `Hi ${first(other)}! I asked for your ${title} on Sharing = Caring (${fmt(r.date_from)} until ${fmt(r.date_until)}). When suits you for pick-up?`;
  return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
}
function reqRow(r){
  const owner = r.owner===me(), other = owner ? r.borrower : r.owner, o = esc(nm(other)), p = r.pieces;
  const piece = p ? { title:p.title, category:p.category } : { title:'Piece', category:'' };
  const A = (s,l,g) => `<button class="btn small ${g?'ghost':''}" data-action="req" data-id="${r.id}" data-s="${s}">${l}</button>`;
  const T = (c,l) => `<span class="st ${c}">${l}</span>`;
  const W = `<a class="btn ghost small" href="${waLink(r)}" target="_blank" rel="noopener">WhatsApp</a>`;
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
  const person = (id, actions, sub='') => `<div class="row-card person">${av(id,'lg')}<div style="min-width:0"><strong>${esc(nm(id))}</strong>${sub?`<p>${sub}</p>`:''}</div><div class="actions">${actions}</div></div>`;
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
  const { data, error } = await sb.from('profiles').select('id,name,colour').ilike('name', `%${q.replace(/[%_]/g,'')}%`).neq('id', me()).limit(20);
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
async function viewProfile(){
  const { data:c } = await sb.from('contacts').select('phone').eq('user_id', me()).maybeSingle();
  const welcome = !S.me?.name;
  $('#main').innerHTML = `<div class="head"><div><h1>${welcome ? 'Welcome!' : 'You'}</h1><p class="lede">${welcome ? 'Tell your friends who you are.' : esc(S.user.email)}</p></div></div>
  <div class="card">
    <form data-form="profile">
      ${field('pName','Your name','<input type="text" id="pName" autocomplete="name" required value="'+esc(S.me?.name||'')+'">')}
      ${field('pPhone','Phone number (for WhatsApp)','<input type="tel" id="pPhone" autocomplete="tel" placeholder="+31 6 12345678" value="'+esc(c?.phone||'')+'">')}
      <p class="hint">Only your friends can see your number. They use it to plan pick-ups with you.</p>
      <div class="field"><span class="legend">Your colour</span><div class="swatches">${COLOURS.map(col => `<label style="background:${col}"><input type="radio" name="pCol" value="${col}" ${(S.me?.colour||COLOURS[0])===col?'checked':''} aria-label="Colour ${col}"></label>`).join('')}</div></div>
      <button class="btn accent">Save</button>
    </form>
  </div>
  ${welcome ? '' : `<div style="margin-top:28px" class="actions"><button class="btn ghost" data-action="logout">Log out</button></div>`}`;
}

/* ---------- dialogs ---------- */
const termFields = (cur=[]) => `<div class="field"><span class="legend">Your terms for borrowing</span><div class="opts">${[...new Set([...TERMS,...cur])].map(t => `<label><input type="checkbox" name="tT" value="${esc(t)}" ${cur.includes(t)?'checked':''}> ${esc(t)}</label>`).join('')}</div></div>${field('tOwn','Add your own (optional)','<input type="text" id="tOwn" placeholder="e.g. Return it with a compliment">')}`;
const readTerms = () => { const t=[...document.querySelectorAll('[name=tT]:checked')].map(x=>x.value); const o=$('#tOwn')?.value.trim(); if(o) t.push(o); return t; };
const pieceFields = (p={}) => `
  ${field('iTitle','Name it','<input type="text" id="iTitle" placeholder="Serious or silly: Green velvet blazer, The disco ball…" required value="'+esc(p.title||'')+'">')}
  <div class="two">${field('iCat','Category',`<select id="iCat">${Object.entries(CATS).map(([k,v]) => `<option value="${k}" ${p.category===k?'selected':''}>${v[0]}</option>`).join('')}</select>`)}${field('iSize','Size','<input type="text" id="iSize" placeholder="EU 38, M, 39…" required value="'+esc(p.size||'')+'">')}</div>
  <div class="two">${field('iMat','Material',`<select id="iMat">${MATERIALS.map(m => `<option ${p.material===m?'selected':''}>${m}</option>`).join('')}</select>`)}${field('iBrand','Brand','<input type="text" id="iBrand" placeholder="Or: second hand" value="'+esc(p.brand||'')+'">')}</div>
  ${termFields(p.terms||[])}
  ${field('iBuy','Where to buy it (optional link)','<input type="url" id="iBuy" placeholder="https://" value="'+esc(p.buy_url||'')+'">')}`;
const readPiece = () => ({ title:$('#iTitle').value.trim(), category:$('#iCat').value, size:$('#iSize').value.trim(), material:$('#iMat').value, brand:$('#iBrand').value.trim()||null, terms:readTerms(), buy_url:$('#iBuy').value.trim()||null });
const cancel = '<button type="button" class="btn ghost" data-action="close">Cancel</button>';

function openModal(m){
  const p = current; let h = '';
  if(m==='add') h = `<span class="eyebrow">Your pieces</span><h2>Add a piece</h2><form data-form="add">${pieceFields()}
    ${field('iFiles','Photos (up to 5)','<input type="file" id="iFiles" accept="image/*" multiple>')}
    <p class="hint">Friends can add their own photos of it later, from events they wore it to.</p>
    <div class="actions">${cancel}<button class="btn accent">Add to my pieces</button></div></form>`;
  if(m==='edit') h = `<span class="eyebrow">Your piece</span><h2>Edit</h2><form data-form="edit">${pieceFields(p)}
    <label class="toggle"><input type="checkbox" id="iAvail" ${p.available?'checked':''}> Available to borrow</label>
    <div class="actions" style="justify-content:space-between"><button type="button" class="btn danger small" data-action="modal" data-m="delete">Delete piece</button><span class="actions">${cancel}<button class="btn">Save</button></span></div></form>`;
  if(m==='delete') h = `<h2>Delete “${esc(p.title)}”?</h2><p style="margin:0">This removes the piece, its photos, reactions and requests for everyone. You can’t undo it.</p>
    <div class="actions">${cancel}<button class="btn danger" data-action="delpiece">Yes, delete it</button></div>`;
  if(m==='photo') h = `<span class="eyebrow">${esc(p.title)}</span><h2>Add a photo</h2><form data-form="photo">
    ${field('pFile','Photo','<input type="file" id="pFile" accept="image/*" required>')}
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
    ${p.terms.length ? `<div class="field"><span class="legend">${o}’s terms</span><div class="terms">${p.terms.map(t=>`<span class="term">${esc(t)}</span>`).join('')}</div></div>` : ''}
    <div class="etiquette"><span class="eyebrow">Borrowing etiquette</span><ul>
      <li><strong>Return it in the same or better state</strong> than you got it.</li>
      <li><strong>Bring it back on time.</strong> Need it longer? Ask before your return date, not after.</li>
      <li><strong>Accidents happen.</strong> If something gets damaged or stained, tell ${o} straight away and propose a fix: cleaning, a repair or paying towards it.</li>
      <li><strong>You plan pick-up and return</strong>, at a time that suits ${o}. Mark it as returned in Requests.</li>
      <li><strong>Share the love.</strong> Add a photo of you wearing it to the gallery.</li></ul></div>
    <div class="actions">${cancel}<button class="btn accent">Send request</button></div></form>`; }
  if(m==='sent'){ const r = sentReq; h = `<span class="eyebrow">Request sent</span><h2>Now plan the pick-up</h2>
    <p style="margin:0">${esc(nm(r.owner))} sees your request in the app. Send a quick message to agree on when you pick it up.</p>
    ${S.phones[r.owner] ? '' : `<p class="hint">${esc(nm(r.owner))} hasn’t added a phone number, so you’ll pick the chat yourself.</p>`}
    <div class="actions"><button type="button" class="btn ghost" data-action="close">Later</button><a class="btn accent" href="${waLink(r)}" target="_blank" rel="noopener" data-action="close">Open WhatsApp</a></div>`; }
  $('#sheet').innerHTML = h; $('#overlay').hidden = false;
}
let sentReq = null;
const closeModal = () => { $('#overlay').hidden = true; $('#sheet').innerHTML = ''; };

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
    const name = $('#pName').value.trim(), phone = $('#pPhone').value.trim(), colour = document.querySelector('[name=pCol]:checked')?.value;
    const a = await sb.from('profiles').update({ name, colour }).eq('id', me()); if(a.error) throw a.error;
    const b = await sb.from('contacts').update({ phone: phone || null }).eq('user_id', me()); if(b.error) throw b.error;
    S.me = { ...S.me, name, colour }; S.profiles[me()] = { id:me(), name, colour };
    toast('Saved'); location.hash = '#/pieces';
  },
  async add(){
    const files = [...($('#iFiles').files || [])].slice(0,5);
    const { data, error } = await sb.from('pieces').insert(readPiece()).select('id').single();
    if(error) throw error;
    $('#sheet button.accent').textContent = files.length ? 'Uploading photos…' : 'Saving…';
    for(const f of files) await uploadPhoto(data.id, f);
    closeModal(); toast('Added to your pieces'); location.hash = '#/piece/' + data.id;
  },
  async edit(){
    const { error } = await sb.from('pieces').update({ ...readPiece(), available:$('#iAvail').checked }).eq('id', current.id);
    if(error) throw error; closeModal(); toast('Saved'); viewPiece(current.id);
  },
  async photo(){
    const f = $('#pFile').files[0]; if(!f) return;
    await uploadPhoto(current.id, f, $('#pCap').value.trim());
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
      case 'clear': S.f = { owner:'all', cat:'all', size:'all', mat:'all', occ:'all', avail:false }; renderPieces(); break;
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
        toast(`Friend request sent to ${nm(d.id)}`); await loadSocial(); viewFriends(); break;
      }
      case 'fr-accept': {
        const { error } = await sb.from('friendships').update({ status:'accepted' }).eq('requester', d.id).eq('addressee', me()); if(error) throw error;
        toast(`You and ${nm(d.id)} are friends now`); viewFriends(); break;
      }
      case 'fr-remove': {
        if(d.confirm && a.textContent !== 'Tap again to remove'){ a.textContent = 'Tap again to remove'; return; }
        const r1 = await sb.from('friendships').delete().eq('requester', me()).eq('addressee', d.id);
        const r2 = await sb.from('friendships').delete().eq('requester', d.id).eq('addressee', me());
        if(r1.error || r2.error) throw (r1.error || r2.error);
        toast('Done'); viewFriends(); break;
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
  const k = e.target.dataset.filter; if(!k) return;
  S.f[k] = e.target.type === 'checkbox' ? e.target.checked : e.target.value; renderPieces();
});
document.addEventListener('keydown', e => { if(e.key === 'Escape' && !$('#overlay').hidden) closeModal(); });

/* ---------- start ---------- */
async function start(){
  const { data:{ session } } = await sb.auth.getSession();
  S.user = session?.user || null;
  if(!S.user) return renderAuth();
  const { data } = await sb.from('profiles').select('id,name,colour').eq('id', me()).maybeSingle();
  S.me = data || { id:me(), name:'' }; S.profiles[me()] = S.me;
  route();
}
sb.auth.onAuthStateChange((event, session) => {
  if(event === 'PASSWORD_RECOVERY'){ recovering = true; S.user = session?.user; return renderAuth(); }
  if(event === 'SIGNED_IN' && !S.user) { setTimeout(start, 0); }
  if(event === 'SIGNED_OUT'){ S.user = null; S.pieces = []; S.urls = {}; S.profiles = {}; location.hash = ''; renderAuth(); }
});
start();
