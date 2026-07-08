/**
 * Qwen AI Service — uses DashScope OpenAI-Compatible API with streaming (SSE)
 * Free tier: https://dashscope.aliyun.com
 * Get API key: https://dashscope.console.aliyun.com/apiKey
 *
 * Add to .env:
 *   QWEN_API_KEY=sk-xxxxxxxxxxxx
 */

// FIX 1: Added /chat/completions to the URL
const QWEN_API_URL = 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions';
const QWEN_MODEL   = 'qwen-turbo'; 

const SYSTEM_PROMPT = `You are PawBot, a warm and knowledgeable assistant for the Pet Rehoming & Monitoring System.
You help users with:
- Pet care advice for dogs, cats, rabbits, birds, fish, reptiles, hamsters, guinea pigs
- Adoption guidance and what to expect
- Health, nutrition, and training tips for pets
- Questions about the platform (listing pets, adoption process, payments, monitoring)

Keep responses friendly, concise, and helpful. Use bullet points for lists.
Never give medical diagnoses — always recommend a vet for serious health concerns.
If a question is unrelated to pets or the platform, still help politely as a general assistant.
 PLEASE WRITE ONLY BURMESE`;

/**
 * Non-streaming — returns full response
 */
const chat = async (messages) => {
  const res = await fetch(QWEN_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${process.env.QWEN_API_KEY}`,
    },
    // FIX 2: Changed to standard OpenAI format
    body: JSON.stringify({
      model: QWEN_MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        ...messages,
      ],
      max_tokens: 1024,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || err.message || `Qwen API error: ${res.status}`);
  }

  const data = await res.json();
  return data.choices[0].message.content;
};

/**
 * Streaming — sends tokens word by word via SSE
 */
const chatStream = async (messages, res, onDone) => {
  const response = await fetch(QWEN_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${process.env.QWEN_API_KEY}`,
      'Accept':        'text/event-stream',
    },
    // FIX 2: Standard OpenAI format + stream: true
    body: JSON.stringify({
      model: QWEN_MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        ...messages,
      ],
      max_tokens: 1024,
      stream: true, 
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    res.write(`data: ${JSON.stringify({ error: err.error?.message || err.message || 'Qwen API error' })}\n\n`);
    res.end();
    return;
  }

  const reader    = response.body.getReader();
  const decoder   = new TextDecoder();
  let   fullText  = '';
  let   buffer    = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop(); // keep incomplete line in buffer

    for (const line of lines) {
      if (!line.trim() || line.startsWith(':')) continue;

      if (line.startsWith('data:')) {
        const raw = line.slice(5).trim();
        if (raw === '[DONE]') continue;

        try {
          const parsed  = JSON.parse(raw);
          // FIX 3: OpenAI format uses parsed.choices, NOT parsed.output.choices
          const choices = parsed.choices;
          if (!choices || !choices.length) continue;

          // FIX 4: OpenAI streaming uses "delta", not "message"
          const delta = choices[0]?.delta?.content || '';
          if (delta) {
            fullText += delta;
            res.write(`data: ${JSON.stringify({ token: delta })}\n\n`);
          }
        } catch { /* skip malformed lines */ }
      }
    }
  }

  // signal end to frontend
  res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
  res.end();

  if (onDone) onDone(fullText);
};

module.exports = { chat, chatStream };