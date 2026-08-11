// ==========================================
// ⚙️ KONFIGURASI SISTEM (SENSITIF)
// ==========================================
const SUPABASE_URL = 'https://bqkmifjbtlnfgbsfhhmu.supabase.co'; 
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJxa21pZmpidGxuZmdic2ZoaG11Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY0NTAzOTEsImV4cCI6MjEwMjAyNjM5MX0.0wK6CknzdFj8zx1GDU7BSDekRab5yPnC7r0alb9UK-E';
const ADMIN_PASSWORD = 'xvfams'; 
const DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/1536738430019440751/dS7j71Gb_cho3nav0rN3Y3N96g4mEiqt_1N0GoDatvVnZrB19JszzzswldDSnRFprXhN';

// ==========================================
// 🌐 VARIABEL GLOBAL
// ==========================================
const db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
let inventoryData = []; let bundlesData = []; let globalLogsData = []; let membersData = []; let rulesData = [];
let currentRole = 'tamu'; let currentOperatorName = 'Tamu'; let currentFunds = 0; let currentDirtyFunds = 0; let currentCriticalLimit = 500; 
let liveChartInstance = null; let isTimelineView = false; let isHackerMode = false;
let factionMap = null; let mapMarkers = {};

// ==========================================
// 🛠️ SETUP AWAL & UI TOOLS
// ==========================================
const bulanSelect = document.getElementById('rekap-bulan');
const namaBulan = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
if (bulanSelect) { namaBulan.forEach((b, i) => { const val = String(i+1).padStart(2, '0'); bulanSelect.innerHTML += `<option value="${val}">${b}</option>`; }); }

const formatMoney = (amount) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(amount);

// UI-only naming layer. Database values remain unchanged for compatibility.
const LOCATION_LABELS = {
    'Brankas Bos': 'Private Vault',
    'Loker Bersama': 'Shared Depository',
    'Gudang Umum': 'Central Storehouse',
    'Bundle Area': 'Bundle Registry'
};
const RANK_LABELS = {
    'President': 'Head of House',
    'Vice President': 'Deputy Head',
    'Sgt at Arms': 'Head of Security',
    'Treasury': 'Treasury Keeper',
    'Road Captain': 'Field Coordinator',
    'Enforcer': 'Security Officer',
    'Member': 'Family Member',
    'Prospect': 'Associate',
    'Hangaround': 'Affiliate'
};
function getLocationLabel(value) { return LOCATION_LABELS[value] || value || '-'; }
function getRankLabel(value) { return RANK_LABELS[value] || value || '-'; }
function getRoleLabel(value) { return ({ tamu: 'Guest / Visitor', president: 'Head of House', vice_president: 'Deputy Head', treasury: 'Treasury Keeper' })[value] || value || '-'; }
setInterval(() => { const clock = document.getElementById('live-clock'); if (clock) clock.innerText = new Date().toLocaleTimeString('en-US', { hour12: false }); }, 1000);

const Toast = Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 3500, timerProgressBar: true, didOpen: (toast) => { toast.onmouseenter = Swal.stopTimer; toast.onmouseleave = Swal.resumeTimer; } });
function showToast(title, icon='success') { Toast.fire({ icon: icon, title: title, background: isHackerMode ? '#080503' : '#120d0a', color: isHackerMode ? '#f0dba5' : '#f3ead9' }); }
function showMessage(title, text, icon) { Swal.fire({ title: title, text: text, icon: icon, background: isHackerMode ? '#080503' : '#120d0a', color: isHackerMode ? '#f0dba5' : '#f3ead9', confirmButtonColor: isHackerMode ? '#7f5f30' : '#a47c3e' }); }

function toggleHackerMode() {
    isHackerMode = !isHackerMode;
    if(isHackerMode) { document.body.classList.add('hacker-mode'); showToast('CEREMONIAL DISPLAY MODE ACTIVE', 'warning'); } 
    else { document.body.classList.remove('hacker-mode'); showToast('Ceremonial Display Mode Off', 'info'); }
    if(document.getElementById('tab-dashboard').classList.contains('block')) renderAnalyticsChart();
}

function confirmTransactionBox(title, text) {
    return Swal.fire({ title: title, text: text, icon: 'warning', showCancelButton: true, confirmButtonColor: '#a47c3e', cancelButtonColor: '#3f3f46', background: isHackerMode ? '#080503' : '#120d0a', color: isHackerMode ? '#f0dba5' : '#f3ead9' }).then(result => result.isConfirmed);
}

// ==========================================
// 🛡️ SISTEM AUTENTIKASI & ROLE
// ==========================================
function toggleLoginInputs() {
    const role = document.getElementById('login-role').value; const passContainer = document.getElementById('password-container'); const aliasContainer = document.getElementById('alias-container'); const passInput = document.getElementById('login-password'); const aliasInput = document.getElementById('login-name');
    if (role !== 'tamu') { passContainer.classList.remove('hidden'); passInput.required = true; } else { passContainer.classList.add('hidden'); passInput.required = false; }
    if (role === 'treasury') { aliasContainer.classList.remove('hidden'); aliasInput.required = true; } else { aliasContainer.classList.add('hidden'); aliasInput.required = false; aliasInput.value = ''; }
}

function handleLogin(event) {
    event.preventDefault();
    const selectedRole = document.getElementById('login-role').value; const enteredPassword = document.getElementById('login-password').value; const enteredName = document.getElementById('login-name').value;
    if (selectedRole !== 'tamu') {
        if (enteredPassword === ADMIN_PASSWORD) { currentRole = selectedRole; if(selectedRole === 'president') currentOperatorName = 'Head of House'; else if(selectedRole === 'vice_president') currentOperatorName = 'Deputy Head'; else if(selectedRole === 'treasury') currentOperatorName = enteredName || 'Treasury Keeper'; } else { showMessage('Akses Ditolak', 'Access key tidak sesuai. Periksa kembali kredensial Anda.', 'error'); return; }
    } else { currentRole = 'tamu'; currentOperatorName = 'Tamu'; }

    document.getElementById('login-screen').classList.add('hidden'); document.getElementById('app-container').classList.remove('hidden'); syncSidebarForViewport();
    setupRoleUI(); fetchInventory(); fetchLogs(); fetchTickerLogs(); fetchFundLogs(); fetchMembers(); fetchRules(); enableRealtimeSync();
}

function setupRoleUI() {
    const adminElements = document.querySelectorAll('.admin-only');
    const treasuryStaffControls = document.querySelectorAll('[data-staff-control="treasury"]');
    const userName = document.getElementById('user-name');
    const userRoleBadge = document.getElementById('user-role-badge');
    const userIcon = document.getElementById('user-icon');
    const isStaff = (currentRole !== 'tamu');

    if (isStaff) {
        adminElements.forEach(el => el.classList.remove('hidden'));
        treasuryStaffControls.forEach(el => {
            el.classList.remove('hidden');
            el.style.removeProperty('display');
        });

        if (currentRole === 'president') {
            userName.innerText = currentOperatorName;
            userRoleBadge.innerText = "HEAD OF HOUSE";
            userIcon.className = "fa-solid fa-crown text-lg";
        } else if (currentRole === 'vice_president') {
            userName.innerText = currentOperatorName;
            userRoleBadge.innerText = "DEPUTY HEAD";
            userIcon.className = "fa-solid fa-user-shield text-lg";
        } else if (currentRole === 'treasury') {
            userName.innerText = currentOperatorName;
            userRoleBadge.innerText = "TREASURY";
            userIcon.className = "fa-solid fa-sack-dollar text-lg";
        }
    } else {
        adminElements.forEach(el => el.classList.add('hidden'));
        treasuryStaffControls.forEach(el => {
            el.classList.add('hidden');
            el.style.setProperty('display', 'none', 'important');
        });
        userName.innerText = currentOperatorName;
        userRoleBadge.innerText = "Tamu";
        userIcon.className = "fa-solid fa-eye text-base";
        switchTab('dashboard');
    }
}
function getOperatorName() { if (currentRole === 'tamu') return `Tamu`; if (currentRole === 'president') return "Head of House"; if (currentRole === 'vice_president') return "Deputy Head"; return `Treasury | ${currentOperatorName}`; }

async function handleLogout() {
    if(await confirmTransactionBox('End Session?', "Sesi akses estate akan diakhiri.")) { document.getElementById('login-password').value = ''; document.getElementById('app-container').classList.add('hidden'); document.getElementById('login-screen').classList.remove('hidden'); }
}
function showIDCard() {
    if(currentRole === 'tamu') return showToast('Visitor access tidak memiliki Estate Credential', 'info');
    const myLogs = globalLogsData.filter(l => l.operator === getOperatorName()); const totalActions = myLogs.length; const totalVol = myLogs.reduce((acc, curr) => acc + (curr.total_price || 0), 0);
    Swal.fire({
        html: `<div class="text-center p-2"><i class="fa-solid fa-id-card text-6xl text-orange-500 mb-4 drop-shadow-[0_0_15px_rgba(234,88,12,0.8)]"></i><h2 class="text-2xl font-bold font-mono text-zinc-100 uppercase tracking-widest">${currentOperatorName}</h2><p class="text-sm text-zinc-400 mb-6 font-bold tracking-widest">${getRoleLabel(currentRole).toUpperCase()}</p><div class="bg-zinc-900/80 p-4 rounded-xl border border-zinc-700 text-left space-y-3 shadow-inner"><div class="flex justify-between items-center border-b border-zinc-800 pb-2"><span class="text-xs text-zinc-500 uppercase font-bold"><i class="fa-solid fa-fingerprint mr-2"></i>Access Status</span> <span class="text-xs font-bold text-emerald-500 bg-emerald-900/30 px-2 py-0.5 rounded border border-emerald-800">AUTHORIZED</span></div><div class="flex justify-between items-center border-b border-zinc-800 pb-2"><span class="text-xs text-zinc-500 uppercase font-bold"><i class="fa-solid fa-clipboard-check mr-2"></i>Recorded Actions</span> <span class="text-sm font-bold text-orange-400 font-mono">${totalActions} OPS</span></div><div class="flex justify-between items-center"><span class="text-xs text-zinc-500 uppercase font-bold"><i class="fa-solid fa-sack-dollar mr-2"></i>Recorded Value</span> <span class="text-sm font-bold text-emerald-400 font-mono">${formatMoney(totalVol)}</span></div></div></div>`,
        background: isHackerMode ? '#080503' : '#120d0a', color: isHackerMode ? '#f0dba5' : '#f3ead9', showConfirmButton: false, showCloseButton: true
    });
}

