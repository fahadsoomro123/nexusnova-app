/* NexusNova Nine-Screen Modern UI v1
   Presentation-only quick pass for remaining partial screens:
   Location, Emergency, Family, Profile, Smart Nexus, Qibla,
   Entertainment, Browser and Caller ID.
*/
(() => {
  'use strict';
  if (window.__nxNineScreenModernV1) return;
  window.__nxNineScreenModernV1 = true;
  window.nexusNineScreenModernVersion = 'nine-screen-modern-v1';

  const STYLE_ID = 'nxNineScreenModernV1Style';
  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    :is(#tab-location,#tab-emergency,#tab-family,#tab-profile,#tab-smart,#tab-qibla,#tab-entertainment,#tab-browser,#tab-caller-id){
      min-height:0!important;
      height:auto!important;
      padding-bottom:2px!important;
    }

    :is(#tab-location,#tab-emergency,#tab-family,#tab-profile,#tab-smart,#tab-qibla,#tab-entertainment,#tab-browser,#tab-caller-id)>.card,
    :is(#tab-location,#tab-emergency,#tab-family,#tab-profile,#tab-smart,#tab-qibla,#tab-entertainment,#tab-browser,#tab-caller-id) .card{
      min-height:0!important;
      height:auto!important;
      margin-bottom:7px!important;
      padding:10px!important;
      border-radius:18px!important;
      border:1px solid rgba(82,167,255,.18)!important;
      background:
        radial-gradient(circle at 92% 0%,rgba(88,95,255,.12),transparent 30%),
        radial-gradient(circle at 8% 8%,rgba(27,174,255,.10),transparent 30%),
        linear-gradient(155deg,rgba(7,20,39,.98),rgba(4,11,24,.99))!important;
      box-shadow:0 12px 30px rgba(0,0,0,.20),inset 0 1px rgba(255,255,255,.035)!important;
    }

    :is(#tab-location,#tab-emergency,#tab-family,#tab-profile,#tab-smart,#tab-qibla,#tab-entertainment,#tab-browser,#tab-caller-id) .hub-hero,
    :is(#tab-location,#tab-emergency,#tab-family,#tab-profile,#tab-smart,#tab-qibla,#tab-entertainment,#tab-browser,#tab-caller-id) .settings-hero{
      min-height:0!important;
      margin:0 0 7px!important;
      padding:9px 10px!important;
      border-radius:16px!important;
      gap:9px!important;
      background:linear-gradient(145deg,rgba(15,45,82,.64),rgba(7,22,45,.74))!important;
      border:1px solid rgba(84,171,255,.16)!important;
    }

    :is(#tab-location,#tab-emergency,#tab-family,#tab-profile,#tab-smart,#tab-qibla,#tab-entertainment,#tab-browser,#tab-caller-id) .hub-kicker{
      margin:0 0 3px!important;
      font-size:6.5px!important;
      line-height:1!important;
      letter-spacing:.14em!important;
      color:#74bfff!important;
      font-weight:950!important;
    }

    :is(#tab-location,#tab-emergency,#tab-family,#tab-profile,#tab-smart,#tab-qibla,#tab-entertainment,#tab-browser,#tab-caller-id) h2,
    :is(#tab-location,#tab-emergency,#tab-family,#tab-profile,#tab-smart,#tab-qibla,#tab-entertainment,#tab-browser,#tab-caller-id) h3{
      margin:0!important;
      font-size:13px!important;
      line-height:1.12!important;
      letter-spacing:-.01em!important;
    }

    :is(#tab-location,#tab-emergency,#tab-family,#tab-profile,#tab-smart,#tab-qibla,#tab-entertainment,#tab-browser,#tab-caller-id) p,
    :is(#tab-location,#tab-emergency,#tab-family,#tab-profile,#tab-smart,#tab-qibla,#tab-entertainment,#tab-browser,#tab-caller-id) small,
    :is(#tab-location,#tab-emergency,#tab-family,#tab-profile,#tab-smart,#tab-qibla,#tab-entertainment,#tab-browser,#tab-caller-id) .settings-muted,
    :is(#tab-location,#tab-emergency,#tab-family,#tab-profile,#tab-smart,#tab-qibla,#tab-entertainment,#tab-browser,#tab-caller-id) .market-count{
      margin-top:3px!important;
      font-size:8px!important;
      line-height:1.3!important;
      color:#8ca6c0!important;
    }

    :is(#tab-location,#tab-emergency,#tab-family,#tab-profile,#tab-smart,#tab-qibla,#tab-entertainment,#tab-browser,#tab-caller-id) .feature-grid,
    :is(#tab-location,#tab-emergency,#tab-family,#tab-profile,#tab-smart,#tab-qibla,#tab-entertainment,#tab-browser,#tab-caller-id) .tool-grid,
    :is(#tab-location,#tab-emergency,#tab-family,#tab-profile,#tab-smart,#tab-qibla,#tab-entertainment,#tab-browser,#tab-caller-id) .settings-grid{
      gap:6px!important;
      margin-top:6px!important;
      align-content:start!important;
    }

    :is(#tab-location,#tab-emergency,#tab-family,#tab-profile,#tab-smart,#tab-qibla,#tab-entertainment,#tab-browser,#tab-caller-id) .feature-tile,
    :is(#tab-location,#tab-emergency,#tab-family,#tab-profile,#tab-smart,#tab-qibla,#tab-entertainment,#tab-browser,#tab-caller-id) .tool-card,
    :is(#tab-location,#tab-emergency,#tab-family,#tab-profile,#tab-smart,#tab-qibla,#tab-entertainment,#tab-browser,#tab-caller-id) .contact-card{
      min-height:0!important;
      height:auto!important;
      margin:0!important;
      padding:8px!important;
      border-radius:14px!important;
      border:1px solid rgba(89,169,255,.14)!important;
      background:linear-gradient(145deg,rgba(17,44,78,.54),rgba(8,24,48,.68))!important;
      box-shadow:inset 0 1px rgba(255,255,255,.025)!important;
    }

    :is(#tab-location,#tab-emergency,#tab-family,#tab-profile,#tab-smart,#tab-qibla,#tab-entertainment,#tab-browser,#tab-caller-id) .feature-tile strong,
    :is(#tab-location,#tab-emergency,#tab-family,#tab-profile,#tab-smart,#tab-qibla,#tab-entertainment,#tab-browser,#tab-caller-id) .tool-card strong{
      font-size:9.5px!important;
      line-height:1.1!important;
    }

    :is(#tab-location,#tab-emergency,#tab-family,#tab-profile,#tab-smart,#tab-qibla,#tab-entertainment,#tab-browser,#tab-caller-id) button,
    :is(#tab-location,#tab-emergency,#tab-family,#tab-profile,#tab-smart,#tab-qibla,#tab-entertainment,#tab-browser,#tab-caller-id) .tool-btn,
    :is(#tab-location,#tab-emergency,#tab-family,#tab-profile,#tab-smart,#tab-qibla,#tab-entertainment,#tab-browser,#tab-caller-id) .action-btn,
    :is(#tab-location,#tab-emergency,#tab-family,#tab-profile,#tab-smart,#tab-qibla,#tab-entertainment,#tab-browser,#tab-caller-id) .settings-btn{
      min-height:34px!important;
      height:auto!important;
      padding:6px 9px!important;
      border-radius:10px!important;
      font-size:8px!important;
      line-height:1.1!important;
      font-weight:900!important;
      letter-spacing:.025em!important;
    }

    :is(#tab-location,#tab-family,#tab-profile,#tab-browser,#tab-caller-id) input,
    :is(#tab-location,#tab-family,#tab-profile,#tab-browser,#tab-caller-id) select,
    :is(#tab-location,#tab-family,#tab-profile,#tab-browser,#tab-caller-id) textarea{
      min-height:36px!important;
      height:auto!important;
      padding:7px 9px!important;
      border-radius:10px!important;
      font-size:9px!important;
      background:rgba(2,10,23,.76)!important;
      border:1px solid rgba(88,168,255,.16)!important;
      color:#f3f8ff!important;
    }

    :is(#tab-location,#tab-family,#tab-profile,#tab-browser,#tab-caller-id) label{
      font-size:7.5px!important;
      line-height:1.2!important;
      color:#90a9c3!important;
    }

    /* Location: remove oversized empty panel while keeping GPS action obvious. */
    #tab-location .location-box{
      min-height:0!important;
      padding:10px!important;
      margin:6px 0!important;
      border-radius:15px!important;
      background:linear-gradient(145deg,rgba(7,37,69,.74),rgba(4,20,39,.86))!important;
    }
    #tab-location .location-icon{font-size:28px!important;line-height:1!important;margin:0!important}
    #tab-location .location-value{margin:6px 0!important;font-size:9px!important;line-height:1.35!important}

    /* Emergency remains visually urgent, but no oversized dead space. */
    #tab-emergency .emergency-banner{
      margin:0 0 6px!important;
      padding:8px 10px!important;
      border-radius:12px!important;
      font-size:8.5px!important;
      line-height:1.3!important;
      background:linear-gradient(145deg,rgba(93,18,32,.58),rgba(54,12,24,.72))!important;
    }
    #tab-emergency .emergency-btn{
      min-height:42px!important;
      padding:8px 10px!important;
      border-radius:13px!important;
      font-size:10px!important;
      box-shadow:0 8px 20px rgba(239,68,68,.18)!important;
    }
    #tab-emergency .contact-actions{gap:5px!important;margin-top:5px!important}

    /* Family + Profile: dense human-readable cards. */
    #tab-family .settings-row,
    #tab-profile .info-row{
      min-height:0!important;
      padding:7px 0!important;
      gap:8px!important;
      font-size:9px!important;
      border-bottom-color:rgba(117,177,235,.10)!important;
    }
    #tab-profile .profile-avatar{
      width:54px!important;
      height:54px!important;
      margin:0 auto 7px!important;
      border-radius:18px!important;
      background:linear-gradient(145deg,#1a78e9,#4b5eea)!important;
      box-shadow:0 8px 24px rgba(25,115,235,.22)!important;
    }

    /* Smart Nexus: all four intelligent tools visible without hunting. */
    #tab-smart .feature-grid{
      display:grid!important;
      grid-template-columns:repeat(2,minmax(0,1fr))!important;
      gap:6px!important;
    }
    #tab-smart .feature-tile{
      display:flex!important;
      flex-direction:column!important;
      gap:4px!important;
      justify-content:flex-start!important;
    }
    #tab-smart .feature-tile>.mi-icon,
    #tab-smart .feature-tile>span:first-child{
      width:28px!important;
      height:28px!important;
      display:grid!important;
      place-items:center!important;
      border-radius:9px!important;
      background:linear-gradient(145deg,rgba(32,137,255,.30),rgba(98,74,255,.18))!important;
    }
    #tab-smart .hub-orb{
      width:44px!important;
      height:44px!important;
      border-radius:15px!important;
      font-size:10px!important;
      background:radial-gradient(circle at 35% 25%,#9af1ff,#1c84ff 38%,#5130b4 78%)!important;
      box-shadow:0 8px 24px rgba(33,119,255,.24)!important;
    }

    /* Qibla keeps compass readability while trimming wrapper waste. */
    #tab-qibla .card{padding:9px!important}
    #tab-qibla [class*="qibla"],#tab-qibla [class*="compass"]{margin-top:6px!important;margin-bottom:6px!important}

    /* Entertainment: compact media tiles + disclosure. */
    #tab-entertainment .integration-note{
      margin-top:6px!important;
      padding:7px 8px!important;
      border-radius:10px!important;
      font-size:7.5px!important;
      line-height:1.3!important;
      color:#8ea8c4!important;
      background:rgba(18,46,80,.30)!important;
      border:1px solid rgba(83,163,245,.12)!important;
    }

    /* Browser: toolbar first, viewer uses available space without fake tail. */
    #tab-browser .browser-toolbar,
    #tab-browser .browser-controls,
    #tab-browser .browser-actions{
      gap:5px!important;
      margin:5px 0!important;
      padding:5px!important;
      border-radius:12px!important;
      background:rgba(15,39,71,.44)!important;
    }
    #tab-browser iframe,#tab-browser webview{
      border-radius:13px!important;
      border:1px solid rgba(82,166,255,.16)!important;
      background:#050b14!important;
    }

    /* Caller ID: privacy-first console, no startup behavior changes. */
    #tab-caller-id .card{
      border-color:rgba(82,183,255,.18)!important;
      background:radial-gradient(circle at 90% 0%,rgba(38,179,255,.10),transparent 34%),linear-gradient(155deg,rgba(6,22,41,.98),rgba(4,12,25,.99))!important;
    }
    #tab-caller-id [class*="status"],
    #tab-caller-id [class*="privacy"]{
      margin:5px 0!important;
      padding:7px 8px!important;
      border-radius:10px!important;
      font-size:8px!important;
      line-height:1.3!important;
    }

    @media(max-width:380px){
      #tab-smart .feature-grid{grid-template-columns:1fr 1fr!important}
      :is(#tab-location,#tab-emergency,#tab-family,#tab-profile,#tab-smart,#tab-qibla,#tab-entertainment,#tab-browser,#tab-caller-id)>.card{padding:8px!important}
    }
  `;
  document.head.appendChild(style);
})();
