let transcript = "";

async function extractTranscript() {
  try {
    const moreButton = document.querySelector('button[aria-label="More actions"]');
    if (moreButton) {
      moreButton.click();
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    const transcriptButton = await waitForElement('[aria-label="Show transcript"], [aria-label="Open transcript"]');
    if (transcriptButton) {
      transcriptButton.click();
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    const selectors = [
      'ytd-transcript-segment-renderer .segment-text',
      '.segment-text',
      '.ytp-caption-segment'
    ];

    for (const selector of selectors) {
      const elements = document.querySelectorAll(selector);
      if (elements.length > 0) {
        transcript = Array.from(elements).map(el => el.textContent).join(' ');
        return true;
      }
    }
    return false;
  } catch (error) {
    console.error('Transcript extraction error:', error);
    return false;
  }
}

function waitForElement(selector, timeout = 3000) {
  return new Promise((resolve) => {
    const start = Date.now();
    const check = () => {
      const element = document.querySelector(selector);
      if (element) resolve(element);
      else if (Date.now() - start > timeout) resolve(null);
      else requestAnimationFrame(check);
    };
    check();
  });
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "get_transcript") {
    extractTranscript().then(success => {
      sendResponse({ 
        transcript: success ? transcript : null,
        error: success ? null : "No transcript available"
      });
    });
    return true;
  }
});