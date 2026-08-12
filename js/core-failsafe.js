/* =========================================================
   NEXUSNOVA CORE FAILSAFE
   Keeps core UI working even if an optional module fails.
========================================================= */

(async function NexusNovaCoreFailsafe(){

    const FIREBASE_APP_URL =
        "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";

    const FIREBASE_AUTH_URL =
        "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

    const FIREBASE_FS_URL =
        "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

    try{

        const {
            initializeApp,
            getApps
        } = await import(FIREBASE_APP_URL);

        const {
            getAuth,
            onAuthStateChanged
        } = await import(FIREBASE_AUTH_URL);

        const {
            getFirestore,
            doc,
            getDoc,
            updateDoc,
            setDoc
        } = await import(FIREBASE_FS_URL);

        const config = {
            apiKey:"AIzaSyBU75WYp5ioaMD1LrNcDyAvROFW2wrTil0",
            authDomain:"nexusnova-6ade2.firebaseapp.com",
            projectId:"nexusnova-6ade2",
            storageBucket:"nexusnova-6ade2.firebasestorage.app",
            messagingSenderId:"49791194817",
            appId:"1:49791194817:web:07f28326e0f15979536640"
        };

        const app =
            getApps().length
            ? getApps()[0]
            : initializeApp(config);

        const auth = getAuth(app);
        const db = getFirestore(app);

        let user = null;
        let mining = false;
        let miningStart = 0;
        let balance = 0;
        let tickerTimer = null;

        function byId(id){
            return document.getElementById(id);
        }

        function setMinerUI(active,start){

            const button = byId("mineBtn");
            const text = byId("btnText");
            const timer = byId("timer");

            if(!button || !text || !timer) return;

            button.classList.toggle("active",active);
            text.textContent =
                active
                ? "MINING ACTIVE"
                : "START MINING";

            if(!active){
                timer.textContent = "MINER OFFLINE";
                return;
            }

            clearInterval(tickerTimer);

            const tick = () => {

                const elapsed =
                    Math.max(
                        0,
                        Date.now()-start
                    );

                const total =
                    24*60*60*1000;

                const left =
                    Math.max(
                        0,
                        total-elapsed
                    );

                if(left <= 0){
                    clearInterval(tickerTimer);
                    mining = false;
                    setMinerUI(false,0);
                    return;
                }

                const h =
                    Math.floor(left/3600000);

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
            };

            tick();

            tickerTimer =
                setInterval(
                    tick,
                    1000
                );
        }

        async function loadUser(){

            if(!user) return;

            try{

                const ref =
                    doc(
                        db,
                        "users",
                        user.uid
                    );

                const snap =
                    await getDoc(ref);

                if(!snap.exists()) return;

                const data =
                    snap.data() || {};

                balance =
                    Number(
                        data.balance || 0
                    );

                const balanceEl =
                    byId("balance");

                if(balanceEl){
                    balanceEl.textContent =
                        balance.toFixed(4);
                }

                const active =
                    data.miningActive === true;

                const started =
                    Number(
                        data.miningStartedAt || 0
                    );

                mining =
                    active &&
                    started > 0 &&
                    Date.now()-started <
                    24*60*60*1000;

                miningStart =
                    mining
                    ? started
                    : 0;

                setMinerUI(
                    mining,
                    miningStart
                );

            }catch(error){

                console.warn(
                    "Failsafe user load:",
                    error
                );
            }
        }

        async function startMining(){

            if(!user){

                user =
                    auth.currentUser;

            }

            if(!user){

                alert(
                    "Please wait for your account to finish loading."
                );

                return;
            }

            if(mining){

                alert(
                    "Mining session is already active."
                );

                return;
            }

            const start =
                Date.now();

            // Make the UI respond immediately.
            mining = true;
            miningStart = start;
            setMinerUI(true,start);

            try{

                await updateDoc(
                    doc(
                        db,
                        "users",
                        user.uid
                    ),
                    {
                        miningActive:true,
                        miningStartedAt:start,
                        miningLastUpdate:start
                    }
                );

            }catch(error){

                console.error(
                    "Failsafe mining save:",
                    error
                );

                mining = false;
                miningStart = 0;
                setMinerUI(false,0);

                alert(
                    "Mining could not be saved to Firebase."
                );
            }
        }

        // Override only the core mining click with the reliable handler.
        window.nexusFailsafeStartMining =
            startMining;

        function wireCoreButtons(){

            const mineBtn =
                byId("mineBtn");

            if(mineBtn){

                mineBtn.onclick =
                    startMining;
            }

            // Navigation works without relying on inline module functions.
            document
                .querySelectorAll(".dock-item")
                .forEach(button => {

                    if(button.dataset.nexusFailsafe){
                        return;
                    }

                    button.dataset.nexusFailsafe =
                        "1";

                    button.addEventListener(
                        "click",
                        () => {

                            const span =
                                button.querySelector("span");

                            const name =
                                span
                                ? span.textContent.trim().toLowerCase()
                                : "";

                            const map = {
                                "mine":"home",
                                "wallet":"wallet",
                                "tasks":"tasks",
                                "market":"market"
                            };

                            const tabName =
                                map[name];

                            if(!tabName) return;

                            document
                                .querySelectorAll(".tab")
                                .forEach(
                                    tab =>
                                        tab.classList.remove("active")
                                );

                            const tab =
                                byId(
                                    "tab-"+tabName
                                );

                            if(tab){
                                tab.classList.add("active");
                            }

                            document
                                .querySelectorAll(".dock-item")
                                .forEach(
                                    x =>
                                        x.classList.remove("active")
                                );

                            button.classList.add("active");

                            if(
                                tabName === "market"
                            ){
                                loadLiveMarket();
                            }

                            if(
                                tabName === "wallet"
                            ){
                                loadWalletPrices();
                            }
                        }
                    );
                });
        }

        async function loadLiveMarket(){

            const list =
                byId("marketList");

            const count =
                byId("marketCount");

            if(!list) return;

            try{

                list.innerHTML =
                    '<div class="status">Loading live market...</div>';

                const response =
                    await fetch(
                        "https://api.binance.com/api/v3/ticker/24hr",
                        {
                            cache:"no-store"
                        }
                    );

                if(!response.ok){
                    throw new Error(
                        "Market HTTP "+response.status
                    );
                }

                const rows =
                    await response.json();

                const wanted = new Set([
                    "BTCUSDT","ETHUSDT","BNBUSDT",
                    "SOLUSDT","XRPUSDT","ADAUSDT",
                    "DOGEUSDT","TRXUSDT","AVAXUSDT",
                    "LINKUSDT","DOTUSDT","LTCUSDT",
                    "BCHUSDT","TONUSDT","SHIBUSDT",
                    "PEPEUSDT","SUIUSDT","NEARUSDT",
                    "APTUSDT","ATOMUSDT","UNIUSDT",
                    "AAVEUSDT","ETCUSDT","FILUSDT",
                    "ALGOUSDT","VETUSDT","HBARUSDT",
                    "XLMUSDT"
                ]);

                const names = {
                    BTC:"Bitcoin",ETH:"Ethereum",BNB:"BNB",
                    SOL:"Solana",XRP:"XRP",ADA:"Cardano",
                    DOGE:"Dogecoin",TRX:"TRON",
                    AVAX:"Avalanche",LINK:"Chainlink",
                    DOT:"Polkadot",LTC:"Litecoin",
                    BCH:"Bitcoin Cash",TON:"Toncoin",
                    SHIB:"Shiba Inu",PEPE:"Pepe",
                    SUI:"Sui",NEAR:"NEAR Protocol",
                    APT:"Aptos",ATOM:"Cosmos",
                    UNI:"Uniswap",AAVE:"Aave",
                    ETC:"Ethereum Classic",FIL:"Filecoin",
                    ALGO:"Algorand",VET:"VeChain",
                    HBAR:"Hedera",XLM:"Stellar"
                };

                const coins =
                    rows
                    .filter(
                        row =>
                            wanted.has(
                                String(
                                    row.symbol || ""
                                ).toUpperCase()
                            )
                    )
                    .map(row => {

                        const pair =
                            String(
                                row.symbol || ""
                            ).toUpperCase();

                        const symbol =
                            pair.replace(
                                "USDT",
                                ""
                            );

                        return {
                            symbol,
                            name:
                                names[symbol] ||
                                symbol,
                            price:
                                Number(
                                    row.lastPrice || 0
                                ),
                            change:
                                Number(
                                    row.priceChangePercent || 0
                                )
                        };
                    });

                list.innerHTML =
                    coins.map(
                        (coin,index) => `
                        <div class="coin-row">
                            <div class="coin-rank">
                                #${index+1}
                            </div>
                            <div>
                                <div class="coin-name">
                                    ${coin.name}
                                </div>
                                <div class="coin-symbol">
                                    ${coin.symbol}
                                </div>
                            </div>
                            <div class="coin-price">
                                $${coin.price.toLocaleString(
                                    undefined,
                                    {
                                        maximumFractionDigits:8
                                    }
                                )}
                                <div class="${coin.change>=0?"up":"down"} coin-change">
                                    ${coin.change>=0?"+":""}${coin.change.toFixed(2)}%
                                </div>
                            </div>
                        </div>
                        `
                    ).join("");

                if(count){
                    count.textContent =
                        coins.length+
                        " live pairs";
                }

            }catch(error){

                console.error(
                    "Failsafe market:",
                    error
                );

                list.innerHTML =
                    '<div class="status">Live market temporarily unavailable. Tap Market again to retry.</div>';
            }
        }

        async function loadWalletPrices(){

            // The main wallet renderer is the single source of truth.
            // Do not create a second set of balance nodes.
            if(typeof window.__nexusPrimaryWalletRenderer === "function"){
                try{
                    window.__nexusPrimaryWalletRenderer();
                    return;
                }catch(_){}
            }

            const list =
                byId("walletAssetList");

            if(!list) return;

            const assets = [
                ["BTC","Bitcoin","₿"],
                ["ETH","Ethereum","Ξ"],
                ["BNB","BNB","◆"],
                ["SOL","Solana","S"],
                ["XRP","XRP","X"],
                ["ADA","Cardano","A"],
                ["DOGE","Dogecoin","Ð"],
                ["TRX","TRON","T"],
                ["AVAX","Avalanche","A"],
                ["LINK","Chainlink","L"],
                ["DOT","Polkadot","D"],
                ["LTC","Litecoin","Ł"],
                ["BCH","Bitcoin Cash","B"],
                ["TON","Toncoin","T"],
                ["USDT","Tether","₮"],
                ["USDC","USD Coin","$"]
            ];

            // Render the assets independently of page2.js.
            // This is the important fix: the wallet no longer stays on
            // "Loading wallet..." if the optional wallet module fails.
            list.innerHTML =
                assets.map(
                    asset => `
                    <div class="coin-row" data-wallet-symbol="${asset[0]}">
                        <div style="
                            width:34px;
                            height:34px;
                            border-radius:50%;
                            background:#182234;
                            display:flex;
                            align-items:center;
                            justify-content:center;
                            font-weight:700;
                            color:#00f5d4;
                        ">
                            ${asset[2]}
                        </div>

                        <div style="min-width:0">
                            <div class="coin-name">
                                ${asset[1]}
                            </div>
                            <div class="coin-symbol">
                                ${asset[0]} • Live USD price
                            </div>
                        </div>

                        <div style="text-align:right">
                            <div class="coin-price wallet-live-price">
                                Loading...
                            </div>
                            <div style="
                                font-size:10px;
                                color:#64748b;
                                margin-top:3px;
                            ">
                                Balance: 0.000000 ${asset[0]}
                            </div>
                        </div>
                    </div>
                    `
                ).join("");

            try{

                const controller =
                    new AbortController();

                const timeout =
                    setTimeout(
                        () => controller.abort(),
                        8000
                    );

                const response =
                    await fetch(
                        "https://api.binance.com/api/v3/ticker/price",
                        {
                            cache:"no-store",
                            signal:controller.signal
                        }
                    );

                clearTimeout(timeout);

                if(!response.ok){
                    throw new Error(
                        "Wallet prices HTTP "+
                        response.status
                    );
                }

                const rows =
                    await response.json();

                const prices = {};

                rows.forEach(
                    row => {

                        const pair =
                            String(
                                row.symbol || ""
                            ).toUpperCase();

                        if(
                            pair.endsWith("USDT")
                        ){

                            prices[
                                pair.replace(
                                    "USDT",
                                    ""
                                )
                            ] =
                                Number(
                                    row.price || 0
                                );
                        }
                    }
                );

                prices.USDT =
                    prices.USDT || 1;

                prices.USDC =
                    prices.USDC || 1;

                updateWalletPriceRows(
                    prices,
                    "Binance live"
                );

            }catch(binanceError){

                console.warn(
                    "Binance wallet prices unavailable:",
                    binanceError
                );

                // Public fallback with a short timeout.
                try{

                    const controller =
                        new AbortController();

                    const timeout =
                        setTimeout(
                            () => controller.abort(),
                            8000
                        );

                    const response =
                        await fetch(
                            "https://api.coingecko.com/api/v3/simple/price"+
                            "?ids=bitcoin,ethereum,binancecoin,solana,ripple,"+
                            "cardano,dogecoin,tron,avalanche-2,chainlink,"+
                            "polkadot,litecoin,bitcoin-cash,the-open-network,"+
                            "tether,usd-coin"+
                            "&vs_currencies=usd",
                            {
                                cache:"no-store",
                                signal:controller.signal
                            }
                        );

                    clearTimeout(timeout);

                    if(!response.ok){
                        throw new Error(
                            "CoinGecko wallet HTTP "+
                            response.status
                        );
                    }

                    const data =
                        await response.json();

                    updateWalletPriceRows(
                        {
                            BTC:Number(data.bitcoin?.usd || 0),
                            ETH:Number(data.ethereum?.usd || 0),
                            BNB:Number(data.binancecoin?.usd || 0),
                            SOL:Number(data.solana?.usd || 0),
                            XRP:Number(data.ripple?.usd || 0),
                            ADA:Number(data.cardano?.usd || 0),
                            DOGE:Number(data.dogecoin?.usd || 0),
                            TRX:Number(data.tron?.usd || 0),
                            AVAX:Number(data["avalanche-2"]?.usd || 0),
                            LINK:Number(data.chainlink?.usd || 0),
                            DOT:Number(data.polkadot?.usd || 0),
                            LTC:Number(data.litecoin?.usd || 0),
                            BCH:Number(data["bitcoin-cash"]?.usd || 0),
                            TON:Number(data["the-open-network"]?.usd || 0),
                            USDT:Number(data.tether?.usd || 1),
                            USDC:Number(data["usd-coin"]?.usd || 1)
                        },
                        "CoinGecko live"
                    );

                }catch(fallbackError){

                    console.warn(
                        "CoinGecko wallet fallback unavailable:",
                        fallbackError
                    );

                    const status =
                        byId("walletActionStatus");

                    if(status){
                        status.textContent =
                            "Live price service unavailable. Tap Refresh to retry.";
                    }
                }
            }
        }

        function updateWalletPriceRows(
            prices,
            sourceName
        ){

            const rows =
                document.querySelectorAll(
                    "[data-wallet-symbol]"
                );

            let total = 0;
            let liveCount = 0;

            rows.forEach(
                row => {

                    const symbol =
                        row.dataset.walletSymbol;

                    const price =
                        Number(
                            prices[symbol] || 0
                        );

                    const priceEl =
                        row.querySelector(
                            ".wallet-live-price"
                        );

                    if(priceEl){

                        if(price > 0){

                            priceEl.textContent =
                                "$"+
                                price.toLocaleString(
                                    undefined,
                                    {
                                        minimumFractionDigits:
                                            price < 1 ? 4 : 2,
                                        maximumFractionDigits:8
                                    }
                                );

                            priceEl.style.color =
                                "#00f5d4";

                            liveCount++;

                        }else{

                            priceEl.textContent =
                                "Price unavailable";

                            priceEl.style.color =
                                "#64748b";
                        }
                    }
                }
            );

            const totalEl =
                byId("walletTotalUsd");

            if(totalEl){

                // Balances are intentionally zero until real blockchain
                // addresses/backend are connected.
                totalEl.textContent =
                    "$ 0.00";
            }

            const status =
                byId("walletActionStatus");

            if(status){

                status.textContent =
                    liveCount+
                    " live crypto prices • "+
                    sourceName+
                    " • On-chain balances pending";
            }
        }


        // Auth listener for initial mining state.
        onAuthStateChanged(
            auth,
            async loggedUser => {

                if(loggedUser){

                    user = loggedUser;

                    await loadUser();

                }

                wireCoreButtons();

            }
        );

        // Also wire immediately; auth can arrive later.
        wireCoreButtons();

        // Market can run independently.
        loadLiveMarket();

        // Wallet price display can update periodically.
        setInterval(
            loadWalletPrices,
            60000
        );

        window.nexusFailsafeMarket =
            loadLiveMarket;

        window.nexusFailsafeWallet =
            loadWalletPrices;

    }catch(error){

        console.error(
            "NEXUS CORE FAILSAFE FAILED:",
            error
        );

        // At minimum keep navigation clickable.
        document
            .querySelectorAll(".dock-item")
            .forEach(button => {

                button.addEventListener(
                    "click",
                    () => {

                        const span =
                            button.querySelector("span");

                        const map = {
                            "Mine":"home",
                            "Wallet":"wallet",
                            "Tasks":"tasks",
                            "Market":"market"
                        };

                        const name =
                            map[
                                span?.textContent?.trim()
                            ];

                        if(!name) return;

                        document
                            .querySelectorAll(".tab")
                            .forEach(
                                tab =>
                                    tab.classList.remove("active")
                            );

                        document
                            .getElementById(
                                "tab-"+name
                            )
                            ?.classList.add("active");
                    }
                );
            });
    }

})();


