/* NexusNova Compact Premium UI v1
   Targeted presentation layer only:
   - preserves mining/reward/auth/ad/business logic
   - keeps the approved Mine + Nova Hub shell
   - removes layout waste without touching the stable Nova Hub scroll owner
   - compacts premium forms/settings while preserving their actions
   - consumes taps on the already-active Mine/Nova Hub dock item
*/
(() => {
  'use strict';
  if (window.__nxCompactPremiumV1) return;
  window.__nxCompactPremiumV1 = true;
  window.nexusCompactPremiumVersion = 'compact-premium-v1';

  const $ = id => document.getElementById(id);
  const $$ = selector => Array.from(document.querySelectorAll(selector));
  const STYLE_ID = 'nxCompactPremiumV1Style';

  function installStyles() {
    if ($(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      /* ---------- Global density: no fake empty canvas ---------- */
      body.nx-compact-premium-v1{--nx-compact-gap:7px;--nx-compact-radius:15px}
      body.nx-compact-premium-v1 main.main>.tab,
      body.nx-compact-premium-v1 main>.tab,
      body.nx-compact-premium-v1 .nexus-hub-tab,
      body.nx-compact-premium-v1 [id^="tab-mega-"],
      body.nx-compact-premium-v1 .nexus-tool-panel{
        min-height:0!important;height:auto!important;
      }
      body.nx-compact-premium-v1 .nexus-hub-tab,
      body.nx-compact-premium-v1 [id^="tab-mega-"]{
        padding-bottom:8px!important;margin-bottom:0!important;
      }
      body.nx-compact-premium-v1 .tool-grid,
      body.nx-compact-premium-v1 .mega-grid{
        align-content:start!important;margin-bottom:0!important;padding-bottom:0!important;
      }
      body.nx-compact-premium-v1 .tool-card,
      body.nx-compact-premium-v1 .nexus-tool-panel.card,
      body.nx-compact-premium-v1 [id^="tab-mega-"]>.card{
        min-height:0!important;height:auto!important;margin-bottom:8px!important;
      }
      @media(max-width:700px){
        /* The old shell reserved bottom space on both body and main. Keep one
           compact dock-safe reserve only, which removes the visible black tail. */
        body.nx-compact-premium-v1.nx-nova-hub-nav{padding-bottom:0!important}
        body.nx-compact-premium-v1.nx-nova-hub-nav .main{padding-bottom:calc(78px + env(safe-area-inset-bottom,0px))!important}
      }

      /* ---------- Premium compact brand header + market rail ---------- */
      body.nx-compact-premium-v1 .top-header{min-height:0!important;padding:6px 0!important;background:linear-gradient(180deg,rgba(4,14,28,.98),rgba(3,10,21,.96))!important;border-bottom-color:rgba(83,169,255,.13)!important}
      body.nx-compact-premium-v1 .header-inner{min-height:36px!important;padding:0 12px!important;gap:9px!important}
      body.nx-compact-premium-v1 .logo-title{font-size:18px!important;line-height:1!important;letter-spacing:-.035em!important}
      body.nx-compact-premium-v1 .logo-sub{font-size:7.5px!important;letter-spacing:.16em!important;margin-top:3px!important}
      body.nx-compact-premium-v1 #nexusLangBtn{min-height:29px!important;padding:3px 8px!important;border-radius:9px!important;font-size:9px!important}
      body.nx-compact-premium-v1 .ticker-wrap{min-height:23px!important;height:23px!important;padding:0!important;border-bottom-color:rgba(72,151,255,.10)!important;background:rgba(2,9,19,.96)!important}
      body.nx-compact-premium-v1 .ticker-content{min-height:23px!important;height:23px!important;align-items:center!important}
      body.nx-compact-premium-v1 .ticker-item{font-size:9px!important;line-height:23px!important;margin-right:18px!important}

      /* ---------- Mining: one-screen compact control deck ---------- */
      body.nx-compact-premium-v1 #tab-home{padding-top:5px!important;padding-bottom:2px!important}
      body.nx-compact-premium-v1 #tab-home>.card:first-child{position:relative;overflow:hidden;margin:0 0 5px!important;padding:7px 12px!important;border-radius:15px!important;background:radial-gradient(circle at 92% 8%,rgba(43,167,255,.16),transparent 38%),linear-gradient(145deg,rgba(7,26,48,.96),rgba(4,14,29,.98))!important;border-color:rgba(83,180,255,.20)!important;box-shadow:0 7px 20px rgba(0,0,0,.18)!important}
      body.nx-compact-premium-v1 #tab-home>.card:first-child:after{content:"NVX • NEXUSNOVA UTILITY";position:absolute;right:10px;top:8px;padding:3px 6px;border-radius:999px;border:1px solid rgba(90,190,255,.15);background:rgba(41,135,255,.08);color:#75bfff;font-size:6.8px;font-weight:900;letter-spacing:.09em;pointer-events:none}
      body.nx-compact-premium-v1 #tab-home .balance-title{font-size:8px!important;letter-spacing:.13em!important;margin:0 0 2px!important;color:#7f9fbd!important}
      body.nx-compact-premium-v1 #tab-home #balance{font-size:22px!important;line-height:1!important;letter-spacing:-.035em!important;margin:0!important;text-shadow:0 0 16px rgba(77,192,255,.18)!important}
      body.nx-compact-premium-v1 #tab-home #usdValue{font-size:8.5px!important;margin-top:3px!important;color:#69baff!important}

      body.nx-compact-premium-v1 #mineBtn.nx-future-miner{min-height:66px!important;height:66px!important;margin:5px 0 4px!important;padding:8px 12px 8px 76px!important;border-radius:17px!important;box-shadow:0 9px 24px rgba(0,76,165,.25),inset 0 1px rgba(255,255,255,.12)!important}
      body.nx-compact-premium-v1 #mineBtn.nx-future-miner .nx-mining-reactor{left:15px!important;width:48px!important;height:48px!important}
      body.nx-compact-premium-v1 #mineBtn.nx-future-miner .nx-mining-reactor:before{inset:-5px!important}
      body.nx-compact-premium-v1 #mineBtn.nx-future-miner .nx-mining-reactor:after{inset:5px!important}
      body.nx-compact-premium-v1 #mineBtn.nx-future-miner .nx-mining-bolt{width:17px!important;height:27px!important}
      body.nx-compact-premium-v1 #mineBtn.nx-future-miner #btnText{font-size:14px!important;line-height:1!important}
      body.nx-compact-premium-v1 #mineBtn.nx-future-miner .sub-text{margin-top:4px!important;font-size:7px!important;letter-spacing:.14em!important}
      body.nx-compact-premium-v1 #mineBtn.nx-future-miner .nx-mining-note{margin-top:3px!important;font-size:6px!important;letter-spacing:.08em!important;white-space:nowrap!important}
      body.nx-compact-premium-v1 #timer.nx-mining-timer{min-height:0!important;margin:3px auto 5px!important;padding:5px 11px!important;border-radius:9px!important;font-size:10px!important;line-height:1.15!important;letter-spacing:.045em!important}

      body.nx-compact-premium-v1 #tab-home .stats-grid{gap:5px!important;margin:4px 0!important}
      body.nx-compact-premium-v1 #tab-home .stat-card{min-height:0!important;padding:6px 8px!important;border-radius:12px!important}
      body.nx-compact-premium-v1 #tab-home .stat-label{font-size:6.8px!important;letter-spacing:.09em!important}
      body.nx-compact-premium-v1 #tab-home .stat-value{margin-top:2px!important;font-size:10.5px!important;line-height:1!important}

      body.nx-compact-premium-v1 #tab-home #nxMineCoreAccess{margin:4px 0!important;padding:6px!important;border-radius:13px!important}
      body.nx-compact-premium-v1 #tab-home #nxMineCoreAccess .nx-mine-core-kicker{margin:0 0 4px!important;font-size:6.8px!important}
      body.nx-compact-premium-v1 #tab-home #nxMineCoreAccess .nx-mine-core-grid{gap:5px!important}
      body.nx-compact-premium-v1 #tab-home #nxMineCoreAccess .nx-mine-core-btn{min-height:43px!important;height:43px!important;padding:4px!important;border-radius:11px!important;gap:3px!important;flex-direction:row!important}
      body.nx-compact-premium-v1 #tab-home #nxMineCoreAccess .nx-mine-core-icon{width:27px!important;height:27px!important;flex:0 0 27px!important;border-radius:8px!important}
      body.nx-compact-premium-v1 #tab-home #nxMineCoreAccess .nx-mine-core-icon svg{width:15px!important;height:15px!important}
      body.nx-compact-premium-v1 #tab-home #nxMineCoreAccess .nx-mine-core-label{font-size:8px!important}

      body.nx-compact-premium-v1 #tab-home #nxProgressMini{margin:4px 0!important;padding:6px 8px!important;border-radius:13px!important}
      body.nx-compact-premium-v1 #tab-home #nxProgressMini .nx-mini-head b{font-size:9px!important}
      body.nx-compact-premium-v1 #tab-home #nxProgressMini .nx-mini-head span{font-size:7px!important}
      body.nx-compact-premium-v1 #tab-home #nxProgressMini .nx-mini-line{gap:4px!important;margin-top:4px!important}
      body.nx-compact-premium-v1 #tab-home #nxProgressMini .nx-mini-cell{padding:4px 3px!important;border-radius:8px!important}
      body.nx-compact-premium-v1 #tab-home #nxProgressMini .nx-mini-cell small{font-size:6px!important}
      body.nx-compact-premium-v1 #tab-home #nxProgressMini .nx-mini-cell strong{margin-top:1px!important;font-size:8.5px!important}
      body.nx-compact-premium-v1 #tab-home #nxMiniLeagueBtn{min-height:30px!important;height:30px!important;margin-top:4px!important;padding:4px 8px!important;font-size:7px!important;border-radius:9px!important}

      /* Existing booster owner stays authoritative; only its box model is compacted. */
      body.nx-compact-premium-v1 #tab-home #nxMiningBoostPanel{min-height:0!important;margin:4px 0!important;padding:7px!important;border-radius:13px!important}
      body.nx-compact-premium-v1 #tab-home #nxMiningBoostPanel h2,
      body.nx-compact-premium-v1 #tab-home #nxMiningBoostPanel h3{margin:0 0 4px!important;font-size:10px!important;line-height:1.1!important}
      body.nx-compact-premium-v1 #tab-home #nxMiningBoostPanel p{margin:2px 0!important;font-size:7px!important;line-height:1.25!important}
      body.nx-compact-premium-v1 #tab-home #nxMiningBoostPanel button{min-height:30px!important;padding:4px 7px!important;border-radius:9px!important;font-size:7.5px!important}
      body.nx-compact-premium-v1 #tab-home #nxMiningBoostPanel [class*="grid"],
      body.nx-compact-premium-v1 #tab-home #nxMiningBoostPanel [class*="row"]{gap:5px!important;margin-top:4px!important}

      /* Nova Vault: preserve every reward/action/disclosure, shrink only geometry. */
      body.nx-compact-premium-v1 #nxNovaVaultPanel{margin:4px 0!important;padding:7px 8px!important;border-radius:14px!important;box-shadow:0 8px 22px rgba(52,20,111,.16),inset 0 1px rgba(255,255,255,.035)!important}
      body.nx-compact-premium-v1 #nxNovaVaultPanel .nx-vault-head{gap:7px!important;align-items:center!important}
      body.nx-compact-premium-v1 #nxNovaVaultPanel .nx-vault-kicker{font-size:6px!important;letter-spacing:.12em!important}
      body.nx-compact-premium-v1 #nxNovaVaultPanel .nx-vault-title{margin-top:1px!important;font-size:10px!important;line-height:1!important}
      body.nx-compact-premium-v1 #nxNovaVaultPanel .nx-vault-title small{margin-top:2px!important;font-size:6px!important;line-height:1.18!important}
      body.nx-compact-premium-v1 #nxNovaVaultPanel .nx-vault-pending{padding:3px 6px!important;font-size:6.5px!important}
      body.nx-compact-premium-v1 #nxNovaVaultPanel .nx-vault-inventory{gap:4px!important;margin-top:5px!important}
      body.nx-compact-premium-v1 #nxNovaVaultPanel .nx-vault-item{padding:4px 3px!important;border-radius:9px!important}
      body.nx-compact-premium-v1 #nxNovaVaultPanel .nx-vault-item b{font-size:9px!important;line-height:1!important}
      body.nx-compact-premium-v1 #nxNovaVaultPanel .nx-vault-item span{margin-top:1px!important;font-size:5.5px!important}
      body.nx-compact-premium-v1 #nxNovaVaultPanel .nx-vault-actions{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:4px!important;margin-top:5px!important}
      body.nx-compact-premium-v1 #nxNovaVaultPanel .nx-vault-btn{min-height:27px!important;padding:3px 5px!important;border-radius:8px!important;font-size:6.3px!important}
      body.nx-compact-premium-v1 #nxNovaVaultPanel .nx-vault-open{grid-column:1/-1!important;min-height:29px!important}
      body.nx-compact-premium-v1 #nxNovaVaultPanel .nx-vault-status{margin-top:4px!important;font-size:6px!important;line-height:1.2!important}
      body.nx-compact-premium-v1 #nxNovaVaultPanel .nx-vault-odds{margin-top:4px!important;padding-top:4px!important;font-size:5.6px!important;line-height:1.2!important}

      /* ---------- Bottom dock: same identity, slightly smaller ---------- */
      body.nx-compact-premium-v1.nx-nova-hub-nav .bottom-dock{max-width:520px!important}
      body.nx-compact-premium-v1.nx-nova-hub-nav .bottom-dock .dock-inner{gap:6px!important;padding:5px!important}
      body.nx-compact-premium-v1.nx-nova-hub-nav .bottom-dock .dock-item[data-nx-nova-hub-primary="1"]{height:52px!important;min-height:52px!important;padding:6px 10px!important;border-radius:15px!important;gap:8px!important}
      body.nx-compact-premium-v1.nx-nova-hub-nav .bottom-dock .dock-item[data-nx-nova-hub-primary="1"] .mi-icon{width:25px!important;height:25px!important;border-radius:8px!important}
      body.nx-compact-premium-v1.nx-nova-hub-nav .bottom-dock .dock-item[data-nx-nova-hub-primary="1"] .mi-icon svg{width:16px!important;height:16px!important}
      body.nx-compact-premium-v1.nx-nova-hub-nav .bottom-dock .dock-item[data-nx-nova-hub-primary="1"] .nx-nova-dock-label{font-size:9px!important;letter-spacing:.075em!important}

      /* ---------- Daily tools / cards ---------- */
      body.nx-compact-premium-v1 .hub-hero{min-height:0!important;margin-bottom:7px!important;padding:10px 12px!important;border-radius:16px!important}
      body.nx-compact-premium-v1 .hub-hero h2{font-size:15px!important;margin:0!important}
      body.nx-compact-premium-v1 .hub-hero p{font-size:9px!important;line-height:1.3!important;margin:3px 0 0!important}
      body.nx-compact-premium-v1 .hub-kicker{font-size:7px!important;letter-spacing:.13em!important;margin-bottom:3px!important}
      body.nx-compact-premium-v1 .hub-orb{width:38px!important;height:38px!important;font-size:17px!important;border-radius:12px!important}
      body.nx-compact-premium-v1 .tool-grid{gap:7px!important}
      body.nx-compact-premium-v1 .tool-card{padding:9px!important;border-radius:15px!important;box-shadow:0 7px 18px rgba(0,0,0,.15)!important}
      body.nx-compact-premium-v1 .tool-title{font-size:10.5px!important;margin-bottom:6px!important;gap:6px!important}
      body.nx-compact-premium-v1 .tool-title .mi-icon{width:20px!important;height:20px!important}
      body.nx-compact-premium-v1 .tool-row{gap:6px!important;margin-top:5px!important}
      body.nx-compact-premium-v1 .tool-input,
      body.nx-compact-premium-v1 .tool-select,
      body.nx-compact-premium-v1 .tool-card input,
      body.nx-compact-premium-v1 .tool-card select,
      body.nx-compact-premium-v1 .tool-card textarea{min-height:39px!important;padding:8px 10px!important;border-radius:11px!important;font-size:11px!important}
      body.nx-compact-premium-v1 .tool-card textarea{min-height:62px!important;max-height:90px!important}
      body.nx-compact-premium-v1 .tool-primary,
      body.nx-compact-premium-v1 .tool-btn,
      body.nx-compact-premium-v1 .tool-card button{min-height:38px!important;padding:7px 10px!important;border-radius:11px!important;font-size:10px!important}
      body.nx-compact-premium-v1 .tool-result{min-height:0!important;margin-top:6px!important;padding:8px!important;border-radius:11px!important;font-size:10px!important;line-height:1.35!important}
      body.nx-compact-premium-v1 .saved-item,
      body.nx-compact-premium-v1 .saved-row{min-height:0!important;padding:7px 8px!important;margin-top:5px!important;border-radius:10px!important;font-size:10px!important}

      /* ---------- Reusable premium modal/forms: futuristic but efficient ---------- */
      body.nx-compact-premium-v1 .nxui-backdrop{padding:10px!important;background:radial-gradient(circle at 50% 8%,rgba(39,116,255,.17),transparent 34%),rgba(1,6,16,.86)!important}
      body.nx-compact-premium-v1 .nxui-modal{width:min(96vw,560px)!important;max-height:94dvh!important;border-radius:20px!important;box-shadow:0 24px 70px rgba(0,0,0,.62),0 0 34px rgba(36,122,255,.11),inset 0 1px rgba(255,255,255,.07)!important}
      body.nx-compact-premium-v1 .nxui-modal:before{height:90px!important}
      body.nx-compact-premium-v1 .nxui-close{right:10px!important;top:10px!important;width:32px!important;height:32px!important;border-radius:10px!important;font-size:17px!important}
      body.nx-compact-premium-v1 .nxui-hero{grid-template-columns:52px 1fr!important;gap:11px!important;padding:14px 14px 9px!important}
      body.nx-compact-premium-v1 .nxui-orb{width:50px!important;height:50px!important;border-radius:15px!important;box-shadow:0 10px 25px rgba(21,126,255,.27),inset 0 1px rgba(255,255,255,.38)!important}
      body.nx-compact-premium-v1 .nxui-orb svg{width:27px!important;height:27px!important}
      body.nx-compact-premium-v1 .nxui-eyebrow{font-size:7px!important;letter-spacing:.13em!important;margin-bottom:3px!important}
      body.nx-compact-premium-v1 .nxui-title{font-size:18px!important;line-height:1.05!important}
      body.nx-compact-premium-v1 .nxui-subtitle{margin-top:4px!important;font-size:9.5px!important;line-height:1.3!important}
      body.nx-compact-premium-v1 .nxui-form{padding:3px 14px 14px!important}
      body.nx-compact-premium-v1 .nxui-grid{gap:7px!important}
      body.nx-compact-premium-v1 .nxui-label{gap:5px!important;margin-bottom:4px!important;font-size:8.5px!important}
      body.nx-compact-premium-v1 .nxui-label svg{width:14px!important;height:14px!important}
      body.nx-compact-premium-v1 .nxui-control>svg{left:10px!important;width:16px!important;height:16px!important}
      body.nx-compact-premium-v1 .nxui-input,
      body.nx-compact-premium-v1 .nxui-select,
      body.nx-compact-premium-v1 .nxui-textarea{min-height:40px!important;padding:8px 10px 8px 34px!important;border-radius:11px!important;font-size:11px!important}
      body.nx-compact-premium-v1 .nxui-textarea{min-height:66px!important;max-height:86px!important;padding-top:9px!important}
      body.nx-compact-premium-v1 .nxui-control.textarea>svg{top:12px!important}
      body.nx-compact-premium-v1 .nxui-hint{margin-top:3px!important;font-size:7.5px!important;line-height:1.25!important}
      body.nx-compact-premium-v1 .nxui-error{margin-top:3px!important;font-size:8px!important}
      body.nx-compact-premium-v1 .nxui-actions{gap:7px!important;margin-top:10px!important}
      body.nx-compact-premium-v1 .nxui-btn{min-height:40px!important;border-radius:11px!important;font-size:10px!important}
      body.nx-compact-premium-v1 .nxui-message{padding:0 14px 14px!important}
      body.nx-compact-premium-v1 .nxui-message-box{padding:10px!important;border-radius:12px!important;font-size:10px!important;line-height:1.4!important}
      body.nx-compact-premium-v1 .nxui-result-shell{padding:11px!important;border-radius:15px!important}
      body.nx-compact-premium-v1 .nxui-result-head{gap:8px!important;margin-bottom:7px!important}
      body.nx-compact-premium-v1 .nxui-result-icon{width:36px!important;height:36px!important;flex-basis:36px!important;border-radius:11px!important}
      body.nx-compact-premium-v1 .nxui-result-icon svg{width:20px!important;height:20px!important}
      body.nx-compact-premium-v1 .nxui-result-title{font-size:12px!important}.nxui-result-sub{font-size:8px!important}
      body.nx-compact-premium-v1 .nxui-result-body{font-size:10px!important;line-height:1.4!important}

      /* Profile editor uses its own modal owner; compact it without changing save/photo logic. */
      body.nx-compact-premium-v1 .nx-profile-modal-card{width:min(96vw,520px)!important;max-height:94dvh!important;padding:12px!important;border-radius:18px!important}
      body.nx-compact-premium-v1 .nx-profile-modal-head{margin-bottom:8px!important}.nx-profile-modal-head h3{font-size:15px!important}
      body.nx-compact-premium-v1 .nx-profile-photo-edit{gap:9px!important;padding:8px!important;border-radius:12px!important}
      body.nx-compact-premium-v1 .nx-profile-photo-preview{width:54px!important;height:54px!important;flex-basis:54px!important}
      body.nx-compact-premium-v1 .nx-profile-field{margin-top:7px!important}.nx-profile-field label{margin-bottom:3px!important;font-size:7px!important}
      body.nx-compact-premium-v1 .nx-profile-field input,
      body.nx-compact-premium-v1 .nx-profile-field textarea{min-height:39px!important;padding:8px 10px!important;border-radius:10px!important;font-size:11px!important}
      body.nx-compact-premium-v1 .nx-profile-field textarea{min-height:56px!important;max-height:75px!important}
      body.nx-compact-premium-v1 .nx-profile-two{gap:7px!important}.nx-profile-save-row{gap:7px!important;margin-top:9px!important}.nx-profile-status{min-height:13px!important;margin-top:5px!important;font-size:8px!important}

      /* ---------- Settings: short, narrow and task-first ---------- */
      body.nx-compact-premium-v1 #tab-about{padding-top:5px!important;padding-bottom:5px!important}
      body.nx-compact-premium-v1 #tab-about .settings-hero{min-height:0!important;margin:0 0 6px!important;padding:8px 10px!important;border-radius:14px!important}
      body.nx-compact-premium-v1 #tab-about .settings-hero h2{font-size:15px!important;margin:0!important}
      body.nx-compact-premium-v1 #tab-about .settings-hero .settings-muted{margin:2px 0 0!important;font-size:8px!important;line-height:1.2!important}
      body.nx-compact-premium-v1 #tab-about .settings-version{padding:3px 6px!important;font-size:7px!important;border-radius:8px!important}
      body.nx-compact-premium-v1 #tab-about .settings-card{margin:0 0 6px!important;padding:7px 9px!important;border-radius:13px!important;box-shadow:0 5px 14px rgba(0,0,0,.13)!important}
      body.nx-compact-premium-v1 #tab-about .settings-card h3{margin:0 0 3px!important;font-size:10px!important;line-height:1.1!important}
      body.nx-compact-premium-v1 #tab-about .settings-card h3 .mi-icon{width:16px!important;height:16px!important}
      body.nx-compact-premium-v1 #tab-about .settings-row{min-height:34px!important;padding:4px 0!important;gap:7px!important;border-bottom-color:rgba(148,163,184,.065)!important}
      body.nx-compact-premium-v1 #tab-about .settings-row strong{font-size:9px!important;line-height:1.15!important}
      body.nx-compact-premium-v1 #tab-about .settings-row small{display:none!important}
      body.nx-compact-premium-v1 #tab-about .settings-actions{gap:4px!important;margin:0!important;flex-wrap:nowrap!important}
      body.nx-compact-premium-v1 #tab-about .settings-btn{min-height:30px!important;padding:5px 8px!important;border-radius:9px!important;font-size:8px!important;white-space:nowrap!important}
      body.nx-compact-premium-v1 #tab-about .settings-select{min-height:30px!important;height:30px!important;max-width:112px!important;padding:3px 24px 3px 7px!important;border-radius:9px!important;font-size:8px!important}
      body.nx-compact-premium-v1 #tab-about .switch{transform:scale(.80);transform-origin:right center;margin-right:-3px!important}
      body.nx-compact-premium-v1 #tab-about .settings-card>.settings-muted{margin:2px 0 5px!important;font-size:8px!important;line-height:1.25!important}

      /* Symbol cue is generated with CSS so existing button text matching and
         click handlers are never changed. */
      body.nx-compact-premium-v1 button[data-nx-symbol]:not(:has(.mi-icon)):not(.nxui-btn)::before{content:attr(data-nx-symbol);display:inline-grid;place-items:center;min-width:15px;height:15px;margin-right:5px;border-radius:5px;background:rgba(73,157,255,.11);color:#7cc4ff;font-size:9px;font-weight:950;vertical-align:-2px}

      @media(max-width:390px){
        body.nx-compact-premium-v1 .nxui-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important}
        body.nx-compact-premium-v1 .nxui-field.nxui-wide{grid-column:1/-1!important}
        body.nx-compact-premium-v1 #tab-home #nxNovaVaultPanel .nx-vault-actions{grid-template-columns:repeat(2,minmax(0,1fr))!important}
      }
      @media(max-height:720px) and (max-width:520px){
        body.nx-compact-premium-v1 .top-header{padding:4px 0!important}
        body.nx-compact-premium-v1 .header-inner{min-height:32px!important}
        body.nx-compact-premium-v1 .ticker-wrap,body.nx-compact-premium-v1 .ticker-content{height:20px!important;min-height:20px!important}
        body.nx-compact-premium-v1 .ticker-item{line-height:20px!important}
        body.nx-compact-premium-v1 #mineBtn.nx-future-miner{height:60px!important;min-height:60px!important}
        body.nx-compact-premium-v1 #nxNovaVaultPanel{padding-top:6px!important;padding-bottom:6px!important}
      }
      @media(prefers-reduced-motion:reduce){body.nx-compact-premium-v1 *{scroll-behavior:auto!important}}
    `;
    document.head.appendChild(style);
  }

  function dockIsPrimary(button) {
    if (!button) return false;
    if (button.id === 'moreBtn') return true;
    if (button.dataset?.nxNovaHubPrimary === '1') return true;
    return /switchTab\(\s*['"]home['"]/.test(String(button.getAttribute('onclick') || ''));
  }

  function installActiveDockGuard() {
    if (document.__nxCompactActiveDockGuardV1) return;
    document.__nxCompactActiveDockGuardV1 = true;
    document.addEventListener('click', event => {
      const button = event.target?.closest?.('.bottom-dock .dock-item');
      if (!button || !dockIsPrimary(button) || !button.classList.contains('active')) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      button.animate?.(
        [{transform:'scale(1)'},{transform:'scale(.985)'},{transform:'scale(1)'}],
        {duration:130,easing:'ease-out'}
      );
    }, true);
  }

  function pruneSettings() {
    const tab = $('tab-about');
    if (!tab) return;

    /* System Status is diagnostic information rather than a user setting. */
    $$('#tab-about .settings-card').forEach(card => {
      const heading = String(card.querySelector('h3')?.textContent || '').replace(/\s+/g,' ').trim();
      if (/^System Status$/i.test(heading.replace(/^[^A-Za-z]+/,''))) card.remove();
    });

    /* Compact mode is no longer a useful switch because this approved layout is
       deliberately compact by default. Remove the option rather than hiding a
       second competing density system. */
    $('compactSetting')?.closest('.settings-row')?.remove();

    const support = $$('#tab-about .settings-card').find(card => /Support\s*&\s*About/i.test(card.textContent || ''));
    const copy = support?.querySelector('.settings-muted');
    if (copy) copy.textContent = 'Help, feedback and NexusNova information.';
  }

  const SYMBOLS = [
    [/\b(save|apply|done|complete)\b/i,'✓'],
    [/\b(add|create|new|post)\b/i,'+'],
    [/\b(delete|remove|clear)\b/i,'×'],
    [/\b(search|find|lookup)\b/i,'⌕'],
    [/\b(refresh|reload|retry)\b/i,'↻'],
    [/\b(calendar|date|event)\b/i,'▦'],
    [/\b(note|document|worksheet)\b/i,'▤'],
    [/\b(lesson|teacher|class|quiz)\b/i,'◇'],
    [/\b(calculate|convert|amount|salary|expense|emi|currency)\b/i,'#'],
    [/\b(location|map|track)\b/i,'⌖'],
    [/\b(profile|account|family|contact)\b/i,'○'],
    [/\b(open|view|browse)\b/i,'›']
  ];

  function symbolizeControls(root = document) {
    root.querySelectorAll?.('button').forEach(button => {
      if (button.dataset.nxSymbol || button.querySelector('.mi-icon,svg')) return;
      const text = String(button.textContent || '').replace(/\s+/g,' ').trim();
      const found = SYMBOLS.find(([pattern]) => pattern.test(text));
      if (found) button.dataset.nxSymbol = found[1];
      if (!button.getAttribute('aria-label') && text) button.setAttribute('aria-label', text);
    });

    root.querySelectorAll?.('input,select,textarea').forEach(control => {
      if (control.getAttribute('aria-label')) return;
      const label = control.id ? document.querySelector(`label[for="${CSS.escape(control.id)}"]`)?.textContent : '';
      const name = String(label || control.getAttribute('placeholder') || control.name || '').trim();
      if (name) control.setAttribute('aria-label', name.slice(0,120));
    });
  }

  function clearLayoutWaste() {
    const roots = $$('main.main>.tab,main>.tab,.nexus-tool-panel');
    roots.forEach(root => {
      if (!root) return;
      const inlineMin = root.style?.minHeight || '';
      const inlineHeight = root.style?.height || '';
      if (/vh|px/i.test(inlineMin)) root.style.removeProperty('min-height');
      if (/100vh|100dvh/i.test(inlineHeight)) root.style.removeProperty('height');
    });
  }

  function apply() {
    document.body?.classList.add('nx-compact-premium-v1');
    installStyles();
    pruneSettings();
    clearLayoutWaste();
    symbolizeControls(document);
  }

  function boot() {
    installStyles();
    installActiveDockGuard();
    apply();
    window.addEventListener('nexusaccountready', apply);
    window.addEventListener('nexusnova:after-core-ready', apply);
    window.addEventListener('pageshow', apply);
    [250,700,1500,2800,5000,8000].forEach(ms => setTimeout(apply,ms));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
