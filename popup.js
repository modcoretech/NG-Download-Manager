// --- DOM Elements ---
const downloadsListEl = document.getElementById('downloadsList');
const searchInput = document.getElementById('searchInput');
const refreshButton = document.getElementById('refreshButton');
const themeToggleButton = document.getElementById('themeToggleButton');
const themeIcon = document.getElementById('themeIcon');
const optionsButton = document.getElementById('optionsButton');
const addUrlButton = document.getElementById('addUrlButton');
const addUrlSection = document.getElementById('addUrlSection');
const urlInput = document.getElementById('urlInput');
const startDownloadButton = document.getElementById('startDownloadButton');
const cancelAddUrlButton = document.getElementById('cancelAddUrlButton');
const filterStatusSelect = document.getElementById('filterStatus');
const filterDateSelect = document.getElementById('filterDate'); // Date filter dropdown
const sortBySelect = document.getElementById('sortBy');
const itemsPerPageSelect = document.getElementById('itemsPerPage');
const batchActionBar = document.getElementById('batchActionBar');
const selectAllCheckbox = document.getElementById('selectAllCheckbox');
const selectedCountSpan = document.getElementById('selectedCount');
const placeholderContainer = downloadsListEl.querySelector('.placeholder-container');
const placeholderText = placeholderContainer.querySelector('.placeholder');
const statusSummarySpan = document.getElementById('statusSummary');
const clearAllFinishedButton = document.getElementById('clearAllFinishedButton');
const moreActionsMenuTemplate = document.getElementById('moreActionsMenuTemplate');
const itemMessageTemplate = document.getElementById('itemMessageTemplate');
const paginationControlsEl = document.getElementById('paginationControls');
const prevPageButton = document.getElementById('prevPageButton');
const nextPageButton = document.getElementById('nextPageButton');
const pageInfoSpan = document.getElementById('pageInfo');


// --- State ---
let allDownloads = []; // Raw data from API
let filteredDownloads = []; // Filtered and sorted data
let displayedDownloads = []; // Data currently visible on the page (paginated slice)
let currentTheme = 'light';
let currentFilterStatus = 'all';
let currentFilterDate = 'all'; // State for date filter
let currentSort = 'startTimeDesc'; // Keep as string for popup simplicity
let selectedIds = new Set();
let activeMoreActionsMenu = null;
let currentPage = 1;
let itemsPerPage = 10; // Popup default
let totalPages = 1;
let debounceTimer = null;
let lastUpdateTime = 0;
const UPDATE_THROTTLE_MS = 500; // Throttle UI updates for non-critical changes

// --- Constants ---
const ICONS_PATH = 'assets/icons/';
const FILE_ICONS = { /* ... (keep existing file icons) ... */
    'zip': 'archive.svg', 'rar': 'archive.svg', '7z': 'archive.svg', 'pdf': 'file-text.svg', 'doc': 'file-text.svg', 'docx': 'file-text.svg', 'xls': 'file-spreadsheet.svg', 'xlsx': 'file-spreadsheet.svg', 'ppt': 'file-slides.svg', 'pptx': 'file-slides.svg', 'txt': 'file.svg', 'jpg': 'image.svg', 'jpeg': 'image.svg', 'png': 'image.svg', 'gif': 'image.svg', 'bmp': 'image.svg', 'svg': 'image.svg', 'mp3': 'music.svg', 'wav': 'music.svg', 'aac': 'music.svg', 'flac': 'music.svg', 'mp4': 'film.svg', 'avi': 'film.svg', 'mkv': 'film.svg', 'mov': 'film.svg', 'wmv': 'film.svg', 'exe': 'terminal.svg', 'msi': 'package.svg', 'deb': 'package.svg', 'rpm': 'package.svg', 'dmg': 'disc.svg', 'iso': 'disc.svg', 'default': 'file.svg'
};

// --- Utility Functions ---
function formatBytes(bytes, decimals = 1) { /* ... (keep existing) ... */
    if (bytes === 0 || !bytes) return '0 B'; if (bytes < 0) return '? B'; const k = 1024; const dm = decimals < 0 ? 0 : decimals; const sizes = ['B', 'KB', 'MB', 'GB', 'TB']; const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1); return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}