// ==========================================
// 📱 NAVIGASI & UI
// ==========================================
function isDesktopSidebarMode() {
    return window.matchMedia('(min-width: 768px)').matches;
}

function updateSidebarToggleUI() {
    const sidebar = document.getElementById('sidebar');
    const button = document.getElementById('sidebar-toggle-btn');
    const icon = document.getElementById('sidebar-toggle-icon');

    if (!sidebar || !button || !icon) return;

    const isDesktop = isDesktopSidebarMode();
    const isOpen = isDesktop
        ? !sidebar.classList.contains('sidebar-hidden')
        : sidebar.classList.contains('mobile-open');

    button.setAttribute('aria-expanded', String(isOpen));
    button.title = isOpen ? 'Sembunyikan sidebar' : 'Tampilkan sidebar';
    button.setAttribute('aria-label', button.title);

    // Ikon dibuat kecil dan sederhana.
    icon.className = isDesktop
        ? 'fa-solid fa-ellipsis-vertical'
        : `fa-solid ${isOpen ? 'fa-xmark' : 'fa-bars'}`;
}

function openSidebar() {
    const sidebar = document.getElementById('sidebar');
    const backdrop = document.getElementById('sidebar-backdrop');

    if (!sidebar || !backdrop) return;

    if (isDesktopSidebarMode()) {
        sidebar.classList.remove('sidebar-hidden');
        sidebar.classList.remove('mobile-open');
        backdrop.classList.add('hidden');
    } else {
        sidebar.classList.remove('sidebar-hidden');
        sidebar.classList.add('mobile-open');
        backdrop.classList.remove('hidden');
    }

    updateSidebarToggleUI();
}

function closeSidebar() {
    const sidebar = document.getElementById('sidebar');
    const backdrop = document.getElementById('sidebar-backdrop');

    if (!sidebar || !backdrop) return;

    if (isDesktopSidebarMode()) {
        sidebar.classList.add('sidebar-hidden');
        sidebar.classList.remove('mobile-open');
        backdrop.classList.add('hidden');
    } else {
        sidebar.classList.remove('mobile-open');
        sidebar.classList.remove('sidebar-hidden');
        backdrop.classList.add('hidden');
    }

    updateSidebarToggleUI();
}

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;

    if (isDesktopSidebarMode()) {
        if (sidebar.classList.contains('sidebar-hidden')) {
            openSidebar();
        } else {
            closeSidebar();
        }
    } else {
        if (sidebar.classList.contains('mobile-open')) {
            closeSidebar();
        } else {
            openSidebar();
        }
    }
}

function syncSidebarForViewport() {
    const sidebar = document.getElementById('sidebar');
    const backdrop = document.getElementById('sidebar-backdrop');

    if (!sidebar || !backdrop) return;

    // Saat berpindah ukuran layar, reset hanya state visual sidebar.
    // Tidak menyentuh role, data, transaksi, atau logika bisnis.
    if (isDesktopSidebarMode()) {
        sidebar.classList.remove('mobile-open');
        sidebar.classList.remove('sidebar-hidden');
        backdrop.classList.add('hidden');
    } else {
        sidebar.classList.remove('sidebar-hidden');
        sidebar.classList.remove('mobile-open');
        backdrop.classList.add('hidden');
    }

    updateSidebarToggleUI();
}

window.addEventListener('resize', syncSidebarForViewport);

function switchTab(tabId) {
    const isStaff = (currentRole !== 'tamu');
    if (!isStaff && tabId !== 'dashboard' && tabId !== 'roster' && tabId !== 'map' && tabId !== 'rules') tabId = 'dashboard';

    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.add('hidden');
        tab.classList.remove('flex');
        tab.classList.remove('block');
    });

    if(tabId === 'map') {
        document.getElementById(`tab-${tabId}`).classList.remove('hidden');
        document.getElementById(`tab-${tabId}`).classList.add('flex');
    } else {
        document.getElementById(`tab-${tabId}`).classList.remove('hidden');
        document.getElementById(`tab-${tabId}`).classList.add('block');
    }

    const titleMap = {
        'dashboard': 'FAMILY COMMAND CENTER',
        'bisnis': 'BUSINESS & TREASURY OPERATIONS',
        'logistik': 'INTERNAL ASSET MOVEMENT',
        'tambah': 'REGISTER NEW ASSET',
        'logs': 'HOUSE AUDIT LEDGER',
        'rekap': 'MONTHLY ESTATE ARCHIVE',
        'roster': 'XAVIERA FAMILY REGISTRY',
        'map': 'TERRITORY & ASSET NETWORK',
        'rules': 'FAMILY CODEX & PROTOCOL'
    };

    const pageTitle = document.getElementById('page-title');
    if (pageTitle) {
        pageTitle.classList.add('ui-title-swap');
        pageTitle.innerText = titleMap[tabId];
        requestAnimationFrame(() => pageTitle.classList.remove('ui-title-swap'));
    }

    animateActiveTab(tabId);

    document.querySelectorAll('#sidebar .nav-btn').forEach(btn => {
        btn.classList.remove('is-active', 'bg-orange-600', 'text-white');
    });

    const activeNav = document.getElementById(`btn-${tabId}`);
    if (activeNav) activeNav.classList.add('is-active');

    if (tabId === 'logs' && isStaff) {
        renderLogsTable();
        fetchFundLogs();
    }

    if (tabId === 'dashboard') {
        renderAnalyticsChart();
    }

    if (tabId === 'rekap' && isStaff) {
        const d = new Date();
        document.getElementById('rekap-bulan').value = String(d.getMonth() + 1).padStart(2, '0');
        document.getElementById('rekap-tahun').value = String(d.getFullYear());
    }

    if (tabId === 'map') {
        if (!factionMap) {
            setTimeout(() => { initLeafletMap(); }, 200);
        } else {
            setTimeout(() => {
                factionMap.invalidateSize();
                updateMapPopups();
            }, 200);
        }
    }

    // Mobile: setelah memilih menu, drawer otomatis ditutup.
    if (!isDesktopSidebarMode()) closeSidebar();
}

// ==========================================
// 🗺️ LEAFLET.JS (PETA INTERAKTIF)
// ==========================================
function initLeafletMap() {
    if (factionMap) return; 
    const imageWidth = 4096; const imageHeight = 4096;
    factionMap = L.map('faction-map', { crs: L.CRS.Simple, minZoom: -2, maxZoom: 3, zoomControl: false });
    const bounds = [[0, 0], [imageHeight, imageWidth]];
    
    // GANTI 'assets/img/gtamap.jpg' dengan path gambarmu jika perlu
    L.imageOverlay('assets/img/gtamap.png', bounds).addTo(factionMap);
    factionMap.fitBounds(bounds); factionMap.setView([imageHeight / 2, imageWidth / 2], 0);
    L.control.zoom({ position: 'bottomright' }).addTo(factionMap);

    const iconStash = L.divIcon({ className: 'custom-div-icon', html: "<div class='w-8 h-8 bg-zinc-900 border-2 border-orange-500 rounded-full flex items-center justify-center text-orange-500 shadow-[0_0_10px_rgba(234,88,12,0.8)]'><i class='fa-solid fa-box-archive'></i></div>", iconSize: [32, 32], iconAnchor: [16, 16], popupAnchor: [0, -16] });
    const iconBoss = L.divIcon({ className: 'custom-div-icon', html: "<div class='w-8 h-8 bg-zinc-900 border-2 border-red-500 rounded-full flex items-center justify-center text-red-500 shadow-[0_0_10px_rgba(239,68,68,0.8)]'><i class='fa-solid fa-crown'></i></div>", iconSize: [32, 32], iconAnchor: [16, 16], popupAnchor: [0, -16] });
    
    mapMarkers['Gudang Umum'] = L.marker([2000, 1500], {icon: iconStash}).addTo(factionMap);
    mapMarkers['Loker Bersama'] = L.marker([2400, 2724], {icon: iconStash}).addTo(factionMap);
    mapMarkers['Brankas Bos'] = L.marker([1800, 2200], {icon: iconBoss}).addTo(factionMap);
    updateMapPopups();
}

