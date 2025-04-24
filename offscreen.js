// Offscreen document script for clipboard operations

chrome.runtime.onMessage.addListener(handleMessages);

function handleMessages(message, sender, sendResponse) {
    // Check if the message is intended for this offscreen document
    if (message.target !== 'offscreen') {
        return; // Ignore messages not targeted here
    }

    switch (message.action) {
        case 'copyToClipboard':
            copyToClipboard(message.payload, sendResponse);
            // Return true to indicate willingness to send an async response
            return true;
        default:
            console.warn(`Offscreen document received unknown action: ${message.action}`);
            sendResponse({ success: false, error: 'Unknown action' });
    }
     // Return false if not handling asynchronously
     return false;
}

function copyToClipboard(text, sendResponse) {
    const textarea = document.getElementById('clipboardTextarea');
    if (!textarea) {
        console.error("Clipboard textarea not found in offscreen document.");
        sendResponse({ success: false, error: 'Offscreen document setup error' });
        return;
    }

    textarea.value = text;
    textarea.select();
    try {
        document.execCommand('copy'); // Attempt to copy
        textarea.value = ''; // Clear textarea after copy
        console.log("Offscreen copy successful.");
        sendResponse({ success: true });
    } catch (err) {
        console.error('Offscreen copy failed:', err);
        sendResponse({ success: false, error: err.message || 'Copy command failed' });
    }
}

console.log("Offscreen script loaded."); // For debugging
// Optional: Send a message back to background to confirm loading
// chrome.runtime.sendMessage({ target: 'background', action: 'offscreenReady' });