function formatSpeed(bytesPerSecond) { /* ... (keep existing) ... */
    if (!bytesPerSecond || bytesPerSecond <= 0) return ''; return formatBytes(bytesPerSecond) + '/s';
}
function formatRemainingTime(ms) { /* ... (keep existing) ... */
    if (!ms || ms <= 0 || ms === Infinity) return ''; const s = Math.floor((ms / 1000) % 60); const m = Math.floor((ms / (1000 * 60)) % 60); const h = Math.floor((ms / (1000 * 60 * 60)) % 24); const d = Math.floor(ms / (1000 * 60 * 60 * 24)); if (d > 0) return `~${d}d`; if (h > 0) return `~${h}h`; if (m > 0) return `~${m}m`; if (s > 0) return `~${s}s`; return '<1s';
}
function getFilename(path) { /* ... (keep existing) ... */
     return path ? path.substring(path.lastIndexOf('\\') + 1).substring(path.lastIndexOf('/') + 1) || 'download' : 'unknown_filename';
}
function getFileIcon(filename) { /* ... (keep existing) ... */
     const ext = filename.split('.').pop()?.toLowerCase() || ''; return ICONS_PATH + (FILE_ICONS[ext] || FILE_ICONS['default']);
}
function debounce(func, delay) { /* ... (keep existing) ... */
    clearTimeout(debounceTimer); debounceTimer = setTimeout(func, delay);
}
function formatDateShort(dateString) {
    if (!dateString) return '';
    try {
        const date = new Date(dateString);
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const itemDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

        if (itemDate.getTime() === todayStart.getTime()) {
            // Today: Show time
            return new Intl.DateTimeFormat(navigator.language, { hour: 'numeric', minute: '2-digit', hour12: true }).format(date);
        } else if (itemDate.getTime() === todayStart.getTime() - (24 * 60 * 60 * 1000)) {
            // Yesterday
            return 'Yesterday';
        } else {
            // Older: Show date
             return new Intl.DateTimeFormat(navigator.language, { month: 'short', day: 'numeric' }).format(date);
        }
    } catch (e) {
        return ''; // Fallback
    }
}

// --- Theme Handling ---
// ... (keep existing theme functions: applyTheme, toggleTheme, loadThemePreference) ...
function applyTheme(theme) { /* ... (keep existing applyTheme) ... */
    document.documentElement.setAttribute('data-theme', theme);
    themeIcon.src = ICONS_PATH + (theme === 'dark' ? 'sun.svg' : 'moon.svg');
    themeIcon.alt = theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode';
    currentTheme = theme;
    chrome.storage.sync.set({ theme: theme });
}
function toggleTheme() { applyTheme(currentTheme === 'light' ? 'dark' : 'light'); }
function loadThemePreference() { /* ... (keep existing loadThemePreference) ... */
     chrome.storage.sync.get('theme', (result) => {
        let themeToApply = result.theme;
        if (!themeToApply || themeToApply === 'system') {
             themeToApply = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
             if (!result.theme) chrome.storage.sync.set({ theme: 'system' });
        }
        applyTheme(themeToApply);
    });
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', event => {
        chrome.storage.sync.get('theme', (result) => {
            if (result.theme === 'system') {
                applyTheme(event.matches ? 'dark' : 'light');
            }
        });
    });
}

