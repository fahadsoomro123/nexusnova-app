const {onCall,HttpsError}=require("firebase-functions/v2/https");
const {setGlobalOptions}=require("firebase-functions/v2");
const {initializeApp}=require("firebase-admin/app");
const {getFirestore,FieldValue}=require("firebase-admin/firestore");

initializeApp();
const db=getFirestore();
setGlobalOptions({region:"us-central1",maxInstances:10});

const DAY=86400000, RATE=1, DAILY=5;
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
function decimalToMinorUnits(value,decimals=8){
  const raw=requestString(value,"amount",MAX_AMOUNT_LENGTH);
  const match=raw.match(/^(\d+)(?:\.(\d+))?$/);
  if(!match) throw new HttpsError("invalid-argument","Invalid amount.");
  const integer=match[1].replace(/^0+(?=\d)/,"");
  const fraction=match[2]||"";
  if(fraction.length>decimals){
    throw new HttpsError("invalid-argument",`Amount supports up to ${decimals} decimal places.`);
  }
  const padded=(fraction+"0".repeat(decimals)).slice(0,decimals);
  const combined=(integer+padded).replace(/^0+(?=\d)/,"")||"0";
  if(!DIGITS_PATTERN.test(combined)) throw new HttpsError("invalid-argument","Invalid amount.");
  return BigInt(combined);
}

exports.getPolicyDocument=onCall(async req=>{
  const name=requestString(req.data?.name,"policy name",64);
  const allowed=new Set(["privacy","terms"]);
  if(!allowed.has(name)) throw new HttpsError("invalid-argument","Unknown policy document.");
  const snap=await db.collection("policies").doc(name).get();
  if(!snap.exists) throw new HttpsError("not-found","Policy document not found.");
  const data=snap.data()||{};
  const body=String(data.body||"");
  if(Buffer.byteLength(body,"utf8")>MAX_POLICY_BYTES){
    throw new HttpsError("data-loss","Policy document is too large.");
  }
  return {name,title:String(data.title||name),body,updatedAt:data.updatedAt?.toMillis?.()||0};
});

exports.claimDailyReward=protectedCallable(async req=>{
  const uid=verifiedUidOf(req), now=Date.now(), ref=db.collection("users").doc(uid);
  return db.runTransaction(async tx=>{
    const snap=await tx.get(ref);
    if(!snap.exists) throw new HttpsError("not-found","User profile not found.");
    const data=snap.data()||{};
    const last=Number(data.lastDailyReward||0);
    if(last&&now-last<DAY){
      throw new HttpsError("failed-precondition","Daily reward is still on cooldown.");
    }
    const balance=profileNumber(data,"balance");
    const next=balance+DAILY;
    if(!Number.isSafeInteger(Math.round(next*1e8))){
      throw new HttpsError("out-of-range","Balance limit reached.");
    }
    const streak=Number.isFinite(Number(data.dailyRewardStreak))&&Number(data.dailyRewardStreak)>=0
      ?Number(data.dailyRewardStreak)+1:1;
    tx.update(ref,{balance:next,lastDailyReward:now,dailyRewardStreak:streak});
    return {balance:next,reward:DAILY,streak,lastDailyReward:now};
  });
});

exports.startMining=protectedCallable(async req=>{
  const uid=verifiedUidOf(req), now=Date.now(), ref=db.collection("users").doc(uid);
  return db.runTransaction(async tx=>{
    const snap=await tx.get(ref);
    if(!snap.exists) throw new HttpsError("not-found","User profile not found.");
    const data=snap.data()||{};
    const active=profileBoolean(data,"miningActive");
    const started=Number(data.miningStartedAt||0);
    if(active&&started>0&&now-started<DAY){
      throw new HttpsError("failed-precondition","Mining session is already active.");
    }
    let balance=profileNumber(data,"balance");
    let total=profileNumber(data,"totalMined");
    if(active&&started>0&&now-started>=DAY){
      balance+=DAY/3600000*RATE;
      total+=DAY/3600000*RATE;
    }
    tx.update(ref,{balance,totalMined:total,miningActive:true,miningStartedAt:now});
    return {balance,totalMined:total,miningActive:true,miningStartedAt:now};
  });
});

exports.completeTask=protectedCallable(async req=>{
  const uid=verifiedUidOf(req);
  const taskId=requestString(req.data?.taskId,"taskId",64);
  const allowed={task1:10};
  const reward=allowed[taskId];
  if(!reward) throw new HttpsError("invalid-argument","Unknown task.");
  const ref=db.collection("users").doc(uid);
  return db.runTransaction(async tx=>{
    const snap=await tx.get(ref);
    if(!snap.exists) throw new HttpsError("not-found","User profile not found.");
    const data=snap.data()||{};
    const completed=data.completedTasks&&typeof data.completedTasks==="object"
      ?data.completedTasks:{};
    if(completed[taskId]===true){
      throw new HttpsError("already-exists","Task already completed.");
    }
    const balance=profileNumber(data,"balance");
    const next=balance+reward;
    tx.update(ref,{
      balance:next,
      tasksCompleted:FieldValue.increment(1),
      [`completedTasks.${taskId}`]:true
    });
    return {balance:next,taskId,reward,tasksCompleted:Number(data.tasksCompleted||0)+1};
  });
});

exports.requestWithdrawal=protectedCallable(async req=>{
  const uid=verifiedUidOf(req);
  const asset=requestAsset(req.data?.asset);
  const network=requestNetwork(req.data?.network);
  const destination=requestString(req.data?.destination,"destination",MAX_DESTINATION_LENGTH);
  const amount=requestString(req.data?.amount,"amount",MAX_AMOUNT_LENGTH);
  const minor=decimalToMinorUnits(amount,8);
  if(minor<=0n) throw new HttpsError("invalid-argument","Amount must be greater than zero.");
  const now=Date.now();
  const profile=db.collection("users").doc(uid);
  const requests=db.collection("withdrawalRequests");
  const request=requests.doc();
  const throttle=db.collection("withdrawalRequestThrottle").doc(uid);
  await db.runTransaction(async tx=>{
    const profileSnapshot=await tx.get(profile);
    if(!profileSnapshot.exists) throw new HttpsError("not-found","User profile not found.");
    const throttleSnapshot=await tx.get(throttle);
    const previous=throttleSnapshot.exists
      ?profileNumber(throttleSnapshot.data(),"lastRequestAt")
      :0;
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