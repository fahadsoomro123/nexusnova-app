const {onCall,HttpsError}=require("firebase-functions/v2/https");
const {setGlobalOptions}=require("firebase-functions/v2");
const {initializeApp}=require("firebase-admin/app");
const {getFirestore,FieldValue}=require("firebase-admin/firestore");
const {randomInt}=require("node:crypto");

initializeApp();
const db=getFirestore();
setGlobalOptions({region:"us-central1",maxInstances:10});

const DAY=86400000, HOUR=3600000, RATE=1, DAILY=5;
const NOVA_COOLDOWN=15*1000;
const NOVA_BOOST_MS=2*HOUR;
const NOVA_BOOSTER_LIMIT=2;
const NOVA_RAIN_LIMIT=4;
const NOVA_TOTAL_BOOST_LIMIT=NOVA_BOOSTER_LIMIT+NOVA_RAIN_LIMIT;
const NOVA_MAX_BOOST_MS=NOVA_TOTAL_BOOST_LIMIT*NOVA_BOOST_MS;
const WITHDRAWAL_COOLDOWN=5*60*1000;
const MAX_POLICY_BYTES=64*1024;
const MAX_AMOUNT_LENGTH=64;
const MAX_ASSET_LENGTH=12;
const MAX_NETWORK_LENGTH=64;
const MAX_DESTINATION_LENGTH=128;
const ASSET_PATTERN=/^[A-Z0-9]{2,12}$/;
const NETWORK_PATTERN=/^[A-Za-z0-9][A-Za-z0-9 ._-]{0,63}$/;
const DIGITS_PATTERN=/^\d+$/;

// Value-bearing operations are deliberately App Check protected.  The web and
// Android clients need production App Check providers before these functions
// can be used in a deployed project; accepting an unauthenticated attestation
// would defeat the point of the server-side reward model.
const protectedCallable=handler=>onCall({enforceAppCheck:true},handler);