// --- Rendering Logic ---
function renderDownloadItem(item) {
    const filename = getFilename(item.filename);
    const fileIcon = getFileIcon(filename);
    const isPaused = item.paused;
    const isComplete = item.state === 'complete';
    const isInterrupted = item.state === 'interrupted';
    const isInProgress = item.state === 'in_progress';
    const isActive = isInProgress || isPaused;

    const progressPercent = (item.bytesReceived && item.totalBytes > 0)
        ? (item.bytesReceived / item.totalBytes) * 100
        : (isComplete ? 100 : (isInterrupted ? 100 : 0));

    let speedStr = '';
    let etaStr = '';
    if (isInProgress && !isPaused && item.bytesReceived > 0) {
        speedStr = formatSpeed(item.currentSpeed || item.speed); // Use best guess for speed
        if (item.estimatedEndTime) {
            const remainingMs = new Date(item.estimatedEndTime).getTime() - Date.now();
            etaStr = remainingMs > 500 ? formatRemainingTime(remainingMs) : ''; // Only show reasonable ETA
        }
    }

    let statusText = item.state;
    let statusClass = item.state;
    if (isPaused) { statusText = 'Paused'; statusClass = 'paused'; }
    else if (isInterrupted) { statusText = item.error ? `Error: ${item.error}` : 'Cancelled'; statusClass = 'interrupted'; }
    else if (isComplete) { statusText = 'Completed'; statusClass = 'complete'; }
    else if (isInProgress) { statusText = 'Downloading'; statusClass = 'in_progress'; }

    const bytesStr = formatBytes(item.bytesReceived);
    const totalBytesStr = item.totalBytes > 0 ? formatBytes(item.totalBytes) : '? B';
    const sizeStr = isActive || item.bytesReceived > 0 ? `${bytesStr} / ${totalBytesStr}` : totalBytesStr;
    const dateStr = formatDateShort(item.startTime);


    const itemHtml = `
        <div class="download-item ${statusClass}" data-id="${item.id}" role="listitem" aria-label="${filename}, Status: ${statusText}">
             <div class="item-selection">
                <input type="checkbox" class="item-checkbox" id="checkbox-${item.id}" aria-label="Select ${filename}" ${selectedIds.has(item.id) ? 'checked' : ''}>
            </div>
            <img src="${fileIcon}" alt="" class="file-icon">
            <div class="download-info">
                <a href="#" class="filename" data-action="open" title="Double Click to Open: ${filename}\nAdded: ${new Date(item.startTime).toLocaleString()}">${filename}</a>
                <div class="status-details">
                    <span class="status-text ${statusClass}">${statusText}</span>
                    <span class="size">${sizeStr}</span>
                    ${speedStr ? `<span class="speed">${speedStr}</span>` : ''}
                    ${etaStr ? `<span class="eta">(${etaStr})</span>` : ''}
                    ${dateStr ? `<span class="item-date">${dateStr}</span>` : ''}
                </div>
                ${isActive || isInterrupted ? `
                <div class="progress-container" aria-label="Download progress ${progressPercent.toFixed(0)}%">
                    <div class="progress-bar ${statusClass}" style="width: ${progressPercent}%" role="progressbar" aria-valuenow="${progressPercent.toFixed(0)}" aria-valuemin="0" aria-valuemax="100"></div>
                </div>
                ` : ''}
                 <div class="item-message-area"></div>
            </div>
            <div class="item-actions">
                 ${isInProgress && !isPaused ? `<button class="icon-button" data-action="pause" title="Pause"><img src="${ICONS_PATH}pause.svg" alt="Pause"></button>` : ''}
                 ${isPaused ? `<button class="icon-button" data-action="resume" title="Resume"><img src="${ICONS_PATH}play.svg" alt="Resume"></button>` : ''}
                 ${isActive ? `<button class="icon-button" data-action="cancel" title="Cancel"><img src="${ICONS_PATH}x-octagon.svg" alt="Cancel"></button>` : ''}
                 ${isComplete ? `<button class="icon-button" data-action="show" title="Show in Folder"><img src="${ICONS_PATH}folder.svg" alt="Folder"></button>` : ''}
                 <button class="icon-button more-actions-trigger" data-action="more" title="More Actions"><img src="${ICONS_PATH}more-vertical.svg" alt="More"></button>
            </div>
        </div>
    `;
    return itemHtml;
}

function updateDownloadItem(item) {
    const existingItemDiv = downloadsListEl.querySelector(`.download-item[data-id="${item.id}"]`);
    if (!existingItemDiv) return;

    const newItemHtml = renderDownloadItem(item);
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = newItemHtml.trim();
    const newItemDiv = tempDiv.firstChild;

    const oldMessageArea = existingItemDiv.querySelector('.item-message-area');
    const newMessageArea = newItemDiv.querySelector('.item-message-area');
    if (oldMessageArea && newMessageArea && oldMessageArea.innerHTML) {
        newMessageArea.innerHTML = oldMessageArea.innerHTML;
    }
    existingItemDiv.replaceWith(newItemDiv);
}

function processAndDisplayDownloads() {
    filteredDownloads = filterAndSortDownloads(allDownloads);
    totalPages = Math.max(1, Math.ceil(filteredDownloads.length / itemsPerPage));
    currentPage = Math.min(currentPage, totalPages);

    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    displayedDownloads = filteredDownloads.slice(startIndex, endIndex);

    downloadsListEl.innerHTML = ''; // Clear list container

    if (displayedDownloads.length === 0) {
        placeholderText.textContent = (searchInput.value || currentFilterStatus !== 'all' || currentFilterDate !== 'all')
            ? 'No downloads match filters.' : 'No downloads yet.';
        placeholderContainer.style.display = 'flex';
        paginationControlsEl.classList.add('hidden');
    } else {
        placeholderContainer.style.display = 'none';
        downloadsListEl.innerHTML = displayedDownloads.map(renderDownloadItem).join('');
        updatePaginationControls();
        paginationControlsEl.classList.remove('hidden');
    }

    updateStatusSummary();
    updateBatchActionBar();
    updateSelectAllCheckboxState();
}


