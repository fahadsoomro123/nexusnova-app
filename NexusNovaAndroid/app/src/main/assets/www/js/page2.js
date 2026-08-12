/* =========================================================
   FIREBASE IMPORTS
========================================================= */

import {
    initializeApp
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";

import {
    getAuth,
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

import {
    getFirestore,
    doc,
    getDoc,
    setDoc,
    updateDoc,
    runTransaction,
    collection,
    addDoc,
    query,
    orderBy,
    limit,
    onSnapshot,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

/* =========================================================
   FIREBASE CONFIG
========================================================= */

const firebaseConfig = {
    apiKey:"AIzaSyBU75WYp5ioaMD1LrNcDyAvROFW2wrTil0",
    authDomain:"nexusnova-6ade2.firebaseapp.com",
    projectId:"nexusnova-6ade2",
    storageBucket:"nexusnova-6ade2.firebasestorage.app",
    messagingSenderId:"49791194817",
    appId:"1:49791194817:web:07f28326e0f15979536640",
    measurementId:"G-YLPFKWSS12"
};

const app = initializeApp(firebaseConfig);

const auth = getAuth(app);
const db = getFirestore(app);


/* =========================================================
   GLOBAL STATE
========================================================= */

let currentUser = null;
let userData = {};

let nvxBalance = 0;

let miningActive = false;
let miningStart = 0;
let miningTimer = null;

let marketCoins = [];
let currencyRates = {};

let currentLatitude = null;
let currentLongitude = null;

let chatUnsubscribe = null;

let aiModel = null;
let aiChat = null;
let aiReady = false;


/* =========================================================
   AI INITIALIZATION
========================================================= */

(async function initNexusAI(){

    try{

        const {
            getAI,
            getGenerativeModel,
            GoogleAIBackend
        } = await import(
            "https://www.gstatic.com/firebasejs/12.1.0/firebase-ai.js"
        );

        const firebaseAI =
            getAI(
                app,
                {
                    backend:
                        new GoogleAIBackend()
                }
            );

        aiModel =
            getGenerativeModel(
                firebaseAI,
                {
                    model:"gemini-3.6-flash",

                    systemInstruction:{
                        parts:[
                            {
                                text:
                                "You are NexusNova AI, the built-in AI assistant of the NexusNova application. " +
                                "Be helpful, warm, natural and practical. " +
                                "Reply in the same language and script the user uses. " +
                                "For Urdu typed in Latin letters, reply in natural Roman Urdu. " +
                                "Keep answers conversational, not robotic, and use the NexusNova app context when relevant. " +
                                "Do not claim you performed an action unless you actually did it."
                            }
                        ]
                    },

                    generationConfig:{
                        temperature:0.7,
                        maxOutputTokens:700
                    }
                }
            );

        aiReady = true;

        setAIStatus(
            "Gemini AI connected",
            true
        );

    }catch(error){

        console.error(
            "Firebase AI Logic initialization error:",
            error
        );

        aiReady = false;

        setAIStatus(
            "Gemini AI unavailable",
            false
        );
    }

})();


/* =========================================================
   AI STATUS
========================================================= */

function setAIStatus(text,ok){

    const connection =
        document.getElementById(
            "aiConnectionText"
        );

    const status =
        document.getElementById(
            "aiStatus"
        );

    if(connection){

        connection.textContent = text;

        connection.classList.toggle(
            "ai-status-ok",
            Boolean(ok)
        );

        connection.classList.toggle(
            "ai-status-error",
            !ok
        );
    }

    if(status){

        status.textContent = text;

        status.style.color =
            ok
            ? "var(--success)"
            : "var(--danger)";
    }
}


/* =========================================================
   MORE MENU
========================================================= */

window.toggleMore = function(){

    const menu =
        document.getElementById(
            "moreMenu"
        );

    if(menu){
        menu.classList.toggle(
            "show"
        );
    }

};


window.openMoreTab = function(name){

    document
        .getElementById("moreMenu")
        ?.classList.remove("show");

    switchTab(name,null);
};


document.addEventListener(
    "click",
    function(event){

        const menu =
            document.getElementById(
                "moreMenu"
            );

        const moreBtn =
            document.getElementById(
                "moreBtn"
            );

        if(
            menu &&
            menu.classList.contains("show") &&
            !menu.contains(event.target) &&
            moreBtn &&
            !moreBtn.contains(event.target)
        ){

            menu.classList.remove(
                "show"
            );
        }

    }
);



/* =========================================================
   SETTINGS
========================================================= */

const NEXUS_SETTINGS_KEY = "nexusnova_settings";

function getNexusSettings(){
    try{
        return JSON.parse(
            localStorage.getItem(NEXUS_SETTINGS_KEY) || "{}"
        );
    }catch{
        return {};
    }
}

window.saveNexusSetting = function(key,value){
    const settings = getNexusSettings();
    settings[key] = value;
    localStorage.setItem(
        NEXUS_SETTINGS_KEY,
        JSON.stringify(settings)
    );
    applyNexusSettings();
};

function applyNexusSettings(){
    const settings = getNexusSettings();

    document.body.classList.toggle(
        "nexus-light",
        settings.theme === "light" ||
        (
            settings.theme === "system" &&
            window.matchMedia &&
            window.matchMedia("(prefers-color-scheme: light)").matches
        )
    );

    document.body.classList.toggle(
        "nexus-compact",
        settings.compact === true
    );

    const map = {
        themeSetting: ["theme","dark"],
        compactSetting: ["compact",false],
        notifyRewards: ["notifyRewards",true],
        notifyMining: ["notifyMining",true],
        notifyMarket: ["notifyMarket",false],
        aiLanguageSetting: ["aiLanguage","English"],
        aiVoiceSetting: ["aiVoice",true],
        appLanguageSetting: ["appLanguage","English"],
        currencySetting: ["currency","USD"]
    };

    Object.entries(map).forEach(([id,[key,def]])=>{
        const el = document.getElementById(id);
        if(!el) return;
        const value = settings[key] ?? def;
        if(el.type === "checkbox"){
            el.checked = Boolean(value);
        }else{
            el.value = value;
        }
    });
}

window.editSettingsProfile = async function(){
    if(!currentUser){
        alert("Account is not ready yet.");
        return;
    }

    const currentName =
        (userData && userData.name) ||
        currentUser.displayName ||
        "Miner User";

    const name = prompt(
        "Enter your display name:",
        currentName
    );

    if(name === null) return;

    const cleanName = name.trim();

    if(!cleanName){
        alert("Name cannot be empty.");
        return;
    }

    try{
        await updateDoc(
            doc(db,"users",currentUser.uid),
            {name:cleanName}
        );

        if(userData){
            userData.name = cleanName;
        }

        document.getElementById("settingsName").textContent =
            cleanName;

        document.getElementById("profileName").textContent =
            cleanName;

        alert("Profile updated.");
    }catch(error){
        console.error(error);
        alert("Could not update profile.");
    }
};

window.sendPasswordReset = async function(){
    if(!currentUser || !currentUser.email){
        alert("No account email is available.");
        return;
    }

    try{
        const { sendPasswordResetEmail } =
            await import("https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js");

        await sendPasswordResetEmail(
            auth,
            currentUser.email
        );

        alert(
            "Password reset email sent to " +
            currentUser.email
        );
    }catch(error){
        console.error(error);
        alert(
            error.message ||
            "Could not send password reset email."
        );
    }
};

window.clearNexusAIData = function(){
    if(!confirm(
        "Clear NexusNova AI data saved locally on this device?"
    )) return;

    const keys = [
        "nexusnova_ai_history",
        "nexusnova_ai_chat",
        "nexusnova_chat_history"
    ];

    keys.forEach(key=>localStorage.removeItem(key));

    alert("Local AI data cleared.");
};

window.requestNexusLocation = function(){
    if(!navigator.geolocation){
        alert("Location is not supported by this browser.");
        return;
    }

    navigator.geolocation.getCurrentPosition(
        position=>{
            alert(
                "Location permission is working.\n" +
                "Accuracy: " +
                Math.round(position.coords.accuracy) +
                " meters."
            );
        },
        error=>{
            alert(
                "Location permission was not granted: " +
                error.message
            );
        }
    );
};

window.checkNexusCamera = async function(){
    if(!navigator.mediaDevices?.getUserMedia){
        alert("Camera is not supported by this browser.");
        return;
    }

    try{
        const stream =
            await navigator.mediaDevices.getUserMedia({
                video:true
            });

        stream.getTracks().forEach(track=>track.stop());

        alert("Camera permission is working.");
    }catch(error){
        alert(
            "Camera permission was not granted: " +
            error.message
        );
    }
};

window.checkNexusMicrophone = async function(){
    if(!navigator.mediaDevices?.getUserMedia){
        alert("Microphone is not supported by this browser.");
        return;
    }

    try{
        const stream =
            await navigator.mediaDevices.getUserMedia({
                audio:true
            });

        stream.getTracks().forEach(track=>track.stop());

        alert("Microphone permission is working.");
    }catch(error){
        alert(
            "Microphone permission was not granted: " +
            error.message
        );
    }
};

window.sendNexusFeedback = function(){
    const subject = encodeURIComponent(
        "NexusNova Feedback"
    );

    const body = encodeURIComponent(
        "NexusNova feedback:\n\n"
    );

    window.location.href =
        "mailto:support@nexusnova.app" +
        "?subject=" + subject +
        "&body=" + body;
};

window.showNexusAbout = function(){
    alert(
        "NexusNova v6.1.0\n\n" +
        "All-in-one digital utility platform."
    );
};

function populateSettingsAccount(){
    const nameEl =
        document.getElementById("settingsName");

    const emailEl =
        document.getElementById("settingsEmail");

    if(nameEl){
        nameEl.textContent =
            (userData && userData.name) ||
            currentUser?.displayName ||
            "Miner User";
    }

    if(emailEl){
        emailEl.textContent =
            currentUser?.email ||
            "No email available";
    }

    applyNexusSettings();
}


/* =========================================================
   TAB SYSTEM
========================================================= */

window.switchTab = function(name,button){

    document
        .querySelectorAll(".tab")
        .forEach(
            x=>x.classList.remove("active")
        );

    const tab =
        document.getElementById(
            "tab-"+name
        );

    if(tab){
        tab.classList.add("active");
    }

    document
        .querySelectorAll(".dock-item")
        .forEach(
            x=>x.classList.remove("active")
        );

    if(button){
        button.classList.add("active");
    }

    const moreNames = [
        "finance",
        "news",
        "chat",
        "ai",
        "location",
        "emergency",
        "profile",
        "about"
    ];

    if(
        moreNames.includes(name)
    ){

        document
            .getElementById("moreBtn")
            ?.classList.add("active");
    }

    window.scrollTo({
        top:0,
        behavior:"smooth"
    });

    if(name === "market"){
        loadMarket();
    }

    if(name === "finance"){
        loadFinanceData();
    }

    if(name === "news"){
        loadNews();
    }

    if(name === "chat"){
        loadChat();
    }

    if(name === "emergency"){
        renderEmergencyContacts();
    }

    if(name === "about"){
        populateSettingsAccount();
    }

};


/* =========================================================
   AUTH
========================================================= */

onAuthStateChanged(
    auth,
    async user => {

        if(!user){

            window.location.replace(
                "./index.html"
            );

            return;
        }

        currentUser = user;

        await loadUserProfile();

        loadMarket();
        loadFinanceData();
        loadNews();
        loadChat();
        renderEmergencyContacts();

    }
);


/* =========================================================
   PROFILE
========================================================= */

async function loadUserProfile(){

    if(!currentUser){
        return;
    }

    const ref =
        doc(
            db,
            "users",
            currentUser.uid
        );

    try{

        const snap =
            await getDoc(ref);

        if(!snap.exists()){

            userData = {

                uid:currentUser.uid,

                name:
                    currentUser.displayName ||
                    "Miner User",

                email:
                    currentUser.email ||
                    "",

                balance:0,

                totalMined:0,

                tasksCompleted:0,

                completedTasks:{},

                miningActive:false,

                miningStartedAt:0,

                referralCode:
                    "NVX"+
                    currentUser.uid
                        .substring(0,8)
                        .toUpperCase(),

                createdAt:
                    serverTimestamp()
            };

            await setDoc(
                ref,
                userData
            );

        }else{

            userData = snap.data();

        }

        nvxBalance =
            Number(
                userData.balance || 0
            );

        miningActive =
            Boolean(
                userData.miningActive
            );

        miningStart =
            Number(
                userData.miningStartedAt || 0
            );

        updateUI();
        updateProfileUI();
        updateTaskButtons();
        updateDailyButton();

        if(miningActive){

            startMiningTicker();

        }

    }catch(error){

        console.error(
            "PROFILE ERROR:",
            error
        );

    }

}


/* =========================================================
   UI
========================================================= */

function updateUI(){

    const usd =
        nvxBalance * 0.10;

    document.getElementById(
        "balance"
    ).textContent =
        nvxBalance.toFixed(4);

    const walletBalanceEl = document.getElementById("walletBalance");
    if(walletBalanceEl){
        walletBalanceEl.textContent = nvxBalance.toFixed(4)+" NVX";
    }

    document.getElementById(
        "usdValue"
    ).textContent =
        "$ "+usd.toFixed(2)+" USD";

    const walletUsdEl = document.getElementById("walletUsd");
    if(walletUsdEl){
        walletUsdEl.textContent = "$ "+usd.toFixed(2)+" USD";
    }

}


function updateProfileUI(){

    if(!currentUser){
        return;
    }

    document.getElementById(
        "profileName"
    ).textContent =
        userData.name ||
        currentUser.displayName ||
        "Miner User";

    document.getElementById(
        "profileEmailDisplay"
    ).textContent =
        currentUser.email || "";

    document.getElementById(
        "profileId"
    ).textContent =
        currentUser.uid.substring(0,12)+"...";

    document.getElementById(
        "profileTotalMined"
    ).textContent =
        Number(
            userData.totalMined || 0
        ).toFixed(4)+" NVX";

    document.getElementById(
        "profileTasksDone"
    ).textContent =
        userData.tasksCompleted || 0;

    document.getElementById(
        "refCodeDisplay"
    ).textContent =
        userData.referralCode || "---";

}


/* =========================================================
   MINING
========================================================= */

document.getElementById("mineBtn").onclick = async function(){

    if(!currentUser){
        currentUser = auth.currentUser;
    }

    if(!currentUser){
        alert("Account is still loading. Please try again.");
        return;
    }

    if(miningActive){

        alert(
            "Mining session is already active."
        );

        return;
    }

    miningActive = true;
    miningStart = Date.now();

    // Update the visible miner immediately; Firestore persistence follows.
    startMiningTicker();

    try{

        await updateDoc(
            doc(
                db,
                "users",
                currentUser.uid
            ),
            {
                miningActive:true,
                miningStartedAt:miningStart,
                miningLastUpdate:miningStart
            }
        );

    }catch(error){

        console.error(
            "START MINING ERROR:",
            error
        );

        miningActive = false;
        miningStart = 0;
        clearInterval(miningTimer);

        const failedBtn = document.getElementById("mineBtn");
        const failedText = document.getElementById("btnText");
        const failedTimer = document.getElementById("timer");

        if(failedBtn) failedBtn.classList.remove("active");
        if(failedText) failedText.textContent = "START MINING";
        if(failedTimer) failedTimer.textContent = "MINER OFFLINE";

        alert(
            "Could not save the mining session. Check your Firebase connection."
        );

    }

};

function startMiningTicker(){

    clearInterval(
        miningTimer
    );

    const btn =
        document.getElementById(
            "mineBtn"
        );

    const text =
        document.getElementById(
            "btnText"
        );

    const timer =
        document.getElementById(
            "timer"
        );

    if(!miningActive){

        text.textContent =
            "START MINING";

        btn.classList.remove(
            "active"
        );

        timer.textContent =
            "MINER OFFLINE";

        return;
    }

    btn.classList.add(
        "active"
    );

    text.textContent =
        "MINING ACTIVE";

    const firstElapsed = Math.max(0, Date.now() - miningStart);
    const firstLeft = Math.max(0, (24*60*60*1000) - firstElapsed);
    const firstH = Math.floor(firstLeft/3600000);
    const firstM = Math.floor((firstLeft%3600000)/60000);
    const firstS = Math.floor((firstLeft%60000)/1000);

    timer.textContent =
        String(firstH).padStart(2,"0")+":"+
        String(firstM).padStart(2,"0")+":"+
        String(firstS).padStart(2,"0");

    miningTimer =
        setInterval(
            async function(){

                const elapsed =
                    Date.now() -
                    miningStart;

                const total =
                    24*60*60*1000;

                if(elapsed >= total){

                    await finishMining();

                    return;
                }

                const earned =
                    Math.max(
                        0,
                        (elapsed/3600000)*1
                    );

                const temporary =
                    nvxBalance + earned;

                const left =
                    total - elapsed;

                const h =
                    Math.floor(
                        left/3600000
                    );

                const m =
                    Math.floor(
                        (left%3600000)/60000
                    );

                const s =
                    Math.floor(
                        (left%60000)/1000
                    );

                timer.textContent =
                    String(h).padStart(2,"0")+":"+
                    String(m).padStart(2,"0")+":"+
                    String(s).padStart(2,"0");

                document.getElementById(
                    "balance"
                ).textContent =
                    temporary.toFixed(4);

                document.getElementById(
                    "walletBalance"
                ).textContent =
                    temporary.toFixed(4)+" NVX";

            },
            1000
        );

}


async function finishMining(){

    clearInterval(
        miningTimer
    );

    if(!currentUser){
        return;
    }

    const elapsed =
        Math.max(
            0,
            Date.now() - miningStart
        );

    const hours =
        Math.min(
            elapsed/3600000,
            24
        );

    const earned =
        hours * 1;

    nvxBalance += earned;

    miningActive = false;

    userData.totalMined =
        Number(
            userData.totalMined || 0
        ) + earned;

    try{

        await updateDoc(
            doc(
                db,
                "users",
                currentUser.uid
            ),
            {
                balance:nvxBalance,
                totalMined:userData.totalMined,
                miningActive:false,
                miningStartedAt:0,
                miningLastUpdate:Date.now()
            }
        );

    }catch(error){

        console.error(
            "FINISH MINING ERROR:",
            error
        );

        return;
    }

    updateUI();
    updateProfileUI();

    document.getElementById(
        "timer"
    ).textContent =
        "MINER OFFLINE";

    document.getElementById(
        "btnText"
    ).textContent =
        "START MINING";

    document.getElementById(
        "mineBtn"
    ).classList.remove(
        "active"
    );

    alert(
        "+"+earned.toFixed(4)+" NVX mined!"
    );

}


/* =========================================================
   DAILY REWARD + TASKS
========================================================= */

const DAILY_REWARD_MS =
    24 * 60 * 60 * 1000;

const DAILY_REWARD_BASE =
    5;

const COMMUNITY_TASK_REWARD =
    10;


/* =========================================================
   DAILY REWARD
========================================================= */

window.claimDailyReward =
    async function(){

        if(!currentUser){
            alert(
                "Please log in first."
            );
            return;
        }

        const button =
            document.getElementById(
                "dailyBtn"
            );

        if(button){
            button.disabled = true;
        }

        const userRef =
            doc(
                db,
                "users",
                currentUser.uid
            );

        try{

            const result =
                await runTransaction(
                    db,
                    async transaction => {

                        const snapshot =
                            await transaction.get(
                                userRef
                            );

                        const data =
                            snapshot.exists()
                            ? snapshot.data()
                            : {};

                        const now =
                            Date.now();

                        const last =
                            Number(
                                data.lastDailyReward || 0
                            );

                        if(
                            now - last <
                            DAILY_REWARD_MS
                        ){

                            return {
                                claimed:false,
                                balance:Number(
                                    data.balance || 0
                                ),
                                streak:Number(
                                    data.dailyRewardStreak || 1
                                )
                            };
                        }

                        const previousStreak =
                            Number(
                                data.dailyRewardStreak || 0
                            );

                        const oneDay =
                            DAILY_REWARD_MS;

                        const streak =
                            last > 0 &&
                            now - last <=
                            oneDay * 2
                            ? previousStreak + 1
                            : 1;

                        const bonus =
                            DAILY_REWARD_BASE;

                        const oldBalance =
                            Number(
                                data.balance || 0
                            );

                        const newBalance =
                            oldBalance + bonus;

                        transaction.update(
                            userRef,
                            {
                                balance:newBalance,
                                lastDailyReward:now,
                                dailyRewardStreak:streak
                            }
                        );

                        return {
                            claimed:true,
                            balance:newBalance,
                            streak:streak,
                            reward:bonus
                        };
                    }
                );

            if(!result.claimed){

                alert(
                    "Daily reward already claimed."
                );

                nvxBalance =
                    Number(
                        result.balance || nvxBalance
                    );

                userData.balance =
                    nvxBalance;

                updateUI();
                updateDailyButton();

                return;
            }

            nvxBalance =
                Number(
                    result.balance
                );

            userData.balance =
                nvxBalance;

            userData.lastDailyReward =
                Date.now();

            userData.dailyRewardStreak =
                Number(
                    result.streak || 1
                );

            updateUI();
            updateProfileUI();
            updateDailyButton();

            alert(
                "+"+
                Number(result.reward || DAILY_REWARD_BASE)
                    .toFixed(2)+
                " NVX added! 🔥\n"+
                "Daily streak: "+
                Number(result.streak || 1)
            );

        }catch(error){

            console.error(
                "DAILY REWARD ERROR:",
                error
            );

            alert(
                "Could not claim daily reward. Please try again."
            );

        }finally{

            updateDailyButton();

        }

    };


function updateDailyButton(){

    const btn =
        document.getElementById(
            "dailyBtn"
        );

    if(!btn){
        return;
    }

    const last =
        Number(
            userData.lastDailyReward || 0
        );

    const remaining =
        DAILY_REWARD_MS -
        (Date.now() - last);

    const ready =
        last <= 0 ||
        remaining <= 0;

    btn.disabled =
        !ready;

    if(ready){

        const streak =
            Number(
                userData.dailyRewardStreak || 0
            );

        btn.textContent =
            streak > 0
            ? "CLAIM DAILY BONUS (+5 NVX) • STREAK "+streak
            : "CLAIM DAILY BONUS (+5 NVX)";

        return;
    }

    const hours =
        Math.floor(
            remaining / 3600000
        );

    const minutes =
        Math.floor(
            (remaining % 3600000) /
            60000
        );

    btn.textContent =
        "NEXT DAILY BONUS • "+
        String(hours).padStart(2,"0")+
        "h "+
        String(minutes).padStart(2,"0")+
        "m";

}


/* =========================================================
   COMMUNITY TASK
========================================================= */

window.completeTask =
    async function(
        taskId,
        amount
    ){

        if(!currentUser){
            alert(
                "Please log in first."
            );
            return;
        }

        const reward =
            Number(amount);

        if(
            !taskId ||
            !Number.isFinite(reward) ||
            reward <= 0
        ){
            return;
        }

        const button =
            taskId === "task1"
            ? document.getElementById(
                "task1Btn"
            )
            : null;

        if(button){
            button.disabled = true;
            button.textContent =
                "VERIFYING...";
        }

        const userRef =
            doc(
                db,
                "users",
                currentUser.uid
            );

        try{

            const result =
                await runTransaction(
                    db,
                    async transaction => {

                        const snapshot =
                            await transaction.get(
                                userRef
                            );

                        const data =
                            snapshot.exists()
                            ? snapshot.data()
                            : {};

                        const completed =
                            {
                                ...(data.completedTasks || {})
                            };

                        if(completed[taskId]){

                            return {
                                claimed:false,
                                balance:Number(
                                    data.balance || 0
                                )
                            };
                        }

                        completed[taskId] =
                            true;

                        const oldBalance =
                            Number(
                                data.balance || 0
                            );

                        const newBalance =
                            oldBalance + reward;

                        const tasksCompleted =
                            Number(
                                data.tasksCompleted || 0
                            ) + 1;

                        transaction.update(
                            userRef,
                            {
                                balance:newBalance,
                                completedTasks:completed,
                                tasksCompleted:tasksCompleted
                            }
                        );

                        return {
                            claimed:true,
                            balance:newBalance,
                            tasksCompleted:
                                tasksCompleted
                        };
                    }
                );

            if(!result.claimed){

                alert(
                    "Task already completed."
                );

                userData.completedTasks =
                    {
                        ...(userData.completedTasks || {}),
                        [taskId]:true
                    };

                updateTaskButtons();

                return;
            }

            nvxBalance =
                Number(
                    result.balance
                );

            userData.balance =
                nvxBalance;

            userData.tasksCompleted =
                Number(
                    result.tasksCompleted || 0
                );

            userData.completedTasks =
                {
                    ...(userData.completedTasks || {}),
                    [taskId]:true
                };

            updateUI();
            updateProfileUI();
            updateTaskButtons();

            alert(
                "+"+
                reward.toFixed(2)+
                " NVX added! 🎁"
            );

        }catch(error){

            console.error(
                "TASK ERROR:",
                error
            );

            alert(
                "Task could not be completed. Please try again."
            );

        }finally{

            updateTaskButtons();

        }

    };


function updateTaskButtons(){

    const completed =
        userData.completedTasks || {};

    const btn =
        document.getElementById(
            "task1Btn"
        );

    if(btn){

        if(completed.task1){

            btn.textContent =
                "COMPLETED ✓";

            btn.disabled =
                true;

        }else{

            btn.textContent =
                "CLAIM +10 NVX";

            btn.disabled =
                false;
        }
    }

    const daily =
        document.getElementById(
            "dailyBtn"
        );

    if(daily){
        updateDailyButton();
    }

}


/* =========================================================
   WATCH AD
========================================================= */

window.watchAdReward =
    function(){

        alert(
            "Rewarded ads are not connected yet."
        );

    };


/* =========================================================
   REAL WALLET FOUNDATION
========================================================= */

const NEXUS_WALLET_ASSETS = [
    {id:"btc",symbol:"BTC",name:"Bitcoin",networks:["Bitcoin"],icon:"₿",decimals:8},
    {id:"eth",symbol:"ETH",name:"Ethereum",networks:["Ethereum"],icon:"Ξ",decimals:8},
    {id:"bnb",symbol:"BNB",name:"BNB",networks:["BNB Smart Chain"],icon:"◆",decimals:8},
    {id:"sol",symbol:"SOL",name:"Solana",networks:["Solana"],icon:"S",decimals:8},
    {id:"xrp",symbol:"XRP",name:"XRP",networks:["XRP Ledger"],icon:"X",decimals:6},
    {id:"ada",symbol:"ADA",name:"Cardano",networks:["Cardano"],icon:"A",decimals:6},
    {id:"doge",symbol:"DOGE",name:"Dogecoin",networks:["Dogecoin"],icon:"Ð",decimals:6},
    {id:"trx",symbol:"TRX",name:"TRON",networks:["TRON"],icon:"T",decimals:6},
    {id:"avax",symbol:"AVAX",name:"Avalanche",networks:["Avalanche C-Chain"],icon:"A",decimals:6},
    {id:"link",symbol:"LINK",name:"Chainlink",networks:["Ethereum (ERC-20)"],icon:"L",decimals:6},
    {id:"dot",symbol:"DOT",name:"Polkadot",networks:["Polkadot"],icon:"D",decimals:6},
    {id:"ltc",symbol:"LTC",name:"Litecoin",networks:["Litecoin"],icon:"Ł",decimals:8},
    {id:"bch",symbol:"BCH",name:"Bitcoin Cash",networks:["Bitcoin Cash"],icon:"B",decimals:8},
    {id:"ton",symbol:"TON",name:"Toncoin",networks:["TON"],icon:"T",decimals:6},
    {id:"usdt",symbol:"USDT",name:"Tether",networks:["Ethereum (ERC-20)","BNB Smart Chain (BEP-20)","TRON (TRC-20)"],icon:"₮",decimals:6},
    {id:"usdc",symbol:"USDC",name:"USD Coin",networks:["Ethereum (ERC-20)","BNB Smart Chain (BEP-20)"],icon:"$",decimals:6}
];

let nexusWalletPrices = {};
let nexusWalletBalances = {};
let nexusWalletInitialized = false;

function getWalletStorageKey(){
    return currentUser
        ? "nexusnova_wallet_preferences_"+currentUser.uid
        : "nexusnova_wallet_preferences_guest";
}

function getWalletPreferences(){

    try{

        const raw =
            localStorage.getItem(
                getWalletStorageKey()
            );

        return raw
            ? JSON.parse(raw)
            : {
                hiddenAssets:{}
            };

    }catch{
        return {
            hiddenAssets:{}
        };
    }
}

function saveWalletPreferences(
    preferences
){

    try{

        localStorage.setItem(
            getWalletStorageKey(),
            JSON.stringify(
                preferences
            )
        );

    }catch(error){

        console.warn(
            "Wallet preference save failed:",
            error
        );
    }
}

function getWalletAsset(
    symbol
){

    return NEXUS_WALLET_ASSETS.find(
        asset =>
            asset.symbol ===
            String(symbol).toUpperCase()
    );
}

function getWalletPrice(
    symbol
){

    return Number(
        nexusWalletPrices[
            String(symbol).toLowerCase()
        ] || 0
    );
}

function renderWalletFoundation(){

    const list =
        document.getElementById(
            "walletAssetList"
        );

    if(!list){
        return;
    }

    const preferences =
        getWalletPreferences();

    list.innerHTML =
        NEXUS_WALLET_ASSETS.map(
            asset => {

                const externalConnected =
                    Boolean(
                        window.nexusConnectedAddress ||
                        window.ethereum?.selectedAddress
                    );

                const onchainCache =
                    window.__nexusOnchainVisibleBalances || {};

                const hasOnchainValue =
                    externalConnected &&
                    Object.prototype.hasOwnProperty.call(
                        onchainCache,
                        asset.symbol
                    );

                const balance =
                    hasOnchainValue
                    ? Number(onchainCache[asset.symbol] || 0)
                    : Number(
                        nexusWalletBalances[
                            asset.symbol
                        ] || 0
                    );

                const price =
                    getWalletPrice(
                        asset.symbol
                    );

                const usd =
                    balance * price;

                const chainId = String(window.nexusConnectedChainId || "").toLowerCase();
                const supportedNative = {
                    "0x1":"ETH",
                    "0x38":"BNB",
                    "0x89":"MATIC",
                    "0xa4b1":"ETH",
                    "0xa":"ETH",
                    "0x2105":"ETH"
                };
                const nativeForChain = supportedNative[chainId] || "";
                const supportedToken = (asset.symbol === "USDT" || asset.symbol === "USDC");
                const isPotentiallyReadable =
                    externalConnected &&
                    (asset.symbol === nativeForChain || supportedToken);

                const readStatus = window.__nexusOnchainReadStatus || {};

                // Always show live USD price. Balance is separate.
                const priceText =
                    price > 0
                    ? "$" + (
                        price >= 1
                        ? price.toLocaleString(undefined, { maximumFractionDigits: 2 })
                        : price.toLocaleString(undefined, { maximumFractionDigits: 6 })
                      )
                    : "Price…";

                let balText;
                if (hasOnchainValue) {
                    balText = balance.toFixed(Math.min(asset.decimals, 6)) + " " + asset.symbol;
                } else if (externalConnected && isPotentiallyReadable) {
                    balText = (readStatus[asset.symbol] === "error")
                        ? "Balance unavailable"
                        : "Reading balance…";
                } else if (Number(balance) > 0) {
                    balText = Number(balance).toFixed(Math.min(asset.decimals, 6)) + " " + asset.symbol;
                } else {
                    balText = "0 " + asset.symbol;
                }

                const valueText =
                    (hasOnchainValue || Number(balance) > 0) && price > 0
                    ? "≈ $" + (Number(balance) * price).toFixed(2)
                    : "";

                const hidden =
                    preferences.hiddenAssets?.[
                        asset.id
                    ] === true;

                return `
                <div
                    class="coin-row"
                    data-symbol="${asset.symbol}"
                    style="cursor:default"
                >

                    <div
                        style="
                            width:34px;
                            height:34px;
                            border-radius:50%;
                            background:#182234;
                            display:flex;
                            align-items:center;
                            justify-content:center;
                            font-weight:700;
                            color:#00f5d4;
                        "
                    >
                        ${asset.icon}
                    </div>

                    <div
                        style="flex:1;min-width:0;margin-left:9px"
                    >

                        <div class="coin-name">
                            ${escapeHTML(asset.name)}
                        </div>

                        <div class="coin-symbol">
                            ${escapeHTML(asset.symbol)}
                            •
                            ${escapeHTML(asset.networks[0])}
                        </div>

                    </div>

                    <div class="wallet-row-right" style="text-align:right;min-width:120px">
                        <div class="wallet-live-price" style="font-weight:800;color:#00e5a8;font-size:15px">
                            ${hidden ? "Hidden" : priceText}
                        </div>
                        <div class="wallet-live-balance" style="font-size:13px;font-weight:600;color:#ffffff;margin-top:4px">
                            ${hidden ? "" : balText}
                        </div>
                        <div class="wallet-live-usd" style="font-size:11px;color:#a0aec0;margin-top:2px">
                            ${hidden ? "" : valueText}
                        </div>
                    </div>

                </div>
                `;
            }
        ).join("");

    updateWalletTotal();
    window.__nexusPrimaryWalletRenderer = renderWalletFoundation;
}

function updateWalletTotal(){

    const total =
        NEXUS_WALLET_ASSETS.reduce(
            (sum, asset) => {
                const cache =
                    window.__nexusOnchainVisibleBalances || {};

                const connected =
                    Boolean(
                        window.nexusConnectedAddress ||
                        window.ethereum?.selectedAddress
                    );

                const amount =
                    connected &&
                    Object.prototype.hasOwnProperty.call(cache, asset.symbol)
                    ? Number(cache[asset.symbol] || 0)
                    : Number(
                        nexusWalletBalances[asset.symbol] || 0
                    );

                return sum +
                    amount *
                    getWalletPrice(asset.symbol);
            },
            0
        );

    const el =
        document.getElementById(
            "walletTotalUsd"
        );

    if(el){

        el.textContent =
            "$ "+
            total.toLocaleString(
                undefined,
                {
                    minimumFractionDigits:2,
                    maximumFractionDigits:2
                }
            );
    }
}

async function refreshWalletFoundation(){

    const list = document.getElementById("walletAssetList");

    if(list){
        list.innerHTML =
            '<div class="status">Loading live crypto prices...</div>';
    }

    const symbols = [
        "BTCUSDT","ETHUSDT","BNBUSDT","SOLUSDT",
        "XRPUSDT","ADAUSDT","DOGEUSDT","TRXUSDT",
        "AVAXUSDT","LINKUSDT","DOTUSDT","LTCUSDT",
        "BCHUSDT","TONUSDT","USDTUSDT","USDCUSDT"
    ];

    const priceMap = {};

    // Primary: Binance public ticker. No API key required.
    try{

        const response = await fetch(
            "https://api.binance.com/api/v3/ticker/price",
            {cache:"no-store"}
        );

        if(response.ok){

            const rows = await response.json();

            rows.forEach(row => {

                const symbol =
                    String(row.symbol || "").toUpperCase();

                if(symbols.includes(symbol)){
                    const base =
                        symbol.replace("USDT","");
                    priceMap[base.toLowerCase()] =
                        Number(row.price || 0);
                }

            });

        }

    }catch(error){

        console.warn(
            "Binance wallet prices unavailable:",
            error
        );
    }

    // Stablecoins always have a USD reference around 1.
    priceMap.usdt = priceMap.usdt || 1;
    priceMap.usdc = priceMap.usdc || 1;

    // Fallback for environments where Binance is blocked.
    if(
        !priceMap.btc &&
        !priceMap.eth &&
        !priceMap.bnb
    ){

        try{

            const response = await fetch(
                "https://api.coingecko.com/api/v3/simple/price"+
                "?ids=bitcoin,ethereum,binancecoin,solana,ripple,"+
                "cardano,dogecoin,tron,avalanche-2,chainlink,"+
                "polkadot,litecoin,bitcoin-cash,the-open-network,"+
                "tether,usd-coin"+
                "&vs_currencies=usd",
                {cache:"no-store"}
            );

            if(response.ok){

                const data = await response.json();

                Object.assign(
                    priceMap,
                    {
                        btc:Number(data.bitcoin?.usd || 0),
                        eth:Number(data.ethereum?.usd || 0),
                        bnb:Number(data.binancecoin?.usd || 0),
                        sol:Number(data.solana?.usd || 0),
                        xrp:Number(data.ripple?.usd || 0),
                        ada:Number(data.cardano?.usd || 0),
                        doge:Number(data.dogecoin?.usd || 0),
                        trx:Number(data.tron?.usd || 0),
                        avax:Number(data["avalanche-2"]?.usd || 0),
                        link:Number(data.chainlink?.usd || 0),
                        dot:Number(data.polkadot?.usd || 0),
                        ltc:Number(data.litecoin?.usd || 0),
                        bch:Number(data["bitcoin-cash"]?.usd || 0),
                        ton:Number(data["the-open-network"]?.usd || 0),
                        usdt:Number(data.tether?.usd || 1),
                        usdc:Number(data["usd-coin"]?.usd || 1)
                    }
                );
            }

        }catch(error){

            console.warn(
                "CoinGecko wallet fallback unavailable:",
                error
            );
        }
    }

    nexusWalletPrices = priceMap;

    renderWalletFoundation();

    const status =
        document.getElementById(
            "walletActionStatus"
        );

    if(status){

        const live =
            Object.keys(priceMap).filter(
                key => Number(priceMap[key]) > 0
            ).length;

        status.textContent =
            live > 0
            ? "Live crypto prices connected • "+
              live+" assets"
            : "Live price services are temporarily unavailable.";
    }
}

window.refreshWalletFoundation =
    refreshWalletFoundation;


    /* =========================================================
   WALLET DEPOSIT / WITHDRAW UI
   - No legacy alert popups.
   - No fake blockchain transaction.
   - Deposit address is only shown when a real backend address
     is configured.
   - Withdrawal creates a request record; actual signing must
     happen server-side.
========================================================= */

function nexusWalletModal(title, body){

    document.getElementById("nexusWalletModal")?.remove();

    const overlay = document.createElement("div");
    overlay.id = "nexusWalletModal";

    overlay.style.cssText =
        "position:fixed;inset:0;z-index:99999;" +
        "background:rgba(0,0,0,.76);" +
        "display:flex;align-items:center;justify-content:center;" +
        "padding:18px;";

    overlay.innerHTML = `
        <div style="
            width:min(460px,100%);
            max-height:90vh;
            overflow:auto;
            background:#101827;
            color:#fff;
            border:1px solid #334155;
            border-radius:16px;
            padding:20px;
            box-shadow:0 25px 80px rgba(0,0,0,.55);
        ">
            <div style="
                display:flex;
                align-items:center;
                justify-content:space-between;
                margin-bottom:16px;
            ">
                <h2 style="margin:0;font-size:20px">
                    ${nexusEscapeText(title)}
                </h2>

                <button
                    id="nexusWalletModalClose"
                    type="button"
                    style="
                        border:0;
                        background:transparent;
                        color:#94a3b8;
                        font-size:27px;
                        cursor:pointer;
                    "
                >×</button>
            </div>

            ${body}
        </div>
    `;

    document.body.appendChild(overlay);

    document
        .getElementById("nexusWalletModalClose")
        ?.addEventListener(
            "click",
            () => overlay.remove()
        );

    overlay.addEventListener(
        "click",
        event => {
            if(event.target === overlay){
                overlay.remove();
            }
        }
    );

    return overlay;
}


function nexusEscapeText(value){

    return String(value ?? "")
        .replace(/[&<>"']/g, char => ({
            "&":"&amp;",
            "<":"&lt;",
            ">":"&gt;",
            '"':"&quot;",
            "'":"&#39;"
        }[char]));

}


function nexusWalletNetworks(){

    return {
        "Ethereum Mainnet":"0x1",
        "BNB Smart Chain":"0x38",
        "Polygon":"0x89",
        "Arbitrum One":"0xa4b1",
        "Optimism":"0xa",
        "Base":"0x2105"
    };

}


function nexusConnectedWalletAddress(){

    return (
        window.nexusConnectedAddress ||
        window.ethereum?.selectedAddress ||
        ""
    );

}


window.handleDeposit = function(){

    const address =
        nexusConnectedWalletAddress();

    const chainId =
        String(
            window.nexusConnectedChainId ||
            ""
        ).toLowerCase();

    const networks =
        nexusWalletNetworks();

    const network =
        Object.keys(networks)
            .find(
                name =>
                    networks[name] === chainId
            ) ||
        "Ethereum Mainnet";


    if(!address){

        nexusWalletModal(
            "Deposit",
            `
            <div style="
                padding:14px;
                border-radius:10px;
                background:#0b1220;
                color:#fbbf24;
                line-height:1.55;
            ">
                🔐 Connect your Rabby/MetaMask wallet first.
            </div>
            `
        );

        return;
    }


    nexusWalletModal(
        "Deposit",
        `
        <div style="
            padding:12px;
            border-radius:10px;
            background:#0b1220;
            color:#94a3b8;
            line-height:1.5;
            margin-bottom:14px;
        ">
            Select the asset and network. A <strong>real NexusNova
            deposit address</strong> will only be shown when it has been
            configured in the secure backend.
        </div>

        <label style="font-size:13px">
            Asset
        </label>

        <select
            id="nexusDepositAsset"
            style="
                width:100%;
                padding:11px;
                margin:6px 0 14px;
                border-radius:10px;
                border:1px solid #334155;
                background:#0f172a;
                color:#fff;
            "
        >
            <option>USDT</option>
            <option>USDC</option>
            <option>ETH</option>
            <option>BNB</option>
        </select>

        <label style="font-size:13px">
            Network
        </label>

        <select
            id="nexusDepositNetwork"
            style="
                width:100%;
                padding:11px;
                margin:6px 0 14px;
                border-radius:10px;
                border:1px solid #334155;
                background:#0f172a;
                color:#fff;
            "
        >
            ${Object.keys(networks)
                .map(
                    name =>
                        `<option ${
                            name === network
                            ? "selected"
                            : ""
                        }>${nexusEscapeText(name)}</option>`
                )
                .join("")}
        </select>

        <button
            id="nexusGetDepositAddress"
            type="button"
            style="
                width:100%;
                padding:13px;
                border:0;
                border-radius:10px;
                background:#00d9b5;
                color:#061016;
                font-weight:700;
                cursor:pointer;
            "
        >
            Get Deposit Address
        </button>

        <div
            id="nexusDepositResult"
            style="
                margin-top:14px;
                padding:12px;
                border-radius:10px;
                background:#07101d;
                color:#94a3b8;
                font-size:13px;
                line-height:1.5;
            "
        >
            No deposit address has been requested yet.
        </div>
        `
    );


    document
        .getElementById("nexusGetDepositAddress")
        ?.addEventListener(
            "click",
            async () => {

                const result =
                    document.getElementById(
                        "nexusDepositResult"
                    );

                const asset =
                    document.getElementById(
                        "nexusDepositAsset"
                    )?.value;

                const selectedNetwork =
                    document.getElementById(
                        "nexusDepositNetwork"
                    )?.value;

                if(!result || !asset || !selectedNetwork){
                    return;
                }

                result.textContent =
                    "Checking secure deposit configuration...";


                /*
                 * A real deposit address must come from the backend.
                 * We deliberately do not use the user's connected wallet
                 * as a fake NexusNova deposit address.
                 */

                try{

                    const addressMapRef =
                        doc(
                            db,
                            "system",
                            "walletDepositAddresses"
                        );

                    const snapshot =
                        await getDoc(
                            addressMapRef
                        );

                    const data =
                        snapshot.exists()
                        ? snapshot.data()
                        : {};

                    const key =
                        `${selectedNetwork}:${asset}`;

                    const depositAddress =
                        data[key] ||
                        data?.addresses?.[key] ||
                        "";

                    if(!depositAddress){

                        result.innerHTML = `
                            <span style="color:#fbbf24">
                                Deposit address is not configured yet for
                                ${nexusEscapeText(asset)} on
                                ${nexusEscapeText(selectedNetwork)}.
                            </span>
                            <br><br>
                            No fake address has been generated.
                        `;

                        return;
                    }


                    result.innerHTML = `
                        <div style="
                            color:#22c55e;
                            margin-bottom:8px;
                        ">
                            ✓ Real deposit address
                        </div>

                        <div style="
                            word-break:break-all;
                            font-family:monospace;
                            color:#fff;
                            margin-bottom:10px;
                        ">
                            ${nexusEscapeText(depositAddress)}
                        </div>

                        <button
                            id="nexusCopyDepositAddress"
                            type="button"
                            style="
                                width:100%;
                                padding:10px;
                                border-radius:9px;
                                border:1px solid #00d9b5;
                                background:transparent;
                                color:#00d9b5;
                                cursor:pointer;
                            "
                        >
                            📋 Copy Address
                        </button>
                    `;


                    document
                        .getElementById(
                            "nexusCopyDepositAddress"
                        )
                        ?.addEventListener(
                            "click",
                            async () => {

                                try{

                                    await navigator
                                        .clipboard
                                        .writeText(
                                            depositAddress
                                        );

                                    const button =
                                        document
                                            .getElementById(
                                                "nexusCopyDepositAddress"
                                            );

                                    if(button){
                                        button.textContent =
                                            "✓ Address Copied";
                                    }

                                }catch(error){

                                    console.warn(
                                        "NexusNova copy deposit address:",
                                        error
                                    );

                                }

                            }
                        );


                    const status =
                        document.getElementById(
                            "walletActionStatus"
                        );

                    if(status){

                        status.innerHTML =
                            `
                            <strong>Deposit address ready</strong><br>
                            ${nexusEscapeText(asset)}
                            •
                            ${nexusEscapeText(selectedNetwork)}
                            `;

                    }

                }catch(error){

                    console.error(
                        "NexusNova deposit configuration:",
                        error
                    );

                    result.innerHTML = `
                        <span style="color:#f87171">
                            Deposit service is temporarily unavailable.
                        </span>
                    `;

                }

            }
        );

};


window.handleWithdraw = function(){

    const address =
        nexusConnectedWalletAddress();


    nexusWalletModal(
        "Withdraw",
        `
        <div style="
            padding:12px;
            border-radius:10px;
            background:#0b1220;
            color:#94a3b8;
            line-height:1.5;
            margin-bottom:14px;
        ">
            Enter the withdrawal details below.
            The request will be recorded securely; no fake blockchain
            transaction will be shown as completed.
        </div>

        <label style="font-size:13px">
            Asset
        </label>

        <select
            id="nexusWithdrawAsset"
            style="
                width:100%;
                padding:11px;
                margin:6px 0 14px;
                border-radius:10px;
                border:1px solid #334155;
                background:#0f172a;
                color:#fff;
            "
        >
            <option>USDT</option>
            <option>USDC</option>
            <option>ETH</option>
            <option>BNB</option>
        </select>

        <label style="font-size:13px">
            Network
        </label>

        <select
            id="nexusWithdrawNetwork"
            style="
                width:100%;
                padding:11px;
                margin:6px 0 14px;
                border-radius:10px;
                border:1px solid #334155;
                background:#0f172a;
                color:#fff;
            "
        >
            ${Object.keys(nexusWalletNetworks())
                .map(
                    name =>
                        `<option>${nexusEscapeText(name)}</option>`
                )
                .join("")}
        </select>

        <label style="font-size:13px">
            Amount
        </label>

        <input
            id="nexusWithdrawAmount"
            type="number"
            min="0"
            step="any"
            placeholder="0.00"
            style="
                width:100%;
                padding:11px;
                margin:6px 0 14px;
                border-radius:10px;
                border:1px solid #334155;
                background:#0f172a;
                color:#fff;
            "
        >

        <label style="font-size:13px">
            Destination wallet address
        </label>

        <input
            id="nexusWithdrawDestination"
            type="text"
            value="${nexusEscapeText(address)}"
            placeholder="0x..."
            style="
                width:100%;
                padding:11px;
                margin:6px 0 14px;
                border-radius:10px;
                border:1px solid #334155;
                background:#0f172a;
                color:#fff;
            "
        >

        <button
            id="nexusSubmitWithdrawal"
            type="button"
            style="
                width:100%;
                padding:13px;
                border:0;
                border-radius:10px;
                background:#00d9b5;
                color:#061016;
                font-weight:700;
                cursor:pointer;
            "
        >
            Submit Withdrawal Request
        </button>

        <div
            id="nexusWithdrawResult"
            style="
                margin-top:14px;
                padding:12px;
                border-radius:10px;
                background:#07101d;
                color:#94a3b8;
                font-size:13px;
                line-height:1.5;
            "
        >
            No request submitted yet.
        </div>
        `
    );


    document
        .getElementById("nexusSubmitWithdrawal")
        ?.addEventListener(
            "click",
            async () => {

                const result =
                    document.getElementById(
                        "nexusWithdrawResult"
                    );

                const asset =
                    document.getElementById(
                        "nexusWithdrawAsset"
                    )?.value;

                const network =
                    document.getElementById(
                        "nexusWithdrawNetwork"
                    )?.value;

                const amount =
                    document.getElementById(
                        "nexusWithdrawAmount"
                    )?.value
                    ?.trim();

                const destination =
                    document.getElementById(
                        "nexusWithdrawDestination"
                    )?.value
                    ?.trim();


                if(!amount || Number(amount) <= 0){

                    if(result){
                        result.innerHTML =
                            `<span style="color:#f87171">
                                Enter a valid amount.
                            </span>`;
                    }

                    return;

                }


                if(
                    !/^0x[a-fA-F0-9]{40}$/
                        .test(destination || "")
                ){

                    if(result){
                        result.innerHTML =
                            `<span style="color:#f87171">
                                Enter a valid EVM destination address.
                            </span>`;
                    }

                    return;

                }


                if(!currentUser){

                    if(result){
                        result.innerHTML =
                            `<span style="color:#f87171">
                                Please log in before submitting a withdrawal.
                            </span>`;
                    }

                    return;

                }


                if(result){
                    result.textContent =
                        "Submitting secure withdrawal request...";
                }


                try{

                    const requestRef =
                        await addDoc(
                            collection(
                                db,
                                "withdrawalRequests"
                            ),
                            {
                                uid:currentUser.uid,
                                email:currentUser.email || "",
                                asset,
                                network,
                                amount:String(amount),
                                destination,
                                status:"pending",
                                createdAt:serverTimestamp()
                            }
                        );


                    if(result){

                        result.innerHTML = `
                            <span style="color:#22c55e">
                                ✓ Withdrawal request submitted.
                            </span>
                            <br>
                            Request ID:
                            ${nexusEscapeText(requestRef.id)}
                            <br><br>
                            Status: <strong>Pending</strong>
                            <br><br>
                            No blockchain transaction has been falsely
                            marked as completed.
                        `;

                    }


                    const status =
                        document.getElementById(
                            "walletActionStatus"
                        );

                    if(status){

                        status.innerHTML =
                            `
                            <strong>Withdrawal request submitted</strong><br>
                            ${nexusEscapeText(asset)}
                            •
                            ${nexusEscapeText(amount)}
                            ${nexusEscapeText(network)}
                            • Pending
                            `;

                    }

                }catch(error){

                    console.error(
                        "NexusNova withdrawal request:",
                        error
                    );

                    if(result){

                        result.innerHTML =
                            `
                            <span style="color:#f87171">
                                Withdrawal request could not be saved.
                                Please check your Firebase connection/rules.
                            </span>
                            `;

                    }

                }

            }
        );

};


/* End wallet actions */

function initWalletFoundation(){

    if(nexusWalletInitialized){
        renderWalletFoundation();
        return;
    }

    nexusWalletInitialized = true;

    nexusWalletBalances = {};

    NEXUS_WALLET_ASSETS.forEach(
        asset => {
            nexusWalletBalances[
                asset.symbol
            ] = 0;
        }
    );

    renderWalletFoundation();

    refreshWalletFoundation();
}

window.initWalletFoundation =
    initWalletFoundation;



/* =========================================================
   MARKET
========================================================= */

async function loadMarket(){

    const marketList =
        document.getElementById("marketList");

    const marketStatus =
        document.getElementById("marketStatus");

    try{

        const response = await fetch(
            "https://api.binance.com/api/v3/ticker/24hr",
            {cache:"no-store"}
        );

        if(!response.ok){
            throw new Error(
                "Binance market request failed: "+
                response.status
            );
        }

        const rows = await response.json();

        const wanted = new Set([
            "BTCUSDT","ETHUSDT","BNBUSDT","SOLUSDT",
            "XRPUSDT","ADAUSDT","DOGEUSDT","TRXUSDT",
            "AVAXUSDT","LINKUSDT","DOTUSDT","LTCUSDT",
            "BCHUSDT","TONUSDT","SHIBUSDT","PEPEUSDT",
            "SUIUSDT","NEARUSDT","APTUSDT","ATOMUSDT",
            "UNIUSDT","AAVEUSDT","ETCUSDT","FILUSDT",
            "ALGOUSDT","VETUSDT","HBARUSDT","XLMUSDT"
        ]);

        const names = {
            BTC:"Bitcoin",ETH:"Ethereum",BNB:"BNB",
            SOL:"Solana",XRP:"XRP",ADA:"Cardano",
            DOGE:"Dogecoin",TRX:"TRON",AVAX:"Avalanche",
            LINK:"Chainlink",DOT:"Polkadot",LTC:"Litecoin",
            BCH:"Bitcoin Cash",TON:"Toncoin",SHIB:"Shiba Inu",
            PEPE:"Pepe",SUI:"Sui",NEAR:"NEAR Protocol",
            APT:"Aptos",ATOM:"Cosmos",UNI:"Uniswap",
            AAVE:"Aave",ETC:"Ethereum Classic",FIL:"Filecoin",
            ALGO:"Algorand",VET:"VeChain",HBAR:"Hedera",
            XLM:"Stellar"
        };

        marketCoins =
            rows
            .filter(row =>
                wanted.has(
                    String(row.symbol || "").toUpperCase()
                )
            )
            .map((row,index) => {

                const pair =
                    String(row.symbol || "").toUpperCase();

                const base =
                    pair.replace("USDT","");

                return {
                    id:base.toLowerCase(),
                    symbol:base,
                    name:names[base] || base,
                    current_price:Number(row.lastPrice || 0),
                    price_change_percentage_24h:
                        Number(row.priceChangePercent || 0),
                    market_cap_rank:index+1
                };

            })
            .sort(
                (a,b) =>
                    (a.market_cap_rank || 999) -
                    (b.market_cap_rank || 999)
            );

        renderMarket(marketCoins);

        if(typeof refreshWalletFoundation === "function"){
            refreshWalletFoundation();
        }

        const count =
            document.getElementById(
                "marketCount"
            );

        if(count){
            count.textContent =
                marketCoins.length+
                " live pairs";
        }

        if(marketStatus){
            marketStatus.textContent =
                "Connected • Live";
        }

        return;

    }catch(error){

        console.warn(
            "Binance market unavailable:",
            error
        );
    }

    // Secondary market source.
    try{

        const response = await fetch(
            "https://api.coingecko.com/api/v3/coins/markets"+
            "?vs_currency=usd&order=market_cap_desc"+
            "&per_page=100&page=1&sparkline=false",
            {cache:"no-store"}
        );

        if(!response.ok){
            throw new Error(
                "CoinGecko market request failed"
            );
        }

        marketCoins =
            await response.json();

        renderMarket(
            marketCoins
        );

        if(typeof refreshWalletFoundation === "function"){
            refreshWalletFoundation();
        }

        const count =
            document.getElementById(
                "marketCount"
            );

        if(count){
            count.textContent =
                "Top "+
                marketCoins.length+
                " coins loaded";
        }

        if(marketStatus){
            marketStatus.textContent =
                "Connected";
        }

    }catch(error){

        console.error(
            "MARKET ERROR:",
            error
        );

        if(marketList){
            marketList.innerHTML =
                '<div class="status">Live market temporarily unavailable. Tap Refresh to retry.</div>';
        }

        if(marketStatus){
            marketStatus.textContent =
                "Offline";
        }
    }
}

window.loadMarket =
    loadMarket;


function renderMarket(coins){

    const list =
        document.getElementById(
            "marketList"
        );

    if(!coins.length){

        list.innerHTML =
            '<div class="status">No coins found.</div>';

        return;
    }

    list.innerHTML =
        coins.map(
            (coin,index)=>{

                const change =
                    Number(
                        coin.price_change_percentage_24h || 0
                    );

                const price =
                    Number(
                        coin.current_price || 0
                    );

                return `
                <div class="coin-row">

                    <div class="coin-rank">
                        #${index+1}
                    </div>

                    <div>

                        <div class="coin-name">
                            ${escapeHTML(coin.name)}
                        </div>

                        <div class="coin-symbol">
                            ${escapeHTML(
                                String(
                                    coin.symbol || ""
                                ).toUpperCase()
                            )}
                        </div>

                    </div>

                    <div class="coin-price">

                        $${price.toLocaleString(
                            undefined,
                            {
                                maximumFractionDigits:8
                            }
                        )}

                        <div class="${change>=0?"up":"down"} coin-change">

                            ${change>=0?"+":""}${change.toFixed(2)}%

                        </div>

                    </div>

                </div>
                `;
            }
        ).join("");

}


window.filterCryptoMarket =
    function(){

        const value =
            document.getElementById(
                "cryptoSearch"
            )
            .value
            .toLowerCase()
            .trim();

        renderMarket(
            marketCoins.filter(
                coin =>
                    String(
                        coin.name || ""
                    )
                    .toLowerCase()
                    .includes(value)
                    ||
                    String(
                        coin.symbol || ""
                    )
                    .toLowerCase()
                    .includes(value)
            )
        );

    };


/* =========================================================
   FINANCE + GOLD
========================================================= */

const NEXUS_FX_CACHE_KEY =
    "nexusnova_fx_cache_v1";

const NEXUS_FX_CACHE_MS =
    10 * 60 * 1000;

async function loadFinanceData(){

    const status =
        document.getElementById("goldStatus");

    try{

        const cached =
            readFinanceCache();

        let rates =
            cached?.rates || null;

        let goldUsdPerOunce =
            cached?.goldUsdPerOunce || null;

        if(
            !cached ||
            Date.now() - cached.time >=
            NEXUS_FX_CACHE_MS
        ){

            const fxResponse =
                await fetch(
                    "https://open.er-api.com/v6/latest/USD",
                    {cache:"no-store"}
                );

            if(!fxResponse.ok){
                throw new Error(
                    "FX request failed: HTTP "+
                    fxResponse.status
                );
            }

            const fxData =
                await fxResponse.json();

            rates =
                fxData.rates || {};

            try{

                const goldResponse =
                    await fetch(
                        "https://api.gold-api.com/price/XAU",
                        {cache:"no-store"}
                    );

                if(goldResponse.ok){

                    const goldData =
                        await goldResponse.json();

                    goldUsdPerOunce =
                        Number(
                            goldData.price ||
                            goldData.value ||
                            0
                        ) || null;
                }

            }catch(goldError){

                console.warn(
                    "Gold API unavailable:",
                    goldError
                );
            }

            writeFinanceCache(
                rates,
                goldUsdPerOunce
            );
        }

        currencyRates =
            rates || {};

        renderFinanceValues(
            Number(currencyRates.PKR || 0),
            Number(goldUsdPerOunce || 0)
        );

        convertCurrency();

        if(status){
            status.textContent =
                goldUsdPerOunce
                ? "Connected • Updated just now"
                : "FX connected • Gold unavailable";
        }

    }catch(error){

        console.error(
            "FINANCE ERROR:",
            error
        );

        const cached =
            readFinanceCache();

        if(cached){

            currencyRates =
                cached.rates || {};

            renderFinanceValues(
                Number(currencyRates.PKR || 0),
                Number(cached.goldUsdPerOunce || 0)
            );

            convertCurrency();

            if(status){
                status.textContent =
                    "Offline • Showing last update";
            }

        }else{

            showFinanceUnavailable();

            if(status){
                status.textContent =
                    "Offline";
            }
        }
    }
}

function renderFinanceValues(
    pkr,
    goldUsdPerOunce
){

    const usdGram =
        goldUsdPerOunce > 0
        ? goldUsdPerOunce / 31.1034768
        : 0;

    const pkrGram =
        usdGram > 0 && pkr > 0
        ? usdGram * pkr
        : 0;

    const gold24 =
        pkrGram;

    const gold22 =
        pkrGram * (22/24);

    const values = {
        goldUsd:
            goldUsdPerOunce > 0
            ? "$"+
              goldUsdPerOunce.toLocaleString(
                  undefined,
                  {maximumFractionDigits:2}
              )+
              " / oz"
            : "Gold unavailable",

        goldUsdGram:
            usdGram > 0
            ? "$"+usdGram.toFixed(2)+" / gram"
            : "--",

        goldPkr:
            pkrGram > 0
            ? "Approx. PKR "+
              pkrGram.toLocaleString(
                  undefined,
                  {maximumFractionDigits:0}
              )+
              " / gram"
            : "USD/PKR unavailable",

        gold24g:
            gold24 > 0
            ? "PKR "+
              gold24.toLocaleString(
                  undefined,
                  {maximumFractionDigits:0}
              )
            : "--",

        gold22g:
            gold22 > 0
            ? "PKR "+
              gold22.toLocaleString(
                  undefined,
                  {maximumFractionDigits:0}
              )
            : "--"
    };

    Object.entries(values).forEach(
        ([id,value])=>{
            const el =
                document.getElementById(id);
            if(el){
                el.textContent = value;
            }
        }
    );
}

function showFinanceUnavailable(){

    [
        "goldUsd",
        "goldUsdGram",
        "goldPkr",
        "gold24g",
        "gold22g"
    ].forEach(id=>{
        const el =
            document.getElementById(id);
        if(el){
            el.textContent = "--";
        }
    });
}

function readFinanceCache(){

    try{
        const raw =
            localStorage.getItem(
                NEXUS_FX_CACHE_KEY
            );

        return raw
            ? JSON.parse(raw)
            : null;

    }catch{
        return null;
    }
}

function writeFinanceCache(
    rates,
    goldUsdPerOunce
){

    try{
        localStorage.setItem(
            NEXUS_FX_CACHE_KEY,
            JSON.stringify({
                time:Date.now(),
                rates:rates || {},
                goldUsdPerOunce:
                    Number(goldUsdPerOunce || 0)
            })
        );
    }catch(error){
        console.warn(
            "Finance cache error:",
            error
        );
    }
}

window.loadFinanceData =
    loadFinanceData;

window.convertCurrency =
    function(){

        const amountEl =
            document.getElementById(
                "convertAmount"
            );

        const fromEl =
            document.getElementById(
                "fromCurrency"
            );

        const toEl =
            document.getElementById(
                "toCurrency"
            );

        const resultEl =
            document.getElementById(
                "convertResult"
            );

        const displayEl =
            document.getElementById(
                "converterDisplay"
            );

        if(!amountEl || !fromEl || !toEl){
            return;
        }

        const amount =
            Number(amountEl.value || 0);

        const from =
            fromEl.value;

        const to =
            toEl.value;

        if(
            !Number.isFinite(amount) ||
            amount < 0
        ){
            if(displayEl){
                displayEl.textContent =
                    "Enter a valid amount.";
            }
            return;
        }

        if(
            !currencyRates[from] ||
            !currencyRates[to]
        ){
            if(displayEl){
                displayEl.textContent =
                    "Currency rates unavailable.";
            }
            return;
        }

        const usd =
            amount /
            Number(currencyRates[from]);

        const result =
            usd *
            Number(currencyRates[to]);

        if(resultEl){
            resultEl.value =
                result.toFixed(4);
        }

        if(displayEl){
            displayEl.textContent =
                `${amount} ${from} = `+
                `${result.toFixed(4)} ${to}`;
        }
    };



/* =========================================================
   NEWS
========================================================= */

async function loadNews(){

    if(typeof window.nexusLoadNewsEnhanced === "function"){
        return window.nexusLoadNewsEnhanced();
    }

    const list = document.getElementById("newsList");
    if(!list){
        return;
    }

    list.innerHTML =
        '<div class="status">Loading live world news...</div>';
}


window.loadNews =
    loadNews;


/* =========================================================
   COMMUNITY CHAT
========================================================= */

window.loadChat =
    function(){

        if(!currentUser){
            return;
        }

        if(chatUnsubscribe){

            chatUnsubscribe();

            chatUnsubscribe = null;
        }

        const q =
            query(
                collection(
                    db,
                    "chatMessages"
                ),
                orderBy(
                    "createdAt",
                    "desc"
                ),
                limit(100)
            );

        chatUnsubscribe =
            onSnapshot(
                q,

                snapshot => {

                    const messages = [];

                    snapshot.forEach(
                        documentSnapshot => {

                            messages.push({
                                id:documentSnapshot.id,
                                ...documentSnapshot.data()
                            });

                        }
                    );

                    messages.reverse();

                    const chatStatus =
                        document.getElementById("chatStatus");

                    if(chatStatus){
                        chatStatus.textContent =
                            "Connected";
                    }

                    const box =
                        document.getElementById(
                            "chatBox"
                        );

                    if(!messages.length){

                        box.innerHTML =
                            '<div class="status">No messages yet.</div>';

                        return;
                    }

                    box.innerHTML =
                        messages.map(
                            message => {

                                const mine =
                                    message.uid ===
                                    currentUser.uid;

                                const time =
                                    message.createdAt?.toDate
                                    ? message.createdAt
                                        .toDate()
                                        .toLocaleTimeString()
                                    : "";

                                return `

                                <div class="chat-message ${mine?"mine":""}">

                                    <div class="chat-name">
                                        ${escapeHTML(
                                            message.name ||
                                            "NexusNova User"
                                        )}
                                    </div>

                                    <div class="chat-bubble">

                                        ${escapeHTML(
                                            message.text || ""
                                        )}

                                        <div style="color:#64748b;font-size:9px;margin-top:3px">
                                            ${escapeHTML(time)}
                                        </div>

                                    </div>

                                </div>

                                `;
                            }
                        ).join("");

                    box.scrollTop =
                        box.scrollHeight;

                },

                error => {

                    console.error(
                        "CHAT ERROR:",
                        error
                    );

                    const chatStatus =
                        document.getElementById("chatStatus");

                    if(chatStatus){
                        chatStatus.textContent =
                            "Offline";
                    }

                    document.getElementById(
                        "chatBox"
                    ).innerHTML =
                        '<div class="status">Chat unavailable. Check Firestore rules.</div>';

                }
            );

    };


window.sendChatMessage =
    async function(){

        if(!currentUser){
            return;
        }

        const input =
            document.getElementById(
                "chatInput"
            );

        const text =
            input.value.trim();

        if(!text){
            return;
        }

        if(text.length > 500){
            alert("Message is too long. Maximum 500 characters.");
            return;
        }

        input.disabled = true;

        try{

            await addDoc(
                collection(
                    db,
                    "chatMessages"
                ),
                {
                    uid:currentUser.uid,

                    name:
                        userData.name ||
                        currentUser.displayName ||
                        "NexusNova User",

                    text:text,

                    createdAt:
                        serverTimestamp()
                }
            );

            input.value = "";

        }catch(error){

            console.error(
                "SEND CHAT ERROR:",
                error
            );

            alert(
                "Message could not be sent."
            );

        }finally{

            input.disabled = false;
            input.focus();

        }

    };



/* =========================================================
   CHAT INPUT SHORTCUT
========================================================= */

document.addEventListener(
    "keydown",
    event => {

        const input =
            document.getElementById("chatInput");

        if(
            input &&
            document.activeElement === input &&
            event.key === "Enter" &&
            !event.shiftKey
        ){

            event.preventDefault();

            if(
                typeof window.sendChatMessage ===
                "function"
            ){
                window.sendChatMessage();
            }
        }
    }
);


/* =========================================================
   NEXUSNOVA AI TOOLS
========================================================= */

let aiSelectedImage = null;
let aiRecognition = null;
let aiListening = false;

window.useAIQuickPrompt = function(prompt){
    const input = document.getElementById("aiInput");
    if(!input) return;
    input.value = prompt;
    input.focus();
};

window.handleAIImage = function(input){
    const file = input?.files?.[0];
    if(!file) return;

    if(!["image/png","image/jpeg","image/webp"].includes(file.type)){
        alert("Please choose a PNG, JPG or WebP image.");
        input.value = "";
        return;
    }

    if(file.size > 10 * 1024 * 1024){
        alert("Please choose an image smaller than 10 MB.");
        input.value = "";
        return;
    }

    aiSelectedImage = file;

    const preview = document.getElementById("aiImagePreview");
    const img = document.getElementById("aiPreviewImg");
    const name = document.getElementById("aiImageName");

    if(preview && img && name){
        img.src = URL.createObjectURL(file);
        name.textContent = file.name;
        preview.style.display = "flex";
    }

    const status = document.getElementById("aiVoiceStatus");
    if(status){
        status.textContent = "Image ready — ask AI what you want to know.";
    }
};

window.clearAIImage = function(){
    aiSelectedImage = null;

    const input = document.getElementById("aiImageInput");
    const preview = document.getElementById("aiImagePreview");
    const img = document.getElementById("aiPreviewImg");

    if(input) input.value = "";
    if(img) img.removeAttribute("src");
    if(preview) preview.style.display = "none";
};

function fileToGenerativePart(file){
    return new Promise((resolve,reject)=>{
        const reader = new FileReader();

        reader.onloadend = ()=>{
            try{
                const result = String(reader.result || "");
                const comma = result.indexOf(",");

                if(comma === -1){
                    reject(new Error("Could not read image."));
                    return;
                }

                resolve({
                    inlineData:{
                        data:result.slice(comma + 1),
                        mimeType:file.type
                    }
                });
            }catch(error){
                reject(error);
            }
        };

        reader.onerror = ()=>reject(
            new Error("Could not read image.")
        );

        reader.readAsDataURL(file);
    });
}

window.toggleAIVoice = function(){
    const SpeechRecognition =
        window.SpeechRecognition ||
        window.webkitSpeechRecognition;

    if(!SpeechRecognition){
        alert(
            "Voice input is not supported in this browser. " +
            "Try the latest Chrome or Edge."
        );
        return;
    }

    if(aiListening && aiRecognition){
        aiRecognition.stop();
        return;
    }

    aiRecognition = new SpeechRecognition();
    const selectedLanguage = getNexusSettings().aiLanguage || "English";
    aiRecognition.lang =
        selectedLanguage === "Urdu" ? "ur-PK" :
        selectedLanguage === "Roman Urdu" ? "en-US" :
        "en-US";
    aiRecognition.interimResults = true;
    aiRecognition.continuous = false;

    aiRecognition.onstart = ()=>{
        aiListening = true;

        const btn =
            document.getElementById("aiVoiceBtn");

        const status =
            document.getElementById("aiVoiceStatus");

        if(btn) btn.classList.add("active");
        if(status) status.textContent =
            "🎙️ Listening... speak now.";
    };

    aiRecognition.onresult = event=>{
        let transcript = "";

        for(
            let i=event.resultIndex;
            i<event.results.length;
            i++
        ){
            transcript +=
                event.results[i][0].transcript;
        }

        const input =
            document.getElementById("aiInput");

        if(input){
            input.value = transcript.trim();
        }
    };

    aiRecognition.onerror = event=>{
        console.warn("Voice recognition:", event.error);

        const status =
            document.getElementById("aiVoiceStatus");

        if(status){
            status.textContent =
                event.error === "not-allowed"
                ? "Microphone permission was denied."
                : "Voice input stopped.";
        }
    };

    aiRecognition.onend = ()=>{
        aiListening = false;

        const btn =
            document.getElementById("aiVoiceBtn");

        const status =
            document.getElementById("aiVoiceStatus");

        if(btn) btn.classList.remove("active");
        if(status) status.textContent =
            "Voice ready";
    };

    aiRecognition.start();
};

function speakAIReply(text) {
    if (window.NexusNovaVoice) {
        return window.NexusNovaVoice.speak(text);
    }
    if (!("speechSynthesis" in window)) return false;
    try {
        const u = new SpeechSynthesisUtterance(String(text || ""));
        u.rate = 0.94;
        u.pitch = 1.02;
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(u);
        return true;
    } catch (e) {
        console.warn("AI voice:", e);
        return false;
    }
}


/* =========================================================
   AI CHAT
========================================================= */

function addAIMessage(text,type){

    const box =
        document.getElementById(
            "aiBox"
        );

    if(!box){
        return;
    }

    const wrapper =
        document.createElement(
            "div"
        );

    wrapper.className =
        "ai-message"+
        (type==="user" ? " user" : "");

    const label =
        document.createElement(
            "div"
        );

    label.className =
        "ai-label";

    label.textContent =
        type==="user"
        ? "You"
        : "NexusNova AI";

    const bubble =
        document.createElement(
            "div"
        );

    bubble.className =
        "ai-bubble";

    bubble.textContent =
        String(text || "");

    wrapper.appendChild(label);
    wrapper.appendChild(bubble);

    box.appendChild(wrapper);

    box.scrollTop =
        box.scrollHeight;
}


window.clearAIChat =
    function(){

        aiChat = null;

        const box =
            document.getElementById(
                "aiBox"
            );

        if(!box){
            return;
        }

        box.innerHTML = "";

        addAIMessage(
            "Chat cleared. 👋\n\nAsk me anything about NexusNova.",
            "ai"
        );

    };


window.sendAIMessage =
    async function(){

        const input =
            document.getElementById(
                "aiInput"
            );

        const button =
            document.getElementById(
                "aiSendBtn"
            );

        if(!input || !button){
            return;
        }

        const text =
            input.value.trim();

        
        // Deterministic external-wallet balance answer.
        // This is read-only and uses the same on-chain cache shown in Wallet.
        const walletBalanceQuestion =
            /(wallet|eth|ethereum|usdt|usdc|bnb|matic|polygon)/i.test(text) &&
            /(balance|amount|kitna|kitne|mere|mera|my|how much|show|dikha)/i.test(text);

        if(walletBalanceQuestion){
            const cache =
                window.__nexusOnchainVisibleBalances || {};
            const address =
                window.nexusConnectedAddress ||
                window.ethereum?.selectedAddress ||
                "";

            if(address && Object.keys(cache).length){
                const parts = Object.entries(cache)
                    .filter(([,value]) => Number.isFinite(Number(value)))
                    .map(([symbol,value]) =>
                        `${symbol}: ${Number(value).toLocaleString(undefined,{maximumFractionDigits:8})}`
                    );

                const totalEl =
                    document.getElementById("walletTotalUsd");

                const walletReply =
                    `Connected wallet: ${address.slice(0,6)}...${address.slice(-4)}.\n` +
                    (parts.length ? parts.join("\n") : "No supported on-chain balance has been read yet.") +
                    (totalEl ? `\nPortfolio value: ${totalEl.textContent.trim()}.` : "");

                addAIMessage(walletReply, "ai");
                speakAIReply(walletReply);
                input.value = "";
                return;
            }

            const noWalletReply =
                "Bhai, external wallet abhi connected nahi hai. Wallet → Connect Wallet se Rabby/MetaMask connect karo, phir main real on-chain balance bata sakta hoon.";

            addAIMessage(noWalletReply, "ai");
            speakAIReply(noWalletReply);
            input.value = "";
            return;
        }

        // Deterministic balance answer: read the same visible NVX value
        // the user sees on the dashboard. This does not touch mining logic.
        const balanceQuestion =
            /(balance|nvx|token|tokens|coins?)/i.test(text) &&
            /(my|mera|mere|kitna|kitne|how much|amount)/i.test(text);

        if(balanceQuestion){
            let visibleBalance = null;

            const balanceElements = [
                document.getElementById("nvxBalance"),
                document.getElementById("balance"),
                document.querySelector("[data-nvx-balance]")
            ].filter(Boolean);

            for(const el of balanceElements){
                const raw = (el.textContent || "")
                    .replace(/,/g,"")
                    .trim();

                const match = raw.match(/-?\d+(?:\.\d+)?/);

                if(match){
                    visibleBalance = Number(match[0]);
                    break;
                }
            }

            // Fall back to the already-running dashboard state only.
            if(
                visibleBalance === null &&
                typeof nvxBalance !== "undefined" &&
                Number.isFinite(Number(nvxBalance))
            ){
                visibleBalance = Number(nvxBalance);
            }

            if(visibleBalance !== null){
                const balanceReply =
                    `Your current NVX balance is ${visibleBalance} NVX.`;

                addAIMessage(balanceReply, "ai");
                speakAIReply(balanceReply);

                input.value = "";
                return;
            }
        }

if(!text){
            return;
        }

        addAIMessage(
            text,
            "user"
        );

        input.value = "";

        button.disabled = true;
        button.textContent = "...";

        if(
            !aiReady ||
            !aiModel
        ){

            addAIMessage(
                "Bhai, Gemini AI abhi connect nahi hua. Firebase AI Logic/App Check setup check karo.",
                "ai"
            );

            setAIStatus(
                "Gemini AI unavailable",
                false
            );

            button.disabled = false;
            button.textContent = "Ask";

            return;
        }

        try{

            setAIStatus(
                "Gemini AI working...",
                true
            );

            if(!aiChat){

                aiChat =
                    aiModel.startChat();

            }

            const walletContext = (() => {
                const cache =
                    window.__nexusOnchainVisibleBalances || {};
                const address =
                    window.nexusConnectedAddress ||
                    window.ethereum?.selectedAddress ||
                    "";
                const total =
                    document.getElementById("walletTotalUsd")?.textContent || "$ 0.00";

                if(!address) return "External wallet: not connected.";
                const balances = Object.entries(cache)
                    .map(([symbol,value]) => `${symbol}=${value}`)
                    .join(", ");

                return `External wallet: ${address.slice(0,6)}...${address.slice(-4)}. ` +
                       `On-chain balances: ${balances || "not read yet"}. ` +
                       `Portfolio USD: ${total}.`;
            })();

            let request =
                `NexusNova app context:\n${walletContext}\n\nUser request:\n${text}`;

            if(aiSelectedImage){
                const imagePart =
                    await fileToGenerativePart(
                        aiSelectedImage
                    );

                request = [
                    text,
                    imagePart
                ];
            }

            const result =
                await aiChat.sendMessage(
                    request
                );

            let reply = "";

            try{

                reply =
                    result.response.text();

            }catch(error){

                console.warn(
                    "AI text extraction error:",
                    error
                );

            }

            reply =
                String(
                    reply || ""
                ).trim();

            if(!reply){

                reply =
                    "Sorry bhai, Gemini ne is waqt koi response nahi diya.";
            }

            addAIMessage(
                reply,
                "ai"
            );

            speakAIReply(reply);

            clearAIImage();

            setAIStatus(
                "Gemini AI connected",
                true
            );

        }catch(error){

            console.error(
                "GEMINI AI ERROR:",
                error
            );

            let message =
                "AI service temporarily unavailable.";

            const errorText =
                String(
                    error?.message ||
                    error ||
                    ""
                ).toLowerCase();

            if(
                errorText.includes("app check") ||
                errorText.includes("appcheck")
            ){

                message =
                    "Bhai, Firebase App Check ki configuration complete nahi hui. Firebase Console mein App Check aur AI Logic setup check karo.";

            }else if(
                errorText.includes("quota") ||
                errorText.includes("429")
            ){

                message =
                    "Bhai, Gemini ki current usage limit hit ho gayi hai. Thori der baad dobara try karo.";

            }else if(
                errorText.includes("permission") ||
                errorText.includes("unauthorized") ||
                errorText.includes("403")
            ){

                message =
                    "Bhai, Firebase AI Logic ki permission/setup check karni hogi.";

            }else if(
                errorText.includes("404") ||
                errorText.includes("not found")
            ){

                message =
                    "Bhai, selected Gemini model available nahi hai. Firebase AI Logic mein supported model select karo.";
            }

            addAIMessage(
                message,
                "ai"
            );

            setAIStatus(
                "Gemini AI error",
                false
            );

        }finally{

            button.disabled = false;
            button.textContent = "Ask";

            input.focus();

        }

    };


/* =========================================================
   LOCATION
========================================================= */

window.getMyLocation =
    function(){

        const status =
            document.getElementById(
                "locationStatus"
            );

        if(!navigator.geolocation){

            status.textContent =
                "Geolocation is not supported.";

            return;
        }

        status.textContent =
            "Requesting location...";

        navigator.geolocation.getCurrentPosition(

            position => {

                currentLatitude =
                    position.coords.latitude;

                currentLongitude =
                    position.coords.longitude;

                const accuracy =
                    Math.round(
                        position.coords.accuracy
                    );

                status.innerHTML =
                    `Latitude: ${currentLatitude.toFixed(6)}
                    <br>
                    Longitude: ${currentLongitude.toFixed(6)}
                    <br>
                    Accuracy: approximately ${accuracy} meters`;

                document.getElementById(
                    "openMapBtn"
                ).style.display =
                    "block";

            },

            error => {

                console.error(
                    "LOCATION ERROR:",
                    error
                );

                status.textContent =
                    "Location permission denied or unavailable.";

            },

            {
                enableHighAccuracy:true,
                timeout:10000,
                maximumAge:0
            }
        );

    };


window.openCurrentLocation =
    function(){

        if(
            currentLatitude === null ||
            currentLongitude === null
        ){

            alert(
                "Get your location first."
            );

            return;
        }

        window.open(
            "https://www.google.com/maps?q="+
            currentLatitude+","+
            currentLongitude,
            "_blank",
            "noopener,noreferrer"
        );

    };


/* =========================================================
   EMERGENCY CONTACTS
========================================================= */

function getEmergencyContacts(){

    try{

        return JSON.parse(
            localStorage.getItem(
                "nexusnovaEmergencyContacts"
            ) || "[]"
        );

    }catch(error){

        console.error(error);

        return [];
    }

}


function saveEmergencyContacts(
    contacts
){

    localStorage.setItem(
        "nexusnovaEmergencyContacts",
        JSON.stringify(contacts)
    );

}


window.addEmergencyContact =
    function(){

        const name =
            document.getElementById(
                "contactName"
            )
            .value
            .trim();

        const phone =
            document.getElementById(
                "contactPhone"
            )
            .value
            .trim();

        if(!name || !phone){

            alert(
                "Enter name and phone number."
            );

            return;
        }

        const contacts =
            getEmergencyContacts();

        contacts.push({
            id:Date.now(),
            name:name,
            phone:phone
        });

        saveEmergencyContacts(
            contacts
        );

        document.getElementById(
            "contactName"
        ).value = "";

        document.getElementById(
            "contactPhone"
        ).value = "";

        renderEmergencyContacts();

    };


function renderEmergencyContacts(){

    const container =
        document.getElementById(
            "emergencyContacts"
        );

    if(!container){
        return;
    }

    const contacts =
        getEmergencyContacts();

    if(!contacts.length){

        container.innerHTML =
            '<div class="status">No family contacts saved.</div>';

        return;
    }

    container.innerHTML =
        contacts.map(
            contact => `

            <div class="contact-card">

                <strong>
                    ${escapeHTML(contact.name)}
                </strong>

                <div class="contact-number">
                    ${escapeHTML(contact.phone)}
                </div>

                <div class="contact-actions">

                    <button class="action-btn primary"
                            onclick="callEmergencyContact('${safeJS(contact.phone)}')">
                        📞 Call
                    </button>

                    <button class="action-btn danger"
                            onclick="deleteEmergencyContact(${Number(contact.id)})">
                        Delete
                    </button>

                </div>

            </div>

            `
        ).join("");

}


window.callEmergencyContact =
    function(phone){

        window.location.href =
            "tel:"+phone;

    };


window.deleteEmergencyContact =
    function(id){

        const contacts =
            getEmergencyContacts()
                .filter(
                    contact =>
                        Number(contact.id) !==
                        Number(id)
                );

        saveEmergencyContacts(
            contacts
        );

        renderEmergencyContacts();

    };


window.emergencySOS =
    function(){

        const contacts =
            getEmergencyContacts();

        if(!contacts.length){

            alert(
                "Add an emergency contact first."
            );

            return;
        }

        const status =
            document.getElementById(
                "emergencyLocation"
            );

        status.textContent =
            "Getting current location...";

        const first =
            contacts[0];

        if(!navigator.geolocation){

            status.textContent =
                "Location is not supported. Calling first contact.";

            window.location.href =
                "tel:"+first.phone;

            return;
        }

        navigator.geolocation.getCurrentPosition(

            position => {

                const lat =
                    position.coords.latitude;

                const lng =
                    position.coords.longitude;

                const link =
                    "https://www.google.com/maps?q="+
                    lat+","+
                    lng;

                currentLatitude = lat;
                currentLongitude = lng;

                status.innerHTML =
                    `Current location:
                    <br>${lat.toFixed(6)}, ${lng.toFixed(6)}
                    <br><br>
                    <button class="action-btn primary"
                            onclick="openLink('${safeURL(link)}')">
                        🗺️ OPEN LOCATION
                    </button>`;

                const message =
                    "NexusNova Emergency Alert: I may need help. My location is: "+
                    link;

                const sms =
                    "sms:"+
                    encodeURIComponent(
                        first.phone
                    )+
                    "?body="+
                    encodeURIComponent(
                        message
                    );

                if(
                    confirm(
                        "Emergency alert prepared for "+
                        first.name+
                        ". Open SMS?"
                    )
                ){

                    window.location.href =
                        sms;
                }

            },

            error => {

                console.error(
                    "EMERGENCY LOCATION ERROR:",
                    error
                );

                status.textContent =
                    "Could not get location. Calling first contact.";

                window.location.href =
                    "tel:"+first.phone;

            },

            {
                enableHighAccuracy:true,
                timeout:10000,
                maximumAge:0
            }
        );

    };


/* =========================================================
   REFERRAL
========================================================= */

window.copyReferral =
    async function(){

        const code =
            userData.referralCode || "";

        const link =
            window.location.origin+
            window.location.pathname+
            "?ref="+
            encodeURIComponent(code);

        try{

            await navigator.clipboard.writeText(
                link
            );

            alert(
                "Referral link copied."
            );

        }catch(error){

            alert(
                link
            );

        }

    };


/* =========================================================
   LOGOUT
========================================================= */

window.handleLogout =
    async function(){

        if(
            !confirm(
                "Do you want to logout?"
            )
        ){
            return;
        }

        try{

            await signOut(
                auth
            );

            window.location.replace(
                "./index.html"
            );

        }catch(error){

            console.error(
                "LOGOUT ERROR:",
                error
            );

            alert(
                "Logout failed."
            );

        }

    };


/* =========================================================
   LINKS
========================================================= */

window.openLink =
    function(url){

        if(!url){
            return;
        }

        try{

            const parsed =
                new URL(
                    url,
                    window.location.href
                );

            if(
                parsed.protocol !== "http:" &&
                parsed.protocol !== "https:"
            ){
                return;
            }

            window.open(
                parsed.href,
                "_blank",
                "noopener,noreferrer"
            );

        }catch(error){

            console.error(
                "Invalid URL:",
                error
            );

        }

    };


/* =========================================================
   TICKER
========================================================= */

async function updateTicker(){

    try{

        const response =
            await fetch(
                "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=8&page=1&sparkline=false"
            );

        if(!response.ok){
            throw new Error(
                "Ticker request failed"
            );
        }

        const coins =
            await response.json();

        const ticker =
            document.getElementById(
                "ticker"
            );

        ticker.innerHTML =
            coins.map(
                coin => {

                    const change =
                        Number(
                            coin.price_change_percentage_24h || 0
                        );

                    return `

                    <span class="ticker-item">

                        ${escapeHTML(
                            String(
                                coin.symbol || ""
                            ).toUpperCase()
                        )}

                        $${Number(
                            coin.current_price || 0
                        ).toLocaleString(
                            undefined,
                            {
                                maximumFractionDigits:6
                            }
                        )}

                        <span class="${change>=0?"up":"down"}">

                            ${change>=0?"+":""}${change.toFixed(2)}%

                        </span>

                    </span>

                    `;
                }
            ).join("");

    }catch(error){

        console.error(
            "TICKER ERROR:",
            error
        );

    }

}


updateTicker();

setInterval(
    updateTicker,
    120000
);


/* =========================================================
   HELPERS
========================================================= */

function escapeHTML(value){

    return String(
        value ?? ""
    )
    .replace(
        /&/g,
        "&amp;"
    )
    .replace(
        /</g,
        "&lt;"
    )
    .replace(
        />/g,
        "&gt;"
    )
    .replace(
        /"/g,
        "&quot;"
    )
    .replace(
        /'/g,
        "&#039;"
    );

}


function safeURL(url){

    return String(
        url || ""
    )
    .replace(
        /'/g,
        "%27"
    );

}


function safeJS(value){

    return String(
        value || ""
    )
    .replace(
        /\\/g,
        "\\\\"
    )
    .replace(
        /'/g,
        "\\'"
    );

}




setInterval(
    () => {
        if(typeof refreshWalletFoundation === "function"){
            refreshWalletFoundation();
        }
    },
    60000
);

/* =========================================================
   LIVE STATUS + WALLET PRICE SYNC
========================================================= */

setInterval(
    () => {

        if(miningActive){
            startMiningTicker();
        }

    },
    30000
);

/* =========================================================
   WALLET FOUNDATION BOOT
========================================================= */

window.addEventListener(
    "load",
    () => {
        setTimeout(
            initWalletFoundation,
            250
        );
    }
);


/* =========================================================
   CORE RECOVERY BOOT
========================================================= */

(function nexusCoreBoot(){

    try{

        if(typeof loadMarket === "function"){
            loadMarket();
        }

    }catch(error){

        console.error(
            "MARKET BOOT ERROR:",
            error
        );

    }

    try{

        if(!currentUser){
            currentUser = auth.currentUser;
        }

        if(currentUser){
            loadUserProfile();
        }

    }catch(error){

        console.error(
            "PROFILE BOOT ERROR:",
            error
        );

    }

})();


/* =========================================================
   NEXUSNOVA TARGETED REPAIR V6
   IMPORTANT: mining, wallet, tasks and market core handlers
   are intentionally NOT replaced here.
   This patch only repairs auxiliary screens/ticker.
========================================================= */

(function nexusTargetedRepairV6(){

    /* ---------- LIVE TICKER ----------
       CoinGecko was the weak point. Use the same public Binance
       endpoint already used by the working market module.
    */
    async function repairTicker(){

        const ticker = document.getElementById("ticker");
        if(!ticker) return;

        try{

            const response = await fetch(
                "https://api.binance.com/api/v3/ticker/24hr",
                {cache:"no-store"}
            );

            if(!response.ok){
                throw new Error("Ticker HTTP "+response.status);
            }

            const rows = await response.json();

            const wanted = [
                "BTCUSDT","ETHUSDT","BNBUSDT","SOLUSDT",
                "XRPUSDT","ADAUSDT","DOGEUSDT","TRXUSDT"
            ];

            const map = new Map(
                rows
                .filter(r => wanted.includes(
                    String(r.symbol || "").toUpperCase()
                ))
                .map(r => [
                    String(r.symbol).replace("USDT",""),
                    r
                ])
            );

            const html = wanted
                .map(pair => {

                    const symbol = pair.replace("USDT","");
                    const r = map.get(symbol);

                    if(!r) return "";

                    const price = Number(r.lastPrice || 0);
                    const change = Number(
                        r.priceChangePercent || 0
                    );

                    return `
                        <span class="ticker-item">
                            <b>${symbol}</b>
                            $${price.toLocaleString(
                                undefined,
                                {maximumFractionDigits:6}
                            )}
                            <span class="${
                                change >= 0 ? "up" : "down"
                            }">
                                ${change >= 0 ? "+" : ""}
                                ${change.toFixed(2)}%
                            </span>
                        </span>
                    `;
                })
                .join("");

            if(html){
                ticker.innerHTML = html;
            }

        }catch(error){

            console.warn(
                "V6 ticker repair failed:",
                error
            );

            // Do not blank a previously working ticker.
            if(!ticker.textContent.trim()){
                ticker.innerHTML =
                    '<span class="ticker-item">Live market temporarily unavailable</span>';
            }
        }
    }

    /* Run immediately and then keep it fresh.
       The old CoinGecko timer is left untouched so working
       market/mining code is not disturbed.
    */
    repairTicker();
    setInterval(repairTicker, 60000);


    /* ---------- PROFILE ----------
       Populate profile directly from the already authenticated
       Firebase user + Firestore document. Does not touch mining.
    */
    async function repairProfile(){

        const user = currentUser || auth.currentUser;

        if(!user) return;

        try{

            const snap = await getDoc(
                doc(db,"users",user.uid)
            );

            const data = snap.exists()
                ? snap.data()
                : {};

            const name =
                data.name ||
                user.displayName ||
                "Miner User";

            const setText = (id,value) => {
                const el = document.getElementById(id);
                if(el) el.textContent = value;
            };

            setText("profileName",name);
            setText(
                "profileEmailDisplay",
                user.email || "No email"
            );
            setText(
                "profileId",
                user.uid.substring(0,12)+"..."
            );
            setText(
                "profileTotalMined",
                Number(data.totalMined || 0).toFixed(4)+" NVX"
            );
            setText(
                "profileTasksDone",
                Number(data.tasksCompleted || 0)
            );
            setText(
                "refCodeDisplay",
                data.referralCode ||
                ("NVX"+user.uid.substring(0,8).toUpperCase())
            );

        }catch(error){

            console.warn(
                "V6 profile repair:",
                error
            );

            // At least show the authenticated account instead of
            // leaving the screen permanently at "Loading...".
            const user = currentUser || auth.currentUser;

            if(user){
                const email =
                    document.getElementById(
                        "profileEmailDisplay"
                    );

                const id =
                    document.getElementById("profileId");

                if(email){
                    email.textContent =
                        user.email || "Authenticated account";
                }

                if(id){
                    id.textContent =
                        user.uid.substring(0,12)+"...";
                }
            }
        }
    }

    window.nexusRepairProfileV6 = repairProfile;


    /* ---------- COMMUNITY CHAT ----------
       Add an error callback. If Firestore is temporarily unavailable,
       the user sees the actual problem instead of "Loading chat..." forever.
    */
    let v6ChatUnsubscribe = null;

    window.loadChat = function(){

        const box =
            document.getElementById("chatBox");

        const status =
            document.getElementById("chatStatus");

        const user =
            currentUser || auth.currentUser;

        if(!box) return;

        if(!user){

            box.innerHTML =
                '<div class="status">Waiting for account...</div>';

            return;
        }

        if(v6ChatUnsubscribe){
            try{
                v6ChatUnsubscribe();
            }catch(_){}
            v6ChatUnsubscribe = null;
        }

        box.innerHTML =
            '<div class="status">Connecting to community...</div>';

        try{

            const q = query(
                collection(db,"chatMessages"),
                orderBy("createdAt","asc"),
                limit(100)
            );

            v6ChatUnsubscribe = onSnapshot(
                q,

                snapshot => {

                    if(status){
                        status.textContent =
                            "Connected";
                    }

                    if(snapshot.empty){

                        box.innerHTML =
                            '<div class="status">No messages yet. Be the first to say hello 👋</div>';

                        return;
                    }

                    const messages = [];

                    snapshot.forEach(s => {
                        messages.push({
                            id:s.id,
                            ...s.data()
                        });
                    });

                    box.innerHTML =
                        messages.map(message => {

                            const mine =
                                message.uid === user.uid;

                            let time = "";

                            try{
                                time =
                                    message.createdAt?.toDate
                                    ? message.createdAt
                                        .toDate()
                                        .toLocaleTimeString()
                                    : "";
                            }catch(_){}

                            return `
                                <div class="chat-message ${mine ? "mine" : ""}">
                                    <div class="chat-name">
                                        ${escapeHTML(
                                            message.name ||
                                            "NexusNova User"
                                        )}
                                    </div>
                                    <div class="chat-bubble">
                                        ${escapeHTML(
                                            message.text || ""
                                        )}
                                        <div style="color:#64748b;font-size:9px;margin-top:3px">
                                            ${escapeHTML(time)}
                                        </div>
                                    </div>
                                </div>
                            `;
                        }).join("");

                    box.scrollTop = box.scrollHeight;
                },

                error => {

                    console.error(
                        "V6 CHAT ERROR:",
                        error
                    );

                    if(status){
                        status.textContent =
                            "Cloud chat unavailable";
                    }

                    box.innerHTML = `
                        <div class="status">
                            Community chat could not connect.<br>
                            <small>${escapeHTML(
                                error?.message ||
                                "Check Firestore rules."
                            )}</small>
                        </div>
                    `;
                }
            );

        }catch(error){

            console.error(
                "V6 CHAT SETUP ERROR:",
                error
            );

            if(status){
                status.textContent =
                    "Chat unavailable";
            }

            box.innerHTML =
                '<div class="status">Community chat setup failed.</div>';
        }
    };


    /* ---------- NEWS ----------
       Keep the existing news implementation as primary.
       If it fails, use GDELT's public JSON feed.
    */
    const originalNews =
        window.loadNews;

    window.loadNews = async function(){

        try{

            if(typeof originalNews === "function"){
                await originalNews();
            }

            const list =
                document.getElementById("newsList");

            const status =
                document.getElementById("newsStatus");

            // If the primary function populated actual stories,
            // do not touch it.
            if(
                list &&
                list.querySelector(".news-item")
            ){
                if(status){
                    status.textContent =
                        "Connected • Live";
                }
                return;
            }

        }catch(error){
            console.warn("Primary news failed:",error);
        }

        const list =
            document.getElementById("newsList");

        if(!list) return;

        try{

            if(list){
                list.innerHTML =
                    '<div class="status">Loading live world news...</div>';
            }

            const response = await fetch(
                "https://api.gdeltproject.org/api/v2/doc/doc?query=world&mode=artlist&format=json&maxrecords=10&timespan=1d",
                {cache:"no-store"}
            );

            if(!response.ok){
                throw new Error(
                    "GDELT HTTP "+response.status
                );
            }

            const data = await response.json();

            const articles =
                Array.isArray(data.articles)
                ? data.articles
                : [];

            if(!articles.length){
                throw new Error("No live articles returned.");
            }

            list.innerHTML =
                articles.slice(0,10).map(article => {

                    const title =
                        article.title ||
                        "World News";

                    const url =
                        article.url ||
                        article.link ||
                        "";

                    const date =
                        article.seendate ||
                        "";

                    return `
                        <div class="news-item">
                            <div class="news-title">
                                ${escapeHTML(title)}
                            </div>
                            <div class="news-meta">
                                ${escapeHTML(date)}
                            </div>
                            ${
                                url
                                ? `<button class="action-btn"
                                    style="margin-top:7px;padding:7px 10px"
                                    onclick="openLink('${safeURL(url)}')">
                                    Read News
                                  </button>`
                                : ""
                            }
                        </div>
                    `;
                }).join("");

            const status =
                document.getElementById("newsStatus");

            if(status){
                status.textContent =
                    "Connected • Live";
            }

        }catch(error){

            console.error(
                "V6 NEWS ERROR:",
                error
            );

            list.innerHTML =
                '<div class="status">Live news service is temporarily unavailable. Tap Refresh to retry.</div>';

            const status =
                document.getElementById("newsStatus");

            if(status){
                status.textContent =
                    "Offline";
            }
        }
    };


    /* ---------- GOLD / FX ----------
       Keep existing FX calculation, but add Metals API as a gold fallback.
    */
    const originalFinance =
        window.loadFinanceData;

    window.loadFinanceData = async function(){

        try{

            if(typeof originalFinance === "function"){
                await originalFinance();
            }

            const goldEl =
                document.getElementById("goldUsd");

            // If gold already rendered, leave the working function alone.
            if(
                goldEl &&
                goldEl.textContent &&
                !/Loading|unavailable/i.test(
                    goldEl.textContent
                )
            ){
                return;
            }

        }catch(error){
            console.warn(
                "Primary finance failed:",
                error
            );
        }

        try{

            const fxResponse =
                await fetch(
                    "https://open.er-api.com/v6/latest/USD",
                    {cache:"no-store"}
                );

            if(!fxResponse.ok){
                throw new Error("FX HTTP "+fxResponse.status);
            }

            const fx =
                await fxResponse.json();

            const pkr =
                Number(fx.rates?.PKR || 0);

            const goldResponse =
                await fetch(
                    "https://api.metals.live/v1/spot",
                    {cache:"no-store"}
                );

            if(!goldResponse.ok){
                throw new Error(
                    "Gold HTTP "+goldResponse.status
                );
            }

            const metals =
                await goldResponse.json();

            const latest =
                Array.isArray(metals)
                ? metals[metals.length - 1]
                : null;

            const ounce =
                Number(latest?.gold || 0);

            if(!ounce || !pkr){
                throw new Error(
                    "Gold/FX data incomplete."
                );
            }

            const gramUsd =
                ounce / 31.1034768;

            const gramPkr =
                gramUsd * pkr;

            const values = {
                goldUsd:
                    "$"+ounce.toLocaleString(
                        undefined,
                        {maximumFractionDigits:2}
                    )+" / oz",

                goldUsdGram:
                    "$"+gramUsd.toFixed(2)+" / gram",

                goldPkr:
                    "Approx. PKR "+
                    gramPkr.toLocaleString(
                        undefined,
                        {maximumFractionDigits:0}
                    )+
                    " / gram",

                gold24g:
                    "PKR "+
                    gramPkr.toLocaleString(
                        undefined,
                        {maximumFractionDigits:0}
                    ),

                gold22g:
                    "PKR "+
                    (gramPkr*(22/24)).toLocaleString(
                        undefined,
                        {maximumFractionDigits:0}
                    )
            };

            Object.entries(values).forEach(
                ([id,value]) => {
                    const el =
                        document.getElementById(id);
                    if(el) el.textContent = value;
                }
            );

            // Keep converter working with the fresh FX rates.
            currencyRates =
                fx.rates || {};

            if(typeof window.convertCurrency === "function"){
                window.convertCurrency();
            }

            const status =
                document.getElementById("goldStatus");

            if(status){
                status.textContent =
                    "Connected • Live";
            }

        }catch(error){

            console.error(
                "V6 FINANCE FALLBACK:",
                error
            );

            const status =
                document.getElementById("goldStatus");

            if(status){
                status.textContent =
                    "Live data unavailable";
            }
        }
    };


    /* ---------- AI STATUS ----------
       Do not fake an AI connection. If Gemini is unavailable,
       display the real state rather than "Connecting..." forever.
    */
    function repairAIStatus(){

        const status =
            document.getElementById("aiStatus");

        if(!status) return;

        if(
            typeof aiReady !== "undefined" &&
            aiReady &&
            typeof aiModel !== "undefined" &&
            aiModel
        ){
            status.textContent =
                "Gemini AI connected";
        }else{
            status.textContent =
                "Gemini AI unavailable";
        }
    }


    /* ---------- BOOT ----------
       Wait for Firebase auth/profile initialization, then repair
       only the auxiliary screens.
    */
    let tries = 0;

    const boot = setInterval(() => {

        tries++;

        try{
            if(
                (currentUser || auth.currentUser)
            ){
                repairProfile();
                repairAIStatus();
            }
        }catch(_){}

        if(tries >= 12){
            clearInterval(boot);
        }

    },1000);

    // Re-run when the user opens More screens.
    document.addEventListener(
        "click",
        event => {

            const button =
                event.target.closest(
                    ".more-item"
                );

            if(!button) return;

            setTimeout(() => {

                try{

                    const label =
                        button.textContent.toLowerCase();

                    if(label.includes("profile")){
                        repairProfile();
                    }

                    if(label.includes("chat")){
                        window.loadChat();
                    }

                    if(label.includes("news")){
                        window.loadNews();
                    }

                    if(
                        label.includes("gold") ||
                        label.includes("fx")
                    ){
                        window.loadFinanceData();
                    }

                    if(label.includes("ai")){
                        repairAIStatus();
                    }

                }catch(error){
                    console.warn(
                        "V6 More screen repair:",
                        error
                    );
                }

            },150);

        },
        true
    );

})();

/* =========================================================
   NEXUSNOVA AUXILIARY REPAIR V7
   Only repairs: ticker, profile, world news, gold/FX.
   Mining / wallet / tasks / market core are NOT replaced.
========================================================= */
(function nexusAuxRepairV7(){
    const text = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    };

    const esc = value => {
        const div = document.createElement("div");
        div.textContent = String(value ?? "");
        return div.innerHTML;
    };

    /* ---------- TICKER: WebSocket first, REST fallback ---------- */
    let tickerSocket = null;
    let tickerReconnect = null;
    const tickerSymbols = ["BTC","ETH","BNB","SOL","XRP","ADA","DOGE","TRX"];
    const tickerData = {};

    function renderTickerV7(){
        const ticker = document.getElementById("ticker");
        if (!ticker) return;

        const html = tickerSymbols.map(symbol => {
            const item = tickerData[symbol];
            if (!item || !Number(item.price)) return "";
            const price = Number(item.price);
            const change = Number(item.change);
            return `<span class="ticker-item"><b>${symbol}</b> $${price.toLocaleString(undefined,{maximumFractionDigits:6})}${Number.isFinite(change) ? ` <span class="${change >= 0 ? "up" : "down"}">${change >= 0 ? "+" : ""}${change.toFixed(2)}%</span>` : ""}</span>`;
        }).join("");

        if (html) ticker.innerHTML = html;
    }

    function connectTickerV7(){
        if (tickerSocket && (tickerSocket.readyState === WebSocket.OPEN || tickerSocket.readyState === WebSocket.CONNECTING)) return;
        try {
            const streams = tickerSymbols.map(s => `${s.toLowerCase()}usdt@ticker`).join("/");
            tickerSocket = new WebSocket(`wss://stream.binance.com:9443/stream?streams=${streams}`);
            tickerSocket.onmessage = event => {
                try {
                    const payload = JSON.parse(event.data);
                    const d = payload.data || payload;
                    const symbol = String(d.s || "").replace("USDT", "");
                    if (!tickerSymbols.includes(symbol)) return;
                    tickerData[symbol] = {
                        price: Number(d.c || 0),
                        change: Number(d.P || 0)
                    };
                    renderTickerV7();
                } catch (_) {}
            };
            tickerSocket.onclose = () => {
                tickerSocket = null;
                clearTimeout(tickerReconnect);
                tickerReconnect = setTimeout(connectTickerV7, 10000);
            };
            tickerSocket.onerror = () => {
                try { tickerSocket.close(); } catch (_) {}
            };
        } catch (_) {}
    }

    async function tickerRestFallback(){
        const endpoints = [
            "https://api1.binance.com/api/v3/ticker/24hr",
            "https://api2.binance.com/api/v3/ticker/24hr",
            "https://api3.binance.com/api/v3/ticker/24hr"
        ];
        for (const endpoint of endpoints) {
            try {
                const response = await fetch(endpoint, {cache:"no-store"});
                if (!response.ok) continue;
                const rows = await response.json();
                for (const row of rows) {
                    const symbol = String(row.symbol || "").toUpperCase().replace("USDT", "");
                    if (tickerSymbols.includes(symbol)) {
                        tickerData[symbol] = {
                            price: Number(row.lastPrice || 0),
                            change: Number(row.priceChangePercent || 0)
                        };
                    }
                }
                renderTickerV7();
                if (Object.keys(tickerData).length) return;
            } catch (_) {}
        }

        // Coinbase is a second browser-friendly price source. Change is omitted there.
        for (const symbol of tickerSymbols) {
            if (tickerData[symbol]?.price) continue;
            try {
                const r = await fetch(`https://api.coinbase.com/v2/prices/${symbol}-USD/spot`, {cache:"no-store"});
                if (!r.ok) continue;
                const j = await r.json();
                const p = Number(j?.data?.amount || 0);
                if (p) tickerData[symbol] = {price:p, change:NaN};
            } catch (_) {}
        }
        renderTickerV7();
        const ticker = document.getElementById("ticker");
        if (ticker && !ticker.querySelector(".ticker-item")) {
            ticker.innerHTML = '<span class="ticker-item">Live ticker temporarily unavailable — tap Market to refresh</span>';
        }
    }

    connectTickerV7();
    setTimeout(tickerRestFallback, 2500);
    window.nexusTickerRefreshV7 = () => { tickerRestFallback(); connectTickerV7(); };

    /* ---------- PROFILE: render auth data immediately, Firestore second ---------- */
    async function profileV7(){
        const user = auth.currentUser || currentUser;
        if (!user) return;

        text("profileName", user.displayName || "Miner User");
        text("profileEmailDisplay", user.email || "");
        text("profileId", `${user.uid.slice(0,12)}...`);

        // Never leave the screen stuck on Loading/--- while Firestore is unavailable.
        if (document.getElementById("profileTotalMined")?.textContent.includes("Loading")) text("profileTotalMined", "0.0000 NVX");
        if (document.getElementById("profileTasksDone")?.textContent.includes("Loading")) text("profileTasksDone", "0");
        if (document.getElementById("refCodeDisplay")?.textContent.includes("Loading")) text("refCodeDisplay", `NVX${user.uid.slice(0,8).toUpperCase()}`);

        try {
            const snap = await getDoc(doc(db, "users", user.uid));
            const data = snap.exists() ? snap.data() : {};
            const name = data.name || user.displayName || "Miner User";
            text("profileName", name);
            text("profileEmailDisplay", user.email || "");
            text("profileId", `${user.uid.slice(0,12)}...`);
            text("profileTotalMined", `${Number(data.totalMined || 0).toFixed(4)} NVX`);
            text("profileTasksDone", String(data.tasksCompleted || 0));
            text("refCodeDisplay", data.referralCode || `NVX${user.uid.slice(0,8).toUpperCase()}`);
        } catch (error) {
            console.warn("Profile V7 Firestore fallback:", error);
        }
    }

    /* ---------- WORLD NEWS: GDELT JSONP avoids browser CORS issues ---------- */
    let newsRequestId = 0;
    window.loadNews = async function(){
        const list = document.getElementById("newsList");
        const status = document.getElementById("newsStatus");
        if (!list) return;
        const requestId = ++newsRequestId;
        list.innerHTML = '<div class="status">Loading live world news...</div>';
        if (status) status.textContent = "Connecting...";

        const callback = `nexusNewsV7_${Date.now()}_${Math.random().toString(36).slice(2)}`;
        const script = document.createElement("script");
        const cleanup = () => {
            try { delete window[callback]; } catch (_) {}
            script.remove();
        };

        const timeout = setTimeout(() => {
            cleanup();
            if (requestId !== newsRequestId) return;
            list.innerHTML = '<div class="status">Live news temporarily unavailable. Tap Refresh to retry.</div>';
            if (status) status.textContent = "Offline";
        }, 12000);

        window[callback] = data => {
            clearTimeout(timeout);
            cleanup();
            if (requestId !== newsRequestId) return;
            const articles = Array.isArray(data?.articles) ? data.articles : [];
            if (!articles.length) {
                list.innerHTML = '<div class="status">No world news returned right now.</div>';
                if (status) status.textContent = "Connected";
                return;
            }
            list.innerHTML = articles.slice(0,10).map(article => {
                const title = article.title || "World News";
                const url = article.url || article.link || "";
                const date = article.seendate || "";
                return `<div class="news-item"><div class="news-title">${esc(title)}</div><div class="news-meta">${esc(date)}</div>${url ? `<button class="action-btn" style="margin-top:7px;padding:7px 10px" onclick="openLink('${String(url).replace(/'/g,"%27")}')">Read News</button>` : ""}</div>`;
            }).join("");
            if (status) status.textContent = "Connected • Live";
        };

        script.src = "https://api.gdeltproject.org/api/v2/doc/doc?query=world&mode=artlist&format=jsonp&callback=" + encodeURIComponent(callback) + "&maxrecords=10&timespan=1d";
        script.async = true;
        document.head.appendChild(script);
    };

    /* ---------- GOLD + USD/PKR: CORS-enabled sources ---------- */
    window.loadFinanceData = async function(){
        const status = document.getElementById("goldStatus");
        if (status) status.textContent = "Loading live gold + FX...";
        try {
            const [goldResponse, fxResponse] = await Promise.all([
                fetch("https://api.gold-api.com/price/XAU", {cache:"no-store"}),
                fetch("https://api.frankfurter.dev/v2/rate/USD/PKR?providers=SBP", {cache:"no-store"})
            ]);
            if (!goldResponse.ok) throw new Error(`Gold HTTP ${goldResponse.status}`);
            if (!fxResponse.ok) throw new Error(`FX HTTP ${fxResponse.status}`);
            const gold = await goldResponse.json();
            const fx = await fxResponse.json();
            const ounce = Number(gold?.price || gold?.value || gold?.usd || 0);
            const pkr = Number(fx?.rate || 0);
            if (!ounce || !pkr) throw new Error("Incomplete gold/FX response");
            const gramUsd = ounce / 31.1034768;
            const gramPkr = gramUsd * pkr;
            text("goldUsd", `$${ounce.toLocaleString(undefined,{maximumFractionDigits:2})} / oz`);
            text("goldUsdGram", `$${gramUsd.toFixed(2)} / gram`);
            text("goldPkr", `Approx. PKR ${gramPkr.toLocaleString(undefined,{maximumFractionDigits:0})} / gram`);
            text("gold24g", `PKR ${gramPkr.toLocaleString(undefined,{maximumFractionDigits:0})}`);
            text("gold22g", `PKR ${(gramPkr*22/24).toLocaleString(undefined,{maximumFractionDigits:0})}`);
            if (status) status.textContent = "Live gold + USD/PKR connected";
            localStorage.setItem("nexus_gold_v7", JSON.stringify({ounce,pkr,at:Date.now()}));
        } catch (error) {
            console.warn("Finance V7:", error);
            try {
                const cached = JSON.parse(localStorage.getItem("nexus_gold_v7") || "null");
                if (cached?.ounce && cached?.pkr) {
                    const gramPkr = (Number(cached.ounce)/31.1034768)*Number(cached.pkr);
                    text("goldUsd", `$${Number(cached.ounce).toLocaleString(undefined,{maximumFractionDigits:2})} / oz`);
                    text("goldUsdGram", `$${(Number(cached.ounce)/31.1034768).toFixed(2)} / gram`);
                    text("goldPkr", `Cached PKR ${gramPkr.toLocaleString(undefined,{maximumFractionDigits:0})} / gram`);
                    text("gold24g", `PKR ${gramPkr.toLocaleString(undefined,{maximumFractionDigits:0})}`);
                    text("gold22g", `PKR ${(gramPkr*22/24).toLocaleString(undefined,{maximumFractionDigits:0})}`);
                    if (status) status.textContent = "Cached gold/FX data";
                    return;
                }
            } catch (_) {}
            if (status) status.textContent = "Gold/FX temporarily unavailable";
        }
    };

    /* Re-run only when the relevant screen is opened. */
    document.addEventListener("click", event => {
        const button = event.target.closest(".more-item");
        if (!button) return;
        const label = button.textContent.toLowerCase();
        setTimeout(() => {
            if (label.includes("profile")) profileV7();
            if (label.includes("news")) window.loadNews();
            if (label.includes("gold") || label.includes("fx")) window.loadFinanceData();
        }, 200);
    }, true);

    const bootV7 = setInterval(() => {
        const user = auth.currentUser || currentUser;
        if (user) {
            profileV7();
            clearInterval(bootV7);
        }
    }, 800);
    setTimeout(() => clearInterval(bootV7), 15000);

    window.nexusAuxRepairV7 = {
        ticker: window.nexusTickerRefreshV7,
        profile: profileV7,
        news: window.loadNews,
        finance: window.loadFinanceData
    };
})();


/* =========================================================
   NEXUSNOVA BLOCKCHAIN V1 — CONNECT EXTERNAL WALLET ONLY
   IMPORTANT:
   - Non-custodial: NexusNova never receives/private-stores keys.
   - This stage ONLY connects an injected EVM wallet (MetaMask/
     Rabby/compatible browser wallet).
   - No deposit/withdraw transaction is sent.
   - Existing mining/wallet/market/tasks code is untouched.
========================================================= */

(function nexusBlockchainV1(){

    let nexusExternalProvider = null;
    let nexusExternalAddress = null;
    let nexusExternalChainId = null;

    const chainNames = {
        "0x1":"Ethereum Mainnet",
        "0x38":"BNB Smart Chain",
        "0x89":"Polygon",
        "0xa4b1":"Arbitrum One",
        "0xa":"Optimism",
        "0xa86a":"Avalanche C-Chain",
        "0x2105":"Base",
        "0x14a34":"Base Sepolia",
        "0xaa36a7":"Ethereum Sepolia"
    };

    function shortAddress(address){
        if(!address) return "---";
        return address.slice(0,6) + "..." + address.slice(-4);
    }

    function setWalletStatus(message, ok=false){
        const status = document.getElementById("walletActionStatus");
        if(status){
            status.textContent = message;
            status.style.color = ok ? "#22c55e" : "";
        }
    }

    function renderConnectedWallet(){
        const box = document.getElementById("connectedWalletBox");
        const addressEl = document.getElementById("connectedWalletAddress");
        const networkEl = document.getElementById("connectedWalletNetwork");
        const button = document.getElementById("connectWalletBtn");

        if(!box || !addressEl || !networkEl || !button) return;

        if(nexusExternalAddress){
            box.style.display = "block";
            addressEl.textContent = shortAddress(nexusExternalAddress);

            const chainKey =
                nexusExternalChainId
                ? String(nexusExternalChainId).toLowerCase()
                : "";

            networkEl.textContent =
                chainNames[chainKey] ||
                (nexusExternalChainId
                    ? "EVM Network • " + nexusExternalChainId
                    : "Connected");

            button.textContent = "🔗 Wallet Connected";
            button.disabled = true;
        }else{
            box.style.display = "none";
            addressEl.textContent = "---";
            networkEl.textContent = "---";
            button.textContent = "🔗 Connect Wallet";
            button.disabled = false;
        }
    }

    async function getInjectedWallet(){
        if(window.ethereum) return window.ethereum;

        setWalletStatus(
            "No browser wallet detected. Install MetaMask or another EVM-compatible wallet."
        );

        return null;
    }

    async function connectNexusWallet(){
        const provider = await getInjectedWallet();
        if(!provider) return;

        const button = document.getElementById("connectWalletBtn");
        if(button){
            button.disabled = true;
            button.textContent = "Connecting...";
        }

        try{
            const accounts = await provider.request({
                method: "eth_requestAccounts"
            });

            if(!accounts || !accounts.length){
                throw new Error("No wallet account was returned.");
            }

            nexusExternalProvider = provider;
            nexusExternalAddress = accounts[0];
            nexusExternalChainId = await provider.request({
                method: "eth_chainId"
            });

            renderConnectedWallet();

            setWalletStatus(
                "External wallet connected • NexusNova does not control your private keys.",
                true
            );

        }catch(error){
            console.error("NEXUS BLOCKCHAIN CONNECT ERROR:", error);

            if(button){
                button.disabled = false;
                button.textContent = "🔗 Connect Wallet";
            }

            if(error?.code === 4001){
                setWalletStatus("Wallet connection was rejected.");
            }else{
                setWalletStatus(
                    error?.message ||
                    "Wallet connection failed."
                );
            }
        }
    }

    function disconnectNexusWallet(){
        nexusExternalProvider = null;
        nexusExternalAddress = null;
        nexusExternalChainId = null;

        renderConnectedWallet();

        setWalletStatus(
            "Wallet disconnected. No blockchain transaction was sent."
        );
    }

    async function handleExternalAccountsChanged(accounts){
        if(!accounts || !accounts.length){
            disconnectNexusWallet();
            return;
        }

        nexusExternalAddress = accounts[0];

        try{
            nexusExternalChainId =
                await nexusExternalProvider.request({
                    method: "eth_chainId"
                });
        }catch(_){}

        renderConnectedWallet();

        setWalletStatus(
            "External wallet account changed.",
            true
        );
    }

    async function handleExternalChainChanged(chainId){
        nexusExternalChainId = chainId;
        renderConnectedWallet();

        setWalletStatus(
            "Wallet network changed. No transaction was sent.",
            true
        );
    }

    window.connectNexusWallet = connectNexusWallet;
    window.disconnectNexusWallet = disconnectNexusWallet;

    // Listen only to the external wallet provider.
    // No existing NexusNova app logic is replaced.
    window.addEventListener("load", () => {
        if(window.ethereum?.on){
            window.ethereum.on(
                "accountsChanged",
                handleExternalAccountsChanged
            );

            window.ethereum.on(
                "chainChanged",
                handleExternalChainChanged
            );
        }
    });

})();


/* =========================================================
   NEXUSNOVA FINAL NEWS OVERRIDE
   This is intentionally last so no earlier news implementation
   can overwrite it. It only owns the News screen.
========================================================= */
(() => {
    "use strict";

    let newsRequest = 0;

    const escNews = value => String(value ?? "").replace(/[&<>"']/g, c => ({
        "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"
    }[c]));

    const newsStatus = text => {
        const el = document.getElementById("newsStatus");
        if(el) el.textContent = text;
    };

    const renderNewsFinal = items => {
        const list = document.getElementById("newsList");
        if(!list) return;

        const clean = items
            .filter(x => x && x.title)
            .slice(0,12);

        if(!clean.length) throw new Error("No articles");

        list.innerHTML = clean.map(item => {
            const url = item.url || "";
            return `
                <article class="news-item">
                    <div class="news-title">${escNews(item.title)}</div>
                    <div class="news-meta">
                        ${escNews(item.source || "World News")}
                        ${item.date ? " • " + escNews(item.date) : ""}
                    </div>
                    ${
                        url
                        ? `<button type="button"
                             class="action-btn nexus-news-read"
                             data-url="${escNews(url)}"
                             style="margin-top:7px;padding:7px 10px">
                             Read News
                           </button>`
                        : ""
                    }
                </article>
            `;
        }).join("");

        list.querySelectorAll(".nexus-news-read").forEach(btn => {
            btn.addEventListener("click", () => {
                const url = btn.getAttribute("data-url");
                if(url) window.open(url, "_blank", "noopener,noreferrer");
            });
        });

        newsStatus(`Connected • Live • ${clean.length} stories`);
    };

    async function json(url, timeout=9000){
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeout);

        try{
            const response = await fetch(url,{
                cache:"no-store",
                signal:controller.signal
            });

            if(!response.ok){
                throw new Error(`HTTP ${response.status}`);
            }

            return await response.json();
        }finally{
            clearTimeout(timer);
        }
    }

    async function getGdelt(){
        const data = await json(
            "https://api.gdeltproject.org/api/v2/doc/doc" +
            "?query=world%20OR%20international%20OR%20geopolitics" +
            "&mode=artlist&format=json&maxrecords=12&timespan=24h"
        );

        return (Array.isArray(data.articles) ? data.articles : [])
            .map(a => ({
                title:a.title,
                url:a.url,
                date:a.seendate,
                source:a.domain || "World News"
            }));
    }

    async function getRss(rss, source){
        const data = await json(
            "https://api.rss2json.com/v1/api.json?rss_url=" +
            encodeURIComponent(rss)
        );

        return (Array.isArray(data.items) ? data.items : [])
            .map(a => ({
                title:a.title,
                url:a.link,
                date:a.pubDate,
                source
            }));
    }

    window.loadNews = async function(){
        const list = document.getElementById("newsList");
        if(!list) return;

        const request = ++newsRequest;

        list.innerHTML =
            '<div class="status">Loading live world news...</div>';
        newsStatus("Connecting...");

        const sources = [
            () => getGdelt(),
            () => getRss(
                "https://news.google.com/rss?hl=en-US&gl=US&ceid=US:en",
                "Google News"
            ),
            () => getRss(
                "https://feeds.bbci.co.uk/news/world/rss.xml",
                "BBC World"
            ),
            () => getRss(
                "https://rss.nytimes.com/services/xml/rss/nyt/World.xml",
                "New York Times World"
            )
        ];

        for(const source of sources){
            try{
                const items = await source();

                if(request !== newsRequest) return;

                if(items.length){
                    renderNewsFinal(items);
                    return;
                }
            }catch(error){
                console.warn("NexusNova final news source failed:",error);
            }
        }

        if(request === newsRequest){
            list.innerHTML =
                '<div class="status">Live news services are temporarily unavailable. Tap ↻ Refresh to retry.</div>';
            newsStatus("Offline");
        }
    };

    window.addEventListener("load", () => {
        setTimeout(() => window.loadNews(), 900);
    });
})();
