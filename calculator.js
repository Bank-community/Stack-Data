import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-database.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";

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

// IMPORTANT: User Email logic
const userEmail = "jackprince79036@gmail.com"; 

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
const calculatorGrossCheckbox = document.getElementById('calculator-gross-checkbox');
const multiSelectToggle = document.getElementById('multi-select-toggle');

let stackMasterData = {};
let currentCommodityFilter = 'All';

// --- Authentication Logic ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        // User is signed in
        loginScreen.style.display = 'none'; 
        appContainer.classList.remove('hidden');
        fetchData();
    } else {
        // User is signed out
        loginScreen.style.display = 'flex'; 
        appContainer.classList.add('hidden');
    }
});

const handleLogin = () => {
    const password = passwordInput.value;
    if (!password) {
        loginError.textContent = 'Please enter your password.';
        loginError.classList.remove('hidden');
        return;
    }
    loginError.classList.add('hidden');
    loginButton.textContent = 'Logging in...';
    loginButton.disabled = true;

    signInWithEmailAndPassword(auth, userEmail, password)
        .catch((error) => {
            loginError.textContent = 'Incorrect password. Please try again.';
            loginError.classList.remove('hidden');
            loginButton.textContent = 'Login';
            loginButton.disabled = false;
        });
};

loginButton.addEventListener('click', handleLogin);
passwordInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleLogin();
});


// --- Data Handling ---
function fetchData() {
    const transactionsRef = ref(database, 'transactions');
    onValue(transactionsRef, (snapshot) => {
        const rawData = snapshot.val() || {};
        const allTransactions = Object.values(rawData);
        processMasterData(allTransactions);
        renderStackCheckboxes('All');
        // Hide loader once data is ready
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
            stackData[stackNum].netBags -= bags;
            stackData[stackNum].netWeight -= weight;
        }
        stackData[stackNum].commodities.add(tx.commodity);
    });
    for (const stack in stackData) {
        stackData[stack].netWeight = parseFloat(stackData[stack].netWeight.toFixed(5));
    }
    stackMasterData = stackData;
}

// --- Render Logic (BIG TEXT & Multi-Select) ---
function renderStackCheckboxes(commodityFilter) {
    currentCommodityFilter = commodityFilter;
    checkboxContainer.innerHTML = '';
    const stackNumbers = Object.keys(stackMasterData).sort((a, b) => a - b);
    
    stackNumbers.forEach(stackNum => {
        const stackInfo = stackMasterData[stackNum];
        if (commodityFilter === 'All' || stackInfo.commodities.has(commodityFilter)) {
            const label = document.createElement('label');
            // Styling for Bigger Text and Area
            label.className = "stack-checkbox-label flex items-center justify-center gap-3 p-3 border border-gray-200 rounded-xl cursor-pointer transition-all duration-200 bg-gray-50";
            
            label.innerHTML = `
                <input type="checkbox" data-stack="${stackNum}" class="h-6 w-6 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 stack-calculator-checkbox accent-indigo-600">
                <span class="font-extrabold text-gray-700 text-xl select-none">${stackNum}</span>
            `;
            checkboxContainer.appendChild(label);
        }
    });

    // Re-attach listeners
    document.querySelectorAll('.stack-calculator-checkbox').forEach(cb => {
        cb.addEventListener('change', function(e) {
            const isMultiMode = multiSelectToggle.checked;
            
            if (!isMultiMode && this.checked) {
                // Uncheck others in Single Mode
                document.querySelectorAll('.stack-calculator-checkbox').forEach(other => {
                    if (other !== this) {
                        other.checked = false;
                    }
                });
            }
            updateCalculatorDisplay();
        });
    });
    updateCalculatorDisplay();
}

// --- Calculator Logic ---
function updateCalculatorDisplay() {
    const isGrossMode = calculatorGrossCheckbox.checked;
    let totalBags = 0;
    let totalWeight = 0;
    const checkedBoxes = document.querySelectorAll('.stack-calculator-checkbox:checked');
    
    checkedBoxes.forEach(cb => {
        const stackNum = cb.dataset.stack;
        if (stackMasterData[stackNum]) {
            if (isGrossMode) {
                totalBags += stackMasterData[stackNum].inwardBags;
                totalWeight += stackMasterData[stackNum].inwardWeight;
            } else {
                totalBags += stackMasterData[stackNum].netBags;
                totalWeight += stackMasterData[stackNum].netWeight;
            }
        }
    });

    calculatorDisplayTitle.textContent = isGrossMode ? 'Selected Gross Inward:' : 'Selected Net Stock:';
    calculatorDisplayBags.textContent = totalBags.toLocaleString();
    calculatorDisplayWeight.textContent = totalWeight.toFixed(3);
}

// --- Event Listeners ---
calculatorGrossCheckbox.addEventListener('change', updateCalculatorDisplay);

document.querySelectorAll('.calculator-btn').forEach(btn => btn.addEventListener('click', (e) => {
    document.querySelectorAll('.calculator-btn').forEach(b => b.classList.remove('active'));
    e.currentTarget.classList.add('active');
    renderStackCheckboxes(e.currentTarget.dataset.commodityFilter);
}));

// Reset display on load
calculatorDisplayBags.textContent = "0";
calculatorDisplayWeight.textContent = "0.000";