function filterAndSortDownloads(downloads) {
    let filtered = downloads;

    // Status Filter
    switch (currentFilterStatus) {
        case 'active': filtered = filtered.filter(item => item.state === 'in_progress' || item.paused); break;
        case 'in_progress': filtered = filtered.filter(item => item.state === 'in_progress' && !item.paused); break;
        case 'paused': filtered = filtered.filter(item => item.paused); break;
        case 'interrupted': filtered = filtered.filter(item => item.state === 'interrupted'); break;
        case 'complete': filtered = filtered.filter(item => item.state === 'complete'); break;
    }

     // Date Filter
    if (currentFilterDate !== 'all') {
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        let dateCutoff;
        switch (currentFilterDate) {
            case 'today': dateCutoff = todayStart; break;
            case 'yesterday': dateCutoff = todayStart - (24 * 60 * 60 * 1000); break;
            case 'last7': dateCutoff = todayStart - (7 * 24 * 60 * 60 * 1000); break;
            case 'last30': dateCutoff = todayStart - (30 * 24 * 60 * 60 * 1000); break;
        }
        if (dateCutoff) {
             if (currentFilterDate === 'yesterday') {
                 const yesterdayEnd = todayStart;
                 filtered = filtered.filter(item => {
                     const itemTime = item.startTime ? new Date(item.startTime).getTime() : 0;
                     return itemTime >= dateCutoff && itemTime < yesterdayEnd;
                 });
             } else {
                 filtered = filtered.filter(item => item.startTime && new Date(item.startTime).getTime() >= dateCutoff);
             }
        }
    }


    // Search Filter
    const searchTerm = searchInput.value.toLowerCase().trim();
    if (searchTerm) {
        filtered = filtered.filter(item =>
            getFilename(item.filename).toLowerCase().includes(searchTerm) ||
            item.url?.toLowerCase().includes(searchTerm) ||
            item.finalUrl?.toLowerCase().includes(searchTerm)
        );
    }

    // Sort
    filtered.sort((a, b) => {
        const nameA = getFilename(a.filename);
        const nameB = getFilename(b.filename);
        const timeA = a.startTime ? new Date(a.startTime).getTime() : 0;
        const timeB = b.startTime ? new Date(b.startTime).getTime() : 0;
        const sizeA = a.totalBytes > 0 ? a.totalBytes : (a.bytesReceived > 0 ? -1 : -2);
        const sizeB = b.totalBytes > 0 ? b.totalBytes : (b.bytesReceived > 0 ? -1 : -2);

        switch (currentSort) {
            case 'startTimeDesc': return timeB - timeA;
            case 'startTimeAsc': return timeA - timeB;
            case 'filenameAsc': return nameA.localeCompare(nameB);
            case 'filenameDesc': return nameB.localeCompare(nameA);
            case 'totalBytesDesc': return sizeB - sizeA;
            case 'totalBytesAsc': return sizeA - sizeB;
            default: return 0;
        }
    });
    return filtered;
}

function updateStatusSummary() {
    const totalCount = allDownloads.length;
    const activeCount = allDownloads.filter(d => d.state === 'in_progress' && !d.paused).length;
    statusSummarySpan.textContent = `Total: ${totalCount} | Active: ${activeCount}`;
}

// --- Pagination ---
// ... (keep existing pagination functions: updatePaginationControls, changePage) ...
function updatePaginationControls() {
    pageInfoSpan.textContent = `Page ${currentPage} of ${totalPages}`;
    prevPageButton.disabled = currentPage <= 1;
    nextPageButton.disabled = currentPage >= totalPages;
}
function changePage(direction) {
    const newPage = currentPage + direction;
    if (newPage >= 1 && newPage <= totalPages) {
        currentPage = newPage;
        processAndDisplayDownloads();
    }
}

