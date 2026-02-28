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
const calculatorOutwardCheckbox = document.getElementById('calculator-outward-checkbox'); 
const multiSelectToggle = document.getElementById('multi-select-toggle');
const downloadPdfBtn = document.getElementById('download-pdf-btn'); // NEW: PDF Button

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
                outwardBags: 0, outwardWeight: 0, 
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

function updateCalculatorDisplay() {
    const isGrossMode = calculatorGrossCheckbox.checked;
    const isOutwardMode = calculatorOutwardCheckbox.checked;

    let totalBags = 0;
    let totalWeight = 0;
    const checkedBoxes = document.querySelectorAll('.stack-calculator-checkbox:checked');
    
    checkedBoxes.forEach(cb => {
        const stackNum = cb.dataset.stack;
        if (stackMasterData[stackNum]) {
            if (isGrossMode) {
                totalBags += stackMasterData[stackNum].inwardBags;
                totalWeight += stackMasterData[stackNum].inwardWeight;
            } else if (isOutwardMode) {
                totalBags += stackMasterData[stackNum].outwardBags;
                totalWeight += stackMasterData[stackNum].outwardWeight;
            } else {
                totalBags += stackMasterData[stackNum].netBags;
                totalWeight += stackMasterData[stackNum].netWeight;
            }
        }
    });

    if (isGrossMode) {
        calculatorDisplayTitle.textContent = 'Selected Gross Inward:';
        calculatorDisplayBags.className = 'text-indigo-700'; 
        calculatorDisplayWeight.className = 'text-indigo-700';
    } else if (isOutwardMode) {
        calculatorDisplayTitle.textContent = 'Selected Total Outward:';
        calculatorDisplayBags.className = 'text-red-600'; 
        calculatorDisplayWeight.className = 'text-red-600';
    } else {
        calculatorDisplayTitle.textContent = 'Selected Net Stock:';
        calculatorDisplayBags.className = 'text-indigo-700';
        calculatorDisplayWeight.className = 'text-indigo-700';
    }

    calculatorDisplayBags.textContent = totalBags.toLocaleString();
    calculatorDisplayWeight.textContent = totalWeight.toFixed(3);

    let averageVal = 0;
    if (totalBags > 0) {
        const weightInKg = totalWeight * 1000;
        averageVal = weightInKg / totalBags;
    }
    
    const formattedAvg = (Math.floor(averageVal * 100) / 100).toFixed(2);

    if(calculatorDisplayAverage) {
        calculatorDisplayAverage.textContent = formattedAvg;
    }
}