function uidOf(req){
  if(!req.auth?.uid) throw new HttpsError("unauthenticated","Please sign in first.");
  return req.auth.uid;
}
function verifiedUidOf(req){
  const uid=uidOf(req);
  if(req.auth.token?.email_verified!==true){
    throw new HttpsError("failed-precondition","Verify your email before using value-bearing features.");
  }
  return uid;
}
function invalidProfile(field){
  throw new HttpsError(
    "failed-precondition",
    `Account data for ${field} needs repair. No value was changed.`
  );
}
function profileNumber(data,field){
  const value=data?.[field];
  if(
    typeof value!=="number"||
    !Number.isFinite(value)||
    value<0||
    value>Number.MAX_SAFE_INTEGER
  ){
    invalidProfile(field);
  }
  return value;
}
function profileBoolean(data,field){
  const value=data?.[field];
  if(typeof value!=="boolean") invalidProfile(field);
  return value;
}
function optionalProfileInt(data,field,defaultValue=0){
  const value=data?.[field];
  if(value===undefined||value===null) return defaultValue;
  if(typeof value!=="number"||!Number.isSafeInteger(value)||value<0){
    invalidProfile(field);
  }
  return value;
}
function requireNovaCooldown(data,now){
  const until=optionalProfileInt(data,"novaFeatureCooldownUntil",0);
  if(now<until){
    throw new HttpsError("resource-exhausted",`Nova cooldown active. Try again in ${Math.ceil((until-now)/1000)} seconds.`);
  }
}
function novaInventorySnapshot(data){
  return {
    booster:optionalProfileInt(data,"novaBoosterInventory",0),
    rain:optionalProfileInt(data,"novaRainInventory",0),
    timeWarp:optionalProfileInt(data,"novaTimeWarpInventory",0),
    pendingVaults:optionalProfileInt(data,"novaVaultPending",0)
  };
}
function requestString(value,field,maxLength){
  if(typeof value!=="string"||value.length>maxLength){
    throw new HttpsError("invalid-argument",`Invalid ${field}.`);
  }
  const normalized=value.trim();
  if(!normalized){
    throw new HttpsError("invalid-argument",`Invalid ${field}.`);
  }
  return normalized;
}
function requestAsset(value){
  const asset=requestString(value,"asset",MAX_ASSET_LENGTH).toUpperCase();
  if(!ASSET_PATTERN.test(asset)){
    throw new HttpsError("invalid-argument","Invalid asset.");
  }
  return asset;
}
function requestNetwork(value){
  const network=requestString(value,"network",MAX_NETWORK_LENGTH);
  if(!NETWORK_PATTERN.test(network)){
    throw new HttpsError("invalid-argument","Invalid network.");
  }
  return network;
}
function isPlainObject(value){
  return value!==null&&typeof value==="object"&&!Array.isArray(value);
}
function configuredMinor(value,field){
  if(
    typeof value!=="string"||
    value.length===0||
    value.length>MAX_AMOUNT_LENGTH||
    !DIGITS_PATTERN.test(value)
  ){
    throw new Error(`invalid ${field}`);
  }
  return BigInt(value);
}
function parseWithdrawalEntry(entry){
  const allowed=["decimals","minMinor","maxMinor","destinationType"];
  if(
    !isPlainObject(entry)||
    !allowed.every(key=>Object.prototype.hasOwnProperty.call(entry,key))||
    Object.keys(entry).some(key=>!allowed.includes(key))||
    typeof entry.decimals!=="number"||
    !Number.isInteger(entry.decimals)||
    entry.decimals<0||
    entry.decimals>18||
    entry.destinationType!=="evm"
  ){
    throw new Error("invalid withdrawal policy entry");
  }
  const minMinor=configuredMinor(entry.minMinor,"minMinor");
  const maxMinor=configuredMinor(entry.maxMinor,"maxMinor");
  if(minMinor<=0n||maxMinor<minMinor){
    throw new Error("invalid withdrawal policy limits");
  }
  return {decimals:entry.decimals,minMinor,maxMinor,destinationType:"evm"};
}
function parseWithdrawalPolicy(){
  const raw=process.env.NEXUSNOVA_WITHDRAWAL_POLICY_JSON||"";
  if(!raw){
    throw new HttpsError("failed-precondition","Withdrawals are not configured for production yet.");
  }
  if(raw.length>MAX_POLICY_BYTES){
    throw new HttpsError("internal","Withdrawal policy configuration is too large.");
  }
  try{
    const policy=JSON.parse(raw);
    if(!isPlainObject(policy)||Object.keys(policy).length===0) throw new Error("not an object");
    const normalized=Object.create(null);
    for(const [asset,networks] of Object.entries(policy)){
      if(!ASSET_PATTERN.test(asset)||!isPlainObject(networks)||Object.keys(networks).length===0){
        throw new Error("invalid asset policy");
      }
      normalized[asset]=Object.create(null);
      for(const [network,entry] of Object.entries(networks)){
        if(!NETWORK_PATTERN.test(network)) throw new Error("invalid network policy");
        normalized[asset][network]=parseWithdrawalEntry(entry);
      }
    }
    return normalized;
  }catch(_){
    throw new HttpsError("internal","Withdrawal policy configuration is invalid.");
  }
}
function decimalToMinor(raw,decimals){
  const amount=requestString(raw,"amount",MAX_AMOUNT_LENGTH);
  if(!/^\d+(?:\.\d+)?$/.test(amount)){
    throw new HttpsError("invalid-argument","Enter a decimal amount without exponent notation.");
  }
  const [whole,fraction=""]=amount.split(".");
  if(fraction.length>decimals){
    throw new HttpsError("invalid-argument",`Amount supports at most ${decimals} decimal places.`);
  }
  const minor=BigInt(whole)*10n**BigInt(decimals)+BigInt((fraction+"0".repeat(decimals)).slice(0,decimals)||"0");
  if(minor<=0n) throw new HttpsError("invalid-argument","Amount must be greater than zero.");
  const normalizedWhole=whole.replace(/^0+(?=\d)/,"");
  return {amount:fraction?`${normalizedWhole}.${fraction}`:normalizedWhole,minor};
}
const ref=uid=>db.collection("users").doc(uid);

