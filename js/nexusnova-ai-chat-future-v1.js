/* NexusNova AI + Community Chat Future UI v1
   Presentation-only modernization:
   - removes fixed empty chat canvases
   - keeps existing Gemini/voice/image/memory/chat owners authoritative
   - upgrades AI + Community Chat into compact symbolic mobile workspaces
*/
(() => {
  'use strict';
  if (window.__nxAiChatFutureV1) return;
  window.__nxAiChatFutureV1 = true;
  window.nexusAiChatFutureVersion = 'ai-chat-future-v1';

  const $ = id => document.getElementById(id);
  const STYLE_ID = 'nxAiChatFutureV1Style';

  function installStyles() {
    if ($(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      /* =========================
         SHARED FUTURE WORKSPACE
         ========================= */
      body.nx-compact-premium-v1 #tab-ai,
      body.nx-compact-premium-v1 #tab-chat{
        min-height:0!important;
        height:auto!important;
        padding-bottom:2px!important;
      }
      #tab-ai .ai-main-card,
      #tab-chat>.card{
        position:relative;
        isolation:isolate;
        overflow:hidden;
        margin-bottom:6px!important;
        padding:10px!important;
        border-radius:20px!important;
        border:1px solid rgba(87,168,255,.20)!important;
        background:
          radial-gradient(circle at 88% 0%,rgba(114,72,255,.14),transparent 32%),
          radial-gradient(circle at 8% 10%,rgba(29,184,255,.11),transparent 34%),
          linear-gradient(155deg,rgba(7,19,38,.985),rgba(4,10,23,.99) 58%,rgba(5,12,29,.99))!important;
        box-shadow:0 16px 42px rgba(0,0,0,.26),inset 0 1px rgba(255,255,255,.035)!important;
      }
      #tab-ai .ai-main-card:before,
      #tab-chat>.card:before{
        content:"";
        position:absolute;
        inset:0;
        z-index:-2;
        opacity:.26;
        pointer-events:none;
        background-image:
          linear-gradient(rgba(96,174,255,.055) 1px,transparent 1px),
          linear-gradient(90deg,rgba(96,174,255,.055) 1px,transparent 1px);
        background-size:24px 24px;
        mask-image:linear-gradient(to bottom,#000,transparent 78%);
      }
      #tab-ai .ai-main-card:after,
      #tab-chat>.card:after{
        content:"";
        position:absolute;
        width:150px;
        height:150px;
        right:-82px;
        top:-82px;
        z-index:-1;
        pointer-events:none;
        border-radius:50%;
        background:radial-gradient(circle,rgba(72,176,255,.22),rgba(92,70,255,.08) 46%,transparent 72%);
        filter:blur(2px);
      }

      /* =========================
         AI NEURAL CONSOLE HEADER
         ========================= */
      #tab-ai .nx-ai-head{
        display:grid!important;
        grid-template-columns:42px minmax(0,1fr) auto!important;
        gap:9px!important;
        align-items:center!important;
        padding:1px 1px 7px!important;
      }
      #tab-ai .nx-ai-head>div:nth-child(2){min-width:0}
      #tab-ai .nx-ai-head h3{
        margin:0!important;
        font-size:14px!important;
        line-height:1.05!important;
        letter-spacing:-.015em!important;
      }
      #tab-ai .nx-ai-head .market-count{
        margin-top:3px!important;
        font-size:7.5px!important;
        line-height:1.2!important;
        color:#7f9fbd!important;
        white-space:nowrap;
        overflow:hidden;
        text-overflow:ellipsis;
      }
      #tab-ai .nx-ai-orb{
        width:42px;
        height:42px;
        display:grid;
        place-items:center;
        position:relative;
        border-radius:15px;
        color:#effaff;
        font-size:12px;
        font-weight:1000;
        letter-spacing:.04em;
        background:radial-gradient(circle at 34% 25%,#9ff4ff 0 4%,#36c9ff 12%,#176aff 42%,#4528a8 78%,#0b1732 100%);
        border:1px solid rgba(151,226,255,.48);
        box-shadow:0 8px 22px rgba(22,119,255,.28),inset 0 1px rgba(255,255,255,.42);
      }
      #tab-ai .nx-ai-orb:before,
      #tab-ai .nx-ai-orb:after{
        content:"";
        position:absolute;
        border:1px solid rgba(109,206,255,.34);
        border-radius:50%;
        animation:nxAiOrbit 5.5s linear infinite;
      }
      #tab-ai .nx-ai-orb:before{inset:-4px 4px;transform:rotate(34deg)}
      #tab-ai .nx-ai-orb:after{inset:4px -4px;transform:rotate(-34deg);animation-direction:reverse}
      @keyframes nxAiOrbit{to{rotate:360deg}}
      @media(prefers-reduced-motion:reduce){#tab-ai .nx-ai-orb:before,#tab-ai .nx-ai-orb:after{animation:none}}
      #tab-ai .nx-ai-head .refresh-btn{
        min-width:0!important;
        min-height:31px!important;
        padding:5px 8px!important;
        border-radius:10px!important;
        border-color:rgba(255,103,135,.20)!important;
        background:rgba(255,75,111,.07)!important;
        color:#ff9bad!important;
        font-size:7.5px!important;
        font-weight:900!important;
        letter-spacing:.05em!important;
      }

      /* Five symbolic actions visible together; no horizontal hunting. */
      #tab-ai .ai-quick-actions{
        display:grid!important;
        grid-template-columns:repeat(5,minmax(0,1fr))!important;
        gap:5px!important;
        overflow:visible!important;
        padding:4px 0 6px!important;
      }
      #tab-ai .ai-quick-actions button{
        min-width:0!important;
        min-height:47px!important;
        padding:5px 2px!important;
        display:flex!important;
        flex-direction:column!important;
        align-items:center!important;
        justify-content:center!important;
        gap:3px!important;
        border-radius:12px!important;
        border:1px solid rgba(87,169,255,.15)!important;
        background:linear-gradient(155deg,rgba(22,54,93,.64),rgba(9,24,49,.72))!important;
        color:#dcecff!important;
        font-size:6.6px!important;
        line-height:1!important;
        font-weight:900!important;
        letter-spacing:.035em!important;
        box-shadow:inset 0 1px rgba(255,255,255,.035)!important;
      }
      #tab-ai .ai-quick-actions button .mi-icon{
        width:20px!important;
        height:20px!important;
        margin:0!important;
        border-radius:7px!important;
        display:grid!important;
        place-items:center!important;
        background:linear-gradient(145deg,rgba(37,139,255,.26),rgba(93,79,255,.14))!important;
        color:#78caff!important;
      }
      #tab-ai .ai-quick-actions button .mi-icon svg{width:12px!important;height:12px!important}
      #tab-ai .ai-quick-actions button:active{transform:scale(.97)}

      /* =========================
         AI CONVERSATION CANVAS
         ========================= */
      #tab-ai .ai-box{
        height:auto!important;
        min-height:112px!important;
        max-height:min(46dvh,430px)!important;
        overflow-y:auto!important;
        overscroll-behavior:contain;
        margin:0!important;
        padding:8px!important;
        border-radius:15px!important;
        border:1px solid rgba(95,173,255,.14)!important;
        background:linear-gradient(180deg,rgba(2,10,22,.82),rgba(4,13,27,.72))!important;
        box-shadow:inset 0 1px 0 rgba(255,255,255,.025)!important;
        scrollbar-width:thin;
      }
      #tab-ai .ai-message{
        max-width:91%!important;
        margin:0 0 7px!important;
        animation:nxAiMessageIn .22s ease both;
      }
      @keyframes nxAiMessageIn{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:none}}
      #tab-ai .ai-label{
        margin:0 0 3px 3px!important;
        font-size:6.5px!important;
        line-height:1!important;
        color:#70caff!important;
        font-weight:950!important;
        letter-spacing:.08em!important;
        text-transform:uppercase;
      }
      #tab-ai .ai-bubble{
        max-width:100%!important;
        padding:8px 10px!important;
        border-radius:14px 14px 14px 5px!important;
        border:1px solid rgba(95,177,255,.14)!important;
        background:linear-gradient(145deg,rgba(20,47,81,.86),rgba(10,27,52,.92))!important;
        color:#edf6ff!important;
        font-size:10.5px!important;
        line-height:1.45!important;
        box-shadow:0 5px 15px rgba(0,0,0,.12),inset 0 1px rgba(255,255,255,.03)!important;
      }
      #tab-ai .ai-message.user{margin-left:auto!important}
      #tab-ai .ai-message.user .ai-label{color:#8ce7c9!important;text-align:right!important;margin-right:3px!important}
      #tab-ai .ai-message.user .ai-bubble{
        border-radius:14px 14px 5px 14px!important;
        border-color:rgba(69,224,174,.15)!important;
        background:linear-gradient(145deg,rgba(8,87,76,.90),rgba(7,57,58,.94))!important;
      }
      #tab-ai .nx-ai-message-tools{
        display:flex;
        gap:4px;
        margin:3px 0 0 3px;
      }
      #tab-ai .nx-ai-copy{
        width:25px;
        height:22px;
        display:grid;
        place-items:center;
        padding:0;
        border-radius:7px;
        border:1px solid rgba(100,177,255,.13);
        background:rgba(35,86,145,.10);
        color:#7da8d1;
      }
      #tab-ai .nx-ai-copy svg{width:11px;height:11px}
      #tab-ai .nx-ai-copy.copied{color:#69e5b9;border-color:rgba(105,229,185,.28)}

      /* Compact image attachment preview. */
      #tab-ai .ai-image-preview{
        margin:0 0 6px!important;
        padding:6px!important;
        min-height:0!important;
        border-radius:12px!important;
        border:1px solid rgba(123,184,255,.18)!important;
        background:rgba(20,48,83,.32)!important;
        align-items:center!important;
        gap:7px!important;
      }
      #tab-ai .ai-image-preview img{width:42px!important;height:42px!important;border-radius:9px!important;object-fit:cover!important}
      #tab-ai .ai-image-preview>div{min-width:0!important;flex:1!important;display:flex!important;align-items:center!important;gap:6px!important}
      #tab-ai .ai-image-preview strong{min-width:0!important;flex:1!important;font-size:8px!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
      #tab-ai .ai-image-preview .settings-btn{min-height:26px!important;padding:4px 7px!important;font-size:7px!important}

      /* Unified composer: text + voice + camera + send in one line. */
      #tab-ai .ai-compose{
        display:grid!important;
        grid-template-columns:minmax(0,1fr) 36px 36px 40px!important;
        align-items:center!important;
        gap:5px!important;
        margin-top:6px!important;
        padding:5px!important;
        border-radius:16px!important;
        border:1px solid rgba(90,174,255,.20)!important;
        background:linear-gradient(145deg,rgba(15,38,70,.88),rgba(7,19,39,.94))!important;
        box-shadow:0 8px 22px rgba(0,0,0,.18),inset 0 1px rgba(255,255,255,.035)!important;
      }
      #tab-ai .ai-compose .chat-input{
        width:100%!important;
        min-width:0!important;
        height:36px!important;
        min-height:36px!important;
        padding:6px 8px!important;
        border:0!important;
        border-radius:10px!important;
        background:rgba(1,8,20,.42)!important;
        box-shadow:none!important;
        font-size:10px!important;
        color:#f5f9ff!important;
      }
      #tab-ai .ai-compose .chat-input::placeholder{color:#7189a5!important}
      #tab-ai .ai-icon-btn,
      #tab-ai #aiSendBtn{
        width:36px!important;
        min-width:36px!important;
        height:36px!important;
        min-height:36px!important;
        margin:0!important;
        padding:0!important;
        display:grid!important;
        place-items:center!important;
        border-radius:11px!important;
        border:1px solid rgba(91,179,255,.19)!important;
        background:rgba(34,87,148,.18)!important;
        color:#84d6ff!important;
      }
      #tab-ai .ai-icon-btn .mi-icon{width:18px!important;height:18px!important;display:grid!important;place-items:center!important;margin:0!important}
      #tab-ai .ai-icon-btn .mi-icon svg{width:14px!important;height:14px!important}
      #tab-ai #aiVoiceBtn{position:relative}
      #tab-ai #aiVoiceBtn:after{
        content:"";
        position:absolute;
        width:5px;
        height:5px;
        right:4px;
        top:4px;
        border-radius:50%;
        background:#55e8bd;
        box-shadow:0 0 8px rgba(85,232,189,.65);
      }
      #tab-ai #aiSendBtn{
        width:40px!important;
        min-width:40px!important;
        font-size:0!important;
        border-color:rgba(104,204,255,.48)!important;
        background:linear-gradient(145deg,#137dff,#5a66ff)!important;
        color:#fff!important;
        box-shadow:0 7px 18px rgba(32,107,255,.28)!important;
      }
      #tab-ai #aiSendBtn:before{content:"↑";font-size:18px;font-weight:1000;line-height:1}
      #tab-ai #aiSendBtn:disabled{opacity:.48!important;box-shadow:none!important}

      /* Statuses become one glanceable control strip instead of four tall rows. */
      #tab-ai .nx-ai-status-grid{
        display:grid;
        grid-template-columns:repeat(2,minmax(0,1fr));
        gap:4px;
        margin-top:5px;
      }
      #tab-ai .nx-ai-status-grid>#aiVoiceStatus,
      #tab-ai .nx-ai-status-grid>#nexusVoiceCommandStatus,
      #tab-ai .nx-ai-status-grid>#aiConnectionText,
      #tab-ai .nx-ai-status-grid>.ai-context-badge{
        min-width:0!important;
        min-height:24px!important;
        margin:0!important;
        padding:4px 6px!important;
        display:flex!important;
        align-items:center!important;
        justify-content:center!important;
        gap:4px!important;
        border-radius:8px!important;
        border:1px solid rgba(91,168,255,.12)!important;
        background:rgba(17,46,82,.22)!important;
        color:#8ca9c5!important;
        font-size:6.6px!important;
        line-height:1.15!important;
        text-align:center!important;
        overflow:hidden!important;
      }
      #tab-ai .nx-ai-status-grid>.ai-context-badge{grid-column:1/-1!important;color:#7fa9d0!important}
      #tab-ai .nx-ai-status-grid>.ai-context-badge .mi-icon{width:13px!important;height:13px!important;flex:0 0 13px!important;margin:0!important}
      #tab-ai .nx-ai-status-grid>.ai-context-badge .mi-icon svg{width:10px!important;height:10px!important}

      /* =========================
         COMMUNITY CHAT
         ========================= */
      #tab-chat .nx-chat-head{
        display:grid!important;
        grid-template-columns:36px minmax(0,1fr) auto!important;
        gap:8px!important;
        align-items:center!important;
        padding:1px 1px 7px!important;
      }
      #tab-chat .nx-chat-node{
        width:36px;
        height:36px;
        display:grid;
        place-items:center;
        border-radius:12px;
        background:linear-gradient(145deg,#1179ff,#0f4ba8);
        border:1px solid rgba(113,205,255,.42);
        color:#eaf8ff;
        box-shadow:0 7px 18px rgba(17,121,255,.24),inset 0 1px rgba(255,255,255,.28);
      }
      #tab-chat .nx-chat-node svg{width:18px;height:18px}
      #tab-chat .nx-chat-head h3{margin:0!important;font-size:13px!important;line-height:1.05!important}
      #tab-chat .nx-chat-head .market-count{margin-top:3px!important;font-size:7.3px!important;color:#7f9fbd!important}
      #tab-chat .nx-chat-head .refresh-btn{
        width:31px!important;
        min-width:31px!important;
        height:31px!important;
        padding:0!important;
        display:grid!important;
        place-items:center!important;
        border-radius:10px!important;
        background:rgba(29,101,171,.16)!important;
        border-color:rgba(92,178,255,.16)!important;
        font-size:15px!important;
      }
      #tab-chat .nx-chat-live{
        grid-column:2/4;
        justify-self:start;
        display:inline-flex;
        align-items:center;
        gap:4px;
        margin-top:-2px;
        padding:3px 6px;
        border-radius:999px;
        background:rgba(59,224,170,.07);
        border:1px solid rgba(59,224,170,.13);
        color:#71dcb8;
        font-size:6px;
        font-weight:950;
        letter-spacing:.09em;
      }
      #tab-chat .nx-chat-live:before{content:"";width:5px;height:5px;border-radius:50%;background:#55e6b6;box-shadow:0 0 8px rgba(85,230,182,.65)}

      #tab-chat .chat-box{
        height:auto!important;
        min-height:96px!important;
        max-height:min(46dvh,420px)!important;
        overflow-y:auto!important;
        overscroll-behavior:contain;
        padding:8px!important;
        border-radius:15px!important;
        border:1px solid rgba(92,171,255,.13)!important;
        background:linear-gradient(180deg,rgba(3,11,23,.80),rgba(4,14,28,.72))!important;
      }
      #tab-chat .chat-message{
        max-width:88%!important;
        margin-bottom:7px!important;
        animation:nxAiMessageIn .2s ease both;
      }
      #tab-chat .chat-name{
        margin-bottom:3px!important;
        font-size:6.5px!important;
        line-height:1!important;
        font-weight:900!important;
        letter-spacing:.06em!important;
        color:#74caff!important;
      }
      #tab-chat .chat-bubble{
        padding:7px 9px!important;
        border-radius:13px 13px 13px 5px!important;
        border:1px solid rgba(94,173,255,.13)!important;
        background:linear-gradient(145deg,rgba(20,47,81,.84),rgba(9,27,52,.91))!important;
        color:#eef6ff!important;
        font-size:10px!important;
        line-height:1.4!important;
      }
      #tab-chat .chat-message.mine .chat-name{text-align:right!important;color:#83e9ca!important}
      #tab-chat .chat-message.mine .chat-bubble{
        border-radius:13px 13px 5px 13px!important;
        border-color:rgba(64,225,174,.14)!important;
        background:linear-gradient(145deg,rgba(8,86,76,.88),rgba(6,55,58,.93))!important;
      }
      #tab-chat .chat-compose{
        display:grid!important;
        grid-template-columns:minmax(0,1fr) 42px!important;
        gap:5px!important;
        align-items:center!important;
        margin-top:6px!important;
        padding:5px!important;
        border-radius:16px!important;
        border:1px solid rgba(91,173,255,.18)!important;
        background:linear-gradient(145deg,rgba(14,37,68,.88),rgba(7,19,38,.94))!important;
      }
      #tab-chat .chat-compose .chat-input{
        min-width:0!important;
        height:36px!important;
        padding:6px 8px!important;
        border:0!important;
        border-radius:10px!important;
        background:rgba(1,8,20,.42)!important;
        box-shadow:none!important;
        font-size:10px!important;
      }
      #tab-chat .chat-compose .action-btn{
        width:42px!important;
        min-width:42px!important;
        height:36px!important;
        min-height:36px!important;
        padding:0!important;
        border-radius:11px!important;
        font-size:0!important;
        border-color:rgba(104,204,255,.46)!important;
        background:linear-gradient(145deg,#137dff,#4b63ef)!important;
        color:#fff!important;
        box-shadow:0 7px 18px rgba(32,107,255,.24)!important;
      }
      #tab-chat .chat-compose .action-btn:before{content:"➤";font-size:13px;line-height:1}

      /* Never let old mobile wrap rules split the AI composer into rows. */
      @media(max-width:520px){
        #tab-ai .ai-compose{display:grid!important;grid-template-columns:minmax(0,1fr) 36px 36px 40px!important;flex-wrap:nowrap!important}
        #tab-ai .ai-compose .chat-input{width:100%!important}
      }
      @media(max-width:360px){
        #tab-ai .ai-main-card,#tab-chat>.card{padding:8px!important}
        #tab-ai .ai-quick-actions{gap:3px!important}
        #tab-ai .ai-quick-actions button{min-height:44px!important;font-size:6px!important}
        #tab-ai .nx-ai-status-grid{grid-template-columns:1fr 1fr}
      }
    `;
    document.head.appendChild(style);
  }

  function copyIcon() {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="8" y="8" width="10" height="10" rx="2"/><path d="M6 16H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
  }

  async function copyText(text, button) {
    const value = String(text || '').trim();
    if (!value) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
      } else {
        const area = document.createElement('textarea');
        area.value = value;
        area.style.position = 'fixed';
        area.style.opacity = '0';
        document.body.appendChild(area);
        area.select();
        document.execCommand('copy');
        area.remove();
      }
      button?.classList.add('copied');
      if (button) button.title = 'Copied';
      setTimeout(() => {
        button?.classList.remove('copied');
        if (button) button.title = 'Copy response';
      }, 900);
    } catch (_) {}
  }

  function upgradeAiMessage(node) {
    if (!(node instanceof Element) || !node.classList.contains('ai-message')) return;
    if (node.dataset.nxFuture === '1') return;
    node.dataset.nxFuture = '1';
    if (node.classList.contains('user')) return;
    const bubble = node.querySelector('.ai-bubble');
    if (!bubble) return;
    const tools = document.createElement('div');
    tools.className = 'nx-ai-message-tools';
    const copy = document.createElement('button');
    copy.type = 'button';
    copy.className = 'nx-ai-copy';
    copy.title = 'Copy response';
    copy.setAttribute('aria-label', 'Copy AI response');
    copy.innerHTML = copyIcon();
    copy.addEventListener('click', () => copyText(bubble.textContent, copy));
    tools.appendChild(copy);
    node.appendChild(tools);
  }

  function enhanceAI() {
    const tab = $('tab-ai');
    if (!tab) return;
    const card = tab.querySelector('.ai-main-card');
    if (!card || card.dataset.nxFuture === '1') return;
    card.dataset.nxFuture = '1';

    const head = card.querySelector('.market-header');
    if (head) {
      head.classList.add('nx-ai-head');
      if (!head.querySelector('.nx-ai-orb')) {
        const orb = document.createElement('div');
        orb.className = 'nx-ai-orb';
        orb.setAttribute('aria-hidden', 'true');
        orb.textContent = 'AI';
        head.prepend(orb);
      }
    }

    const box = $('aiBox');
    if (box) {
      box.querySelectorAll('.ai-message').forEach(upgradeAiMessage);
      const observer = new MutationObserver(records => {
        for (const record of records) {
          record.addedNodes.forEach(node => {
            if (!(node instanceof Element)) return;
            if (node.classList.contains('ai-message')) upgradeAiMessage(node);
            node.querySelectorAll?.('.ai-message').forEach(upgradeAiMessage);
          });
        }
      });
      observer.observe(box, {childList:true, subtree:false});
    }

    if (!card.querySelector('.nx-ai-status-grid')) {
      const voice = $('aiVoiceStatus');
      const commands = $('nexusVoiceCommandStatus');
      const connection = $('aiConnectionText');
      const context = card.querySelector('.ai-context-badge');
      const nodes = [voice, commands, connection, context].filter(Boolean);
      if (nodes.length) {
        const rail = document.createElement('div');
        rail.className = 'nx-ai-status-grid';
        const compose = card.querySelector('.ai-compose');
        if (compose) compose.insertAdjacentElement('afterend', rail);
        else card.appendChild(rail);
        nodes.forEach(node => rail.appendChild(node));
      }
    }
  }

  function chatIcon() {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 5h14v10H9l-4 4V5z"/><path d="M8 9h8M8 12h5"/></svg>';
  }

  function markChatMessages(box) {
    box.querySelectorAll('.chat-message').forEach(node => {
      if (node.dataset.nxFuture === '1') return;
      node.dataset.nxFuture = '1';
    });
  }

  function enhanceChat() {
    const tab = $('tab-chat');
    if (!tab) return;
    const card = tab.querySelector(':scope > .card');
    if (!card || card.dataset.nxFuture === '1') return;
    card.dataset.nxFuture = '1';

    const head = card.querySelector('.market-header');
    if (head) {
      head.classList.add('nx-chat-head');
      if (!head.querySelector('.nx-chat-node')) {
        const node = document.createElement('div');
        node.className = 'nx-chat-node';
        node.setAttribute('aria-hidden', 'true');
        node.innerHTML = chatIcon();
        head.prepend(node);
      }
      if (!head.querySelector('.nx-chat-live')) {
        const live = document.createElement('div');
        live.className = 'nx-chat-live';
        live.textContent = 'REAL-TIME COMMUNITY';
        head.appendChild(live);
      }
    }

    const box = $('chatBox');
    if (box) {
      markChatMessages(box);
      const observer = new MutationObserver(() => markChatMessages(box));
      observer.observe(box, {childList:true, subtree:false});
    }
  }

  function init() {
    installStyles();
    enhanceAI();
    enhanceChat();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, {once:true});
  } else {
    init();
  }
})();