function updateMapPopups() {
    if(!factionMap) return; const locations = ['Gudang Umum', 'Loker Bersama', 'Brankas Bos'];
    locations.forEach(loc => {
        const items = inventoryData.filter(i => i.location === loc); const countSenjata = items.filter(i => i.category === 'Senjata').length; const countResource = items.filter(i => i.category === 'Resource').length; const totalStok = items.reduce((sum, item) => sum + item.stock, 0);
        const popupHTML = `<div class="min-w-[160px]"><h4 class="font-bold text-orange-500 border-b border-zinc-700 pb-1 mb-2 uppercase text-[11px] tracking-wider"><i class="fa-solid fa-location-crosshairs mr-1"></i> ${getLocationLabel(loc)}</h4><div class="text-[11px] space-y-1 font-semibold"><div class="flex justify-between text-zinc-300"><span>Armory types:</span> <span class="text-rose-400 font-mono">${countSenjata}</span></div><div class="flex justify-between text-zinc-300"><span>General assets:</span> <span class="text-blue-400 font-mono">${countResource}</span></div><div class="flex justify-between border-t border-zinc-700 pt-1 mt-1 text-zinc-200"><span>Total units:</span> <span class="text-emerald-400 font-mono text-sm">${totalStok}</span></div></div></div>`;
        if (mapMarkers[loc]) { mapMarkers[loc].bindPopup(popupHTML); }
    }); showToast('Territory Network Synced', 'info');
}

// ==========================================
// 📡 DISCORD WEBHOOK LOGIC
// ==========================================
async function sendToDiscord(title, description, color, fields) {
    if (!DISCORD_WEBHOOK_URL) return;
    const payload = { username: "XAVIERA FAMILY · ESTATE NETWORK", embeds: [{ title: title, description: description, color: color, fields: fields, timestamp: new Date().toISOString(), footer: { text: "Xaviera Family Estate Operations" } }] };
    try { await fetch(DISCORD_WEBHOOK_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); } catch (error) {}
}

// ==========================================
// 💰 SISTEM KEUANGAN KAS
// ==========================================
async function fetchFunds() {
    try {
        const { data, error } = await db.from('faction_funds').select('*').in('id', [1, 2, 3]); if (error) throw error;
        const kasBersih = data.find(d => d.id === 1); if (kasBersih) { currentFunds = kasBersih.balance; const df = document.getElementById('display-faction-funds'); const skb = document.getElementById('stat-kas-bersih'); if(df) { df.innerText = formatMoney(currentFunds); df.className = `font-mono font-bold text-sm tracking-wider ${currentFunds < 0 ? 'text-rose-500' : 'text-emerald-400'}`; } if(skb) { skb.innerText = formatMoney(currentFunds); skb.className = `text-lg font-mono font-bold ${currentFunds < 0 ? 'text-rose-500' : 'text-emerald-400'}`; } }
        const kasKotor = data.find(d => d.id === 2); if (kasKotor) { currentDirtyFunds = kasKotor.balance; const ddf = document.getElementById('display-dirty-funds'); const skk = document.getElementById('stat-kas-kotor'); if(ddf) { ddf.innerText = formatMoney(currentDirtyFunds); ddf.className = `font-mono font-bold text-sm tracking-wider ${currentDirtyFunds < 0 ? 'text-rose-600' : 'text-red-500'}`; } if(skk) { skk.innerText = formatMoney(currentDirtyFunds); skk.className = `text-lg font-mono font-bold ${currentDirtyFunds < 0 ? 'text-rose-600' : 'text-red-500'}`; } }
        const stokKritis = data.find(d => d.id === 3); if (stokKritis) { currentCriticalLimit = stokKritis.balance; const critDisplay = document.getElementById('critical-limit-display'); if(critDisplay) critDisplay.innerText = currentCriticalLimit; }
    } catch (err) {}
}
async function adjustCriticalLimit() {
    if (currentRole === 'tamu') return; const { value: input } = await Swal.fire({ title: 'Set Critical Stock Threshold', input: 'number', inputLabel: `Current threshold: ${currentCriticalLimit} units`, showCancelButton: true, confirmButtonColor: '#a47c3e', background: isHackerMode ? '#080503' : '#120d0a', color: isHackerMode ? '#f0dba5' : '#f3ead9' }); if (!input) return; const newLimit = parseInt(input); if (isNaN(newLimit) || newLimit < 0) return showMessage("Invalid Value", "Masukkan angka 0 atau lebih.", "error");
    const { error } = await db.from('faction_funds').upsert({ id: 3, balance: newLimit }); if (!error) { currentCriticalLimit = newLimit; document.getElementById('critical-limit-display').innerText = newLimit; showToast('Critical threshold updated', 'success'); renderTable(); renderAnalyticsChart(); updateQuickStats(); }
}
async function changeTreasuryBalance(account, action) {
    if (currentRole === 'tamu') return;

    const isDirty = account === 'dirty';
    const isDeposit = action === 'deposit';
    const currentBalance = isDirty ? currentDirtyFunds : currentFunds;
    const accountName = isDirty ? 'Unprocessed Funds' : 'House Treasury';
    const actionName = isDeposit ? 'Deposit' : 'Tarik';

    const { value: input } = await Swal.fire({
        title: `${actionName} ${accountName}`,
        input: 'number',
        inputLabel: `Saldo saat ini: ${formatMoney(currentBalance)}`,
        inputPlaceholder: 'Masukkan nominal...',
        inputAttributes: {
            min: '1',
            step: '1'
        },
        showCancelButton: true,
        confirmButtonText: isDeposit ? 'Deposit' : 'Tarik',
        cancelButtonText: 'Batal',
        confirmButtonColor: isDeposit ? '#10b981' : '#ef4444',
        background: isHackerMode ? '#000' : '#18181b',
        color: isHackerMode ? '#f0dba5' : '#f4f4f5',
        preConfirm: (value) => {
            const amount = Number(value);
            if (!Number.isFinite(amount) || amount <= 0) {
                Swal.showValidationMessage('Masukkan nominal lebih dari 0.');
                return false;
            }
            return amount;
        }
    });

    if (input === undefined) return;

    const amount = Number(input);
    const signedAmount = isDeposit ? amount : -amount;
    const newBalance = currentBalance + signedAmount;
    const fundId = isDirty ? 2 : 1;

    const { error } = await db
        .from('faction_funds')
        .update({ balance: newBalance })
        .eq('id', fundId);

    if (error) {
        showMessage('Operation Failed', error.message, 'error');
        return;
    }

    const logType = isDirty
        ? (isDeposit ? 'Deposit Kotor' : 'Tarik Kotor')
        : (isDeposit ? 'Deposit' : 'Tarik');

    await db.from('vault_logs').insert([{
        type: logType,
        amount: amount,
        operator: getOperatorName() + ' (Quick Action)'
    }]);

    await sendToDiscord(
        isDirty ? `💸 Log Brankas: ${logType}` : `💰 Log Brankas: ${logType}`,
        `Operator **${getOperatorName()}** ${isDeposit ? 'melakukan deposit ke' : 'menarik saldo dari'} ${accountName}.`,
        isDirty
            ? (isDeposit ? 15105570 : 10038562)
            : (isDeposit ? 3066993 : 15158332),
        [
            { name: 'Nominal', value: formatMoney(amount), inline: true },
            { name: `Total ${isDirty ? 'Kotor' : 'Kas'}`, value: formatMoney(newBalance), inline: true }
        ]
    );

    showToast(`${actionName} ${accountName} completed`, 'success');
    await fetchFunds();
    fetchTickerLogs();
}

async function adjustFunds() {
    if (currentRole === 'tamu') return; const { value: input } = await Swal.fire({ title: 'Treasury Adjustment', input: 'text', inputLabel: `Current treasury: ${formatMoney(currentFunds)}\nUse a negative value to withdraw`, showCancelButton: true, confirmButtonColor: '#10b981', background: isHackerMode ? '#080503' : '#120d0a', color: isHackerMode ? '#f0dba5' : '#f3ead9' }); if (!input) return; const amount = parseFloat(input); if (isNaN(amount)) return showMessage("Invalid Amount", "Masukkan nominal yang valid.", "error");
    const newBalance = currentFunds + amount; const { error } = await db.from('faction_funds').update({ balance: newBalance }).eq('id', 1); if (!error) { const type = amount >= 0 ? 'Deposit' : 'Tarik'; await db.from('vault_logs').insert([{ type: type, amount: Math.abs(amount), operator: getOperatorName() + " (Manual)" }]); await sendToDiscord(`💰 Log Brankas: ${type}`, `Operator **${getOperatorName()}** menyesuaikan kas.`, amount >= 0 ? 3066993 : 15158332, [{ name: "Nominal", value: formatMoney(Math.abs(amount)), inline: true }, { name: "Total Kas", value: formatMoney(newBalance), inline: true }]); showToast('Treasury balance updated', 'success'); await fetchFunds(); fetchTickerLogs(); }
}
async function adjustDirtyFunds() {
    if (currentRole === 'tamu') return; const { value: input } = await Swal.fire({ title: 'Unprocessed Funds Adjustment', input: 'text', inputLabel: `Current unprocessed funds: ${formatMoney(currentDirtyFunds)}\nUse a negative value to withdraw`, showCancelButton: true, confirmButtonColor: '#ef4444', background: isHackerMode ? '#080503' : '#120d0a', color: isHackerMode ? '#f0dba5' : '#f3ead9' }); if (!input) return; const amount = parseFloat(input); if (isNaN(amount)) return showMessage("Invalid Amount", "Masukkan nominal yang valid.", "error");
    const newBalance = currentDirtyFunds + amount; const { error } = await db.from('faction_funds').update({ balance: newBalance }).eq('id', 2); if (!error) { const type = amount >= 0 ? 'Deposit Kotor' : 'Tarik Kotor'; await db.from('vault_logs').insert([{ type: type, amount: Math.abs(amount), operator: getOperatorName() + " (Manual)" }]); await sendToDiscord(`💸 Log Brankas: ${type}`, `Operator **${getOperatorName()}** menyesuaikan Kotor.`, amount >= 0 ? 15105570 : 10038562, [{ name: "Nominal", value: formatMoney(Math.abs(amount)), inline: true }, { name: "Total Kotor", value: formatMoney(newBalance), inline: true }]); showToast('Unprocessed funds updated', 'success'); await fetchFunds(); fetchTickerLogs(); }
}
async function fetchFundLogs() {
    const tbody = document.getElementById('fund-logs-table-body'); if(!tbody) return;
    try { const { data, error } = await db.from('vault_logs').select('*').order('created_at', { ascending: false }); if (error) throw error; tbody.innerHTML = data.length === 0 ? `<tr><td colspan="4" class="p-8 text-center text-zinc-500 italic">Belum ada riwayat mutasi kas.</td></tr>` : ''; data.forEach((log, index) => { const localTime = new Date(log.created_at).toLocaleString('id-ID', { hour12: false }); let typeBadge, amtColor, amtSign; if (log.type === 'Deposit') { typeBadge = `<span class="bg-emerald-950/80 text-emerald-400 px-2 py-0.5 rounded text-[10px] font-bold uppercase">Deposit</span>`; amtColor = 'text-emerald-400'; amtSign = '+'; } else if (log.type === 'Tarik') { typeBadge = `<span class="bg-rose-950/80 text-rose-400 px-2 py-0.5 rounded text-[10px] font-bold uppercase">Tarik</span>`; amtColor = 'text-rose-400'; amtSign = '-'; } else if (log.type === 'Deposit Kotor') { typeBadge = `<span class="bg-red-950/80 text-red-500 px-2 py-0.5 rounded text-[10px] font-bold uppercase">Deposit Unprocessed</span>`; amtColor = 'text-red-500'; amtSign = '+'; } else { typeBadge = `<span class="bg-orange-950/80 text-orange-500 px-2 py-0.5 rounded text-[10px] font-bold uppercase">Withdraw Unprocessed</span>`; amtColor = 'text-orange-500'; amtSign = '-'; } tbody.innerHTML += `<tr class="${index % 2 === 0 ? 'bg-zinc-950/50' : 'bg-transparent'} hover:bg-zinc-800/20"><td class="p-3 text-center font-mono text-zinc-500">${localTime}</td><td class="p-3 text-center">${typeBadge}</td><td class="p-3 text-right font-mono font-bold ${amtColor}">${amtSign}${formatMoney(log.amount)}</td><td class="p-3 text-zinc-400 text-xs font-semibold flex items-center gap-2"><i class="fa-solid fa-user-tie text-zinc-600"></i> ${log.operator}</td></tr>`; }); } catch (err) {}
}

