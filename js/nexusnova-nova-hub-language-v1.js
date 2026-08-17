/* NexusNova Nova Hub language guard v1
   UI text only: removes legacy ALL APPS wording from rendered screens.
   No navigation, mining, reward, wallet, auth or Firebase mutation.
*/
(() => {
  'use strict';
  if (window.__nxNovaHubLanguageV1) return;
  window.__nxNovaHubLanguageV1 = true;

  const replaceText = value => String(value || '')
    .replace(/BACK TO ALL APPS/g, 'BACK TO NOVA HUB')
    .replace(/Back to ALL APPS/g, 'Back to Nova Hub')
    .replace(/Back to All Apps/g, 'Back to Nova Hub')
    .replace(/ALL APPS/g, 'NOVA HUB')
    .replace(/All Apps/g, 'Nova Hub')
    .replace(/all apps/g, 'Nova Hub');

  function polishAttributes(root = document) {
    const nodes = root.querySelectorAll?.('[aria-label],[title],[placeholder]') || [];
    nodes.forEach(node => {
      ['aria-label','title','placeholder'].forEach(attr => {
        if (!node.hasAttribute(attr)) return;
        const before = node.getAttribute(attr) || '';
        const after = replaceText(before);
        if (after !== before) node.setAttribute(attr, after);
      });
    });
  }

  function polishText(root = document.body) {
    if (!root) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = node.parentElement;
        if (!parent || /^(SCRIPT|STYLE|NOSCRIPT|TEXTAREA)$/i.test(parent.tagName)) return NodeFilter.FILTER_REJECT;
        return /all apps/i.test(node.nodeValue || '') ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      }
    });
    const hits = [];
    while (walker.nextNode()) hits.push(walker.currentNode);
    hits.forEach(node => {
      const before = node.nodeValue || '';
      const after = replaceText(before);
      if (after !== before) node.nodeValue = after;
    });
  }

  let queued = false;
  function refresh() {
    queued = false;
    polishText(document.body);
    polishAttributes(document);
  }
  function queue() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(refresh);
  }

  function install() {
    refresh();
    const observer = new MutationObserver(queue);
    observer.observe(document.body, {childList:true,subtree:true});
    [250,700,1500,3000,6000].forEach(ms => setTimeout(refresh, ms));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, {once:true});
  else install();

  window.NexusNovaNovaHubLanguage = Object.freeze({version:'1.0.0',refresh});
})();