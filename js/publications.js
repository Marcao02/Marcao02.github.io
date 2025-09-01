/* Lightweight BibTeX parser + filtering for publications page.
  Fetches local data/Marcos.bib (moved from root) and renders grouped by year.
  Falls back to data/publications_keywords.json (titles only) if BibTeX fetch fails (e.g., file:// context).
*/
(function(global){
  const BIB_URL = 'https://github.com/Marcao02/Marcao02.github.io/blob/copilot/fix-890b5ba6-6b04-4e18-b4ea-6adc9b0acc9e/Marcos.bib#:~:text=LICENSE-,Marcos,-.bib'; // 'data/Marcos.bib';
  const LOCAL_WRAP = document.getElementById('localPubContainer');
  const LIST = document.getElementById('localPubList');
  const FILTER = document.getElementById('pubFilter');
  const STATUS = document.getElementById('pubStatus');
  if(!LOCAL_WRAP || !LIST) return;

  // Robust-ish BibTeX parser (single level braces) – lightweight, no external deps.
  function parseBib(tex){
    const entries = [];
    tex.split(/@(?!\s)/).slice(1).forEach(raw => {
      const typeMatch = raw.match(/^(\w+)/);
      if(!typeMatch) return;
      const type = typeMatch[1].toLowerCase();
      const braceIdx = raw.indexOf('{');
      if(braceIdx === -1) return;
      // key until first comma after opening brace
      const afterBrace = raw.slice(braceIdx+1);
      const key = (afterBrace.split(/,/)[0]||'').trim();
      const body = afterBrace.slice(key.length+1).replace(/}\s*$/,'');
      const fields = { type, key };
      // Field regex capturing value in braces {}, quotes "" or bare until comma/newline
      const fieldRegex = /(\w+)\s*=\s*(\{([^{}]*|\{[^}]*\})*\}|"[^"]*"|[^,\n]+)\s*,?/g;
      let m;
      while((m = fieldRegex.exec(body))){
        let val = m[2].trim();
        if(val.startsWith('{') && val.endsWith('}')) val = val.slice(1,-1);
        if(val.startsWith('"') && val.endsWith('"')) val = val.slice(1,-1);
        fields[m[1].toLowerCase()] = val.replace(/\s+/g,' ').trim();
      }
      entries.push(fields);
    });
    return entries;
  }

  function highlightSelf(name){
    // Bold the website owner's surname variants (case-insensitive contains 'silveira')
    return name.replace(/(da\s+silveira|silveira)/ig, '<strong>$1</strong>');
  }

  function formatAuthors(a){
    if(!a) return '';
    // Split on ' and ' respecting BibTeX 'and'
    const people = a.split(/\band\b/ig).map(s=>s.replace(/[,\s]+$/,'').trim()).filter(Boolean);
    const formatted = people.map(p=> highlightSelf(p));
    if(formatted.length <= 2) return formatted.join(' & ');
    return formatted.slice(0,-1).join(', ') + ' & ' + formatted.slice(-1);
  }

  function buildVenue(e){
    return e.journal || e.booktitle || e.school || e.publisher || e.organization || '';
  }

  function buildPages(e){
    if(!e.pages) return '';
    return e.pages.replace(/--/g,'–');
  }

  function buildExtra(e){
    const bits = [];
    if(e.volume) bits.push(e.volume + (e.number?`(${e.number})`:''));
    const pages = buildPages(e); if(pages) bits.push(pages);
    return bits.join(', ');
  }

  function entryTypeBadge(e){
    const t = e.type;
    const map = { article:'Journal', inproceedings:'Conf.', incollection:'Chapter', phdthesis:'PhD Thesis', mastersthesis:'MSc Thesis', misc:'Misc', inbook:'Chapter', book:'Book', patent:'Patent' };
    const label = map[t] || t;
    return `<span class="pub-badge badge badge-light">${label}</span>`;
  }

  function buildLink(e){
    if(e.url) return { href:e.url, label:'link' };
    if(e.doi) return { href:`https://doi.org/${e.doi}`, label:'doi' };
    return null;
  }

  function rawBibtexSnippet(e){
    const ordered = Object.keys(e).filter(k=>!['type','key'].includes(k) && !/^__/.test(k));
    const body = ordered.map(k=> `  ${k} = {${e[k]}}`).join(',\n');
    return `@${e.type}{${e.key},\n${body}\n}`;
  }

  function cite(entry){
    const authors = formatAuthors(entry.author);
    const title = (entry.title||'').replace(/[{}]/g,'');
    const venue = buildVenue(entry);
    const year = entry.year || 'n.d.';
    const extra = buildExtra(entry);
    const link = buildLink(entry);
    const badge = entryTypeBadge(entry);
    const safeTitle = title.replace(/\.$/,'');
    const titleHTML = link ? `<a href="${link.href}" target="_blank" rel="noopener" class="pub-title-link">${safeTitle}</a>` : safeTitle;
    const dataAttrs = `data-year="${year}" data-authors="${authors.replace(/<[^>]+>/g,'').toLowerCase()}" data-venue="${venue.toLowerCase()}" data-title="${safeTitle.toLowerCase()}"`;
    const bib = rawBibtexSnippet(entry)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    return `<div class="pub-item" ${dataAttrs}>
      <div class="pub-main">
        ${badge} <span class="pub-authors">${authors}</span> (<span class="pub-year">${year}</span>). <span class="pub-title">${titleHTML}</span>${venue?`. <em class="pub-venue">${venue}</em>`:''}${extra?`, ${extra}`:''}.
        ${link?` <a class="pub-ext small" href="${link.href}" target="_blank" rel="noopener">[${link.label}]</a>`:''}
        <button type="button" class="btn btn-link btn-sm p-0 ml-1 pub-bib-toggle" aria-expanded="false" aria-label="Show BibTeX">[BibTeX]</button>
      </div>
      <pre class="pub-bib d-none" aria-hidden="true"><code>${bib}</code></pre>
    </div>`;
  }

  function render(entries){
    entries.sort((a,b)=> (parseInt(b.year)||0) - (parseInt(a.year)||0));
    const byYear = {};
    entries.forEach(e=>{ const y = e.year || 'n.d.'; (byYear[y] = byYear[y] || []).push(e); });
    const years = Object.keys(byYear).sort((a,b)=> b.localeCompare(a,undefined,{numeric:true}));
    LIST.innerHTML = years.map(y => {
      const items = byYear[y].map(cite).join('');
      return `<div class="pub-year-group" data-year-group="${y}">
        <h4 class="pub-year-header" tabindex="0">${y} <span class="count">(${byYear[y].length})</span></h4>
        <div class="pub-year-body">${items}</div>
      </div>`;
    }).join('');

    // Year collapse toggle
    LIST.querySelectorAll('.pub-year-header').forEach(h => {
      h.addEventListener('click', () => toggleYear(h));
      h.addEventListener('keydown', (e)=>{ if(e.key==='Enter' || e.key===' ') { e.preventDefault(); toggleYear(h);} });
    });
    // BibTeX toggles
    LIST.querySelectorAll('.pub-bib-toggle').forEach(btn => {
      btn.addEventListener('click', () => {
        const pre = btn.closest('.pub-item').querySelector('.pub-bib');
        const isHidden = pre.classList.contains('d-none');
        pre.classList.toggle('d-none');
        btn.setAttribute('aria-expanded', String(!isHidden));
        pre.setAttribute('aria-hidden', String(isHidden));
      });
    });
  }

  function toggleYear(header){
    const body = header.nextElementSibling;
    if(!body) return;
    const collapsed = body.classList.toggle('collapsed');
    body.style.display = collapsed ? 'none' : '';
  }

  function applyFilter(){
    const q = FILTER.value.trim().toLowerCase();
    const items = LIST.querySelectorAll('.pub-item');
    let shown=0;
    items.forEach(it=>{
      if(!q){ it.style.display=''; shown++; return; }
      const hay = [it.dataset.title,it.dataset.authors,it.dataset.venue,it.dataset.year].join(' ');
      if(hay.includes(q)){ it.style.display=''; shown++; } else it.style.display='none';
    });
    STATUS.textContent = q? `${shown} match${shown!==1?'es':''}`:'';
  }

  FILTER?.addEventListener('input', applyFilter);

  function tryFetch(paths){
    if(!paths.length) return Promise.reject(new Error('All paths failed'));
    const p = paths.shift();
    return fetch(p, { cache:'no-store' })
      .then(r=>{ if(!r.ok) throw new Error('HTTP '+r.status); return r.text(); })
      .catch(()=> tryFetch(paths));
  }

  function fallbackFromKeywords(){
    return fetch('data/publications_keywords.json')
      .then(r=> r.ok ? r.json():Promise.reject())
      .then(j=>{
        if(!j.publications) throw new Error('No publications in keywords json');
        const mapped = j.publications.map(p=>{
          const rawYear = (p.year || '').toString();
          const m = rawYear.match(/\d{4}/);
          return { title: p.title || (p.TITLE||''), year: m? m[0] : 'n.d.', author:'', journal:'', booktitle:'', type:'misc', key:'fallback'+Math.random().toString(36).slice(2) };
        });
        render(mapped);
        applyFilter();
        STATUS.textContent = `Fallback: ${mapped.length} titles (metadata unavailable).`;
      })
      .catch(err=>{ STATUS.textContent = 'Unable to load any publication data.'; console.error('Fallback failed', err); });
  }

  function loadAndRender(){
    STATUS.textContent = 'Loading publications…';
    tryFetch([BIB_URL])
      .then(txt => {
        const entries = parseBib(txt).filter(e=> e.title);
        if(!entries.length) throw new Error('No entries parsed');
        render(entries);
        applyFilter();
        STATUS.textContent = `${entries.length} publications loaded.`;
      })
      .catch(err => {
        console.warn('BibTeX load failed, using fallback', err);
        fallbackFromKeywords();
      });
  }

  // Public API
  global.renderLocalPublications = loadAndRender;

})(window);