/* =========================================================
   NEXUSNOVA UNIVERSAL BUTTON RECOVERY V5
   Keeps navigation + core actions alive even if optional modules fail.
========================================================= */
(function nexusUniversalRecovery(){

    const $ = id => document.getElementById(id);

    function showTab(name){

        document.querySelectorAll(".tab").forEach(
            section => section.classList.remove("active")
        );

        const target = $("tab-" + name);

        if(target){
            target.classList.add("active");
        }

        document.querySelectorAll(
            "[id^='tab-'][data-tab]"
        ).forEach(
            button => {
                button.classList.toggle(
                    "active",
                    button.dataset.tab === name
                );
            }
        );

        // Hide More popup if it is open.
        const moreMenu = $("moreMenu");
        if(moreMenu){
            moreMenu.style.display = "none";
        }
    }

    // Navigation always works.
    if(typeof window.switchTab !== 'function') window.switchTab = function(name, button){

        showTab(name);

        try{
            if(button){
                document.querySelectorAll(
                    ".bottom-nav button, .bottom-nav a"
                ).forEach(
                    el => el.classList.remove("active")
                );
                button.classList.add("active");
            }
        }catch(_){}

        try{
            if(name === "market" &&
               typeof window.loadMarket === "function"){
                window.loadMarket(true);
            }
        }catch(_){}

        try{
            if(name === "wallet" &&
               typeof window.refreshWalletFoundation === "function"){
                window.refreshWalletFoundation();
            }
        }catch(_){}
    };

    if(typeof window.openMoreTab !== 'function') window.openMoreTab = function(name){
        showTab(name);

        try{
            if(name === "market" &&
               typeof window.loadMarket === "function"){
                window.loadMarket(true);
            }
            if(name === "news" &&
               typeof window.loadNews === "function"){
                window.loadNews(true);
            }
            if(name === "chat" &&
               typeof window.loadChat === "function"){
                window.loadChat();
            }
            if(name === "finance" &&
               typeof window.loadFinanceData === "function"){
                window.loadFinanceData();
            }
        }catch(error){
            console.warn("More tab handler:", error);
        }
    };

    window.toggleMore = function(){

        const menu = $("moreMenu");

        if(!menu){
            return;
        }

        const current =
            getComputedStyle(menu).display;

        menu.style.display =
            current === "none"
            ? "block"
            : "none";
    };

    // Mining fallback: immediate UI + persistent local state.
    window.startMining = function(){

        const btn = $("mineBtn");
        const status =
            document.querySelector(
                ".miner-status, #minerStatus"
            );
        const text = $("btnText");

        localStorage.setItem(
            "nexusnova_mining_active",
            "1"
        );

        localStorage.setItem(
            "nexusnova_mining_started",
            String(Date.now())
        );

        if(btn){
            btn.classList.add("mining-active");
            btn.disabled = false;
        }

        if(text){
            text.textContent = "MINING ACTIVE";
        }

        if(status){
            status.textContent = "MINER ONLINE";
            status.style.color = "#00f5d4";
        }

        const timer = $("timer");
        if(timer){
            timer.textContent = "24H SESSION";
        }

        alert("Mining started successfully.");
    };

    // If page2.js did not expose a mining handler, bind the actual button.
    const mineBtn = $("mineBtn");
    if(mineBtn){

        mineBtn.addEventListener(
            "click",
            function(){
                // If the normal handler has not changed the UI, make sure
                // the recovery state is visible.
                setTimeout(
                    () => {

                        const active =
                            localStorage.getItem(
                                "nexusnova_mining_active"
                            ) === "1";

                        const status =
                            document.querySelector(
                                ".miner-status, #minerStatus"
                            );

                        const text = $("btnText");

                        if(active && status &&
                           /offline/i.test(
                               status.textContent || ""
                           )){

                            status.textContent =
                                "MINER ONLINE";

                            status.style.color =
                                "#00f5d4";

                            if(text){
                                text.textContent =
                                    "MINING ACTIVE";
                            }
                        }

                    },
                    250
                );
            },
            {passive:true}
        );
    }

    // Wallet actions remain clearly marked until real blockchain routing exists.
    

    if(typeof window.handleWithdraw !== "function"){
        window.handleWithdraw = function(){
            alert(
                "Withdraw wallet connection is the next blockchain stage. " +
                "No fake transaction will be created."
            );
        };
    }

    // Market fallback if its module is unavailable.
    if(typeof window.loadMarket !== "function"){

        window.loadMarket = async function(){

            const list = $("marketList");
            if(!list) return;

            list.innerHTML =
                '<div class="status">Loading live market...</div>';

            try{

                const controller = new AbortController();
                const timeout =
                    setTimeout(
                        () => controller.abort(),
                        8000
                    );

                const response =
                    await fetch(
                        "https://api.binance.com/api/v3/ticker/24hr",
                        {
                            cache:"no-store",
                            signal:controller.signal
                        }
                    );

                clearTimeout(timeout);

                if(!response.ok){
                    throw new Error("Market HTTP "+response.status);
                }

                const rows =
                    await response.json();

                const wanted = new Set([
                    "BTCUSDT","ETHUSDT","BNBUSDT","SOLUSDT",
                    "XRPUSDT","ADAUSDT","DOGEUSDT","TRXUSDT",
                    "AVAXUSDT","LINKUSDT","DOTUSDT","LTCUSDT",
                    "BCHUSDT","TONUSDT","SHIBUSDT","PEPEUSDT",
                    "SUIUSDT","NEARUSDT","APTUSDT","ATOMUSDT"
                ]);

                const selected =
                    rows
                    .filter(r =>
                        wanted.has(
                            String(r.symbol || "").toUpperCase()
                        )
                    )
                    .sort(
                        (a,b) =>
                            Number(b.quoteVolume || 0) -
                            Number(a.quoteVolume || 0)
                    );

                list.innerHTML =
                    selected.map(
                        r => {

                            const symbol =
                                String(r.symbol)
                                .replace("USDT","");

                            const price =
                                Number(r.lastPrice || 0);

                            const change =
                                Number(r.priceChangePercent || 0);

                            return `
                            <div class="market-row">
                                <div>
                                    <strong>${symbol}</strong>
                                    <div class="coin-symbol">
                                        USDT pair
                                    </div>
                                </div>
                                <div style="text-align:right">
                                    <strong>
                                        $${price.toLocaleString(
                                            undefined,
                                            {
                                                maximumFractionDigits:8
                                            }
                                        )}
                                    </strong>
                                    <div class="${
                                        change >= 0
                                        ? "up"
                                        : "down"
                                    }">
                                        ${
                                            change >= 0 ? "+" : ""
                                        }${change.toFixed(2)}%
                                    </div>
                                </div>
                            </div>`;
                        }
                    ).join("");

                const count = $("marketCount");
                if(count){
                    count.textContent =
                        selected.length+" live pairs";
                }

                const status = $("marketStatus");
                if(status){
                    status.textContent =
                        "Connected • Live";
                }

            }catch(error){

                console.warn("MARKET RECOVERY:", error);

                list.innerHTML =
                    '<div class="status">Market temporarily unavailable. Tap Refresh.</div>';

                const status = $("marketStatus");
                if(status){
                    status.textContent = "Offline";
                }
            }
        };
    }

    // Finance / news refresh buttons: call normal functions when present,
    // otherwise give a useful non-blocking message.
    if(typeof window.loadFinanceData !== "function"){
        window.loadFinanceData = function(){
            const s = $("goldStatus");
            if(s){
                s.textContent =
                    "Gold/FX module ready — refresh to retry live data.";
            }
        };
    }

    if(typeof window.loadNews !== "function"){
        window.loadNews = function(){
            const list = $("newsList");
            if(list){
                list.innerHTML =
                    '<div class="status">News feed temporarily unavailable. Tap Refresh to retry.</div>';
            }
        };
    }

    // Chat: make the button usable even if Firestore chat module fails.
    if(typeof window.sendChatMessage !== "function"){
        window.sendChatMessage = async function(){

            const input = $("chatInput");
            const box = $("chatBox");

            if(!input || !box) return;

            const text = input.value.trim();
            if(!text) return;

            const row =
                document.createElement("div");

            row.className = "chat-message mine";
            row.textContent = text;

            box.appendChild(row);
            input.value = "";

            box.scrollTop = box.scrollHeight;
        };
    }

    if(typeof window.loadChat !== "function"){
        window.loadChat = function(){};
    }

    // Location.
    if(typeof window.getMyLocation !== "function"){
        window.getMyLocation = function(){

            const status = $("locationStatus");

            if(!navigator.geolocation){
                if(status){
                    status.textContent =
                        "Location is not supported by this browser.";
                }
                return;
            }

            if(status){
                status.textContent =
                    "Requesting location permission...";
            }

            navigator.geolocation.getCurrentPosition(
                position => {

                    if(status){
                        status.textContent =
                            "Location ready: "+
                            position.coords.latitude.toFixed(5)+
                            ", "+
                            position.coords.longitude.toFixed(5);
                    }

                    localStorage.setItem(
                        "nexusnova_lat",
                        String(position.coords.latitude)
                    );

                    localStorage.setItem(
                        "nexusnova_lng",
                        String(position.coords.longitude)
                    );
                },
                error => {

                    if(status){
                        status.textContent =
                            "Location permission was not granted.";
                    }

                    console.warn(error);
                },
                {
                    enableHighAccuracy:true,
                    timeout:10000,
                    maximumAge:0
                }
            );
        };
    }

    if(typeof window.openCurrentLocation !== "function"){
        window.openCurrentLocation = function(){

            const lat =
                localStorage.getItem("nexusnova_lat");

            const lng =
                localStorage.getItem("nexusnova_lng");

            if(!lat || !lng){
                if(typeof window.getMyLocation === "function"){
                    window.getMyLocation();
                }
                return;
            }

            window.open(
                "https://www.google.com/maps?q="+
                encodeURIComponent(lat)+
                ","+
                encodeURIComponent(lng),
                "_blank",
                "noopener,noreferrer"
            );
        };
    }

    // Emergency / family controls never silently fail.
    if(typeof window.addEmergencyContact !== "function"){
        window.addEmergencyContact = function(){

            const name = $("contactName")?.value?.trim();
            const phone = $("contactPhone")?.value?.trim();

            if(!name || !phone){
                alert("Enter contact name and phone number first.");
                return;
            }

            const contacts =
                JSON.parse(
                    localStorage.getItem(
                        "nexusnova_emergency_contacts"
                    ) || "[]"
                );

            contacts.push({name,phone});

            localStorage.setItem(
                "nexusnova_emergency_contacts",
                JSON.stringify(contacts)
            );

            if($("contactName")) $("contactName").value="";
            if($("contactPhone")) $("contactPhone").value="";

            if(typeof window.renderEmergencyContacts === "function"){
                window.renderEmergencyContacts();
            }else{
                alert("Emergency contact added.");
            }
        };
    }

    if(typeof window.emergencySOS !== "function"){
        window.emergencySOS = function(){

            const contacts =
                JSON.parse(
                    localStorage.getItem(
                        "nexusnova_emergency_contacts"
                    ) || "[]"
                );

            if(!contacts.length){
                alert(
                    "Add an emergency contact first."
                );
                return;
            }

            const phone = contacts[0].phone;

            if(
                confirm(
                    "Call emergency contact "+contacts[0].name+"?"
                )
            ){
                window.location.href =
                    "tel:"+phone;
            }
        };
    }

    // Make missing optional actions harmless.
    if(typeof window.claimDailyReward !== "function"){
        window.claimDailyReward = function(){
            alert("Daily reward is ready. Please try again after reconnecting.");
        };
    }

    if(typeof window.completeTask !== "function"){
        window.completeTask = function(){
            alert("Task module is temporarily unavailable.");
        };
    }

    if(typeof window.watchAdReward !== "function"){
        window.watchAdReward = function(){
            alert("Ad reward module is temporarily unavailable.");
        };
    }

    if(typeof window.clearAIChat !== "function"){
        window.clearAIChat = function(){
            const box = $("aiBox");
            if(box) box.innerHTML = "";
        };
    }

    // Boot market and wallet after all scripts have loaded.
    window.addEventListener(
        "load",
        () => {

            setTimeout(
                () => {

                    try{
                        if(typeof window.loadMarket === "function"){
                            window.loadMarket(true);
                        }
                    }catch(_){}

                    try{
                        if(typeof window.refreshWalletFoundation === "function"){
                            window.refreshWalletFoundation();
                        }
                    }catch(_){}

                },
                600
            );
        }
    );

})();
