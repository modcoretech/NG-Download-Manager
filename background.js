// --- Globals & Settings ---
const OFFSCREEN_DOCUMENT_PATH = '/offscreen.html';
let creatingOffscreenDocument = null;
let lastBadgeUpdateTime = 0;
const BADGE_UPDATE_THROTTLE_MS = 1000;
const UI_UPDATE_THROTTLE_MS = 500;
let lastUiUpdateTimes = {}; // { id: timestamp }

// --- Utility ---
async function updateBadge() { /* ... (keep existing) ... */
     const now = Date.now(); if (now - lastBadgeUpdateTime < BADGE_UPDATE_THROTTLE_MS) return; lastBadgeUpdateTime = now; try { const items = await chrome.downloads.search({ state: "in_progress" }); const count = items.filter(item => !item.paused).length; await chrome.action.setBadgeText({ text: count > 0 ? String(count) : "" }); await chrome.action.setBadgeBackgroundColor({ color: count > 0 ? '#1a73e8' : '#ffffff' }); } catch (error) { console.error("Error updating badge:", error); try { await chrome.action.setBadgeText({ text: "!" }); await chrome.action.setBadgeBackgroundColor({ color: '#d93025' }); } catch (e) {} }
}
function getFilename(path) { /* ... (keep existing) ... */
     return path ? path.substring(path.lastIndexOf('\\') + 1).substring(path.lastIndexOf('/') + 1) || 'download' : 'unknown_filename';
}

// Simplified: Send message, popup listener will handle it
async function pushUpdateToPopup(updateType, payload) {
    try {
        await chrome.runtime.sendMessage({ action: updateType, payload: payload });
    } catch (e) {
        // console.debug("Popup not open or error sending message:", e.message);
    }
}