exports.startMiningSession=protectedCallable(async req=>{
  const uid=verifiedUidOf(req), now=Date.now();
  return db.runTransaction(async tx=>{
    const r=ref(uid), s=await tx.get(r);
    if(!s.exists) throw new HttpsError("not-found","User profile not found.");
    const d=s.data()||{};
    const balance=profileNumber(d,"balance");
    const miningActive=profileBoolean(d,"miningActive");
    const startedAt=profileNumber(d,"miningStartedAt");
    if(miningActive){
      if(startedAt<=0||startedAt>now+5*60*1000){
        invalidProfile("mining session");
      }
      return {started:false,alreadyActive:true,startedAt,balance,miningActive:true};
    }
    if(startedAt!==0) invalidProfile("mining session");
    tx.update(r,{miningActive:true,miningStartedAt:now,miningLastUpdate:now});
    return {started:true,startedAt:now,balance,miningActive:true};
  });
});

exports.finishMiningSession=protectedCallable(async req=>{
  const uid=verifiedUidOf(req), now=Date.now();
  return db.runTransaction(async tx=>{
    const r=ref(uid), s=await tx.get(r);
    if(!s.exists) throw new HttpsError("not-found","User profile not found.");
    const d=s.data()||{};
    const miningActive=profileBoolean(d,"miningActive");
    const start=profileNumber(d,"miningStartedAt");
    const balance0=profileNumber(d,"balance");
    if(!miningActive){
      if(start!==0) invalidProfile("mining session");
      return {finished:false,balance:balance0,earned:0,miningActive:false};
    }
    if(start<=0||start>now+5*60*1000) invalidProfile("mining session");
    if(now-start<DAY){
      throw new HttpsError("failed-precondition","Your 24-hour mining session is still active.");
    }
    const earned=DAY/3600000*RATE;
    const balance=balance0+earned;
    const totalMined=profileNumber(d,"totalMined")+earned;
    const novaVaultPending=optionalProfileInt(d,"novaVaultPending",0)+1;
    tx.update(r,{balance,totalMined,miningActive:false,miningStartedAt:0,miningLastUpdate:now,novaVaultPending});
    return {finished:true,balance,earned,totalMined,miningActive:false,novaVaultPending,novaVaultEarned:1};
  });
});

exports.openNovaVault=protectedCallable(async req=>{
  const uid=verifiedUidOf(req), now=Date.now();
  // Draw once per request with Node crypto so Firestore transaction retries do
  // not let a caller reroll. Odds: NVX 60%, Booster 18%, Rain 17%, Warp 5%.
  const roll=randomInt(10000);
  const nvxAmount=randomInt(1,11);
  const rewardType=roll<6000?"nvx":roll<7800?"booster":roll<9500?"rain":"time-warp";
  return db.runTransaction(async tx=>{
    const r=ref(uid), s=await tx.get(r);
    if(!s.exists) throw new HttpsError("not-found","User profile not found.");
    const d=s.data()||{};
    requireNovaCooldown(d,now);
    const inventory=novaInventorySnapshot(d);
    if(inventory.pendingVaults<1){
      throw new HttpsError("failed-precondition","No Nova Vault is ready. Complete a natural 24-hour mining session first.");
    }
    const cooldownUntil=now+NOVA_COOLDOWN;
    const updates={
      novaVaultPending:inventory.pendingVaults-1,
      novaFeatureCooldownUntil:cooldownUntil,
      novaLastVaultReward:rewardType,
      novaLastVaultAmount:rewardType==="nvx"?nvxAmount:1,
      novaLastVaultOpenedAt:now
    };
    let balance=profileNumber(d,"balance");
    let booster=inventory.booster, rain=inventory.rain, timeWarp=inventory.timeWarp;
    if(rewardType==="nvx"){
      balance+=nvxAmount;
      updates.balance=balance;
    }else if(rewardType==="booster"){
      booster+=1;
      updates.novaBoosterInventory=booster;
    }else if(rewardType==="rain"){
      rain+=1;
      updates.novaRainInventory=rain;
    }else{
      timeWarp+=1;
      updates.novaTimeWarpInventory=timeWarp;
    }
    tx.update(r,updates);
    return {
      opened:true,
      reward:{type:rewardType,amount:rewardType==="nvx"?nvxAmount:1},
      balance,
      cooldownUntil,
      novaVaultPending:inventory.pendingVaults-1,
      inventory:{booster,rain,timeWarp,pendingVaults:inventory.pendingVaults-1}
    };
  });
});

