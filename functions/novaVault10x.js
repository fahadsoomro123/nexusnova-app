const {onCall,HttpsError}=require("firebase-functions/v2/https");
const {getFirestore}=require("firebase-admin/firestore");
const {randomInt}=require("node:crypto");

/*
  Nova Vault 10x secure opener.
  Rewarded purpose contract: nova-vault-10x

  Security model:
  - The rewarded ad itself never writes NVX or inventory from the WebView.
  - A Google-signed AdMob SSV callback grants novaVaultBoostCredits.
  - This callable requires Auth + verified email + App Check.
  - One boosted opening consumes exactly one pending Vault and one server credit.
  - The random draw happens once before the Firestore transaction so transaction
    retries cannot be used as a reroll oracle.

  "10x" is implemented as a transparent weighted-pool boost: the three premium
  item weights (Booster/Rain/Time Warp) are each multiplied by 10 relative to the
  normal NVX weight. The resulting normalized display odds are approximately:
  NVX 13.04%, Booster 39.13%, Rain 36.96%, Time Warp 10.87%.
  Boosted NVX drops are 5-25 NVX instead of the normal 1-10 NVX range.
*/

const db=getFirestore();
const NOVA_COOLDOWN=15*1000;

const protectedCallable=handler=>onCall({enforceAppCheck:true},handler);

function verifiedUidOf(req){
  if(!req.auth?.uid) throw new HttpsError("unauthenticated","Please sign in first.");
  if(req.auth.token?.email_verified!==true){
    throw new HttpsError("failed-precondition","Verify your email before using Nova Vault rewards.");
  }
  return req.auth.uid;
}

function profileNumber(data,field){
  const value=data?.[field];
  if(typeof value!=="number"||!Number.isFinite(value)||value<0||value>Number.MAX_SAFE_INTEGER){
    throw new HttpsError("failed-precondition",`Account data for ${field} needs repair. No value was changed.`);
  }
  return value;
}

function optionalInt(data,field,defaultValue=0){
  const value=data?.[field];
  if(value===undefined||value===null) return defaultValue;
  if(typeof value!=="number"||!Number.isSafeInteger(value)||value<0){
    throw new HttpsError("failed-precondition",`Account data for ${field} needs repair. No value was changed.`);
  }
  return value;
}

function requireCooldown(data,now){
  const until=optionalInt(data,"novaFeatureCooldownUntil",0);
  if(now<until){
    throw new HttpsError("resource-exhausted",`Nova cooldown active. Try again in ${Math.ceil((until-now)/1000)} seconds.`);
  }
}

function drawBoostedReward(){
  // Normal weights are NVX 6000 / Booster 1800 / Rain 1700 / Warp 500.
  // Premium weights are x10 while the NVX weight remains unchanged.
  const roll=randomInt(46000);
  const type=roll<6000?"nvx":roll<24000?"booster":roll<41000?"rain":"time-warp";
  return {
    type,
    amount:type==="nvx"?randomInt(5,26):1
  };
}

exports.openNovaVaultBoosted=protectedCallable(async req=>{
  const uid=verifiedUidOf(req);
  const now=Date.now();
  const reward=drawBoostedReward();

  return db.runTransaction(async tx=>{
    const userRef=db.collection("users").doc(uid);
    const snap=await tx.get(userRef);
    if(!snap.exists) throw new HttpsError("not-found","User profile not found.");
    const data=snap.data()||{};

    requireCooldown(data,now);

    const pending=optionalInt(data,"novaVaultPending",0);
    const credits=optionalInt(data,"novaVaultBoostCredits",0);
    if(pending<1){
      throw new HttpsError("failed-precondition","No Nova Vault is ready. Complete a natural 24-hour mining session first.");
    }
    if(credits<1){
      throw new HttpsError("failed-precondition","10x chance is not unlocked yet. Complete the rewarded ad first.");
    }

    const cooldownUntil=now+NOVA_COOLDOWN;
    const updates={
      novaVaultPending:pending-1,
      novaVaultBoostCredits:credits-1,
      novaFeatureCooldownUntil:cooldownUntil,
      novaLastVaultReward:reward.type,
      novaLastVaultAmount:reward.amount,
      novaLastVaultMode:"10x",
      novaLastVaultOpenedAt:now
    };

    let balance=profileNumber(data,"balance");
    let booster=optionalInt(data,"novaBoosterInventory",0);
    let rain=optionalInt(data,"novaRainInventory",0);
    let timeWarp=optionalInt(data,"novaTimeWarpInventory",0);

    if(reward.type==="nvx"){
      if(balance>Number.MAX_SAFE_INTEGER-reward.amount){
        throw new HttpsError("failed-precondition","Balance limit reached. No value was changed.");
      }
      balance+=reward.amount;
      updates.balance=balance;
    }else if(reward.type==="booster"){
      booster+=1;
      updates.novaBoosterInventory=booster;
    }else if(reward.type==="rain"){
      rain+=1;
      updates.novaRainInventory=rain;
    }else{
      timeWarp+=1;
      updates.novaTimeWarpInventory=timeWarp;
    }

    tx.update(userRef,updates);
    return {
      opened:true,
      boosted:true,
      boostMode:"10x-weighted-pool",
      reward,
      balance,
      cooldownUntil,
      novaVaultPending:pending-1,
      novaVaultBoostCredits:credits-1,
      inventory:{booster,rain,timeWarp,pendingVaults:pending-1}
    };
  });
});

exports.__novaVault10xTest=Object.freeze({
  premiumWeightMultiplier:10,
  totalWeight:46000,
  boostedNvxMin:5,
  boostedNvxMax:25,
  displayOdds:Object.freeze({
    nvx:6000/46000,
    booster:18000/46000,
    rain:17000/46000,
    timeWarp:5000/46000
  })
});