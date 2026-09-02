const {onCall,HttpsError}=require("firebase-functions/v2/https");
const {initializeApp}=require("firebase-admin/app");
const {getFirestore,FieldValue}=require("firebase-admin/firestore");
initializeApp();
const db=getFirestore();
const DAY=86400000, MINING_REWARD=24, MAX_PROFILE_NAME=80;
const NOVA_COOLDOWN=15*1000, NOVA_BOOST_MS=2*60*60*1000, NOVA_MAX_BOOST_USES=6;
const NOVA_MAX_BOOSTER_USES=2, NOVA_MAX_RAIN_USES=4, NOVA_MAX_BOOST_CREDITS=3, NOVA_VAULTS_PER_BOOST_CREDIT=7;
const WITHDRAWAL_COOLDOWN=60*1000, MAX_DESTINATION_LENGTH=160;
const ALLOWED_ASSETS=new Set(["BTC","ETH","BNB","USDT","USDC"]);
const ALLOWED_NETWORKS=new Set(["ethereum","bsc"]);
const protectedCallable=handler=>onCall({enforceAppCheck:true},handler);
const ref=uid=>db.collection("users").doc(uid);
function uidOf(req){if(!req.auth?.uid)throw new HttpsError("unauthenticated","Sign in first.");return req.auth.uid}
function verifiedUidOf(req){const uid=uidOf(req);if(req.auth.token?.email_verified!==true)throw new HttpsError("failed-precondition","Verify your email first.");return uid}
function profileNumber(data,field){const value=data?.[field];if(typeof value!=="number"||!Number.isFinite(value)||value<0||value>Number.MAX_SAFE_INTEGER)throw new HttpsError("failed-precondition",`Account data for ${field} needs repair. No value was changed.`);return value}
function optionalInt(data,field,defaultValue=0){const value=data?.[field];if(value===undefined||value===null)return defaultValue;if(typeof value!=="number"||!Number.isSafeInteger(value)||value<0)throw new HttpsError("failed-precondition",`Account data for ${field} needs repair. No value was changed.`);return value}
function requestString(value,label,max){const text=String(value??"").trim();if(!text||text.length>max)throw new HttpsError("invalid-argument",`Invalid ${label}.`);return text}
function requestAsset(value){const asset=requestString(value,"asset",12).toUpperCase();if(!ALLOWED_ASSETS.has(asset))throw new HttpsError("invalid-argument","Unsupported asset.");return asset}
function requestNetwork(value){const network=requestString(value,"network",24).toLowerCase();if(!ALLOWED_NETWORKS.has(network))throw new HttpsError("invalid-argument","Unsupported network.");return network}
function decimalToMinor(raw,decimals){const text=String(raw??"").trim();if(!/^\d+(?:\.\d+)?$/.test(text))throw new HttpsError("invalid-argument","Invalid amount.");const [whole,frac=""]=text.split(".");if(frac.length>decimals)throw new HttpsError("invalid-argument",`Use at most ${decimals} decimal places.`);const minor=BigInt(whole)*10n**BigInt(decimals)+BigInt((frac+"0".repeat(decimals)).slice(0,decimals)||"0");if(minor<=0n)throw new HttpsError("invalid-argument","Amount must be greater than zero.");return {amount:text,minor}}
function parseWithdrawalPolicy(){const raw=process.env.NEXUSNOVA_WITHDRAWAL_POLICY_JSON||"";if(!raw)return {};try{return JSON.parse(raw)}catch{throw new HttpsError("internal","Withdrawal configuration is invalid.")}}
function cooldown(data,now){const until=optionalInt(data,"novaFeatureCooldownUntil",0);if(now<until)throw new HttpsError("resource-exhausted",`Nova cooldown active. Try again in ${Math.ceil((until-now)/1000)} seconds.`);return until}
function inventoryOf(data){return {booster:optionalInt(data,"novaBoosterInventory",0),rain:optionalInt(data,"novaRainInventory",0),timeWarp:optionalInt(data,"novaTimeWarpInventory",0),pendingVaults:optionalInt(data,"novaVaultPending",0)}}
function miningElapsed(data,now){const active=data?.miningActive===true;const started=optionalInt(data,"miningStartedAt",0);return {active,started,elapsed:active&&started>0?Math.max(0,now-started):0}}
function randomVaultReward(){const roll=require("node:crypto").randomInt(10000);const type=roll<6000?"nvx":roll<7800?"booster":roll<9500?"rain":"time-warp";return {type,amount:type==="nvx"?require("node:crypto").randomInt(1,11):1}}