exports.useNovaBoost=protectedCallable(async req=>{
  const uid=verifiedUidOf(req), now=Date.now();
  const kind=String(req.data?.kind||"").toLowerCase();
  if(kind!=="booster"&&kind!=="rain") throw new HttpsError("invalid-argument","Unknown Nova boost type.");
  return db.runTransaction(async tx=>{
    const r=ref(uid), s=await tx.get(r);
    if(!s.exists) throw new HttpsError("not-found","User profile not found.");
    const d=s.data()||{};
    requireNovaCooldown(d,now);
    if(profileBoolean(d,"miningActive")!==true) throw new HttpsError("failed-precondition","Start mining before using a Nova boost.");
    const startedAt=optionalProfileInt(d,"miningStartedAt",0);
    const anchorAt=optionalProfileInt(d,"miningLastUpdate",0);
    if(startedAt<=0||anchorAt<=0||startedAt>anchorAt) invalidProfile("mining session");
    if(now-startedAt>=DAY) throw new HttpsError("failed-precondition","Mining session is already complete. Claim it first.");
    const reducedMs=anchorAt-startedAt;
    if(reducedMs<0||reducedMs>NOVA_MAX_BOOST_MS||reducedMs%NOVA_BOOST_MS!==0) invalidProfile("mining boost state");
    const uses=reducedMs/NOVA_BOOST_MS;
    const expected=uses<NOVA_BOOSTER_LIMIT?"booster":"rain";
    if(uses>=NOVA_TOTAL_BOOST_LIMIT) throw new HttpsError("failed-precondition","Maximum 12-hour reduction is already used for this session.");
    if(kind!==expected){
      throw new HttpsError("failed-precondition",expected==="booster"?"Use the two Nova Booster slots first.":"Nova Booster is complete. Use Nova Rain now.");
    }
    const inventory=novaInventorySnapshot(d);
    const available=kind==="booster"?inventory.booster:inventory.rain;
    if(available<1) throw new HttpsError("failed-precondition",`No stored Nova ${kind==="booster"?"Booster":"Rain"} is available.`);
    const nextStartedAt=startedAt-NOVA_BOOST_MS;
    if(anchorAt-nextStartedAt>NOVA_MAX_BOOST_MS) throw new HttpsError("failed-precondition","Maximum 12-hour reduction reached.");
    const cooldownUntil=now+NOVA_COOLDOWN;
    const updates={miningStartedAt:nextStartedAt,novaFeatureCooldownUntil:cooldownUntil};
    if(kind==="booster") updates.novaBoosterInventory=inventory.booster-1;
    else updates.novaRainInventory=inventory.rain-1;
    tx.update(r,updates);
    return {
      applied:true,
      appliedKind:kind,
      miningActive:true,
      miningStartedAt:nextStartedAt,
      miningLastUpdate:anchorAt,
      reducedHours:(uses+1)*2,
      uses:uses+1,
      cooldownUntil,
      inventory:{
        booster:kind==="booster"?inventory.booster-1:inventory.booster,
        rain:kind==="rain"?inventory.rain-1:inventory.rain,
        timeWarp:inventory.timeWarp,
        pendingVaults:inventory.pendingVaults
      }
    };
  });
});

