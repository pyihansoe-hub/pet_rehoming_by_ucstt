/**
 * Qwen AI Service — uses DashScope API with streaming (SSE)
 * Free tier: https://dashscope.aliyun.com
 * Get API key: https://dashscope.console.aliyun.com/apiKey
 *
 * Add to .env:
 *   QWEN_API_KEY=sk-xxxxxxxxxxxx
 */

const QWEN_API_URL = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation';
const QWEN_MODEL   = 'qwen-turbo'; // free tier model — also: qwen-plus, qwen-max

const SYSTEM_PROMPT = `You are PawBot, a warm and knowledgeable assistant for the Pet Rehoming & Monitoring System.
You help users with:
- Pet care advice for dogs, cats, rabbits, birds, fish, reptiles, hamsters, guinea pigs
- Adoption guidance and what to expect
- Health, nutrition, and training tips for pets
- Questions about the platform (listing pets, adoption process, payments, monitoring)

Keep responses friendly, concise, and helpful. Use bullet points for lists.
Never give medical diagnoses — always recommend a vet for serious health concerns.
If a question is unrelated to pets or the platform, still help politely as a general assistant.`;

/**
 * Non-streaming — returns full response
 * Used as fallback or for session history saving
 */
const chat = async (messages) => {
  const res = await fetch(QWEN_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${process.env.QWEN_API_KEY}`,
    },
    body: JSON.stringify({
      model: QWEN_MODEL,
      input: {
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          ...messages,
        ],
      },
      parameters: {
        result_format: 'message',
        max_tokens: 1024,
      },
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Qwen API error: ${res.status}`);
  }

  const data = await res.json();
  return data.output.choices[0].message.content;
};

/**
 * Streaming — sends tokens word by word via SSE
 * Call this from a route handler that sets up SSE headers
 *
 * @param {array}    messages  - conversation history [{role, content}]
 * @param {object}   res       - Express response object (with SSE headers set)
 * @param {function} onDone    - called with full text when stream ends
 */
const chatStream = async (messages, res, onDone) => {
  const response = await fetch(QWEN_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type':        'application/json',
      'Authorization':       `Bearer ${process.env.QWEN_API_KEY}`,
      'X-DashScope-SSE':     'enable',   // enables streaming
      'Accept':              'text/event-stream',
    },
    body: JSON.stringify({
      model: QWEN_MODEL,
      input: {
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          ...messages,
        ],
      },
      parameters: {
        result_format:     'message',
        max_tokens:        1024,
        incremental_output: true,        // send incremental chunks
      },
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    res.write(`data: ${JSON.stringify({ error: err.message || 'Qwen error' })}\n\n`);
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
    buffer = lines.pop(); // keep incomplete line

    for (const line of lines) {
      if (!line.trim() || line.startsWith(':')) continue;

      if (line.startsWith('data:')) {
        const raw = line.slice(5).trim();
        if (raw === '[DONE]') continue;

        try {
          const parsed  = JSON.parse(raw);
          const choices = parsed.output?.choices;
          if (!choices) continue;

          const delta = choices[0]?.message?.content || '';
          if (delta) {
            fullText += delta;
            // send each token chunk to frontend
            res.write(`data: ${JSON.stringify({ token: delta })}\n\n`);
          }
        } catch { /* skip malformed lines */ }
      }
    }
  }

  // signal end
  res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
  res.end();

  if (onDone) onDone(fullText);
};

module.exports = { chat, chatStream };