// --- Offscreen Document Management (Clipboard) ---
// ... (keep existing offscreen functions: hasOffscreenDocument, closeOffscreenDocument, copyToClipboardViaOffscreen) ...
async function hasOffscreenDocument() { if (chrome.runtime.getContexts) { const contexts = await chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'], documentUrls: [chrome.runtime.getURL(OFFSCREEN_DOCUMENT_PATH)] }); return !!contexts && contexts.length > 0; } console.warn("chrome.runtime.getContexts not available, offscreen check might be unreliable."); return false; }
async function closeOffscreenDocument() { if (!await hasOffscreenDocument()) return; console.log("Closing offscreen document."); await chrome.offscreen.closeDocument().catch(e => console.debug("Error closing offscreen doc:", e)); }
async function copyToClipboardViaOffscreen(text) { if (creatingOffscreenDocument) { await creatingOffscreenDocument; } else if (!await hasOffscreenDocument()) { console.log("Creating offscreen document for clipboard."); creatingOffscreenDocument = chrome.offscreen.createDocument({ url: OFFSCREEN_DOCUMENT_PATH, reasons: [chrome.offscreen.Reason.CLIPBOARD], justification: 'Required to copy download link to clipboard', }); try { await creatingOffscreenDocument; } catch (e) { console.error("Offscreen document creation failed:", e); creatingOffscreenDocument = null; throw new Error("Could not create helper for copying."); } finally { creatingOffscreenDocument = null; } } else { console.log("Offscreen document already exists."); } console.log("Sending copy command to offscreen document."); try { const response = await chrome.runtime.sendMessage({ target: 'offscreen', action: 'copyToClipboard', payload: text }); if (!response?.success) { throw new Error(response?.error || "Offscreen copy action failed."); } console.log("Text copied successfully via offscreen."); setTimeout(closeOffscreenDocument, 5000); } catch (error) { console.error("Error communicating with or executing copy in offscreen document:", error); closeOffscreenDocument().catch(e => {}); throw error; } }


// --- Download Event Listeners ---
chrome.downloads.onCreated.addListener(async (downloadItem) => {
    console.log("Download created:", downloadItem.id); await updateBadge(); await pushUpdateToPopup('downloadCreated', { item: downloadItem });
});
chrome.downloads.onChanged.addListener(async (downloadDelta) => {
    // ... (keep existing onChanged logic for notifications, badge updates, and throttled UI pushes) ...
    const { id } = downloadDelta; console.log("Download changed:", id, downloadDelta); let needsUiUpdate = false; let isCriticalChange = false; if (downloadDelta.state) { isCriticalChange = true; await updateBadge(); const state = downloadDelta.state.current; if (state === 'complete' || state === 'interrupted') { delete lastUiUpdateTimes[id]; try { const items = await chrome.downloads.search({ id: id }); if (items && items.length > 0) { const item = items[0]; const filename = getFilename(item.filename); const settings = await chrome.storage.sync.get({ notifyOnComplete: true, notifyOnFail: true, autoOpenTypes: '' }); if (state === 'complete') { if (settings.autoOpenTypes && item.filename) { const typesToOpen = settings.autoOpenTypes.toLowerCase().split(',').map(t => t.trim()).filter(Boolean); const fileExtension = filename.split('.').pop()?.toLowerCase(); if (fileExtension && typesToOpen.includes(fileExtension)) { console.log(`Attempting auto-open: ${filename}`); try { const latestItem = await chrome.downloads.search({ id: id }); if (latestItem.length > 0 && latestItem[0].exists) { chrome.downloads.open(id).catch(e => console.warn(`Auto-open failed for ${id}: ${e.message}`)); } else { console.warn(`Cannot auto-open ${filename}: File does not exist.`); } } catch (e) { console.error(`Error during auto-open check for ${id}:`, e); } } } if (settings.notifyOnComplete) { chrome.notifications.create(String(id) + '_complete', { type: 'basic', iconUrl: 'icons/icon128.png', title: "Download Complete", message: filename || 'File download finished.', buttons: [{ title: 'Show in folder' }], priority: 0 }); } } else { if (settings.notifyOnFail) { chrome.notifications.create(String(id) + '_fail', { type: 'basic', iconUrl: 'icons/icon128.png', title: "Download Failed", message: `Failed: ${filename || 'File download'} (${item.error || 'Unknown'})`, priority: 1 }); } } } } catch (e) { console.error("Error during completion/failure handling:", e); } } } const relevantChanges = ['state', 'paused', 'error', 'bytesReceived', 'totalBytes', 'filename', 'url', 'finalUrl', 'mime', 'startTime', 'endTime', 'estimatedEndTime', 'exists']; needsUiUpdate = relevantChanges.some(prop => prop in downloadDelta); if (needsUiUpdate) { const now = Date.now(); const lastUpdate = lastUiUpdateTimes[id] || 0; if (isCriticalChange || (now - lastUpdate >= UI_UPDATE_THROTTLE_MS)) { console.debug(`Pushing update for ${id}. Critical: ${isCriticalChange}`); await pushUpdateToPopup('downloadUpdate', { id: id, delta: downloadDelta }); lastUiUpdateTimes[id] = now; } else { /* Throttled */ } }
});
chrome.downloads.onErased.addListener(async (downloadId) => {
    console.log("Download erased:", downloadId); delete lastUiUpdateTimes[downloadId]; await updateBadge(); await pushUpdateToPopup('downloadErased', { id: downloadId });
});

// --- Notification Click Handlers ---
// ... (keep existing notification handlers) ...
chrome.notifications.onClicked.addListener((notificationId) => { const idPart = notificationId.replace('_complete', '').replace('_fail', ''); const downloadId = parseInt(idPart, 10); if (!isNaN(downloadId)) { chrome.downloads.search({ id: downloadId }).then(items => { if (items.length > 0 && items[0].exists) { chrome.downloads.show(downloadId); } else { console.log(`Notification click: Download ${downloadId} missing.`); } }).catch(e => console.warn("Error searching on notification click:", e)); } chrome.notifications.clear(notificationId).catch(e => {}); });
chrome.notifications.onButtonClicked.addListener((notificationId, buttonIndex) => { const idPart = notificationId.replace('_complete', '').replace('_fail', ''); const downloadId = parseInt(idPart, 10); if (!isNaN(downloadId) && buttonIndex === 0) { chrome.downloads.search({ id: downloadId }).then(items => { if (items.length > 0 && items[0].exists) { chrome.downloads.show(downloadId); } else { console.log(`Notification button click: Download ${downloadId} missing.`); } }).catch(e => console.warn("Error searching on notification button click:", e)); } chrome.notifications.clear(notificationId).catch(e => {}); });

// --- Message Listener ---
// ... (keep existing message listener structure) ...
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    let keepChannelOpen = false;
    if (sender.id === chrome.runtime.id && !sender.url?.endsWith(OFFSCREEN_DOCUMENT_PATH)) {
        console.log("BG Received message:", message.action); // Log less payload
        switch (message.action) {
            case 'getDownloads': keepChannelOpen = true; chrome.downloads.search({}).then(items => sendResponse({ success: true, downloads: items })).catch(error => sendResponse({ success: false, error: error.message })); break;
            case 'performDownloadAction': keepChannelOpen = true; const { downloadId, action } = message.payload; performAction(downloadId, action).then(() => sendResponse({ success: true })).catch(error => sendResponse({ success: false, error: error.message || String(error) })); break;
            case 'performBatchAction': keepChannelOpen = true; const { downloadIds, action: batchAction } = message.payload; performBatchAction(downloadIds, batchAction).then((results) => sendResponse({ success: true, results })).catch(error => sendResponse({ success: false, error: error.message || String(error) })); break;
            case 'performBulkAction': keepChannelOpen = true; const { action: bulkAction } = message.payload; performBulkAction(bulkAction).then(() => sendResponse({ success: true })).catch(error => sendResponse({ success: false, error: error.message || String(error) })); break;
            case 'downloadUrl': keepChannelOpen = true; chrome.downloads.download({ url: message.payload.url }).then(newDownloadId => sendResponse({ success: true, downloadId: newDownloadId })).catch(error => sendResponse({ success: false, error: error.message })); break;
        }
    }
    else if (message.target === 'background') { console.log("BG Received message targeted to background:", message); }
    return keepChannelOpen;
});