exports.getSecureAccount=protectedCallable(async req=>{const uid=uidOf(req);const s=await ref(uid).get();if(!s.exists)throw new HttpsError("not-found","User profile not found.");return s.data()||{}});

exports.finishMiningSession=protectedCallable(async req=>{
  const uid=verifiedUidOf(req), now=Date.now();
  return db.runTransaction(async tx=>{
    const r=ref(uid), s=await tx.get(r);if(!s.exists)throw new HttpsError("not-found","User profile not found.");const d=s.data()||{};
    const {active,started,elapsed}=miningElapsed(d,now);
    if(!active||started<=0)throw new HttpsError("failed-precondition","No active mining session.");
    if(elapsed<DAY)throw new HttpsError("failed-precondition","Mining session is not complete yet.");
    const balance=profileNumber(d,"balance"), total=profileNumber(d,"totalMined"), pending=optionalInt(d,"novaVaultPending",0);
    const nextBalance=balance+MINING_REWARD,nextTotal=total+MINING_REWARD;
    tx.update(r,{balance:nextBalance,totalMined:nextTotal,miningActive:false,miningStartedAt:0,miningLastUpdate:now,novaVaultPending:pending+1,novaBoostUsesThisSession:0,novaBoosterUsesThisSession:0,novaRainUsesThisSession:0});
    return {balance:nextBalance,totalMined:nextTotal,miningActive:false,miningStartedAt:0,miningLastUpdate:now,novaVaultPending:pending+1,earned:MINING_REWARD};
  });
});

exports.claimDailyReward=protectedCallable(async req=>{
  const uid=verifiedUidOf(req), now=Date.now();
  return db.runTransaction(async tx=>{
    const r=ref(uid),s=await tx.get(r);if(!s.exists)throw new HttpsError("not-found","User profile not found.");const d=s.data()||{};
    const last=profileNumber(d,"lastDailyReward"),balance=profileNumber(d,"balance");
    if(now-last<DAY)throw new HttpsError("resource-exhausted","Daily reward is not ready yet.");
    const reward=5,nextBalance=balance+reward;tx.update(r,{balance:nextBalance,lastDailyReward:now,dailyRewardStreak:FieldValue.increment(1)});return {reward,balance:nextBalance,lastDailyReward:now};
  });
});

exports.completeTaskReward=protectedCallable(async req=>{
  const uid=verifiedUidOf(req);const taskId=String(req.data?.taskId||"");if(taskId!=="task1")throw new HttpsError("invalid-argument","Unknown task.");
  return db.runTransaction(async tx=>{
    const r=ref(uid),s=await tx.get(r);if(!s.exists)throw new HttpsError("not-found","User profile not found.");const d=s.data()||{};const done=d.completedTasks||{};
    if(done[taskId])throw new HttpsError("already-exists","Task already completed.");const balance=profileNumber(d,"balance"),reward=10,nextBalance=balance+reward;
    tx.update(r,{balance:nextBalance,tasksCompleted:FieldValue.increment(1),[`completedTasks.${taskId}`]:true});return {reward,balance:nextBalance};
  });
});

