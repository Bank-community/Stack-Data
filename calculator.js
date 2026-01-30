import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-database.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, setPersistence, browserLocalPersistence } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyAgzs3GqaafEHQSnEyZqrjQT0r_6jXMaGQ",
    authDomain: "re-store-7f2b3.firebaseapp.com",
    databaseURL: "https://re-store-7f2b3-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "re-store-7f2b3",
    storageBucket: "re-store-7f2b3.appspot.com",
    messagingSenderId: "774895588253",
    appId: "1:774895588253:web:dad6c0fed92bce7c39574"
};
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);
const auth = getAuth(app);

// IMPORTANT: User Email logic & Auto Password
const userEmail = "jackprince79036@gmail.com"; 
const AUTO_PASSWORD = "123580"; 
const CACHE_KEY = "stack_calculator_cache_v1";

// DOM Elements
const loginScreen = document.getElementById('login-screen');
const loginButton = document.getElementById('login-button');
const passwordInput = document.getElementById('password');
const loginError = document.getElementById('login-error');

const appContainer = document.getElementById('app-container');
const loaderOverlay = document.getElementById('loader-overlay');

const checkboxContainer = document.getElementById('stack-checkbox-container');
const calculatorDisplayTitle = document.getElementById('calculator-display-title');
const calculatorDisplayBags = document.getElementById('calculator-display-bags');
const calculatorDisplayWeight = document.getElementById('calculator-display-weight');
const calculatorDisplayAverage = document.getElementById('calculator-display-average'); 
const calculatorGrossCheckbox = document.getElementById('calculator-gross-checkbox');
const calculatorOutwardCheckbox = document.getElementById('calculator-outward-checkbox'); // NEW Outward Checkbox
const multiSelectToggle = document.getElementById('multi-select-toggle');

let stackMasterData = {};
let currentCommodityFilter = 'All';

// --- Auth State Listener ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        console.log("User verified via Session or Login.");
        loginScreen.style.display = 'none'; 
        appContainer.classList.remove('hidden');
        loadCachedData(); 
        fetchData();
    } else {
        console.log("No active session. Attempting Auto-Login...");
        loginScreen.style.display = 'flex'; 
        appContainer.classList.add('hidden');
        attemptAutoLogin();
    }
});

// --- Auto Login Logic ---
function attemptAutoLogin() {
    passwordInput.value = AUTO_PASSWORD;
    loginButton.textContent = 'Verifying...';
    loginButton.disabled = true;

    setPersistence(auth, browserLocalPersistence)
        .then(() => {
            return signInWithEmailAndPassword(auth, userEmail, AUTO_PASSWORD);
        })
        .catch((error) => {
            console.error("Auto-login failed:", error);
            loginError.textContent = 'Verification Failed. Check Internet.';
            loginError.classList.remove('hidden');
            loginButton.textContent = 'Retry Login';
            loginButton.disabled = false;
        });
}


// --- Data Handling ---
function loadCachedData() {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
        try {
            const data = JSON.parse(cached);
            processMasterData(Object.values(data));
            renderStackCheckboxes('All');
            console.log("Data loaded from LocalStorage (Instant)");
        } catch (e) {
            console.error("Cache parsing error", e);
        }
    }
}

function fetchData() {
    const transactionsRef = ref(database, 'transactions');
    onValue(transactionsRef, (snapshot) => {
        const rawData = snapshot.val() || {};
        localStorage.setItem(CACHE_KEY, JSON.stringify(rawData));
        const allTransactions = Object.values(rawData);
        processMasterData(allTransactions);
        renderStackCheckboxes(currentCommodityFilter);
        if(loaderOverlay) loaderOverlay.classList.add('hidden');
    });
}

function processMasterData(transactions) {
    const stackData = {};
    transactions.forEach(tx => {
        const stackNum = tx.stackNumber;
        if (!stackData[stackNum]) {
            stackData[stackNum] = {
                netBags: 0, netWeight: 0,
                inwardBags: 0, inwardWeight: 0,
                outwardBags: 0, outwardWeight: 0, // NEW: Track Outward separately
                commodities: new Set()
            };
        }
        const bags = tx.bags || 0;
        const weight = tx.weight || 0;

        if (tx.transactionType === 'inward') {
            stackData[stackNum].netBags += bags;
            stackData[stackNum].netWeight += weight;
            stackData[stackNum].inwardBags += bags;
            stackData[stackNum].inwardWeight += weight;
        } else {
            // Outward Logic
            stackData[stackNum].netBags -= bags;
            stackData[stackNum].netWeight -= weight;
            
            // NEW: Accumulate Outward totals
            stackData[stackNum].outwardBags += bags;
            stackData[stackNum].outwardWeight += weight;
        }
        stackData[stackNum].commodities.add(tx.commodity);
    });
    for (const stack in stackData) {
        stackData[stack].netWeight = parseFloat(stackData[stack].netWeight.toFixed(5));
    }
    stackMasterData = stackData;
}

