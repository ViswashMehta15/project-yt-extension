// Token counter for GPT (approximate)
function countTokens(text) {
  return Math.ceil(text.length / 4); // 1 token ≈ 4 characters
}

// Split text into overlapping chunks
function chunkText(text, chunkSize = 500, overlap = 100) {
  const chunks = [];
  let start = 0;
  
  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    chunks.push(text.slice(start, end));
    start += chunkSize - overlap;
  }
  
  return chunks;
}

// Simple semantic similarity search
function findRelevantChunks(question, chunks, maxTokens = 1500) {
  const questionWords = new Set(question.toLowerCase().split(/\W+/));
  let totalTokens = 0;
  const relevant = [];

  for (const chunk of chunks) {
    const chunkTokens = countTokens(chunk);
    const chunkWords = new Set(chunk.toLowerCase().split(/\W+/));
    
    // Calculate overlap score
    const intersection = [...questionWords].filter(w => chunkWords.has(w)).length;
    const score = intersection / questionWords.size;

    if (score > 0.2 && totalTokens + chunkTokens <= maxTokens) {
      relevant.push(chunk);
      totalTokens += chunkTokens;
    }
  }

  return relevant;
}