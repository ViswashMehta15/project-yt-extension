// ==============================================
// RAG Utilities
// ==============================================

// Approximate token counter (1 token ≈ 4 characters)
const countTokens = (text) => Math.ceil(text.length / 4);

// Split text into overlapping chunks
const chunkText = (text, chunkSize = 500, overlap = 100) => {
  const chunks = [];
  let start = 0;
  
  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    chunks.push(text.slice(start, end));
    start += chunkSize - overlap; // Overlap chunks
  }
  
  return chunks;
};

// Find chunks relevant to the question
const findRelevantChunks = (question, chunks, maxContextTokens = 1500) => {
  const questionWords = new Set(question.toLowerCase().split(/\W+/));
  let totalTokens = 0;
  const relevantChunks = [];

  // Score each chunk based on word overlap
  const scoredChunks = chunks.map(chunk => {
    const chunkWords = new Set(chunk.toLowerCase().split(/\W+/));
    const intersection = [...questionWords].filter(w => chunkWords.has(w)).length;
    return {
      chunk,
      score: intersection / questionWords.size
    };
  });

  // Sort by score descending
  scoredChunks.sort((a, b) => b.score - a.score);

  // Select top chunks within token limit
  for (const { chunk, score } of scoredChunks) {
    const chunkTokens = countTokens(chunk);
    if (score > 0.1 && (totalTokens + chunkTokens) <= maxContextTokens) {
      relevantChunks.push(chunk);
      totalTokens += chunkTokens;
    }
  }

  return relevantChunks;
};

// ==============================================
// OpenAI Communication
// ==============================================

const fetchOpenAIResponse = async (apiKey, context, question) => {
  try {
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
          content: "Answer the question using only the provided video context:"
        }, {
          role: "user",
          content: `QUESTION: ${question}\n\nCONTEXT:\n${context}`
        }],
        max_tokens: 300,
        temperature: 0.5
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
};

// ==============================================
// Main Question Handling
// ==============================================

document.getElementById('askBtn').addEventListener('click', async () => {
  const questionInput = document.getElementById('question');
  const responseDiv = document.getElementById('response');
  const question = questionInput.value.trim();

  // Input validation
  if (!question) {
    responseDiv.innerHTML = '<div class="error">Please enter a question</div>';
    return;
  }

  // Disable input during processing
  questionInput.disabled = true;
  responseDiv.innerHTML = '<div class="loader"></div>';

  try {
    // ========================
    // 1. Get Video Transcript
    // ========================
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

    // ========================
    // 2. RAG Processing
    // ========================
    const chunks = chunkText(transcriptData.transcript);
    const relevantChunks = findRelevantChunks(question, chunks);
    
    if (relevantChunks.length === 0) {
      throw new Error('No relevant content found in video');
    }

    // ========================
    // 3. Get OpenAI Response
    // ========================
    const { apiKey } = await chrome.storage.local.get(['apiKey']);
    if (!apiKey) throw new Error('Missing OpenAI API Key');

    const context = relevantChunks.join('\n\n[...CONTEXT BREAK...]\n\n');
    const answer = await Promise.race([
      fetchOpenAIResponse(apiKey, context, question),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('API timeout after 15 seconds')), 15000)
      )
    ]);

    // ========================
    // 4. Display Results
    // ========================
    responseDiv.innerHTML = `
      <div class="success">
        <strong>Answer:</strong>
        <div style="margin-top: 10px;">${answer}</div>
      </div>
    `;

  } catch (error) {
    // Handle specific error cases
    let errorMessage = error.message;
    if (errorMessage.includes('quota')) {
      errorMessage += '<br>Please check your OpenAI account billing details.';
    }

    responseDiv.innerHTML = `
      <div class="error">
        <strong>Error:</strong> ${errorMessage}
        ${error.message.includes('API Key') ? 
          '<button id="settingsBtn" style="margin-top: 10px;">Open Settings</button>' : ''}
      </div>
    `;

    // Add settings button handler if needed
    if (error.message.includes('API Key')) {
      document.getElementById('settingsBtn').addEventListener('click', () => {
        chrome.runtime.openOptionsPage();
      });
    }
  } finally {
    // Re-enable input
    questionInput.disabled = false;
  }
});