document.addEventListener('DOMContentLoaded', () => {
  const apiKeyInput = document.getElementById('apiKey');
  const saveButton = document.getElementById('saveKey');

  // Load existing key
  chrome.storage.local.get(['apiKey'], ({ apiKey }) => {
    if (apiKey) apiKeyInput.value = apiKey;
  });

  // Save new key
  saveButton.addEventListener('click', () => {
    const apiKey = apiKeyInput.value.trim();
    if (!apiKey) {
      alert('Please enter an API key');
      return;
    }

    chrome.storage.local.set({ apiKey }, () => {
      alert('API key saved successfully!');
      window.close();
    });
  });
});