exports.openNovaVault=protectedCallable(async req=>{
  const uid=verifiedUidOf(req),now=Date.now(),reward=randomVaultReward();
  return db.runTransaction(async tx=>{
    const r=ref(uid),s=await tx.get(r);if(!s.exists)throw new HttpsError("not-found","User profile not found.");const d=s.data()||{};cooldown(d,now);
    const inv=inventoryOf(d);if(inv.pendingVaults<1)throw new HttpsError("failed-precondition","No Nova Vault is ready.");
    const credits=optionalInt(d,"novaVaultBoostCredits",0),rawProgress=optionalInt(d,"novaVaultMilestoneProgress",0),progress=Math.min(rawProgress,NOVA_VAULTS_PER_BOOST_CREDIT-1);
    let nextCredits=credits,nextProgress=progress+1,boostCreditGranted=false;
    if(nextProgress>=NOVA_VAULTS_PER_BOOST_CREDIT){
      if(credits<NOVA_MAX_BOOST_CREDITS){nextCredits=credits+1;nextProgress=0;boostCreditGranted=true}else nextProgress=NOVA_VAULTS_PER_BOOST_CREDIT-1;
    }
    const updates={novaVaultPending:inv.pendingVaults-1,novaFeatureCooldownUntil:now+NOVA_COOLDOWN,novaLastVaultReward:reward.type,novaLastVaultAmount:reward.amount,novaLastVaultOpenedAt:now,novaVaultBoostCredits:nextCredits,novaVaultMilestoneProgress:nextProgress};
    let balance=profileNumber(d,"balance"),booster=inv.booster,rain=inv.rain,timeWarp=inv.timeWarp;
    if(reward.type==="nvx"){balance+=reward.amount;updates.balance=balance}else if(reward.type==="booster"){booster+=1;updates.novaBoosterInventory=booster}else if(reward.type==="rain"){rain+=1;updates.novaRainInventory=rain}else{timeWarp+=1;updates.novaTimeWarpInventory=timeWarp}
    tx.update(r,updates);return {reward,balance,cooldownUntil:now+NOVA_COOLDOWN,novaVaultPending:inv.pendingVaults-1,novaVaultBoostCredits:nextCredits,novaVaultMilestoneProgress:nextProgress,boostCreditGranted,inventory:{booster,rain,timeWarp,pendingVaults:inv.pendingVaults-1}};
  });
});

exports.useNovaBoost=protectedCallable(async req=>{
  const uid=verifiedUidOf(req),now=Date.now(),kind=String(req.data?.kind||"").toLowerCase();if(kind!=="booster"&&kind!=="rain")throw new HttpsError("invalid-argument","Unknown Nova Boost.");
  return db.runTransaction(async tx=>{
    const r=ref(uid),s=await tx.get(r);if(!s.exists)throw new HttpsError("not-found","User profile not found.");const d=s.data()||{};cooldown(d,now);
    const inv=inventoryOf(d),mining=miningElapsed(d,now);if(!mining.active||mining.started<=0)throw new HttpsError("failed-precondition","Start mining first.");if(mining.elapsed>=DAY)throw new HttpsError("failed-precondition","Mining session is already complete.");
    const uses=optionalInt(d,"novaBoostUsesThisSession",0),boosterUses=optionalInt(d,"novaBoosterUsesThisSession",0),rainUses=optionalInt(d,"novaRainUsesThisSession",0);
    if(uses>=NOVA_MAX_BOOST_USES)throw new HttpsError("resource-exhausted","Maximum Nova Boosts used this session.");
    if(kind==="booster"&&boosterUses>=NOVA_MAX_BOOSTER_USES)throw new HttpsError("resource-exhausted","Maximum 2 Nova Boosters can be used per mining session.");
    if(kind==="rain"&&rainUses>=NOVA_MAX_RAIN_USES)throw new HttpsError("resource-exhausted","Maximum 4 Nova Rain uses are allowed per mining session.");
    if(kind==="booster"&&inv.booster<1)throw new HttpsError("failed-precondition","No Nova Booster available.");if(kind==="rain"&&inv.rain<1)throw new HttpsError("failed-precondition","No Nova Rain available.");
    const newStart=Math.max(1,mining.started-NOVA_BOOST_MS),updates={miningStartedAt:newStart,miningLastUpdate:now,novaBoostUsesThisSession:uses+1,novaFeatureCooldownUntil:now+NOVA_COOLDOWN};
    if(kind==="booster"){updates.novaBoosterInventory=inv.booster-1;updates.novaBoosterUsesThisSession=boosterUses+1}else{updates.novaRainInventory=inv.rain-1;updates.novaRainUsesThisSession=rainUses+1}
    tx.update(r,updates);return {kind,miningActive:true,miningStartedAt:newStart,cooldownUntil:now+NOVA_COOLDOWN,reducedHours:(uses+1)*2,novaVaultPending:inv.pendingVaults,inventory:{booster:kind==="booster"?inv.booster-1:inv.booster,rain:kind==="rain"?inv.rain-1:inv.rain,timeWarp:inv.timeWarp,pendingVaults:inv.pendingVaults}};
  });
});