// --- Fetching Data ---
// ... (keep existing fetchDownloads) ...
async function fetchDownloads(showLoading = true) {
     if (showLoading) {
         placeholderText.textContent = 'Loading downloads...';
         placeholderContainer.style.display = 'flex';
         downloadsListEl.innerHTML = '';
         paginationControlsEl.classList.add('hidden');
     }
    try {
        const response = await chrome.runtime.sendMessage({ action: 'getDownloads' });
        if (response?.success && Array.isArray(response.downloads)) {
            allDownloads = response.downloads;
            processAndDisplayDownloads();
        } else { throw new Error(response?.error || 'Failed to fetch downloads.'); }
    } catch (error) {
        console.error("Error fetching downloads:", error);
        placeholderText.textContent = `Error: ${error.message}. Try refreshing.`;
        placeholderContainer.style.display = 'flex';
        downloadsListEl.innerHTML = '';
        paginationControlsEl.classList.add('hidden');
        allDownloads = []; processAndDisplayDownloads();
    }
}

// --- Actions ---
// ... (keep existing showItemMessage, clearItemMessage, sendAction, sendBatchAction, sendClearAllFinished, startUrlDownload) ...
// Ensure sendAction correctly handles the 'open' file error message.
function showItemMessage(downloadId, message, type = 'info', duration = 5000) {
    const itemDiv = downloadsListEl.querySelector(`.download-item[data-id="${downloadId}"]`);
    if (!itemDiv) return;
    const messageArea = itemDiv.querySelector('.item-message-area');
    if (!messageArea) return;
    messageArea.innerHTML = '';
    const messageEl = itemMessageTemplate.cloneNode(true);
    messageEl.removeAttribute('id'); messageEl.className = `item-message ${type}`;
    messageEl.textContent = message; messageEl.style.display = 'inline-block';
    messageEl.setAttribute('role', 'alert'); messageArea.appendChild(messageEl);
    if (duration > 0) { setTimeout(() => { messageEl.remove(); }, duration); }
}
function clearItemMessage(downloadId) {
     const itemDiv = downloadsListEl.querySelector(`.download-item[data-id="${downloadId}"]`);
     if (!itemDiv) return;
     const messageArea = itemDiv.querySelector('.item-message-area');
     if (messageArea) { messageArea.innerHTML = ''; }
}
function sendAction(action, downloadId) {
    console.log(`Popup Action: ${action} on ID: ${downloadId}`); closeMoreActionsMenu(); clearItemMessage(downloadId);
    chrome.runtime.sendMessage({ action: 'performDownloadAction', payload: { downloadId, action } }, (response) => {
        if (response?.success) {
            console.log(`Action ${action} successful for ID ${downloadId}`);
            if (action === 'clear') {/* Handled by background push */ }
            else if (action === 'copyLink' || action === 'copySourceLink') { showItemMessage(downloadId, 'Link copied!', 'info', 3000); }
        } else {
            const errorMsg = response?.error || 'Unknown error'; console.error(`Action ${action} failed for ID ${downloadId}:`, errorMsg);
            let displayMsg = `Action '${action}' failed: ${errorMsg}`;
            if (action === 'open' && errorMsg.includes("user action")) { displayMsg = "Cannot open file directly (browser security). Use 'Show in Folder'."; }
            else if (action === 'open' && errorMsg.includes("no longer exists")) { displayMsg = "Cannot open: File no longer exists."; }
            showItemMessage(downloadId, displayMsg, 'error', 8000);
        }
    });
}
function sendBatchAction(action) {
    const ids = Array.from(selectedIds); if (ids.length === 0) return;
    console.log(`Popup Batch Action: ${action} on IDs:`, ids); ids.forEach(id => clearItemMessage(id));
    chrome.runtime.sendMessage({ action: 'performBatchAction', payload: { action, downloadIds: ids } }, (response) => {
        if (response?.success && response.results) {
            console.log(`Batch ${action} finished. Success: ${response.results.success?.length}, Failed: ${response.results.failed?.length}`);
            if (action === 'clear') { /* Handled by background push */ selectedIds.clear(); updateBatchActionBar(); updateSelectAllCheckboxState(); }
            else {
                if (response.results.failed?.length > 0) { response.results.failed.forEach(fail => { showItemMessage(fail.id, `Batch '${action}' failed: ${fail.reason}`, 'error', 8000); }); }
                if (action === 'copyLink' && response.results.success?.length > 0) { showItemMessage(ids[0], `Copied ${response.results.success.length} links.`, 'info', 3000); }
            }
        } else { const errorMsg = response?.error || 'Unknown batch error'; console.error(`Batch action ${action} failed globally:`, errorMsg); alert(`Batch action '${action}' failed: ${errorMsg}`); }
        if (action !== 'clear') { selectedIds.clear(); updateBatchActionBar(); updateCheckboxes(); }
    });
}
function sendClearAllFinished() {
    if (confirm("Remove ALL completed and failed/cancelled downloads from the list?")) {
        console.log("Popup Action: Clear All Finished");
        chrome.runtime.sendMessage({ action: 'performBulkAction', payload: { action: 'clearAllFinished' } }, (response) => {
            if (!response?.success) { console.error("Clear All Finished failed:", response?.error); alert(`Clear All Finished failed: ${response?.error || 'Unknown error'}`); }
        });
    }
}
function startUrlDownload() {
    const url = urlInput.value.trim(); if (!url) { urlInput.focus(); return; }
    try { new URL(url); } catch (_) { alert("Invalid URL entered."); urlInput.focus(); return; }
    console.log("Popup Action: Download URL:", url);
    chrome.runtime.sendMessage({ action: 'downloadUrl', payload: { url } }, (response) => {
        if (response?.success) { console.log("URL download initiated."); urlInput.value = ''; addUrlSection.classList.add('hidden'); setTimeout(() => fetchDownloads(false), 500); }
        else { console.error("URL download failed:", response?.error); alert(`Could not start download: ${response?.error || 'Unknown error'}`); }
    });
}