// --- Action Implementations ---
async function performAction(downloadId, action) {
    // ... (keep existing performAction, ensure 'open' error handling is correct) ...
    console.log(`BG action: ${action} on ID: ${downloadId}`); try { let items; switch (action) { case 'pause': await chrome.downloads.pause(downloadId); break; case 'resume': await chrome.downloads.resume(downloadId); break; case 'cancel': await chrome.downloads.cancel(downloadId); break; case 'open': items = await chrome.downloads.search({ id: downloadId }); if (items.length === 0) throw new Error("Download not found."); if (items[0].state !== 'complete') throw new Error("File not downloaded yet."); if (!items[0].exists) throw new Error("File no longer exists."); if (items[0].error) throw new Error(`Cannot open errored download (${items[0].error}).`); try { await chrome.downloads.open(downloadId); } catch (e) { if (e.message.toLowerCase().includes("user gesture")) { console.warn(`Action 'open' failed for ${downloadId}: User gesture required.`); throw new Error("Opening file requires a direct user action (security restriction). Try 'Show in Folder'."); } throw e; } break; case 'show': await chrome.downloads.show(downloadId); break; case 'retry': items = await chrome.downloads.search({ id: downloadId }); if (items.length > 0 && items[0].state === 'interrupted') { const originalUrl = items[0].url || items[0].finalUrl; if (!originalUrl) throw new Error("Cannot retry: Original URL not found."); await chrome.downloads.erase({ id: downloadId }); await chrome.downloads.download({ url: originalUrl }); } else { throw new Error("Cannot retry: Download not failed or not found."); } break; case 'clear': await chrome.downloads.erase({ id: downloadId }); break; case 'copyLink': items = await chrome.downloads.search({id: downloadId}); if (items.length > 0 && (items[0].url || items[0].finalUrl)) { await copyToClipboardViaOffscreen(items[0].finalUrl || items[0].url); } else { throw new Error("Download item or URL not found."); } break; case 'saveAs': items = await chrome.downloads.search({id: downloadId}); if (items.length > 0 && (items[0].url || items[0].finalUrl)) { await chrome.downloads.download({ url: items[0].finalUrl || items[0].url, saveAs: true }); } else { throw new Error("Download item or URL not found for Save As."); } break; default: throw new Error(`Unknown action: ${action}`); } console.log(`Action ${action} completed for ID: ${downloadId}`); } catch (error) { console.error(`Error performing action ${action} for ID ${downloadId}:`, error); if (error.message?.includes("Download not found") || error.message?.includes("Invalid download id")) { throw new Error("Download item not found (may have been cleared)."); } throw error; }
}

