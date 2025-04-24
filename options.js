const themeSelect = document.getElementById('themeSelect');
const notifyOnCompleteCheckbox = document.getElementById('notifyOnComplete');
const notifyOnFailCheckbox = document.getElementById('notifyOnFail');
const defaultSortSelect = document.getElementById('defaultSort');
const itemsPerPageSelect = document.getElementById('itemsPerPage'); // Added
const autoOpenTypesInput = document.getElementById('autoOpenTypes');
const saveButton = document.getElementById('saveButton');
const statusMessage = document.getElementById('statusMessage');

// --- Load Settings ---
function loadSettings() {
    chrome.storage.sync.get(
        {
            // Default values
            theme: 'system',
            notifyOnComplete: true,
            notifyOnFail: true,
            defaultSort: 'startTimeDesc',
            itemsPerPage: 10, // Added default
            autoOpenTypes: ''
        },
        (items) => {
            themeSelect.value = items.theme;
            notifyOnCompleteCheckbox.checked = items.notifyOnComplete;
            notifyOnFailCheckbox.checked = items.notifyOnFail;
            defaultSortSelect.value = items.defaultSort;
            itemsPerPageSelect.value = items.itemsPerPage; // Load setting
            autoOpenTypesInput.value = items.autoOpenTypes;

            applyOptionsPageTheme(items.theme);
        }
    );
}

// --- Save Settings ---
function saveSettings() {
    // Sanitize auto-open types
    const cleanAutoOpenTypes = autoOpenTypesInput.value
        .toLowerCase()
        .split(',')
        .map(ext => ext.trim().replace(/^\./, ''))
        .filter(Boolean)
        .join(',');

    const settings = {
        theme: themeSelect.value,
        notifyOnComplete: notifyOnCompleteCheckbox.checked,
        notifyOnFail: notifyOnFailCheckbox.checked,
        defaultSort: defaultSortSelect.value,
        itemsPerPage: parseInt(itemsPerPageSelect.value, 10) || 10, // Save setting
        autoOpenTypes: cleanAutoOpenTypes
    };

    // Update input visually
    autoOpenTypesInput.value = cleanAutoOpenTypes;

    chrome.storage.sync.set(settings, () => {
        statusMessage.textContent = 'Settings saved!';
        statusMessage.classList.add('success', 'visible');
        setTimeout(() => {
            statusMessage.classList.remove('visible');
            setTimeout(() => { statusMessage.textContent = ''; statusMessage.classList.remove('success'); }, 500);
        }, 3000);
        applyOptionsPageTheme(settings.theme); // Apply theme immediately
        console.log('Settings saved:', settings);
    });
}

// --- Apply Theme to Options Page ---
function applyOptionsPageTheme(themeSetting) {
    let themeToApply = themeSetting;
     if (themeToApply === 'system') {
         themeToApply = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
     }
     // You might need specific CSS rules in options.css linked to this attribute
     document.documentElement.setAttribute('data-theme', themeToApply);
}

// --- Event Listeners ---
document.addEventListener('DOMContentLoaded', loadSettings);
saveButton.addEventListener('click', saveSettings);

// Update theme if system preference changes and theme is set to 'system'
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', event => {
    chrome.storage.sync.get({ theme: 'system' }, items => {
        if (items.theme === 'system') {
            applyOptionsPageTheme('system');
        }
    });
});