// ==========================================
// 📄 PDF GENERATION LOGIC (NEW)
// ==========================================
async function generatePDF() {
    if (!window.jspdf) {
        alert("PDF Library is still loading. Please try again in a few seconds.");
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // 1. Dynamic Title Setting
    let titleText = currentCommodityFilter === 'All' ? 'All Commodities Report' : `${currentCommodityFilter} Stack Report`;

    // 2. Decide Which Stacks To Print
    const checkedBoxes = Array.from(document.querySelectorAll('.stack-calculator-checkbox:checked'));
    let selectedStacks = [];

    if (checkedBoxes.length > 0) {
        // Sirf checked stacks ka PDF banega
        selectedStacks = checkedBoxes.map(cb => cb.dataset.stack);
        titleText = `Custom ${titleText}`;
    } else {
        // Koi check nahi hai, to current filter ke anusar saare stacks aayenge
        selectedStacks = Object.keys(stackMasterData).filter(stackNum => {
            if (currentCommodityFilter === 'All') return true;
            return stackMasterData[stackNum].commodities.has(currentCommodityFilter);
        });
    }

    if (selectedStacks.length === 0) {
        alert("No stacks available to download.");
        return;
    }

    // Sort numerically
    selectedStacks.sort((a, b) => parseInt(a) - parseInt(b));

    // 3. Prepare Table Data & Totals
    const tableBody = [];
    let tInBags = 0, tInMt = 0;
    let tOutBags = 0, tOutMt = 0;
    let tAvailBags = 0, tAvailMt = 0;

    selectedStacks.forEach(stackNum => {
        const d = stackMasterData[stackNum];
        
        tInBags += d.inwardBags; tInMt += d.inwardWeight;
        tOutBags += d.outwardBags; tOutMt += d.outwardWeight;
        tAvailBags += d.netBags; tAvailMt += d.netWeight;

        // --- Percentage / Gain / Loss Logic ---
        let statusStr = "-";
        if (d.inwardWeight > 0) {
            const diffMt = d.outwardWeight - d.inwardWeight;
            const percent = (diffMt / d.inwardWeight) * 100;

            if (d.netBags <= 0) { // Stack Empty (0 Bags)
                if (diffMt > 0) {
                    statusStr = `+${diffMt.toFixed(3)} MT\n(+${percent.toFixed(2)}%)`;
                } else if (diffMt < 0) {
                    statusStr = `${diffMt.toFixed(3)} MT\n(${percent.toFixed(2)}%)`;
                } else {
                    statusStr = `0 MT\n(0.00%)`;
                }
            } else { // Stack Active
                if (diffMt > 0) {
                    statusStr = `+${diffMt.toFixed(3)} MT\n(+${percent.toFixed(2)}%)`; // Chalte stack me profit
                } else {
                    statusStr = "Active";
                }
            }
        }

        tableBody.push([
            stackNum,
            `${d.inwardBags} / ${d.inwardWeight.toFixed(3)}`,
            `${d.outwardBags} / ${d.outwardWeight.toFixed(3)}`,
            `${d.netBags} / ${d.netWeight.toFixed(3)}`,
            statusStr
        ]);
    });

    // Add Grand Total Row
    tableBody.push([
        "TOTAL",
        `${tInBags} / ${tInMt.toFixed(3)}`,
        `${tOutBags} / ${tOutMt.toFixed(3)}`,
        `${tAvailBags} / ${tAvailMt.toFixed(3)}`,
        "-"
    ]);

    // 4. Draw PDF
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(0, 21, 64);
    doc.text(titleText, 105, 18, null, null, "center");

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100);
    const dateStr = new Date().toLocaleString('en-GB');
    doc.text(`Generated on: ${dateStr}`, 105, 26, null, null, "center");

    // Auto Table Generation
    doc.autoTable({
        startY: 35,
        head: [['Stack No.', 'Total Inward\n(Bags / MT)', 'Total Outward\n(Bags / MT)', 'Available Stock\n(Bags / MT)', 'Gain / Loss\n(MT & %)']],
        body: tableBody,
        theme: 'grid',
        headStyles: { fillColor: [59, 130, 246], textColor: 255, halign: 'center', valign: 'middle' },
        columnStyles: {
            0: { halign: 'center', fontStyle: 'bold' },
            1: { halign: 'right' },
            2: { halign: 'right' },
            3: { halign: 'right', fontStyle: 'bold', textColor: [0, 80, 0] },
            4: { halign: 'center', valign: 'middle' }
        },
        willDrawCell: function(data) {
            // Colorize Text logic for Gain/Loss
            if (data.column.index === 4 && data.cell.section === 'body') {
                const text = data.cell.text.join(" ");
                if (text.includes('+')) {
                    doc.setTextColor(0, 150, 0); // Green for Gain
                } else if (text.includes('-') && text !== '-') {
                    doc.setTextColor(200, 0, 0); // Red for Loss
                } else if (text === 'Active') {
                    doc.setTextColor(0, 0, 200); // Blue for Active
                }
            }
            // Make the Total row bold entirely
            if (data.row.index === tableBody.length - 1 && data.cell.section === 'body') {
                doc.setFont("helvetica", "bold");
                doc.setTextColor(0, 0, 0); 
                doc.setFillColor(240, 240, 240); 
            }
        }
    });

    // Save File
    const fileName = `${titleText.replace(/\s+/g, '_')}_${new Date().getTime()}.pdf`;
    doc.save(fileName);
}


// --- Event Listeners ---
calculatorGrossCheckbox.addEventListener('change', function() {
    if(this.checked) calculatorOutwardCheckbox.checked = false;
    updateCalculatorDisplay();
});

calculatorOutwardCheckbox.addEventListener('change', function() {
    if(this.checked) calculatorGrossCheckbox.checked = false;
    updateCalculatorDisplay();
});

loginButton.addEventListener('click', attemptAutoLogin);

// Add listener to the NEW Download button
if(downloadPdfBtn) {
    downloadPdfBtn.addEventListener('click', generatePDF);
}

document.querySelectorAll('.calculator-btn').forEach(btn => btn.addEventListener('click', (e) => {
    document.querySelectorAll('.calculator-btn').forEach(b => b.classList.remove('active'));
    e.currentTarget.classList.add('active');
    renderStackCheckboxes(e.currentTarget.dataset.commodityFilter);
}));