exports.useNovaTimeWarp=protectedCallable(async req=>{
  const uid=verifiedUidOf(req), now=Date.now();
  return db.runTransaction(async tx=>{
    const r=ref(uid), s=await tx.get(r);
    if(!s.exists) throw new HttpsError("not-found","User profile not found.");
    const d=s.data()||{};
    requireNovaCooldown(d,now);
    if(profileBoolean(d,"miningActive")!==true) throw new HttpsError("failed-precondition","Start mining before using a 24H Time Warp.");
    const startedAt=optionalProfileInt(d,"miningStartedAt",0);
    if(startedAt<=0) invalidProfile("mining session");
    if(now-startedAt>=DAY) throw new HttpsError("failed-precondition","Mining session is already complete. Claim it normally instead.");
    const inventory=novaInventorySnapshot(d);
    if(inventory.timeWarp<1) throw new HttpsError("failed-precondition","No 24H Time Warp is stored in your Nova Vault.");
    const earned=DAY/HOUR*RATE;
    const balance=profileNumber(d,"balance")+earned;
    const totalMined=profileNumber(d,"totalMined")+earned;
    const cooldownUntil=now+NOVA_COOLDOWN;
    // Deliberately NO novaVaultPending increment here: Time Warp completion
    // cannot create another Vault, preventing an infinite Vault/Warp loop.
    tx.update(r,{
      balance,totalMined,
      miningActive:false,
      miningStartedAt:0,
      miningLastUpdate:now,
      novaTimeWarpInventory:inventory.timeWarp-1,
      novaFeatureCooldownUntil:cooldownUntil
    });
    return {
      completed:true,
      earned,
      balance,totalMined,
      miningActive:false,
      miningStartedAt:0,
      novaVaultEarned:0,
      cooldownUntil,
      inventory:{
        booster:inventory.booster,
        rain:inventory.rain,
        timeWarp:inventory.timeWarp-1,
        pendingVaults:inventory.pendingVaults
      }
    };
  });
});

exports.claimDailyReward=protectedCallable(async req=>{
  const uid=verifiedUidOf(req), now=Date.now();
  return db.runTransaction(async tx=>{
    const r=ref(uid), s=await tx.get(r);
    if(!s.exists) throw new HttpsError("not-found","User profile not found.");
    const d=s.data()||{}, last=profileNumber(d,"lastDailyReward");
    if(now-last<DAY) throw new HttpsError("failed-precondition","Daily reward already claimed. Please try again after 24 hours.");
    const streak0=profileNumber(d,"dailyRewardStreak");
    const streak=last>0&&now-last<=DAY*2?streak0+1:1;
    const balance=profileNumber(d,"balance")+DAILY;
    tx.update(r,{balance,lastDailyReward:now,dailyRewardStreak:streak});
    return {claimed:true,reward:DAILY,balance,streak,lastDailyReward:now};
  });
});

exports.completeTaskReward=protectedCallable(async req=>{
  verifiedUidOf(req);
  const taskId=String(req.data?.taskId||"");
  if(taskId==="task1"){
    throw new HttpsError("failed-precondition","Telegram membership verification is not configured yet. No reward was issued.");
  }
  throw new HttpsError("invalid-argument","Unknown task.");
  /* Keep future task rewards behind a verified server-side campaign proof.
  const uid=verifiedUidOf(req);
  return db.runTransaction(async tx=>{
    const r=ref(uid), s=await tx.get(r);
    if(!s.exists) throw new HttpsError("not-found","User profile not found.");
    const d=s.data()||{}, done={...(d.completedTasks||{})};
    if(done[taskId]) throw new HttpsError("already-exists","Task already completed.");
    done[taskId]=true;
    const reward=TASKS[taskId], balance=Number(d.balance||0)+reward;
    const tasksCompleted=Number(d.tasksCompleted||0)+1;
    tx.update(r,{balance,completedTasks:done,tasksCompleted});
    return {claimed:true,reward,balance,tasksCompleted,taskId};
  });
  */
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