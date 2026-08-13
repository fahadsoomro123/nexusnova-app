/* NexusNova Learn Fix v1 - replaces placeholder Learn actions with useful real workflows. */
(() => {
  'use strict';
  if (window.__nxLearnFixV1) return;
  window.__nxLearnFixV1 = true;

  function openAIWithPrompt(prompt) {
    if (typeof window.openMoreTab === 'function') window.openMoreTab('ai');
    setTimeout(() => {
      const input = document.getElementById('aiInput');
      if (!input) return;
      input.value = prompt;
      input.focus();
    }, 120);
  }

  function install() {
    const tab = document.getElementById('tab-learn');
    if (!tab) return;
    const buttons = [...tab.querySelectorAll('button')];

    const learning = buttons.find(b => /open learning/i.test(b.textContent || ''));
    if (learning) {
      learning.onclick = () => {
        const topic = prompt('What topic do you want to learn?');
        if (!topic || !topic.trim()) return;
        openAIWithPrompt(`Teach me ${topic.trim()} step by step in simple language. Start from basics, give examples, then give me 5 practice questions.`);
      };
      learning.textContent = 'Start Learning';
    }

    const papers = buttons.find(b => /open papers/i.test(b.textContent || ''));
    if (papers) {
      papers.onclick = () => {
        const subject = prompt('Enter class/subject/paper, for example: Sindh Class 8 Science past papers');
        if (!subject || !subject.trim()) return;
        const q = encodeURIComponent(`${subject.trim()} solved past papers PDF Pakistan Sindh`);
        window.open(`https://www.google.com/search?q=${q}`, '_blank', 'noopener,noreferrer');
      };
      papers.textContent = 'Find Solved Papers';
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, {once:true});
  else install();
  window.addEventListener('load', install);
})();