// ==========================================
// 📦 INVENTORY & UI FORMS
// ==========================================
async function fetchInventory() {
    const statusBadge = document.getElementById('db-status'); const locFilter = document.getElementById('filter-lokasi') ? document.getElementById('filter-lokasi').value : 'Semua';
    try { let query = db.from('inventory').select('*'); if (locFilter !== 'Semua') query = query.eq('location', locFilter); const { data, error } = await query.order('id', { ascending: true }); if (error) throw error; inventoryData = data; if(statusBadge) statusBadge.innerText = "Terkoneksi"; await fetchFunds(); renderTable(); renderAnalyticsChart(); renderSelectOptions(); updateQuickStats(); await fetchBundles(); markSyncTime(); if(document.getElementById('tab-map').classList.contains('flex')) { updateMapPopups(); } } catch (err) { if(statusBadge) statusBadge.innerText = "Error Koneksi"; }
}
function updateQuickStats() { const statJenis = document.getElementById('stat-jenis-barang'); if(statJenis) statJenis.innerText = inventoryData.length; const statKritis = document.getElementById('stat-barang-kritis'); if(statKritis) statKritis.innerText = `${inventoryData.filter(i => i.stock <= currentCriticalLimit).length} Item`; }
function buildInventoryHTML(dataList, isStaff, tipeTabel) {
    if(dataList.length === 0) return `<div class="p-6 text-center text-zinc-600 text-xs italic bg-zinc-900/20 rounded">Tidak ada data ${tipeTabel}.</div>`;
    let html = '<div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">';
    dataList.forEach(item => { const pct = Math.min(100, (item.stock / (currentCriticalLimit * 2)) * 100); const color = item.stock <= currentCriticalLimit ? 'bg-rose-500' : (item.stock <= currentCriticalLimit*1.5 ? 'bg-yellow-500' : 'bg-emerald-500'); const textAlert = item.stock <= currentCriticalLimit ? 'text-rose-500 animate-pulse' : (tipeTabel === 'Senjata' ? 'text-rose-400' : 'text-emerald-400'); const actionBtn = isStaff ? `<div class="flex gap-2 mt-3"><button onclick="handleEditItem(${item.id})" class="flex-1 text-blue-400 hover:text-white border border-blue-900/50 px-2 py-1.5 rounded text-xs hover:bg-blue-600"><i class="fa-solid fa-pen-to-square"></i></button><button onclick="handleDeleteItem(${item.id})" class="flex-1 text-red-500 hover:text-white border border-red-900/50 px-2 py-1.5 rounded text-xs hover:bg-red-600"><i class="fa-solid fa-trash"></i></button></div>` : ''; html += `<div class="inventory-item-card bg-zinc-900/80 border border-zinc-800 p-4 rounded-xl shadow-lg flex flex-col justify-between"><div><div class="flex justify-between items-start mb-2"><h4 class="font-bold text-zinc-200 text-sm">${item.name}</h4><span class="text-[9px] bg-zinc-950 px-2 py-1 rounded text-zinc-400">${getLocationLabel(item.location)}</span></div><div class="text-3xl font-mono font-bold ${textAlert} my-2">${item.stock} <span class="text-[10px] text-zinc-500 font-sans tracking-widest uppercase">Unit</span></div><div class="stock-progress-bg"><div class="stock-progress-fill ${color}" style="width: ${pct}%"></div></div></div>${actionBtn}</div>`; }); return html + '</div>';
}
function renderTable() { const searchQ = document.getElementById('search-inventory') ? document.getElementById('search-inventory').value.toLowerCase() : ''; let fData = searchQ ? inventoryData.filter(i => i.name.toLowerCase().includes(searchQ)) : inventoryData; const isStaff = currentRole !== 'tamu'; const cS = document.getElementById('inventory-senjata-container'); const cR = document.getElementById('inventory-resource-container'); if(cS) cS.innerHTML = buildInventoryHTML(fData.filter(i => i.category === 'Senjata'), isStaff, 'Senjata'); if(cR) cR.innerHTML = buildInventoryHTML(fData.filter(i => i.category !== 'Senjata'), isStaff, 'Resource'); }
function renderSelectOptions() { const opts = `<option value="">-- Kosong --</option>` + inventoryData.map(i => `<option value="${i.id}">[${i.category === 'Senjata'?'🔫':'📦'}] ${i.name} (Stok: ${i.stock})</option>`).join(''); ['satuan-item', 'mutasi-item', 'bundle-item1', 'bundle-item2', 'bundle-item3'].forEach(id => { const el = document.getElementById(id); if(el) el.innerHTML = opts; }); }
function calcSatuanTotal() { const q = document.getElementById('satuan-qty').value||0; const h = document.getElementById('satuan-harga').value||0; document.getElementById('display-satuan-total').innerText = formatMoney(q*h); }
function toggleSatuanColors() { const t = document.getElementById('satuan-tipe').value; const b = document.getElementById('satuan-total-box'); const d = document.getElementById('display-satuan-total'); if(t==='Jual') { b.className="p-3 bg-black border border-emerald-900/50 rounded-lg flex justify-between items-center"; d.className="text-lg font-mono font-bold text-emerald-500"; } else { b.className="p-3 bg-black border border-rose-900/50 rounded-lg flex justify-between items-center"; d.className="text-lg font-mono font-bold text-rose-500"; } }
function calcPaketTotal() { const bId = document.getElementById('paket-bundle').value; const q = document.getElementById('paket-qty').value||0; if(!bId) return; const b = bundlesData.find(x=>x.id==bId); if(b) document.getElementById('display-paket-total').innerText = formatMoney(q*b.price); }
function togglePaketColors() { const t = document.getElementById('paket-tipe').value; const b = document.getElementById('paket-total-box'); const d = document.getElementById('display-paket-total'); if(t==='Jual') { b.className="p-3 bg-black border border-orange-900/50 rounded-lg flex justify-between items-center"; d.className="text-lg font-mono font-bold text-orange-500"; } else { b.className="p-3 bg-black border border-rose-900/50 rounded-lg flex justify-between items-center"; d.className="text-lg font-mono font-bold text-rose-500"; } }
function toggleMutasiColors() { const b = document.getElementById('mutasi-btn'); if(document.getElementById('mutasi-tipe').value === 'Ambil') { b.className = "w-full bg-purple-600 hover:bg-purple-700 text-white font-bold uppercase py-3 rounded-lg shadow-lg text-sm flex justify-center gap-2"; } else { b.className = "w-full bg-blue-600 hover:bg-blue-700 text-white font-bold uppercase py-3 rounded-lg shadow-lg text-sm flex justify-center gap-2"; } }