// --- Batch Selection Logic ---
// ... (keep existing batch selection functions: updateBatchActionBar, updateCheckboxes, updateSelectAllCheckboxState, handleSelectAll, handleItemCheckboxChange) ...
function updateBatchActionBar() {
    const count = selectedIds.size;
    if (count > 0) {
        selectedCountSpan.textContent = `${count} selected`; batchActionBar.classList.remove('hidden');
        const buttons = batchActionBar.querySelectorAll('.batch-buttons button'); buttons.forEach(btn => btn.disabled = false); // Basic enable all
    } else { batchActionBar.classList.add('hidden'); }
}
function updateCheckboxes() {
    downloadsListEl.querySelectorAll('.item-checkbox').forEach(cb => { const id = parseInt(cb.closest('.download-item').dataset.id, 10); cb.checked = selectedIds.has(id); }); updateSelectAllCheckboxState();
}
function updateSelectAllCheckboxState() {
     const visibleCheckboxes = downloadsListEl.querySelectorAll('.item-checkbox'); if (visibleCheckboxes.length === 0) { selectAllCheckbox.checked = false; selectAllCheckbox.indeterminate = false; selectAllCheckbox.disabled = true; return; }
     selectAllCheckbox.disabled = false; const numVisible = displayedDownloads.length; let numVisibleSelected = 0; displayedDownloads.forEach(item => { if(selectedIds.has(item.id)) numVisibleSelected++; });
     if (numVisibleSelected === 0) { selectAllCheckbox.checked = false; selectAllCheckbox.indeterminate = false; }
     else if (numVisibleSelected === numVisible) { selectAllCheckbox.checked = true; selectAllCheckbox.indeterminate = false; }
     else { selectAllCheckbox.checked = false; selectAllCheckbox.indeterminate = true; }
}
function handleSelectAll(event) {
    const isChecked = event.target.checked; displayedDownloads.forEach(item => { if (isChecked) selectedIds.add(item.id); else selectedIds.delete(item.id); }); updateCheckboxes(); updateBatchActionBar();
}
function handleItemCheckboxChange(event) {
     const checkbox = event.target; const downloadId = parseInt(checkbox.closest('.download-item').dataset.id, 10); if (checkbox.checked) selectedIds.add(downloadId); else selectedIds.delete(downloadId); updateBatchActionBar(); updateSelectAllCheckboxState();
}


