chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "save_api_key") {
    chrome.storage.local.set({ apiKey: request.key });
  }
});