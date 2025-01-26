async function fetchOpenAIResponse(apiKey, transcript, question) {
  try {
    const MAX_TOKENS = 3000;
    const truncatedTranscript = transcript.length > MAX_TOKENS
      ? transcript.substring(0, MAX_TOKENS) + '...'
      : transcript;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo",
        messages: [{
          role: "system",
          content: "Answer questions based on the following video transcript:"
        }, {
          role: "user",
          content: `${question}\n\nTranscript: ${truncatedTranscript}`
        }],
        max_tokens: 500,
        temperature: 0.7
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || 'API request failed');
    }

    const data = await response.json();
    return data.choices[0].message.content.trim();
  } catch (error) {
    throw new Error(`AI Response Failed: ${error.message}`);
  }
}

document.getElementById('askBtn').addEventListener('click', async () => {
  const questionInput = document.getElementById('question');
  const responseDiv = document.getElementById('response');
  const question = questionInput.value.trim();

  if (!question) {
    responseDiv.innerHTML = '<div class="error">Please enter a question</div>';
    return;
  }

  responseDiv.innerHTML = '<div class="loader"></div>';
  questionInput.disabled = true;

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const transcriptData = await Promise.race([
      new Promise(resolve => 
        chrome.tabs.sendMessage(tab.id, { action: "get_transcript" }, resolve)
      ),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Transcript timeout after 5 seconds')), 5000)
      )
    ]);

    if (!transcriptData?.transcript) {
      throw new Error(transcriptData?.error || 'No transcript available');
    }

    const { apiKey } = await chrome.storage.local.get(['apiKey']);
    if (!apiKey) throw new Error('Missing OpenAI API Key');

    const answer = await Promise.race([
      fetchOpenAIResponse(apiKey, transcriptData.transcript, question),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('API timeout after 15 seconds')), 15000)
      )
    ]);

    responseDiv.innerHTML = `<div class="success">${answer}</div>`;
  } catch (error) {
    let errorMessage = error.message;
    if (errorMessage.includes('quota')) {
      errorMessage += '<br>Please check your OpenAI account billing details.';
    }

    responseDiv.innerHTML = `
      <div class="error">
        ${errorMessage}
        ${error.message.includes('API Key') ? 
          '<button id="settingsBtn" style="margin-top: 10px;">Open Settings</button>' : ''}
      </div>
    `;

    if (error.message.includes('API Key')) {
      document.getElementById('settingsBtn').addEventListener('click', () => {
        chrome.runtime.openOptionsPage();
      });
    }
  } finally {
    questionInput.disabled = false;
  }
});