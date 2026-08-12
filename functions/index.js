const {onCall,HttpsError}=require("firebase-functions/v2/https");
const {setGlobalOptions}=require("firebase-functions/v2");
const {initializeApp}=require("firebase-admin/app");
const {getFirestore,FieldValue}=require("firebase-admin/firestore");

initializeApp();
const db=getFirestore();
setGlobalOptions({region:"us-central1",maxInstances:10});

const DAY=86400000, RATE=1, DAILY=5;

function uidOf(req){
  if(!req.auth?.uid) throw new HttpsError("unauthenticated","Please sign in first.");
  return req.auth.uid;
}
const ref=uid=>db.collection("users").doc(uid);

exports.startMiningSession=onCall(async req=>{
  const uid=uidOf(req), now=Date.now();
  return db.runTransaction(async tx=>{
    const r=ref(uid), s=await tx.get(r);
    if(!s.exists) throw new HttpsError("not-found","User profile not found.");
    const d=s.data()||{};
    if(d.miningActive) return {started:false,alreadyActive:true,startedAt:Number(d.miningStartedAt||now)};
    tx.update(r,{miningActive:true,miningStartedAt:now,miningLastUpdate:now});
    return {started:true,startedAt:now};
  });
});

exports.finishMiningSession=onCall(async req=>{
  const uid=uidOf(req), now=Date.now();
  return db.runTransaction(async tx=>{
    const r=ref(uid), s=await tx.get(r);
    if(!s.exists) throw new HttpsError("not-found","User profile not found.");
    const d=s.data()||{}, start=Number(d.miningStartedAt||0);
    if(!d.miningActive||!start) return {finished:false,balance:Number(d.balance||0),earned:0};
    const elapsed=Math.min(Math.max(now-start,0),DAY);
    const earned=elapsed/3600000*RATE;
    const balance=Number(d.balance||0)+earned;
    const totalMined=Number(d.totalMined||0)+earned;
    tx.update(r,{balance,totalMined,miningActive:false,miningStartedAt:0,miningLastUpdate:now});
    return {finished:true,balance,earned,totalMined};
  });
});

exports.claimDailyReward=onCall(async req=>{
  const uid=uidOf(req), now=Date.now();
  return db.runTransaction(async tx=>{
    const r=ref(uid), s=await tx.get(r);
    if(!s.exists) throw new HttpsError("not-found","User profile not found.");
    const d=s.data()||{}, last=Number(d.lastDailyReward||0);
    if(now-last<DAY) throw new HttpsError("failed-precondition","Daily reward already claimed. Please try again after 24 hours.");
    const streak0=Number(d.dailyRewardStreak||0);
    const streak=last>0&&now-last<=DAY*2?streak0+1:1;
    const balance=Number(d.balance||0)+DAILY;
    tx.update(r,{balance,lastDailyReward:now,dailyRewardStreak:streak});
    return {claimed:true,reward:DAILY,balance,streak};
  });
});

const TASKS={task1:10};
exports.completeTaskReward=onCall(async req=>{
  const uid=uidOf(req), taskId=String(req.data?.taskId||"");
  if(!(taskId in TASKS)) throw new HttpsError("invalid-argument","Unknown task.");
  return db.runTransaction(async tx=>{
    const r=ref(uid), s=await tx.get(r);
    if(!s.exists) throw new HttpsError("not-found","User profile not found.");
    const d=s.data()||{}, done={...(d.completedTasks||{})};
    if(done[taskId]) throw new HttpsError("already-exists","Task already completed.");
    done[taskId]=true;
    const reward=TASKS[taskId], balance=Number(d.balance||0)+reward;
    const tasksCompleted=Number(d.tasksCompleted||0)+1;
    tx.update(r,{balance,completedTasks:done,tasksCompleted});
    return {claimed:true,reward,balance,tasksCompleted};
  });
});

exports.getDepositAddress=onCall(async req=>{
  uidOf(req);
  const asset=String(req.data?.asset||"").toUpperCase();
  const network=String(req.data?.network||"");
  const raw=process.env.NEXUSNOVA_DEPOSIT_ADDRESSES_JSON||"";
  if(!raw) throw new HttpsError("failed-precondition","Deposit address service is not configured yet. No fake address will be generated.");
  let map; try{map=JSON.parse(raw);}catch{throw new HttpsError("internal","Deposit address configuration is invalid.");}
  const address=map?.[network]?.[asset]||"";
  if(!address) throw new HttpsError("failed-precondition",`No real deposit address is configured for ${asset} on ${network}.`);
  return {address,asset,network};
});

exports.requestWithdrawal=onCall(async req=>{
  const uid=uidOf(req);
  const asset=String(req.data?.asset||"").toUpperCase();
  const network=String(req.data?.network||"");
  const amount=String(req.data?.amount||"");
  const destination=String(req.data?.destination||"");
  if(!asset||!network||!/^\d+(\.\d+)?$/.test(amount)||Number(amount)<=0)
    throw new HttpsError("invalid-argument","Invalid withdrawal request.");
  if(!/^0x[a-fA-F0-9]{40}$/.test(destination))
    throw new HttpsError("invalid-argument","Invalid EVM destination address.");
  const doc=await db.collection("withdrawalRequests").add({
    uid,asset,network,amount,destination,status:"pending_review",
    createdAt:FieldValue.serverTimestamp()
  });
  return {requestId:doc.id,status:"pending_review"};
});
