/* UNSAERO paper framework helpers.
   Provides automatic TOC generation, section/equation numbering, and
   lightweight \cref-style cross references for native HTML articles. */
(function(){
  function activeContent(){
    return document.querySelector('.paper .lang-content.active') || document.querySelector('.paper');
  }

  function cleanHeadingText(text){
    return (text || '')
      .replace(/^\s*\d+(?:\.\d+)*\.?\s+/, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function flashTarget(el){
    if(!el) return;
    el.classList.remove('xref-target');
    void el.offsetWidth;
    el.classList.add('xref-target');
    window.setTimeout(()=>el.classList.remove('xref-target'), 1600);
  }

  function articleContents(){
    return Array.from(document.querySelectorAll('.paper > .lang-content'));
  }

  function isUnnumberedSection(section){
    if(!section) return false;
    const id = (section.id || '').toLowerCase();
    return section.dataset.unnumbered === 'true' || id.includes('references') || id.includes('referencias');
  }

  function numberSections(content){
    const labels = new Map();
    let h2Count = 0;
    let h3Count = 0;

    content.querySelectorAll('section[id]').forEach(section => {
      const heading = section.querySelector(':scope > h2, :scope > h3');
      if(!heading) return;

      const baseText = cleanHeadingText(heading.textContent);
      const tag = heading.tagName.toLowerCase();
      const unnumbered = isUnnumberedSection(section);
      let number = '';

      if(!unnumbered){
        if(tag === 'h2'){
          h2Count += 1;
          h3Count = 0;
          number = String(h2Count);
        } else {
          if(h2Count === 0) h2Count = 1;
          h3Count += 1;
          number = `${h2Count}.${h3Count}`;
        }
      }

      section.dataset.secNumber = number;
      section.dataset.crefLabel = number ? `Section ${number}` : baseText;
      section.dataset.crefLabelPt = number ? `Seção ${number}` : baseText;
      labels.set(section.id, section.dataset.crefLabel);

      heading.dataset.baseText = baseText;
      heading.innerHTML = number
        ? `<span class="sec-num">${number}</span> ${baseText}`
        : baseText;
    });

    return labels;
  }

  function buildToc(content){
    const toc = content.querySelector('.paper-toc');
    if(!toc) return;

    let list = toc.querySelector('ol');
    if(!list){
      list = document.createElement('ol');
      toc.appendChild(list);
    }
    list.innerHTML = '';

    content.querySelectorAll('section[id]').forEach(section => {
      const heading = section.querySelector(':scope > h2, :scope > h3');
      if(!heading) return;
      const baseText = heading.dataset.baseText || cleanHeadingText(heading.textContent);
      const number = section.dataset.secNumber || '';
      const li = document.createElement('li');
      li.className = heading.tagName.toLowerCase();
      const a = document.createElement('a');
      a.href = `#${section.id}`;
      if(number){
        const n = document.createElement('span');
        n.className = 'toc-num';
        n.textContent = number;
        const t = document.createElement('span');
        t.className = 'toc-title';
        t.textContent = baseText;
        a.appendChild(n);
        a.appendChild(t);
      } else {
        a.textContent = baseText;
      }
      li.appendChild(a);
      list.appendChild(li);
    });
  }

  function numberObjects(content){
    const labels = new Map();

    let eqCount = 0;
    content.querySelectorAll('.equation-block[id]').forEach(eq => {
      eqCount += 1;
      eq.dataset.objectNumber = String(eqCount);
      const label = eq.dataset.cref || 'Eq.';
      const text = `${label} (${eqCount})`;
      eq.dataset.crefLabel = text;
      labels.set(eq.id, text);
    });

    let defCount = 0;
    content.querySelectorAll('.definition[id]').forEach(def => {
      defCount += 1;
      def.dataset.objectNumber = String(defCount);
      const label = def.dataset.cref || 'Definition';
      const text = `${label} ${defCount}`;
      def.dataset.crefLabel = text;
      labels.set(def.id, text);
    });

    content.querySelectorAll('section[id]').forEach(section => {
      const number = section.dataset.secNumber || '';
      const heading = section.querySelector(':scope > h2, :scope > h3');
      const baseText = heading?.dataset.baseText || cleanHeadingText(heading?.textContent || section.id);
      const isPt = content.id && content.id.endsWith('-pt');
      const text = number ? `${isPt ? 'Seção' : 'Section'} ${number}` : baseText;
      labels.set(section.id, text);
    });

    return labels;
  }

  function resolveCrossReferences(content, labels){
    content.querySelectorAll('.xref').forEach(ref => {
      const href = ref.getAttribute('href');
      const explicit = ref.dataset.ref;
      const id = explicit || (href && href.startsWith('#') ? href.slice(1) : '');
      if(!id) return;

      const label = labels.get(id);
      ref.setAttribute('href', `#${id}`);
      if(label) ref.textContent = label;
      else if(!ref.textContent.trim()) ref.textContent = '??';
    });
  }

  function generateArticle(content){
    if(!content) return;
    numberSections(content);
    buildToc(content);
    const labels = numberObjects(content);
    resolveCrossReferences(content, labels);
  }

  function generateAllArticles(){
    const contents = articleContents();
    if(contents.length){
      contents.forEach(generateArticle);
    } else {
      const paper = document.querySelector('.paper');
      if(paper) generateArticle(paper);
    }
    setupCrossReferences();
    setupTocState();
  }

  function scrollToHash(){
    if(!window.location.hash) return;
    const id = decodeURIComponent(window.location.hash.slice(1));
    const target = document.getElementById(id);
    if(target){
      window.setTimeout(()=>{
        target.scrollIntoView({behavior:'smooth', block:'start'});
        flashTarget(target);
      }, 120);
    }
  }

  function setupCrossReferences(){
    document.querySelectorAll('a.xref[href^="#"], .paper-toc a[href^="#"]').forEach(link=>{
      if(link.dataset.xrefBound === 'true') return;
      link.dataset.xrefBound = 'true';
      link.addEventListener('click', (event)=>{
        const href = link.getAttribute('href');
        if(!href || href.length < 2) return;
        const target = document.getElementById(decodeURIComponent(href.slice(1)));
        if(!target) return;
        event.preventDefault();
        history.pushState(null, '', href);
        target.scrollIntoView({behavior:'smooth', block:'start'});
        window.setTimeout(()=>flashTarget(target), 260);
      });
    });
  }

  function setupTocState(){
    document.querySelectorAll('.paper-toc a[href^="#"]').forEach(link=>{
      if(link.dataset.tocBound === 'true') return;
      link.dataset.tocBound = 'true';
      link.addEventListener('click', ()=>{
        const toc = link.closest('.paper-toc');
        toc?.querySelectorAll('a').forEach(a=>a.classList.remove('is-current'));
        link.classList.add('is-current');
      });
    });
  }

  document.addEventListener('DOMContentLoaded', ()=>{
    generateAllArticles();
    scrollToHash();
  });

  window.UNSAEROPaper = {
    activeContent,
    generateArticle,
    generateAllArticles,
    scrollToHash,
    setupCrossReferences,
    setupTocState
  };
})();
