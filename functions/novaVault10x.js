const {onCall,HttpsError}=require("firebase-functions/v2/https");
const {getFirestore}=require("firebase-admin/firestore");
const {randomInt}=require("node:crypto");

/*
  Nova Vault 10X secure opener.

  Release model:
  - 10X credits are earned from normal Vault milestones, never from ads.
  - One boosted opening consumes exactly one pending Vault and one server credit.
  - The boosted pool contains premium utility items only: Booster, Nova Rain,
    and 24H Time Warp. It never grants NVX directly.
  - The random draw happens once before the Firestore transaction so transaction
    retries cannot be used as a reroll oracle.
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
  // Premium-only 10X pool, normalized from the previous premium weights:
  // Booster 18,000 / Rain 17,000 / Time Warp 5,000 = 40,000 total.
  const roll=randomInt(40000);
  const type=roll<18000?"booster":roll<35000?"rain":"time-warp";
  return {type,amount:1};
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
      throw new HttpsError("failed-precondition","10X credit is not ready yet. Open normal Nova Vaults to earn a milestone credit.");
    }

    const cooldownUntil=now+NOVA_COOLDOWN;
    const updates={
      novaVaultPending:pending-1,
      novaVaultBoostCredits:credits-1,
      novaFeatureCooldownUntil:cooldownUntil,
      novaLastVaultReward:reward.type,
      novaLastVaultAmount:reward.amount,
      novaLastVaultMode:"10x-milestone",
      novaLastVaultOpenedAt:now
    };

    let booster=optionalInt(data,"novaBoosterInventory",0);
    let rain=optionalInt(data,"novaRainInventory",0);
    let timeWarp=optionalInt(data,"novaTimeWarpInventory",0);

    if(reward.type==="booster"){
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
      boostMode:"10x-milestone-premium-items",
      reward,
      cooldownUntil,
      novaVaultPending:pending-1,
      novaVaultBoostCredits:credits-1,
      inventory:{booster,rain,timeWarp,pendingVaults:pending-1}
    };
  });
});

exports.__novaVault10xTest=Object.freeze({
  totalWeight:40000,
  directNvx:false,
  displayOdds:Object.freeze({
    nvx:0,
    booster:18000/40000,
    rain:17000/40000,
    timeWarp:5000/40000
  })
});