// --- More Actions Menu ---
// ... (keep existing menu functions: showMoreActionsMenu, closeMoreActionsMenu, handleClickOutsideMenu) ...
// Ensure showMoreActionsMenu disables buttons correctly based on item state.
function showMoreActionsMenu(triggerButton, downloadId) {
    closeMoreActionsMenu();
    const item = allDownloads.find(d => d.id === downloadId); if (!item) return;
    const menu = moreActionsMenuTemplate.cloneNode(true); menu.removeAttribute('id'); menu.style.display = 'flex';

    const canPause = item.state === 'in_progress' && !item.paused;
    const canResume = item.paused;
    const canCancel = item.state === 'in_progress' || item.paused;
    const canOpen = item.state === 'complete'; // Let background check existence
    const canShow = true;
    const canRetry = item.state === 'interrupted';
    const canSaveAs = item.state === 'complete' || item.state === 'interrupted';
    const canCopyLink = !!(item.finalUrl || item.url);
    const canCopySource = !!item.url;
    const canShowError = item.state === 'interrupted' && item.error;
    const canClear = true;

    menu.querySelector('[data-action="pause"]').style.display = canPause ? 'flex' : 'none';
    menu.querySelector('[data-action="resume"]').style.display = canResume ? 'flex' : 'none';
    menu.querySelector('[data-action="cancel"]').style.display = canCancel ? 'flex' : 'none';
    menu.querySelector('[data-action="open"]').style.display = (item.state === 'complete') ? 'flex' : 'none';
    menu.querySelector('[data-action="show"]').style.display = 'flex';
    menu.querySelector('[data-action="retry"]').style.display = canRetry ? 'flex' : 'none';
    menu.querySelector('[data-action="saveAs"]').style.display = canSaveAs ? 'flex' : 'none';
    menu.querySelector('[data-action="copyLink"]').disabled = !canCopyLink;
    menu.querySelector('[data-action="copySourceLink"]').style.display = canCopySource ? 'flex' : 'none';
    menu.querySelector('[data-action="showError"]').style.display = canShowError ? 'flex' : 'none';
    menu.querySelector('[data-action="clear"]').style.display = 'flex';

    menu.querySelectorAll('button[data-action]').forEach(button => {
        if (button.style.display !== 'none') {
             button.addEventListener('click', (e) => {
                e.stopPropagation(); const action = button.getAttribute('data-action');
                if (action === 'showError') { showItemMessage(downloadId, `Error details: ${item.error}`, 'info', 0); closeMoreActionsMenu(); }
                else { sendAction(action, downloadId); }
            });
        }
    });
    const itemDiv = triggerButton.closest('.download-item'); itemDiv.appendChild(menu); activeMoreActionsMenu = menu;
    setTimeout(() => { document.addEventListener('click', handleClickOutsideMenu, { capture: true, once: true }); }, 0);
}
function closeMoreActionsMenu() { if (activeMoreActionsMenu) { activeMoreActionsMenu.remove(); activeMoreActionsMenu = null; document.removeEventListener('click', handleClickOutsideMenu, { capture: true }); } }
function handleClickOutsideMenu(event) { if (activeMoreActionsMenu && !activeMoreActionsMenu.contains(event.target) && !event.target.closest('.more-actions-trigger')) { closeMoreActionsMenu(); } else if (activeMoreActionsMenu) { document.addEventListener('click', handleClickOutsideMenu, { capture: true, once: true }); } }


// --- Event Handlers ---
// ... (keep existing handleListClick, handleListDoubleClick) ...
function handleListClick(event) {
    const target = event.target; const itemDiv = target.closest('.download-item'); if (!itemDiv) { closeMoreActionsMenu(); return; }
    const downloadId = parseInt(itemDiv.dataset.id, 10);
    if (target.classList.contains('item-checkbox') || target.closest('.item-selection')) { return; } // Handled by change event
    const actionButton = target.closest('button[data-action]');
    if (actionButton) {
        event.stopPropagation(); const action = actionButton.dataset.action;
        if (action === 'more') { if (activeMoreActionsMenu && activeMoreActionsMenu.parentElement === itemDiv) { closeMoreActionsMenu(); } else { showMoreActionsMenu(actionButton, downloadId); } }
        else if (action === 'open' && target.closest('a.filename')) { return; } // Handled by dblclick
        else { sendAction(action, downloadId); }
        return;
    }
    closeMoreActionsMenu();
}
function handleListDoubleClick(event) {
     const filenameLink = event.target.closest('a.filename');
     if (filenameLink) { const itemDiv = filenameLink.closest('.download-item'); const downloadId = parseInt(itemDiv.dataset.id, 10); sendAction('open', downloadId); }
}

