/* NexusNova Quran Sacred Name Highlighter v1
   Presentation-only. Quran source text remains untouched; matching text nodes are wrapped safely. */
(() => {
  'use strict';
  if (window.__nxQuranSacredHighlightsV1) return;
  window.__nxQuranSacredHighlightsV1 = true;

  const MARKS = '[\\u0610-\\u061A\\u064B-\\u065F\\u0670\\u06D6-\\u06ED]*';
  const escapeRx = value => String(value).replace(/[.*+?^${}()|[\\]\\]/g, '\\$&');
  const stripMarks = value => String(value).replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/g, '');
  const looseArabic = word => Array.from(stripMarks(word)).map(ch => escapeRx(ch) + MARKS).join('');
  const bounded = source => `(?<![\\p{L}\\p{M}])(?:${source})(?![\\p{L}\\p{M}])`;
  const boundedWithArabicPrefixes = source => `(?<![\\p{L}\\p{M}])(?:[وفبلك]${MARKS}){0,2}(?:${source})(?![\\p{L}\\p{M}])`;

  const allahSource = [looseArabic('الله'),looseArabic('ٱلله'),'اللہ','ﷲ','Allah'].join('|');
  const muhammadNameSource = [looseArabic('محمد'),looseArabic('أحمد'),'Muhammad','Mohammad','Mohammed','Ahmad','Ahmed'].join('|');
  const messengerBeforeAllah = [
    `${looseArabic('رسول')}(?=\\s*(?:${allahSource}))`,
    `Messenger(?=\\s+of\\s+(?:Allah))`,
    `Rasool(?=\\s+(?:Allah))`
  ].join('|');

  const prophetArabic = [
    'آدم','نوح','إبراهيم','ابراهيم','إسماعيل','اسماعيل','إسحاق','اسحاق','يعقوب','يوسف',
    'أيوب','ايوب','شعيب','موسى','هارون','داود','سليمان','إلياس','الياس','اليسع','يونس',
    'زكريا','يحيى','عيسى','لوط','هود','صالح','إدريس','ادريس','ذو الكفل'
  ].map(looseArabic);
  const prophetUrdu = [
    'آدم','نوح','ابراہیم','اسماعیل','اسحاق','یعقوب','یوسف','ایوب','شعیب','موسیٰ','ہارون',
    'داؤد','داود','سلیمان','الیاس','الیسع','یونس','زکریا','یحییٰ','عیسیٰ','لوط','ہود','صالح','ادریس','ذوالکفل','ذو الکفل'
  ];
  const prophetEnglish = [
    'Adam','Noah','Nuh','Abraham','Ibrahim','Ishmael','Ismail','Isaac','Ishaq','Jacob','Yaqub',
    'Joseph','Yusuf','Job','Ayyub','Shuayb','Moses','Musa','Aaron','Harun','David','Dawud',
    'Solomon','Sulayman','Elijah','Ilyas','Elisha','Alyasa','Jonah','Yunus','Zechariah','Zakariya',
    'John','Yahya','Jesus','Isa','Lot','Lut','Hud','Salih','Saleh','Idris','Dhul-Kifl','Dhul Kifl'
  ].map(escapeRx);

  const muhammadRx = new RegExp(`(?:${boundedWithArabicPrefixes(muhammadNameSource)}|${messengerBeforeAllah})`, 'giu');
  const allahRx = new RegExp(`(?:${allahSource})`, 'giu');
  const prophetRx = new RegExp(boundedWithArabicPrefixes([...prophetArabic, ...prophetUrdu.map(escapeRx), ...prophetEnglish].join('|')), 'giu');

  function eligibleTextNode(node, root) {
    const parent = node.parentElement;
    if (!parent || !root.contains(parent)) return false;
    if (parent.closest('.nx-sacred-name,script,style,textarea,input,select,button')) return false;
    return Boolean(node.nodeValue && node.nodeValue.trim());
  }

  function wrapMatches(root, regex, className, label) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) { return eligibleTextNode(node, root) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT; }
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);

    nodes.forEach(node => {
      const text = node.nodeValue || '';
      regex.lastIndex = 0;
      let match, last = 0, changed = false;
      const fragment = document.createDocumentFragment();
      while ((match = regex.exec(text))) {
        if (!match[0]) { regex.lastIndex += 1; continue; }
        changed = true;
        if (match.index > last) fragment.appendChild(document.createTextNode(text.slice(last, match.index)));
        const span = document.createElement('span');
        span.className = `nx-sacred-name ${className}`;
        span.dataset.nxSacred = label;
        span.textContent = match[0];
        fragment.appendChild(span);
        last = match.index + match[0].length;
      }
      if (!changed) return;
      if (last < text.length) fragment.appendChild(document.createTextNode(text.slice(last)));
      node.replaceWith(fragment);
    });
  }

  function refreshSearchCounts(reader) {
    const qCount = document.getElementById('nxQuranFindCount');
    const qInput = document.getElementById('nxQuranFindPolish');
    const total = reader.querySelectorAll('.nx-ayah').length;
    if (qCount && !String(qInput?.value || '').trim()) qCount.textContent = `${total} verses`;
    const bible = document.getElementById('nxBibleReader');
    const bCount = document.getElementById('nxBibleFindCount');
    const bInput = document.getElementById('nxBibleFindPolish');
    if (bible && bCount && !String(bInput?.value || '').trim()) bCount.textContent = `${bible.querySelectorAll('.nx-bible-verse').length} verses`;
  }

  let observedReader = null;
  let readerObserver = null;
  let scheduled = false;

  function apply(reader = observedReader) {
    if (!reader || !reader.isConnected) return;
    scheduled = false;
    wrapMatches(reader, muhammadRx, 'nx-name-muhammad', 'muhammad');
    wrapMatches(reader, allahRx, 'nx-name-allah', 'allah');
    wrapMatches(reader, prophetRx, 'nx-name-prophet', 'prophet');
    refreshSearchCounts(reader);
  }
  function schedule(reader = observedReader) {
    if (!reader || scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => apply(reader));
  }
  function connect() {
    const reader = document.getElementById('nxQuranReader');
    if (!reader || reader === observedReader) return;
    readerObserver?.disconnect();
    observedReader = reader;
    readerObserver = new MutationObserver(() => schedule(reader));
    readerObserver.observe(reader, {childList:true, subtree:true, characterData:true});
    schedule(reader);
  }
  const install = () => {
    connect();
    const body = document.body;
    if (!body || window.__nxQuranReaderLocatorV1) return;
    window.__nxQuranReaderLocatorV1 = new MutationObserver(() => connect());
    window.__nxQuranReaderLocatorV1.observe(body, {childList:true, subtree:true});
    [600,1400,2800,5200,9000].forEach(ms => setTimeout(connect, ms));
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, {once:true});
  else install();
})();