// ==========================================
// 💸 TRANSAKSI & BUNDLING
// ==========================================
async function fetchBundles() { try { const { data, error } = await db.from('bundles').select('*').order('id', { ascending: true }); if (!error) { bundlesData = data; renderBundlesTable(); } } catch (e) {} }
function renderBundlesTable() {
    const sel = document.getElementById('paket-bundle'); if(sel) sel.innerHTML = `<option value="">-- Pilih Paket --</option>` + bundlesData.map(b => `<option value="${b.id}">${b.name} - ${formatMoney(b.price)}</option>`).join(''); const tbody = document.getElementById('bundles-table-body'); if(!tbody) return; tbody.innerHTML = bundlesData.length === 0 ? `<tr><td colspan="4" class="p-8 text-center text-zinc-500 italic">Belum ada paket.</td></tr>` : '';
    bundlesData.forEach(b => { let items = []; [ [b.item1_id, b.item1_qty], [b.item2_id, b.item2_qty], [b.item3_id, b.item3_qty] ].forEach(x => { if(x[0]) { const i=inventoryData.find(y=>y.id==x[0]); items.push(`<span class="text-zinc-500">» ${i?i.name:'<i class="text-red-500">Terhapus</i>'} <b class="text-orange-500">x${x[1]}</b></span>`); } }); tbody.innerHTML += `<tr class="bg-zinc-950/30 border-b border-zinc-800/50"><td class="p-3 pl-5 font-bold text-orange-500">${b.name}</td><td class="p-3 text-[11px] flex flex-col">${items.join('')}</td><td class="p-3 text-right font-mono text-emerald-400 font-bold">${formatMoney(b.price)}</td><td class="p-3 text-center"><button onclick="deleteBundle(${b.id})" class="text-red-500 hover:text-white hover:bg-red-600 border border-red-900/50 px-3 py-1.5 rounded"><i class="fa-solid fa-trash"></i></button></td></tr>`; });
}
async function processTransaction(updates, totalQty, itemName, location, type, unitPrice, totalPrice, target, isPaket = false) {
    for (let u of updates) { await db.from('inventory').update({ stock: u.newStock }).eq('id', u.id); } const newFunds = type === 'Jual' ? currentFunds + totalPrice : currentFunds - totalPrice; await db.from('faction_funds').update({ balance: newFunds }).eq('id', 1); await db.from('warehouse_logs').insert([{ item_name: itemName, location: location, quantity: totalQty, type: type, operator: getOperatorName(), price: unitPrice, total_price: totalPrice, target_name: target }]); const vType = type === 'Jual' ? 'Deposit' : 'Tarik'; await db.from('vault_logs').insert([{ type: vType, amount: totalPrice, operator: `${getOperatorName()} | Bisnis ${isPaket?'Paket':'Satuan'}` }]); await sendToDiscord(`💼 Estate Transaction: ${type}`, `Operator **${getOperatorName()}** recorded an estate transaction.`, type==='Jual'?3066993:15158332, [{name: "Item", value: itemName, inline: true}, {name: "Jumlah", value: `${totalQty}`, inline: true}, {name: "Total Kas", value: formatMoney(totalPrice), inline: true}]); showToast(`Transaction recorded successfully`, 'success'); await fetchInventory(); fetchTickerLogs(); switchTab('dashboard');
}
async function handleBusinessSatuan(e) {
    e.preventDefault(); if(currentRole === 'tamu') return; const type = document.getElementById('satuan-tipe').value; const itemId = parseInt(document.getElementById('satuan-item').value); if(!itemId) return showMessage('Select an Asset', 'Pilih aset terlebih dahulu sebelum melanjutkan.', 'warning'); const qty = parseInt(document.getElementById('satuan-qty').value); const price = parseFloat(document.getElementById('satuan-harga').value); const target = document.getElementById('satuan-target').value; const item = inventoryData.find(i => i.id === itemId); if (!item) return; const totalPrice = qty * price;
    if (type === 'Beli') { if (currentFunds < totalPrice) { if(!await confirmTransactionBox('Treasury Insufficient', `Saldo treasury tidak mencukupi. Tetap lanjutkan transaksi?`)) return; } await processTransaction([{id: item.id, newStock: item.stock + qty}], qty, item.name, item.location, 'Beli', price, totalPrice, target); } else { if (item.stock < qty) return showMessage('Insufficient Stock', `Available stock: ${item.stock} units.`, 'error'); await processTransaction([{id: item.id, newStock: item.stock - qty}], qty, item.name, item.location, 'Jual', price, totalPrice, target); } document.getElementById('form-bisnis-satuan').reset(); document.getElementById('display-satuan-total').innerText = '$ 0';
}
async function handleBusinessPaket(e) {
    e.preventDefault(); if(currentRole === 'tamu') return; const type = document.getElementById('paket-tipe').value; const bId = document.getElementById('paket-bundle').value; if(!bId) return showMessage('Select a Package', 'Pilih paket aset terlebih dahulu.', 'warning'); const qty = parseInt(document.getElementById('paket-qty').value); const target = document.getElementById('paket-target').value; const bundle = bundlesData.find(x => x.id == bId); if(!bundle) return; const totalPrice = qty * bundle.price; let updates = []; let itemsToCheck = [ {id: bundle.item1_id, q: bundle.item1_qty}, {id: bundle.item2_id, q: bundle.item2_qty}, {id: bundle.item3_id, q: bundle.item3_qty} ].filter(x => x.id);
    for (let req of itemsToCheck) { const item = inventoryData.find(x => x.id == req.id); if(!item) return showMessage('Package Incomplete', 'Salah satu aset dalam paket tidak lagi tersedia di registry.', 'error'); const needed = req.q * qty; if(type === 'Jual' && item.stock < needed) return showMessage('Insufficient Stock', `${item.name} membutuhkan ${needed} unit, tersedia ${item.stock} unit.`, 'error'); updates.push({id: item.id, newStock: type === 'Jual' ? item.stock - needed : item.stock + needed}); }
    if (type === 'Beli' && currentFunds < totalPrice) { if(!await confirmTransactionBox('Treasury Insufficient', `Saldo treasury tidak mencukupi. Tetap lanjutkan transaksi?`)) return; } await processTransaction(updates, qty, `[PAKET] ${bundle.name}`, 'Bundle Area', type, bundle.price, totalPrice, target, true); document.getElementById('form-bisnis-paket').reset(); document.getElementById('display-paket-total').innerText = '$ 0';
}
async function handleCreateBundle(e) {
    e.preventDefault(); if(currentRole === 'tamu') return; const name = document.getElementById('create-bundle-name').value; const price = document.getElementById('create-bundle-price').value; const i1 = document.getElementById('bundle-item1').value; const q1 = document.getElementById('bundle-qty1').value; const i2 = document.getElementById('bundle-item2').value; const q2 = document.getElementById('bundle-qty2').value; const i3 = document.getElementById('bundle-item3').value; const q3 = document.getElementById('bundle-qty3').value; if(!i1) return showMessage('Package Incomplete', 'Paket memerlukan minimal satu aset.', 'error');
    const {error} = await db.from('bundles').insert([{ name: name, price: price, item1_id: i1||null, item1_qty: q1||null, item2_id: i2||null, item2_qty: q2||null, item3_id: i3||null, item3_qty: q3||null }]); if(!error) { showToast('Bundle configuration saved', 'success'); document.getElementById('form-buat-paket').reset(); fetchBundles(); } else showMessage('Error', error.message, 'error');
}
async function deleteBundle(id) { if(currentRole === 'tamu') return; if(await confirmTransactionBox('Remove Package?', 'Konfigurasi paket akan dihapus dari registry.')) { const {error} = await db.from('bundles').delete().eq('id', id); if(!error) { showToast('Package removed', 'success'); fetchBundles(); } } }