async function performBatchAction(downloadIds, action) {
    // ... (keep existing performBatchAction) ...
    console.log(`BG batch action: ${action} on IDs: ${downloadIds.join(', ')}`); const results = { success: [], failed: [] }; const settledResults = await Promise.allSettled( downloadIds.map(id => performAction(id, action)) ); settledResults.forEach((result, index) => { const id = downloadIds[index]; if (result.status === 'fulfilled') { results.success.push(id); } else { const reason = result.reason?.message || String(result.reason); results.failed.push({ id, reason: reason }); console.error(`Batch action ${action} failed for ID ${id}:`, reason); } }); console.log(`Batch action ${action} finished. Success: ${results.success.length}, Failed: ${results.failed.length}`); return results;
}

// FIXED: Erase by ID instead of query
async function performBulkAction(action) {
    if (action === 'clearAllFinished') {
        console.log("BG performing bulk action: clearAllFinished");
        try {
            const completedItems = await chrome.downloads.search({ state: 'complete', limit: 0 });
            const interruptedItems = await chrome.downloads.search({ state: 'interrupted', limit: 0 });
            const idsToErase = [...completedItems, ...interruptedItems].map(item => item.id);

            if (idsToErase.length === 0) { console.log("No finished downloads to clear."); return; }
            console.log(`Found ${idsToErase.length} items to erase.`);

            const batchSize = 50; let erasedCount = 0;
            for (let i = 0; i < idsToErase.length; i += batchSize) {
                const batchIds = idsToErase.slice(i, i + batchSize);
                const erasePromises = batchIds.map(id => chrome.downloads.erase({ id }));
                const results = await Promise.allSettled(erasePromises);
                results.forEach((result, index) => {
                     if (result.status === 'rejected') { console.warn(`Failed to erase download ID ${batchIds[index]}:`, result.reason); }
                     else { erasedCount++; }
                 });
                 console.log(`Processed erase batch ${Math.floor(i / batchSize) + 1}, ${erasedCount} erased so far.`);
                 // Optional delay: await new Promise(resolve => setTimeout(resolve, 50));
            }
            console.log(`Bulk action ${action} completed. Erased ${erasedCount} items.`);
            await pushUpdateToPopup('downloadUpdate', {}); // Hint for full refresh

        } catch (error) { console.error(`Error performing bulk action ${action}:`, error); throw error; }
    } else { console.warn(`Unsupported bulk action: ${action}`); throw new Error(`Unsupported bulk action: ${action}`); }
}

// --- Context Menu ---
// ... (keep existing context menu setup) ...
chrome.runtime.onInstalled.addListener(() => { chrome.contextMenus.create({ id: "proDownloadManagerLink", title: "Download Link with Pro Manager", contexts: ["link"] }); chrome.contextMenus.create({ id: "proDownloadManagerMedia", title: "Download Media with Pro Manager", contexts: ["image", "video", "audio"] }); updateBadge(); console.log("Context menus created/updated."); });
chrome.contextMenus.onClicked.addListener((info, tab) => { let urlToDownload = null; if (info.menuItemId === "proDownloadManagerLink" && info.linkUrl) { urlToDownload = info.linkUrl; } else if (info.menuItemId === "proDownloadManagerMedia" && info.srcUrl) { urlToDownload = info.srcUrl; } if (urlToDownload) { console.log("Downloading from context menu:", urlToDownload); chrome.downloads.download({ url: urlToDownload }); } });


// --- Initialization ---
updateBadge();
console.log("Pro Download Manager Background Service Worker Started (v1.4.0).");
closeOffscreenDocument().catch(e => {}); // Clean up on start