exports.useNovaTimeWarp=protectedCallable(async req=>{
  const uid=verifiedUidOf(req),now=Date.now();
  return db.runTransaction(async tx=>{
    const r=ref(uid),s=await tx.get(r);if(!s.exists)throw new HttpsError("not-found","User profile not found.");const d=s.data()||{};cooldown(d,now);const inv=inventoryOf(d),mining=miningElapsed(d,now);
    if(inv.timeWarp<1)throw new HttpsError("failed-precondition","No Time Warp available.");if(!mining.active||mining.started<=0)throw new HttpsError("failed-precondition","Start mining first.");if(mining.elapsed>=DAY)throw new HttpsError("failed-precondition","Mining session is already complete.");
    const balance=profileNumber(d,"balance"),total=profileNumber(d,"totalMined"),nextBalance=balance+MINING_REWARD,nextTotal=total+MINING_REWARD;
    tx.update(r,{balance:nextBalance,totalMined:nextTotal,miningActive:true,miningStartedAt:now,miningLastUpdate:now,novaTimeWarpInventory:inv.timeWarp-1,novaFeatureCooldownUntil:now+NOVA_COOLDOWN,novaBoostUsesThisSession:0,novaBoosterUsesThisSession:0,novaRainUsesThisSession:0});
    return {earned:MINING_REWARD,balance:nextBalance,totalMined:nextTotal,miningActive:true,miningStartedAt:now,cooldownUntil:now+NOVA_COOLDOWN,inventory:{booster:inv.booster,rain:inv.rain,timeWarp:inv.timeWarp-1,pendingVaults:inv.pendingVaults}};
  });
});

exports.getDepositAddress=protectedCallable(async req=>{
  uidOf(req);
  const asset=requestAsset(req.data?.asset);
  const network=requestNetwork(req.data?.network);
  const raw=process.env.NEXUSNOVA_DEPOSIT_ADDRESSES_JSON||"";
  if(!raw) throw new HttpsError("failed-precondition","Deposit address service is not configured yet. No fake address will be generated.");
  let map; try{map=JSON.parse(raw);}catch{throw new HttpsError("internal","Deposit address configuration is invalid.");}
  const address=map?.[network]?.[asset]||"";
  if(!address) throw new HttpsError("failed-precondition",`No real deposit address is configured for ${asset} on ${network}.`);
  return {address,asset,network};
});

exports.requestWithdrawal=protectedCallable(async req=>{
  const uid=verifiedUidOf(req), now=Date.now();
  const asset=requestAsset(req.data?.asset);
  const network=requestNetwork(req.data?.network);
  const policy=parseWithdrawalPolicy();
  const networkPolicy=policy?.[asset]?.[network];
  if(!networkPolicy){
    throw new HttpsError("invalid-argument","That asset and network are not enabled for withdrawals.");
  }
  const {amount,minor}=decimalToMinor(req.data?.amount,networkPolicy.decimals);
  if(minor<networkPolicy.minMinor||minor>networkPolicy.maxMinor){
    throw new HttpsError("invalid-argument","Amount is outside this asset's configured withdrawal limits.");
  }
  const destination=requestString(req.data?.destination,"destination address",MAX_DESTINATION_LENGTH);
  if(networkPolicy.destinationType!=="evm"||!/^0x[a-fA-F0-9]{40}$/.test(destination))
    throw new HttpsError("invalid-argument","Invalid EVM destination address.");
  const profile=ref(uid);
  const throttle=db.collection("withdrawalRateLimits").doc(uid);
  const request=db.collection("withdrawalRequests").doc();
  await db.runTransaction(async tx=>{
    const profileSnapshot=await tx.get(profile);
    if(!profileSnapshot.exists) throw new HttpsError("not-found","User profile not found.");
    const throttleSnapshot=await tx.get(throttle);
    const previous=throttleSnapshot.exists
      ? profileNumber(throttleSnapshot.data(),"lastRequestAt")
      : 0;
    if(now-previous<WITHDRAWAL_COOLDOWN){
      throw new HttpsError("resource-exhausted","Please wait before submitting another withdrawal request.");
    }
    tx.set(request,{
      uid,asset,network,amount,amountMinor:minor.toString(),destination,
      status:"pending_review",createdAt:FieldValue.serverTimestamp()
    });
    tx.set(throttle,{lastRequestAt:now,updatedAt:FieldValue.serverTimestamp()});
  });
  return {requestId:request.id,status:"pending_review"};
});

Object.assign(exports, require("./notifications"));
Object.assign(exports, require("./admobRewardedSsv"));
Object.assign(exports, require("./novaVault10x"));
// v2 intentionally loads last so the deployed admobRewardedSsv export uses
// the release-safe signed endpoint, which records callbacks but grants no NVX
// or mining acceleration value.
Object.assign(exports, require("./admobRewardedSsvV2"));
