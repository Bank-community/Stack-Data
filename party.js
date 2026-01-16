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
        const userEmail = "jackprince79036@gmail.com";

        // Login Elements
        const loginScreen = document.getElementById('login-screen');
        const appContainer = document.getElementById('app-container');
        const passwordInput = document.getElementById('password');
        const loginButton = document.getElementById('login-button');
        const loginError = document.getElementById('login-error');

        // General DOM Elements
        const mainContent = document.getElementById('main-content');
        const reportLoader = document.getElementById('report-loader');
        const cardTitle = document.getElementById('card-title');
        const tableBody = document.getElementById('report-transactions-table-body');
        const noDataMessage = document.getElementById('report-no-data-message');
        
        // Filter Elements (Updated with Party and Bag Type)
        const filterElements = {
            commodity: document.getElementById('filter-commodity'),
            party: document.getElementById('filter-party'), // New
            stackNumber: document.getElementById('filter-stackNumber'),
            bagType: document.getElementById('filter-bagType'), // New
            startDate: document.getElementById('filter-startDate'),
            endDate: document.getElementById('filter-endDate')
        };
        document.getElementById('reset-filter-btn').addEventListener('click', resetFilters);
        Object.values(filterElements).forEach(el => el.addEventListener('change', applyFilters));

        // Calculator Elements
        const checkboxContainer = document.getElementById('stack-checkbox-container');
        const calculatorDisplayTitle = document.getElementById('calculator-display-title');
        const calculatorDisplayBags = document.getElementById('calculator-display-bags');
        const calculatorDisplayWeight = document.getElementById('calculator-display-weight');
        const calculatorGrossCheckbox = document.getElementById('calculator-gross-checkbox');
        const multiSelectToggle = document.getElementById('multi-select-toggle');

        calculatorGrossCheckbox.addEventListener('change', updateCalculatorDisplay);
        multiSelectToggle.addEventListener('change', () => {
             showToast(multiSelectToggle.checked ? "Multi-Select Mode ON" : "Single-Select Mode ON");
        });

        document.querySelectorAll('.calculator-btn').forEach(btn => btn.addEventListener('click', (e) => {
            document.querySelectorAll('.calculator-btn').forEach(b => b.classList.remove('active'));
            e.currentTarget.classList.add('active');
            renderStackCheckboxes(e.currentTarget.dataset.commodityFilter);
        }));

        let allTransactions = [];
        let stackMasterData = {};
        let pieChart = null; 

        // --- Helper: Determine Party Name ---
        function getPartyName(stackNumber) {
            const num = parseInt(stackNumber);
            if (isNaN(num)) return 'Other';

            // MANO ENTERPRISES (Stack 7)
            if (num === 7) return 'MANO ENTERPRISES';

            // SHIVSHANKAR (101, 102, 104)
            if ([101, 102, 104].includes(num)) return 'SHIVSHANKAR';

            // TYAGI (22, 23, 25, 26, 27)
            if ([22, 23, 25, 26, 27].includes(num)) return 'TYAGI';

            // ITC (1-18 excluding 7, plus 24, 28-30, 103, 105, 106)
            // Logic: 1 se 18 (aur 7 nahi) OR baki list mein
            if ( (num >= 1 && num <= 18 && num !== 7) || 
                 [24, 28, 29, 30, 103, 105, 106].includes(num) ) {
                return 'ITC';
            }

            return 'Other';
        }

        // --- Authentication Logic ---
        onAuthStateChanged(auth, (user) => {
            if (user) {
                loginScreen.style.display = 'none';
                appContainer.classList.remove('hidden');
                initializeReportApp();
            } else {
                loginScreen.style.display = 'flex';
                appContainer.classList.add('hidden');
                reportLoader.style.display = 'none';
                mainContent.classList.add('hidden');
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


        // --- Report App Initialization ---
        function initializeReportApp() {
            const transactionsRef = ref(database, 'transactions');
            onValue(transactionsRef, (snapshot) => {
                const rawData = snapshot.val() || {};
                allTransactions = Object.values(rawData);
                
                // Add Party property dynamically to object for easier filtering later (optional but good for debugging)
                allTransactions.forEach(tx => {
                    tx._party = getPartyName(tx.stackNumber);
                });

                processMasterData(allTransactions);
                document.querySelector('#total-stacks-display span').textContent = Object.keys(stackMasterData).length;

                populateStackDropdown();
                renderStackCheckboxes('All');
                applyFilters(); 
                
                reportLoader.style.display = 'none';
                mainContent.classList.remove('hidden');
            }, { once: true });
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

        function populateStackDropdown() {
            const stackSelect = filterElements.stackNumber;
            const existingValue = stackSelect.value;
            const stackNumbers = Object.keys(stackMasterData).sort((a, b) => a - b);
            
            stackSelect.innerHTML = '<option value="">All Stacks</option>';
            stackNumbers.forEach(stack => {
                const option = document.createElement('option');
                option.value = stack;
                option.textContent = stack;
                stackSelect.appendChild(option);
            });
            if (stackNumbers.includes(existingValue)) {
                stackSelect.value = existingValue;
            }
        }

        // --- Filter Logic ---
        function applyFilters() {
            const filters = {
                commodity: filterElements.commodity.value,
                party: filterElements.party.value,       // New
                stackNumber: filterElements.stackNumber.value,
                bagType: filterElements.bagType.value,   // New
                startDate: filterElements.startDate.value,
                endDate: filterElements.endDate.value,
            };
            
            // Build Title
            let titleText = filters.commodity === 'All' ? 'All Commodities' : filters.commodity;
            
            if (filters.party !== 'All') {
                titleText += ` (${filters.party})`;
            }

            const stackNumberDisplay = filters.stackNumber ? filters.stackNumber.toUpperCase() : '';
            const titleStackPart = stackNumberDisplay ? `- Stack <span class="text-blue-600 font-bold">${stackNumberDisplay}</span>` : '';
            
            cardTitle.innerHTML = `${titleText} Summary ${titleStackPart}`;

            const filteredTransactions = allTransactions.filter(tx => {
                // 1. Commodity Filter
                const commodityMatch = (filters.commodity === 'All' || tx.commodity === filters.commodity);
                
                // 2. Party Filter (using helper)
                const txParty = getPartyName(tx.stackNumber);
                const partyMatch = (filters.party === 'All' || txParty === filters.party);

                // 3. Stack Filter
                const stackMatch = (!filters.stackNumber || tx.stackNumber == filters.stackNumber);

                // 4. Bag Type Filter
                // Logic: "Made-up" if countVan string is exactly "Made-up". Regular otherwise.
                let bagTypeMatch = true;
                if (filters.bagType === 'Made-up') {
                    bagTypeMatch = (tx.countVan === 'Made-up');
                } else if (filters.bagType === 'Regular') {
                    bagTypeMatch = (tx.countVan !== 'Made-up');
                }

                // 5. Date Filter
                const startMatch = (!filters.startDate || tx.date >= filters.startDate);
                const endMatch = (!filters.endDate || tx.date <= filters.endDate);

                return commodityMatch && partyMatch && stackMatch && bagTypeMatch && startMatch && endMatch;
            });

            updateCompactCard(filteredTransactions);
            populateReportTable(filteredTransactions);
            updatePieChart(filteredTransactions); // Pass filtered data to chart
        }

        function resetFilters() {
            filterElements.commodity.value = 'All';
            filterElements.party.value = 'All';
            filterElements.stackNumber.value = '';
            filterElements.bagType.value = 'All';
            filterElements.startDate.value = '';
            filterElements.endDate.value = '';
            applyFilters();
            showToast('All filters reset.');
        }

        function updateCompactCard(transactions) {
            let stats = { inwardBags: 0, inwardWeight: 0, outwardBags: 0, outwardWeight: 0 };
            transactions.forEach(tx => {
                const bags = tx.bags || 0;
                const weight = tx.weight || 0;
                if (tx.transactionType === 'inward') {
                    stats.inwardBags += bags;
                    stats.inwardWeight += weight;
                } else {
                    stats.outwardBags += bags;
                    stats.outwardWeight += weight;
                }
            });

            const netBags = stats.inwardBags - stats.outwardBags;
            const netWeight = stats.inwardWeight - stats.outwardWeight;
            
            document.getElementById('card-inward-bags').textContent = stats.inwardBags.toLocaleString();
            document.getElementById('card-inward-weight').textContent = stats.inwardWeight.toFixed(3);
            document.getElementById('card-outward-bags').textContent = stats.outwardBags.toLocaleString();
            document.getElementById('card-outward-weight').textContent = stats.outwardWeight.toFixed(3);
            document.getElementById('card-net-bags').textContent = netBags.toLocaleString();
            document.getElementById('card-net-weight').textContent = netWeight.toFixed(3);

            const avgWeightSpan = document.getElementById('avg-weight-display');
            // Show avg weight if there is valid data
            if (netBags > 0) {
                const avgWeightKg = (netWeight * 1000) / netBags;
                avgWeightSpan.textContent = `(Avg. ${avgWeightKg.toFixed(2)} kg/Bag)`;
                avgWeightSpan.classList.remove('hidden');
            } else {
                avgWeightSpan.classList.add('hidden');
            }

            updateDateRange(transactions);
        }
        
        function updateDateRange(transactions) {
            const cardDateRange = document.getElementById('card-date-range');
            if (transactions.length === 0) {
                cardDateRange.textContent = 'Date Range: N/A';
                return;
            }
            const dates = transactions.map(tx => new Date(tx.date));
            const minDate = new Date(Math.min.apply(null, dates));
            const maxDate = new Date(Math.max.apply(null, dates));
            const formatDate = (date) => `${date.getDate().toString().padStart(2,'0')}-${(date.getMonth()+1).toString().padStart(2,'0')}-${date.getFullYear()}`;
            
            cardDateRange.textContent = `Date Range: ${formatDate(minDate)} to ${formatDate(maxDate)}`;
        }

        function populateReportTable(transactions) {
            tableBody.innerHTML = '';
            noDataMessage.classList.toggle('hidden', transactions.length > 0);
            if (transactions.length > 0) {
                transactions.sort((a, b) => new Date(b.date) - new Date(a.date)).forEach(tx => {
                    tableBody.insertRow().innerHTML = `
                        <td class="p-3">${tx.date}</td>
                        <td class="p-3">
                            ${tx.stackNumber} 
                            <span class="text-xs text-gray-400 block">${getPartyName(tx.stackNumber)}</span>
                        </td>
                        <td class="p-3">${tx.countVan}</td>
                        <td class="p-3">${tx.transactionType === 'inward' ? 
                            '<span class="font-semibold text-green-700">Inward</span>' : 
                            '<span class="font-semibold text-red-700">Outward</span>'}
                        </td>
                        <td class="p-3">${(tx.bags || 0).toLocaleString()}</td>
                        <td class="p-3">${(tx.weight || 0).toFixed(3)} MT</td>
                    `;
                });
            }
        }

        // --- Pie Chart Logic (Updated to use filtered data) ---
        function updatePieChart(currentFilteredTransactions) {
            const canvas = document.getElementById('stockPieChart');
            if (!canvas) return;
            const ctx = canvas.getContext('2d');
            Chart.register(ChartDataLabels);

            const selectedStackFilter = filterElements.stackNumber.value;
            let chartConfig = { labels: [], data: [], colors: [] };

            // Scenario 1: Specific Stack Selected -> Show This Stack vs Others (within the current filtered context)
            if (selectedStackFilter) {
                // Determine weight of selected stack from filtered transactions
                let selectedStackWeight = 0;
                let otherStacksWeight = 0;

                // We use filtered transactions to respect Party/Date filters
                currentFilteredTransactions.forEach(tx => {
                    const weight = tx.transactionType === 'inward' ? (tx.weight || 0) : -(tx.weight || 0);
                    if (tx.stackNumber == selectedStackFilter) {
                        selectedStackWeight += weight;
                    } else {
                        otherStacksWeight += weight; // Note: 'filteredTransactions' already filtered by stack, so this might be 0 usually unless we change logic. 
                        // Wait, if Stack Filter is ON, 'filteredTransactions' only has THAT stack. 
                        // So 'Other Stacks' will always be 0 in this array.
                        // To show comparison, we need a wider dataset (filtered by everything EXCEPT stack).
                    }
                });

                // Re-calculate "Others" based on global data but with current filters (minus stack filter)
                // This is complex. Let's simplify: If Stack is selected, just show Wheat vs Maize for THAT stack.
                // It's more useful than "This Stack vs 0".
                
                let wheatWeight = 0;
                let maizeWeight = 0;
                currentFilteredTransactions.forEach(tx => {
                     const weight = tx.transactionType === 'inward' ? (tx.weight || 0) : -(tx.weight || 0);
                     if (tx.commodity === 'Wheat') wheatWeight += weight;
                     if (tx.commodity === 'Maize') maizeWeight += weight;
                });
                
                chartConfig.labels = ['Wheat', 'Maize'];
                chartConfig.data = [parseFloat(wheatWeight.toFixed(3)), parseFloat(maizeWeight.toFixed(3))];
                chartConfig.colors = ['#f59e0b', '#10b981'];

            } else {
                // Scenario 2: No Stack Selected (All Stacks view) -> Show Wheat vs Maize
                let wheatNetWeight = 0;
                let maizeNetWeight = 0;
                
                currentFilteredTransactions.forEach(tx => {
                    const weight = tx.transactionType === 'inward' ? (tx.weight || 0) : -(tx.weight || 0);
                    if (tx.commodity === 'Wheat') wheatNetWeight += weight;
                    if (tx.commodity === 'Maize') maizeNetWeight += weight;
                });
                
                wheatNetWeight = parseFloat(wheatNetWeight.toFixed(3));
                maizeNetWeight = parseFloat(maizeNetWeight.toFixed(3));
                
                chartConfig.labels = ['Wheat', 'Maize'];
                chartConfig.data = [wheatNetWeight, maizeNetWeight];
                chartConfig.colors = ['#f59e0b', '#10b981'];
            }
            
            // Filter out zero values for cleaner chart
            const finalLabels = [];
            const finalData = [];
            const finalColors = [];
            
            chartConfig.data.forEach((val, idx) => {
                if (val > 0.001) {
                    finalLabels.push(chartConfig.labels[idx]);
                    finalData.push(val);
                    finalColors.push(chartConfig.colors[idx]);
                }
            });

            if (pieChart) pieChart.destroy();
            
            const totalDataValue = finalData.reduce((a, b) => a + b, 0);
            if (totalDataValue <= 0.001) { 
                 ctx.clearRect(0, 0, canvas.width, canvas.height);
                 ctx.save();
                 ctx.textAlign = 'center';
                 ctx.textBaseline = 'middle';
                 ctx.fillStyle = '#6b7280';
                 ctx.font = "16px 'Inter'";
                 ctx.fillText('No data to display', canvas.width / 2, canvas.height / 2);
                 ctx.restore();
                 return;
            }

            pieChart = new Chart(ctx, {
                type: 'pie',
                data: {
                    labels: finalLabels,
                    datasets: [{
                        data: finalData,
                        backgroundColor: finalColors,
                        borderColor: '#ffffff',
                        borderWidth: 3,
                        hoverOffset: 12
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    layout: { padding: 20 },
                    plugins: {
                        datalabels: {
                            formatter: (value, ctx) => {
                                const total = ctx.chart.data.datasets[0].data.reduce((a, b) => a + b, 0);
                                const percentage = total > 0 ? (value / total * 100) : 0;
                                return percentage > 5 ? percentage.toFixed(1) + '%' : '';
                            },
                            color: '#fff',
                            font: { weight: 'bold', size: 14, family: "'Inter', sans-serif" },
                            textStrokeColor: '#374151',
                            textStrokeWidth: 2
                        },
                        legend: {
                            position: 'bottom',
                            labels: { padding: 25, usePointStyle: true, pointStyle: 'circle', font: { size: 13, family: "'Inter', sans-serif" } }
                        },
                        tooltip: {
                            enabled: true,
                            backgroundColor: '#1f2937',
                            callbacks: {
                                label: function(context) { return ` ${context.label}: ${context.parsed.toFixed(3)} MT`; }
                            }
                        }
                    }
                }
            });
        }

        // --- Stack Calculator Logic ---
        function renderStackCheckboxes(commodityFilter) {
            checkboxContainer.innerHTML = '';
            const stackNumbers = Object.keys(stackMasterData).sort((a, b) => a - b);
            
            stackNumbers.forEach(stackNum => {
                const stackInfo = stackMasterData[stackNum];
                if (commodityFilter === 'All' || stackInfo.commodities.has(commodityFilter)) {
                    // Check Party Filter context if needed, but calculator usually allows free selection.
                    // For now, listing all existing stacks. 
                    
                    const label = document.createElement('label');
                    label.className = "flex items-center gap-1.5 p-1 rounded hover:bg-gray-200 cursor-pointer";
                    label.innerHTML = `
                        <input type="checkbox" data-stack="${stackNum}" class="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 stack-calculator-checkbox">
                        <span class="font-medium text-gray-700">${stackNum}</span>
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

        function showToast(message) {
            const toast = document.getElementById('report-toast');
            toast.querySelector('span').textContent = message;
            toast.classList.remove('opacity-0', 'translate-y-2');
            setTimeout(() => { toast.classList.add('opacity-0', 'translate-y-2'); }, 3000);
        }
    