// --- Render Logic ---
function renderStackCheckboxes(commodityFilter) {
    const previouslyChecked = new Set();
    document.querySelectorAll('.stack-calculator-checkbox:checked').forEach(cb => {
        previouslyChecked.add(cb.dataset.stack);
    });

    currentCommodityFilter = commodityFilter;
    checkboxContainer.innerHTML = '';
    const stackNumbers = Object.keys(stackMasterData).sort((a, b) => a - b);
    
    stackNumbers.forEach(stackNum => {
        const stackInfo = stackMasterData[stackNum];
        let hasCommodity = false;
        if (commodityFilter === 'All') hasCommodity = true;
        else if (stackInfo.commodities.has(commodityFilter)) hasCommodity = true;

        if (hasCommodity) {
            const label = document.createElement('label');
            label.className = "stack-checkbox-label flex items-center justify-center gap-3 p-3 border border-gray-200 rounded-xl cursor-pointer transition-all duration-200 bg-gray-50";
            
            const isChecked = previouslyChecked.has(stackNum) ? 'checked' : '';

            label.innerHTML = `
                <input type="checkbox" data-stack="${stackNum}" ${isChecked} class="h-6 w-6 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 stack-calculator-checkbox accent-indigo-600">
                <span class="font-extrabold text-gray-700 text-xl select-none">${stackNum}</span>
            `;
            checkboxContainer.appendChild(label);
        }
    });

    document.querySelectorAll('.stack-calculator-checkbox').forEach(cb => {
        cb.addEventListener('change', function(e) {
            const isMultiMode = multiSelectToggle.checked;
            if (!isMultiMode && this.checked) {
                document.querySelectorAll('.stack-calculator-checkbox').forEach(other => {
                    if (other !== this) other.checked = false;
                });
            }
            updateCalculatorDisplay();
        });
    });
    updateCalculatorDisplay();
}

// --- UPDATED CALCULATOR LOGIC ---
function updateCalculatorDisplay() {
    const isGrossMode = calculatorGrossCheckbox.checked;
    const isOutwardMode = calculatorOutwardCheckbox.checked; // NEW Mode

    let totalBags = 0;
    let totalWeight = 0;
    const checkedBoxes = document.querySelectorAll('.stack-calculator-checkbox:checked');
    
    checkedBoxes.forEach(cb => {
        const stackNum = cb.dataset.stack;
        if (stackMasterData[stackNum]) {
            if (isGrossMode) {
                // Show Inward Only
                totalBags += stackMasterData[stackNum].inwardBags;
                totalWeight += stackMasterData[stackNum].inwardWeight;
            } else if (isOutwardMode) {
                // NEW: Show Outward Only
                totalBags += stackMasterData[stackNum].outwardBags;
                totalWeight += stackMasterData[stackNum].outwardWeight;
            } else {
                // Default: Net Stock
                totalBags += stackMasterData[stackNum].netBags;
                totalWeight += stackMasterData[stackNum].netWeight;
            }
        }
    });

    // Update Title & Color Context
    if (isGrossMode) {
        calculatorDisplayTitle.textContent = 'Selected Gross Inward:';
        calculatorDisplayBags.className = 'text-indigo-700'; 
        calculatorDisplayWeight.className = 'text-indigo-700';
    } else if (isOutwardMode) {
        calculatorDisplayTitle.textContent = 'Selected Total Outward:';
        calculatorDisplayBags.className = 'text-red-600'; // Make text red for Outward
        calculatorDisplayWeight.className = 'text-red-600';
    } else {
        calculatorDisplayTitle.textContent = 'Selected Net Stock:';
        calculatorDisplayBags.className = 'text-indigo-700';
        calculatorDisplayWeight.className = 'text-indigo-700';
    }

    calculatorDisplayBags.textContent = totalBags.toLocaleString();
    calculatorDisplayWeight.textContent = totalWeight.toFixed(3);

    // --- LOGIC: (MT * 1000) / Bags ---
    let averageVal = 0;
    if (totalBags > 0) {
        // Point ko ignore karke (Weight in Kg) / Bags
        const weightInKg = totalWeight * 1000;
        averageVal = weightInKg / totalBags;
    }
    
    const formattedAvg = (Math.floor(averageVal * 100) / 100).toFixed(2);

    if(calculatorDisplayAverage) {
        calculatorDisplayAverage.textContent = formattedAvg;
    }
}

// --- Event Listeners ---
calculatorGrossCheckbox.addEventListener('change', function() {
    // If Gross is checked, uncheck Outward
    if(this.checked) calculatorOutwardCheckbox.checked = false;
    updateCalculatorDisplay();
});

// NEW Listener for Outward
calculatorOutwardCheckbox.addEventListener('change', function() {
    // If Outward is checked, uncheck Gross
    if(this.checked) calculatorGrossCheckbox.checked = false;
    updateCalculatorDisplay();
});


loginButton.addEventListener('click', attemptAutoLogin);

document.querySelectorAll('.calculator-btn').forEach(btn => btn.addEventListener('click', (e) => {
    document.querySelectorAll('.calculator-btn').forEach(b => b.classList.remove('active'));
    e.currentTarget.classList.add('active');
    renderStackCheckboxes(e.currentTarget.dataset.commodityFilter);
}));