// --- Update Handling Functions ---
// ... (keep existing handleDownloadUpdate, handleDownloadCreated, handleDownloadErased from previous popup.js) ...
 function handleDownloadUpdate(payload) {
    const { id, delta } = payload; if (!id || !delta) { fetchDownloads(false); return; }
    const itemIndex = allDownloads.findIndex(d => d.id === id); let itemChanged = false;
    if (itemIndex !== -1) {
        for (const key in delta) { if (delta[key]?.current !== undefined && allDownloads[itemIndex][key] !== delta[key].current) { allDownloads[itemIndex][key] = delta[key].current; itemChanged = true; } }
        if (itemChanged) {
             const isVisible = displayedDownloads.some(d => d.id === id);
             if (isVisible) { updateDownloadItem(allDownloads[itemIndex]); }
             else { const sortKey = currentSort.replace(/Asc|Desc/, ''); if (sortKey in delta || delta.filename || delta.startTime || delta.totalBytes || delta.state) { processAndDisplayDownloads(); } }
             updateStatusSummary();
        }
    } else { fetchDownloads(false); }
}
function handleDownloadCreated(payload) {
    const newItem = payload.item; if (!newItem || allDownloads.some(d => d.id === newItem.id)) return;
    allDownloads.unshift(newItem); processAndDisplayDownloads();
}
function handleDownloadErased(payload) {
    const { id } = payload; const initialLength = allDownloads.length; allDownloads = allDownloads.filter(d => d.id !== id);
    if (allDownloads.length < initialLength) { selectedIds.delete(id); processAndDisplayDownloads(); }
}

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    loadThemePreference();
    // Load settings
     chrome.storage.sync.get({
         defaultSort: 'startTimeDesc',
         itemsPerPage: 10 // Popup items per page setting key
        }, (settings) => {
         currentSort = settings.defaultSort;
         itemsPerPage = parseInt(settings.itemsPerPage, 10) || 10;
         sortBySelect.value = currentSort;
         itemsPerPageSelect.value = itemsPerPage;
         fetchDownloads(); // Initial fetch
     });

    // Global listeners
    refreshButton.addEventListener('click', () => fetchDownloads());
    themeToggleButton.addEventListener('click', toggleTheme);
    optionsButton.addEventListener('click', () => chrome.runtime.openOptionsPage());
    addUrlButton.addEventListener('click', () => addUrlSection.classList.toggle('hidden'));
    cancelAddUrlButton.addEventListener('click', () => { addUrlSection.classList.add('hidden'); urlInput.value=''; });
    startDownloadButton.addEventListener('click', startUrlDownload);
    urlInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') startUrlDownload(); });
    clearAllFinishedButton.addEventListener('click', sendClearAllFinished);

    // Search, Filter, Sort, Pagination listeners
    searchInput.addEventListener('input', () => { debounce(() => { currentPage = 1; processAndDisplayDownloads(); }, 300); });
    filterStatusSelect.addEventListener('change', (e) => { currentFilterStatus = e.target.value; currentPage = 1; processAndDisplayDownloads(); });
    filterDateSelect.addEventListener('change', (e) => { currentFilterDate = e.target.value; currentPage = 1; processAndDisplayDownloads(); }); // Added date filter listener
    sortBySelect.addEventListener('change', (e) => { currentSort = e.target.value; processAndDisplayDownloads(); });
    itemsPerPageSelect.addEventListener('change', (e) => { itemsPerPage = parseInt(e.target.value, 10) || 10; currentPage = 1; chrome.storage.sync.set({ itemsPerPage: itemsPerPage }); processAndDisplayDownloads(); });

    // Pagination Button listeners
    prevPageButton.addEventListener('click', () => changePage(-1));
    nextPageButton.addEventListener('click', () => changePage(1));

    // Batch Action listeners
    selectAllCheckbox.addEventListener('change', handleSelectAll);
    batchActionBar.addEventListener('click', (e) => { const button = e.target.closest('button[data-batch-action]'); if (button) { sendBatchAction(button.dataset.batchAction); } });
    downloadsListEl.addEventListener('change', (event) => { if (event.target.classList.contains('item-checkbox')) { handleItemCheckboxChange(event); } });

    // Downloads List listeners
    downloadsListEl.addEventListener('click', handleListClick);
    downloadsListEl.addEventListener('dblclick', handleListDoubleClick);

    // Listen for updates pushed from the background script
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        switch (message.action) {
            case 'downloadUpdate': handleDownloadUpdate(message.payload); break;
            case 'downloadCreated': handleDownloadCreated(message.payload); break;
            case 'downloadErased': handleDownloadErased(message.payload); break;
        }
        return true;
    });
});