// ==========================================
// 📊 CHART & LOGS
// ==========================================
function renderAnalyticsChart() {
    const canvas = document.getElementById('bloodlineChart'); if (!canvas) return; const ctx = canvas.getContext('2d'); if (liveChartInstance) liveChartInstance.destroy(); liveChartInstance = new Chart(ctx, { type: 'bar', data: { labels: inventoryData.map(i => i.name), datasets: [{ data: inventoryData.map(i => i.stock), backgroundColor: inventoryData.map(i => i.stock <= currentCriticalLimit ? 'rgba(239, 68, 68, 0.6)' : (isHackerMode ? 'rgba(159, 23, 38, 0.48)' : 'rgba(200, 162, 91, 0.48)')), borderColor: inventoryData.map(i => i.stock <= currentCriticalLimit ? 'rgba(239, 68, 68, 1)' : (isHackerMode ? '#f0dba5' : 'rgba(226, 195, 127, 0.95)')), borderWidth: 2, borderRadius: 5 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { ticks: { color: isHackerMode ? '#f0dba5' : '#a1a1aa' }, grid: { color: isHackerMode ? '#3d2d16' : '#27272a' } }, y: { ticks: { color: isHackerMode ? '#f0dba5' : '#a1a1aa' }, grid: { color: isHackerMode ? '#3d2d16' : '#27272a' } } } } });
}
function toggleTimelineView() { isTimelineView = !isTimelineView; const icon = document.getElementById('timeline-toggle-icon'); if(icon) icon.className = isTimelineView ? 'fa-solid fa-list text-zinc-400' : 'fa-solid fa-stream text-zinc-400'; renderLogsTable(); }
async function fetchTickerLogs() {
    const ticker = document.getElementById('live-ticker'); if (!ticker) return; try { const { data, error } = await db.from('warehouse_logs').select('*').order('created_at', { ascending: false }).limit(5); if (error || !data || data.length === 0) { ticker.innerText = "Xaviera estate network beroperasi normal."; return; } ticker.innerText = data.map(l => `[${new Date(l.created_at).toLocaleTimeString('id-ID')}] ${l.operator}: ${l.type} ${l.quantity}x ${l.item_name}`).join('  ///  '); } catch (e) { ticker.innerText = "Xaviera private estate network active."; }
}
async function fetchLogs() { try { const { data, error } = await db.from('warehouse_logs').select('*').order('created_at', { ascending: false }); if (!error) { globalLogsData = data; renderLogsTable(); } } catch (err) {} }
function renderLogsTable() {
    const container = document.getElementById('logs-container'); if(!container) return; const searchQ = document.getElementById('search-logs') ? document.getElementById('search-logs').value.toLowerCase() : ''; let fLogs = searchQ ? globalLogsData.filter(l => l.item_name.toLowerCase().includes(searchQ) || l.operator.toLowerCase().includes(searchQ) || (l.target_name && l.target_name.toLowerCase().includes(searchQ))) : globalLogsData; if(fLogs.length === 0) { container.innerHTML = `<div class="p-8 text-center text-zinc-500 italic">Data aktivitas tidak ditemukan.</div>`; return; }
    if (isTimelineView) {
        let html = '<div class="relative border-l-2 border-zinc-800 ml-6 my-4 pl-6 space-y-6">';
        fLogs.forEach(log => { const localTime = new Date(log.created_at).toLocaleString('id-ID', { hour12: false }); const isPackage = log.item_name.includes('[PAKET]'); let bgIcon = '', icon = '', title = ''; if(log.type === 'Beli' || (log.type === 'Masuk' && log.price > 0)) { bgIcon = 'bg-rose-900/50 text-rose-500'; icon = 'fa-arrow-down'; title = 'Restock Bisnis'; } else if (log.type === 'Jual' || (log.type === 'Keluar' && log.price > 0)) { bgIcon = 'bg-emerald-900/50 text-emerald-500'; icon = 'fa-arrow-up'; title = 'Penjualan Bisnis'; } else if (log.type === 'Simpan' || (log.type === 'Masuk' && log.price === 0)) { bgIcon = 'bg-blue-900/50 text-blue-500'; icon = 'fa-box-archive'; title = 'Deposit Logistik'; } else if (log.type === 'Ambil' || (log.type === 'Keluar' && log.price === 0)) { bgIcon = 'bg-purple-900/50 text-purple-500'; icon = 'fa-hand-holding'; title = 'Ambil Logistik'; } html += `<div class="timeline-item relative bg-zinc-900/50 p-4 rounded-xl border border-zinc-800 shadow-md group"><div class="absolute -left-12 top-4 w-10 h-10 rounded-full ${bgIcon} border border-zinc-700 flex justify-center items-center"><i class="fa-solid ${icon}"></i></div><div class="flex justify-between items-start mb-1"><div><span class="text-[10px] font-bold uppercase text-zinc-500">${title}</span><h4 class="font-bold text-sm ${isPackage ? 'text-orange-400' : 'text-zinc-200'}">${log.quantity}x ${log.item_name}</h4></div><span class="text-xs font-mono text-zinc-500">${localTime}</span></div><p class="text-xs text-zinc-400 mt-2 mb-3 leading-relaxed border-l-2 border-zinc-700 pl-2"><span class="font-semibold text-zinc-300">Ket:</span> ${log.target_name || '-'}<br><span class="font-semibold text-zinc-300">Nilai:</span> ${log.total_price > 0 ? formatMoney(log.total_price) : 'Tanpa Kas'}</p><div class="flex items-center gap-2 text-[10px] uppercase font-bold text-zinc-500 bg-zinc-950 px-2 py-1 rounded inline-flex border border-zinc-800"><i class="fa-solid fa-user-shield"></i> OP: ${log.operator}</div></div>`; }); container.innerHTML = html + '</div>';
    } else {
        let tbody = ''; fLogs.forEach((log, index) => { const localTime = new Date(log.created_at).toLocaleString('id-ID', { hour12: false }); const isPackage = log.item_name.includes('[PAKET]'); let tb = '', sign = '', cVal = 'text-zinc-500'; if(log.type === 'Beli' || (log.type === 'Masuk' && log.price > 0)) { tb = `<span class="bg-rose-950/80 text-rose-400 px-2 py-0.5 rounded text-[10px] font-bold uppercase">Restock</span>`; sign = '-'; cVal = 'text-rose-400'; } else if (log.type === 'Jual' || (log.type === 'Keluar' && log.price > 0)) { tb = `<span class="bg-emerald-950/80 text-emerald-400 px-2 py-0.5 rounded text-[10px] font-bold uppercase">Jual</span>`; sign = '+'; cVal = 'text-emerald-400'; } else if (log.type === 'Simpan' || (log.type === 'Masuk' && log.price === 0)) { tb = `<span class="bg-blue-950/80 text-blue-400 px-2 py-0.5 rounded text-[10px] font-bold uppercase">Simpan</span>`; } else if (log.type === 'Ambil' || (log.type === 'Keluar' && log.price === 0)) { tb = `<span class="bg-purple-950/80 text-purple-400 px-2 py-0.5 rounded text-[10px] font-bold uppercase">Ambil</span>`; } tbody += `<tr class="${index % 2 === 0 ? 'bg-zinc-950/50' : 'bg-transparent'} hover:bg-zinc-800/20"><td class="p-3 text-center font-mono text-zinc-500">${localTime}</td><td class="p-3 font-semibold ${isPackage ? 'text-orange-400' : 'text-zinc-200'}">${log.item_name}</td><td class="p-3 text-center">${tb}</td><td class="p-3 text-center font-mono font-bold text-zinc-400">${log.quantity}</td><td class="p-3 text-zinc-400 text-xs">${log.target_name || '-'}</td><td class="p-3 text-right font-mono text-xs text-zinc-500">${log.price > 0 ? formatMoney(log.price) : '-'}</td><td class="p-3 text-right font-mono font-bold ${cVal}">${log.total_price > 0 ? sign+formatMoney(log.total_price) : '-'}</td><td class="p-3 text-zinc-500 text-[11px] font-semibold"><i class="fa-solid fa-user-shield"></i> ${log.operator}</td></tr>`; }); container.innerHTML = `<table class="w-full text-left border-collapse min-w-[1100px]"><thead class="sticky top-0 bg-zinc-900 z-10 shadow-md"><tr class="border-b border-zinc-800 text-zinc-400 text-[11px] uppercase"><th class="p-3 text-center w-32">Waktu</th><th class="p-3">Item/Paket</th><th class="p-3 text-center">Tipe</th><th class="p-3 text-center">Qty</th><th class="p-3">Keterangan</th><th class="p-3 text-right">Harga</th><th class="p-3 text-right">Total Kas</th><th class="p-3 w-36">Operator</th></tr></thead><tbody class="divide-y divide-zinc-900 text-xs md:text-sm">${tbody}</tbody></table>`;
    }
}

// ==========================================
// 📁 EKSPOR & MANAJEMEN GUDANG UTAMA
// ==========================================
async function exportMonthlyRecapExcel() {
    const tM = document.getElementById('rekap-bulan').value; const tY = document.getElementById('rekap-tahun').value; try { const { data: logs, error } = await db.from('warehouse_logs').select('*').order('created_at', { ascending: true }); if (error) throw error; const fLogs = logs.filter(l => { const d = new Date(l.created_at); return String(d.getMonth() + 1).padStart(2, '0') === tM && String(d.getFullYear()) === tY; }); if (fLogs.length === 0) return showMessage('No Records', `Tidak ada catatan untuk periode ${tM}-${tY}.`, 'info'); const rows = fLogs.map((l, i) => ({ "No": i + 1, "Waktu": new Date(l.created_at).toLocaleString('id-ID'), "Item": l.item_name, "Jenis": l.price > 0 ? (l.type==='Beli'||l.type==='Masuk'?'Beli':'Jual') : (l.type==='Simpan'||l.type==='Masuk'?'Deposit':'Ambil'), "Qty": l.quantity, "Ket": l.target_name || '-', "Harga": l.price || 0, "Total Kas": l.total_price || 0, "Operator": l.operator })); const ws = XLSX.utils.json_to_sheet(rows); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Ledger"); XLSX.writeFile(wb, `XAVIERA_ESTATE_AUDIT_${tM}_${tY}.xlsx`); showToast('Archive exported successfully', 'success'); } catch (err) { showMessage('Error', err.message, 'error'); }
}
async function handleMutasiGudang(e) {
    e.preventDefault(); if(currentRole === 'tamu') return; const type = document.getElementById('mutasi-tipe').value; const itemId = parseInt(document.getElementById('mutasi-item').value); if(!itemId) return showMessage('Select an Asset', 'Pilih aset terlebih dahulu sebelum melanjutkan.', 'warning'); const qty = parseInt(document.getElementById('mutasi-qty').value); const target = document.getElementById('mutasi-keterangan').value; const item = inventoryData.find(i => i.id === itemId); if (!item) return; let newStock = item.stock; if(type === 'Ambil') { if (item.stock < qty) return showMessage('Stok Kurang', `Sisa: ${item.stock}.`, 'error'); newStock = item.stock - qty; } else { newStock = item.stock + qty; } const { error } = await db.from('inventory').update({ stock: newStock }).eq('id', item.id); if (!error) { await db.from('warehouse_logs').insert([{ item_name: item.name, location: item.location, quantity: qty, type: type, operator: getOperatorName(), price: 0, total_price: 0, target_name: target }]); await sendToDiscord(`📦 Asset Movement: ${type}`, `Operator **${getOperatorName()}** recorded an inventory movement.`, type==='Ambil'?10181046:3447003, [{ name: "Barang", value: item.name, inline: true }, { name: "Jumlah", value: `${qty}`, inline: true }, { name: "Alasan", value: target, inline: true }]); document.getElementById('form-mutasi-gudang').reset(); showToast(`Asset movement recorded`, 'success'); await fetchInventory(); fetchTickerLogs(); switchTab('dashboard'); }
}
async function handleAddNewItem(e) {
    e.preventDefault(); if(currentRole === 'tamu') return; const name = document.getElementById('input-tambah-nama').value; const loc = document.getElementById('input-tambah-lokasi').value; const stock = parseInt(document.getElementById('input-tambah-stok').value) || 0; const cat = document.getElementById('input-tambah-kategori').value; const { error } = await db.from('inventory').insert([{ name: name, location: loc, stock: stock, category: cat }]); if (!error) { await db.from('warehouse_logs').insert([{ item_name: name, location: loc, quantity: stock, type: 'Simpan', operator: getOperatorName(), price: 0, total_price: 0, target_name: 'Registrasi Baru' }]); await sendToDiscord(`📦 New Estate Asset`, `A new asset was added to the estate registry.`, 3447003, [{ name: "Nama", value: name, inline: true }]); showToast('Asset registered', 'success'); document.getElementById('form-tambah-barang').reset(); await fetchInventory(); fetchTickerLogs(); switchTab('dashboard'); } else showMessage('Operation Failed', error.message, 'error');
}
async function handleEditItem(id) {
    if(currentRole === 'tamu') return; const item = inventoryData.find(i => i.id === id); if(!item) return; const { value: v } = await Swal.fire({ title: 'Edit Asset', html: `<div class="space-y-4 my-2"><input id="swal-edit-name" class="swal2-input !m-0 !bg-zinc-900 !text-zinc-200" value="${item.name}"><select id="swal-edit-category" class="swal2-select !m-0 !bg-zinc-900 !text-zinc-200"><option value="Resource" ${item.category === 'Resource' ? 'selected' : ''}>Resource</option><option value="Senjata" ${item.category === 'Senjata' ? 'selected' : ''}>Senjata</option></select><select id="swal-edit-location" class="swal2-select !m-0 !bg-zinc-900 !text-zinc-200"><option value="Brankas Bos" ${item.location === 'Brankas Bos' ? 'selected' : ''}>Private Vault</option><option value="Loker Bersama" ${item.location === 'Loker Bersama' ? 'selected' : ''}>Shared Depository</option><option value="Gudang Umum" ${item.location === 'Gudang Umum' ? 'selected' : ''}>Central Storehouse</option></select></div>`, showCancelButton: true, confirmButtonColor: '#3b82f6', background: isHackerMode ? '#080503' : '#120d0a', color: isHackerMode ? '#f0dba5' : '#f3ead9', preConfirm: () => { const n = document.getElementById('swal-edit-name').value; if(!n) { Swal.showValidationMessage('Nama aset wajib diisi.'); return false; } return { name: n, category: document.getElementById('swal-edit-category').value, location: document.getElementById('swal-edit-location').value } } }); if (v) { const { error } = await db.from('inventory').update({ name: v.name, category: v.category, location: v.location }).eq('id', id); if (!error) { showToast('Asset record updated', 'success'); await fetchInventory(); } else showMessage('Error', error.message, 'error'); }
}
async function handleDeleteItem(id) {
    if(currentRole === 'tamu') return; if(await confirmTransactionBox('Remove Asset?', 'Aset yang digunakan dalam package dapat menyebabkan package tersebut tidak lengkap. Lanjutkan?')) { const { error } = await db.from('inventory').delete().eq('id', id); if (!error) { showToast('Record removed', 'info'); await fetchInventory(); } }
}

// ==========================================
// 👥 HOUSE DIRECTORY & MEMBERS
// ==========================================
async function fetchMembers() { try { const { data, error } = await db.from('members').select('*').order('created_at', { ascending: true }); if (error) throw error; membersData = data; renderMembersTable(); } catch (err) {} }
function renderMembersTable() {
    const tbody = document.getElementById('roster-table-body'); const countDisplay = document.getElementById('roster-count'); if (!tbody) return; if (countDisplay) countDisplay.innerText = `${membersData.length} Total`; tbody.innerHTML = membersData.length === 0 ? `<tr><td colspan="4" class="p-8 text-center text-zinc-500 italic">Belum ada anggota.</td></tr>` : ''; const isStaff = (currentRole !== 'tamu');
    membersData.forEach((member, index) => { let statusBadge = ''; if(member.status === 'Aktif') statusBadge = '<span class="bg-emerald-950/80 text-emerald-400 border border-emerald-800 px-2 py-0.5 rounded text-[10px] font-bold uppercase">🟢 Aktif</span>'; else if(member.status === 'Penjara') statusBadge = '<span class="bg-rose-950/80 text-rose-400 border border-rose-800 px-2 py-0.5 rounded text-[10px] font-bold uppercase">🔴 Restricted</span>'; else statusBadge = '<span class="bg-zinc-800 text-zinc-400 border border-zinc-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase">⚪ Inactive</span>'; let rankStyle = 'text-zinc-200'; if(member.rank.includes('President') || member.rank.includes('Sgt') || member.rank.includes('Treasury')) rankStyle = 'text-orange-400 font-bold'; else if(member.rank === 'Prospect' || member.rank === 'Hangaround') rankStyle = 'text-zinc-500'; const actionBtn = isStaff ? `<button onclick="handleDeleteMember(${member.id}, '${member.name}')" class="text-red-500 hover:text-white hover:bg-red-600 border border-red-900/50 px-3 py-1 rounded transition-all mr-1"><i class="fa-solid fa-user-xmark"></i></button>` : ''; tbody.innerHTML += `<tr class="${index % 2 === 0 ? 'bg-zinc-950/50' : 'bg-transparent'} hover:bg-zinc-900/50 transition-colors"><td class="p-3 pl-5 font-bold tracking-wide text-zinc-100">${member.name}</td><td class="p-3 text-sm ${rankStyle}">${getRankLabel(member.rank)}</td><td class="p-3 text-center">${statusBadge}</td><td class="p-3 text-center admin-only ${isStaff ? '' : 'hidden'}">${actionBtn}</td></tr>`; });
}
async function handleAddMember(e) { e.preventDefault(); if(currentRole === 'tamu') return; const name = document.getElementById('roster-name').value; const rank = document.getElementById('roster-rank').value; const status = document.getElementById('roster-status').value; const { error } = await db.from('members').insert([{ name: name, rank: rank, status: status }]); if (!error) { showToast('Member added to the house directory', 'success'); document.getElementById('form-tambah-anggota').reset(); fetchMembers(); } else showMessage('Operation Failed', error.message, 'error'); }
async function handleDeleteMember(id, name) { if(currentRole === 'tamu') return; if(await confirmTransactionBox('Remove Member?', `Hapus ${name} dari Xaviera House Directory?`)) { const { error } = await db.from('members').delete().eq('id', id); if(!error) { showToast('Dihapus', 'info'); fetchMembers(); } } }

// ==========================================
// 📜 HOUSE CODEX & PROTOCOLS
// ==========================================
async function fetchRules() {
    try { const { data, error } = await db.from('faction_rules').select('*').order('created_at', { ascending: false }); if (error) throw error; rulesData = data; renderRules(); } catch (err) { console.error("Error SOP:", err); }
}

function renderRules() {
    const container = document.getElementById('rules-container'); const countDisplay = document.getElementById('rules-count'); if(!container) return;
    if(countDisplay) countDisplay.innerText = `${rulesData.length} Pasal`;
    if(rulesData.length === 0) { container.innerHTML = `<div class="p-8 text-center text-zinc-500 italic">Buku panduan masih kosong. Belum ada aturan yang diterbitkan.</div>`; return; }
    
    const isStaff = (currentRole !== 'tamu'); let html = '';
    
    rulesData.forEach(r => {
        let badgeClass = 'bg-zinc-800 text-zinc-300';
        if(r.category === 'Aturan Umum') badgeClass = 'bg-orange-900/50 text-orange-400 border border-orange-800/50';
        else if(r.category === 'SOP Gudang') badgeClass = 'bg-blue-900/50 text-blue-400 border border-blue-800/50';
        else if(r.category === 'Hierarki') badgeClass = 'bg-red-900/50 text-red-400 border border-red-800/50';
        
        const actionBtn = isStaff ? `<button onclick="handleDeleteRule(${r.id})" class="text-red-500 hover:text-white hover:bg-red-600 border border-red-900/50 px-2.5 py-1.5 rounded text-xs transition-all" title="Hapus Aturan"><i class="fa-solid fa-trash"></i></button>` : '';
        
        html += `
            <div class="bg-zinc-900/60 border border-zinc-800 rounded-lg p-4 shadow-md relative group hover:bg-zinc-900 transition-colors">
                <div class="flex justify-between items-start mb-3">
                    <div>
                        <span class="${badgeClass} px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider mb-2 inline-block">${r.category}</span>
                        <h3 class="text-zinc-100 font-bold text-base tracking-wide">${r.title}</h3>
                    </div>
                    <div class="admin-only ${isStaff ? '' : 'hidden'}">${actionBtn}</div>
                </div>
                <p class="text-zinc-400 text-sm leading-relaxed whitespace-pre-wrap border-l-2 border-zinc-700 pl-3">${r.content}</p>
                <div class="mt-4 text-[10px] text-zinc-500 font-mono text-right border-t border-zinc-800/60 pt-2">
                    <i class="fa-solid fa-pen-nib mr-1"></i> Ditulis oleh: <span class="text-zinc-400 font-bold">${r.author}</span> | ${new Date(r.created_at).toLocaleString('id-ID')}
                </div>
            </div>`;
    });
    container.innerHTML = html;
}

async function handleAddRule(e) {
    e.preventDefault(); if(currentRole === 'tamu') return;
    const cat = document.getElementById('rule-category').value; const title = document.getElementById('rule-title').value; const content = document.getElementById('rule-content').value;
    const {error} = await db.from('faction_rules').insert([{ category: cat, title: title, content: content, author: getOperatorName() }]);
    if(!error) { showToast('Protocol published', 'success'); document.getElementById('form-tambah-rule').reset(); await sendToDiscord(`📜 House Protocol Published`, `**${title}**\n*Oleh: ${getOperatorName()}*`, 15158332, []); fetchRules(); } else showMessage('Gagal Menyimpan', error.message, 'error');
}

async function handleDeleteRule(id) {
    if(currentRole === 'tamu') return;
    if(await confirmTransactionBox('Remove Protocol?', 'Protokol ini akan dihapus dari House Codex. Lanjutkan?')) { const {error} = await db.from('faction_rules').delete().eq('id', id); if(!error) { showToast('Protocol removed', 'info'); fetchRules(); } }
}

// ==========================================
// ✨ INTERACTIVE UI LAYER
// Hanya mengatur tampilan dan interaksi antarmuka.
// Tidak mengubah logika transaksi/database.
// ==========================================
function animateActiveTab(tabId) {
    const tab = document.getElementById(`tab-${tabId}`);
    if (!tab) return;
    tab.classList.remove('ui-tab-enter');
    void tab.offsetWidth;
    tab.classList.add('ui-tab-enter');
    setTimeout(() => tab.classList.remove('ui-tab-enter'), 380);
}

function markSyncTime() {
    const el = document.getElementById('last-sync-time');
    if (!el) return;
    const now = new Date();
    el.innerText = `Sync ${now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}`;
    const pill = el.closest('.sync-pill');
    if (pill) {
        pill.classList.remove('sync-flash');
        void pill.offsetWidth;
        pill.classList.add('sync-flash');
        setTimeout(() => pill.classList.remove('sync-flash'), 650);
    }
}

function pulseValue(el) {
    if (!el) return;
    el.classList.remove('ui-value-pop');
    void el.offsetWidth;
    el.classList.add('ui-value-pop');
    setTimeout(() => el.classList.remove('ui-value-pop'), 380);
}

function setupValueObservers() {
    const ids = [
        'stat-kas-bersih',
        'stat-kas-kotor',
        'stat-jenis-barang',
        'stat-barang-kritis',
        'display-faction-funds',
        'display-dirty-funds'
    ];

    ids.forEach(id => {
        const el = document.getElementById(id);
        if (!el || el.dataset.uiObserved === 'true') return;
        el.dataset.uiObserved = 'true';
        let lastText = el.textContent;
        const observer = new MutationObserver(() => {
            const nextText = el.textContent;
            if (nextText === lastText) return;
            lastText = nextText;
            pulseValue(el);
        });
        observer.observe(el, { childList: true, characterData: true, subtree: true });
    });
}

function setupKpiInteraction() {
    document.querySelectorAll('.kpi-card').forEach(card => {
        if (card.dataset.interactiveReady === 'true') return;
        card.dataset.interactiveReady = 'true';

        card.addEventListener('pointermove', event => {
            if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
            if (event.pointerType && event.pointerType !== 'mouse') return;
            const rect = card.getBoundingClientRect();
            const x = ((event.clientX - rect.left) / rect.width) * 100;
            const y = ((event.clientY - rect.top) / rect.height) * 100;
            card.style.setProperty('--mouse-x', `${x}%`);
            card.style.setProperty('--mouse-y', `${y}%`);

            const rx = ((event.clientY - rect.top) / rect.height - 0.5) * -2.4;
            const ry = ((event.clientX - rect.left) / rect.width - 0.5) * 2.8;
            card.style.transform = `perspective(700px) rotateX(${rx}deg) rotateY(${ry}deg) translateY(-2px)`;
        });

        card.addEventListener('pointerleave', () => {
            card.style.transform = '';
        });
    });
}

function createRipple(event) {
    const button = event.target.closest('button');
    if (!button || button.disabled || button.closest('.swal2-container')) return;

    const rect = button.getBoundingClientRect();
    const ripple = document.createElement('span');
    ripple.className = 'ui-ripple';
    ripple.style.left = `${event.clientX - rect.left}px`;
    ripple.style.top = `${event.clientY - rect.top}px`;
    button.appendChild(ripple);
    setTimeout(() => ripple.remove(), 520);
}

function setRefreshFeedback() {
    const btn = document.getElementById('refresh-dashboard-btn');
    if (!btn || btn.dataset.feedbackReady === 'true') return;
    btn.dataset.feedbackReady = 'true';
    btn.addEventListener('click', () => {
        btn.classList.add('ui-refreshing');
        setTimeout(() => btn.classList.remove('ui-refreshing'), 850);
    });
}

function getVisibleCommandItems() {
    return Array.from(document.querySelectorAll('#command-list .command-item'))
        .filter(item => !item.classList.contains('hidden') && item.style.display !== 'none');
}

function selectCommandItem(index) {
    const items = getVisibleCommandItems();
    items.forEach(item => item.classList.remove('command-selected'));
    if (!items.length) return;
    const safeIndex = ((index % items.length) + items.length) % items.length;
    items[safeIndex].classList.add('command-selected');
    items[safeIndex].scrollIntoView({ block: 'nearest' });
}

function openCommandPalette() {
    const palette = document.getElementById('command-palette');
    const input = document.getElementById('command-search');
    if (!palette || !input) return;

    palette.classList.remove('hidden');
    palette.setAttribute('aria-hidden', 'false');
    input.value = '';
    filterCommandPalette('');
    document.body.classList.add('command-open');
    setTimeout(() => {
        input.focus();
        selectCommandItem(0);
    }, 30);
}

function closeCommandPalette() {
    const palette = document.getElementById('command-palette');
    if (!palette) return;
    palette.classList.add('hidden');
    palette.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('command-open');
}

function filterCommandPalette(query) {
    const q = String(query || '').trim().toLowerCase();
    let visibleCount = 0;

    document.querySelectorAll('#command-list .command-item').forEach(item => {
        // Tetap hormati .admin-only yang disembunyikan oleh setupRoleUI().
        if (item.classList.contains('admin-only') && currentRole === 'tamu') {
            item.style.display = 'none';
            return;
        }
        const label = (item.dataset.label || item.textContent || '').toLowerCase();
        const match = !q || label.includes(q);
        item.style.display = match ? '' : 'none';
        if (match) visibleCount++;
    });

    const empty = document.getElementById('command-empty');
    if (empty) empty.classList.toggle('hidden', visibleCount > 0);
    selectCommandItem(0);
}

function setupCommandPalette() {
    const openBtn = document.getElementById('command-menu-btn');
    const palette = document.getElementById('command-palette');
    const input = document.getElementById('command-search');
    if (!openBtn || !palette || !input || palette.dataset.ready === 'true') return;
    palette.dataset.ready = 'true';

    openBtn.addEventListener('click', openCommandPalette);
    palette.querySelectorAll('[data-command-close]').forEach(el => el.addEventListener('click', closeCommandPalette));

    input.addEventListener('input', () => filterCommandPalette(input.value));

    document.querySelectorAll('#command-list .command-item').forEach(item => {
        item.addEventListener('click', () => {
            const tab = item.dataset.tab;
            if (tab) switchTab(tab);
            closeCommandPalette();
        });
    });

    document.addEventListener('keydown', event => {
        const isShortcut = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k';
        if (isShortcut) {
            event.preventDefault();
            if (palette.classList.contains('hidden')) openCommandPalette();
            else closeCommandPalette();
            return;
        }

        if (palette.classList.contains('hidden')) return;

        if (event.key === 'Escape') {
            event.preventDefault();
            closeCommandPalette();
            return;
        }

        const items = getVisibleCommandItems();
        if (!items.length) return;
        let index = items.findIndex(item => item.classList.contains('command-selected'));
        if (index < 0) index = 0;

        if (event.key === 'ArrowDown') {
            event.preventDefault();
            selectCommandItem(index + 1);
        } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            selectCommandItem(index - 1);
        } else if (event.key === 'Enter') {
            const selected = items[index] || items[0];
            if (selected) {
                event.preventDefault();
                selected.click();
            }
        }
    });
}

function setupInteractiveUI() {
    setupKpiInteraction();
    setupValueObservers();
    setRefreshFeedback();
    setupCommandPalette();
    document.addEventListener('pointerdown', createRipple);

    const inventoryRoot = document.getElementById('tab-dashboard');
    if (inventoryRoot) {
        const observer = new MutationObserver(() => setupKpiInteraction());
        observer.observe(inventoryRoot, { childList: true, subtree: true });
    }
}

// ==========================================
// 🔄 SUPABASE REALTIME (LIVE SYNC)
// ==========================================
function enableRealtimeSync() {
    db.channel('bloodline-radar')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory' }, p => { fetchInventory(); })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'faction_funds' }, p => { fetchFunds(); })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'warehouse_logs' }, p => { fetchLogs(); })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'vault_logs' }, p => { if (document.getElementById('tab-logs').classList.contains('block')) fetchFundLogs(); })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'members' }, p => { fetchMembers(); })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'faction_rules' }, p => { fetchRules(); })
        .subscribe((status) => {
            if (status === 'SUBSCRIBED') { const sb = document.getElementById('db-status'); if(sb) { sb.innerHTML = `<i class="fa-solid fa-satellite-dish animate-pulse mr-1"></i> LIVE SYNC`; sb.className = "hidden md:inline-block text-[10px] bg-blue-900/40 text-blue-400 px-2 py-1 rounded border border-blue-700/50"; } }
        });
}

setupInteractiveUI();
syncSidebarForViewport();
