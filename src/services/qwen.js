
const { Agent } = require('https');

// OpenRouter's OpenAI-compatible endpoint
//const API_URL = 'https://tight-dust-f6bf.leob14165.workers.dev';
const API_URL = 'https://openrouter.ai/api/v1/chat/completions';
// Keep-alive agent to reuse TLS connections (saves 100-300ms per request)
const keepAliveAgent = new Agent({ keepAlive: true, maxSockets: 50 });

// OpenRouter model IDs use the format "provider/model-name".
// Examples: "qwen/qwen-2.5-72b-instruct", "meta-llama/llama-3.3-70b-instruct", "openai/gpt-4o-mini"
const AI_MODEL = 'deepseek/deepseek-chat'; 
//const AI_MODEL = 'google/gemma-4-26b-a4b-it:free';
const SYSTEM_PROMPT = `You are PawBot, a warm and knowledgeable assistant for the Pet Rehoming & Monitoring System.
You help users with:
- Pet care advice for dogs, cats
- Adoption guidance and what to expect
- Health, nutrition, and training tips for pets
- Questions about the platform (listing pets, adoption process, payments, monitoring)

Keep responses friendly, concise, and helpful. Use bullet points for lists.
If a question is unrelated to pets or the platform, still help politely as a general assistant.
Reply directly and concisely with only the final answer.
PLEASE WRITE ONLY IN THE LANGUAGE OF THE USER'S QUERY AND ANSWER SHORTLY.`;


const chat = async (messages) => {
  // Timeout to prevent hanging requests
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  // Trim history to last 6 messages to reduce processing time
  const recentMessages = messages.slice(-6);

  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      agent: keepAliveAgent,
      signal: controller.signal,
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        // OpenRouter uses these for ranking and attribution (optional but recommended)
        'HTTP-Referer':  process.env.OPENROUTER_REFERER || 'http://localhost:3000', 
        'X-Title':       'PawBot', 
      },
      body: JSON.stringify({
        model: AI_MODEL,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          ...recentMessages,
        ],
        max_tokens: 2048,
        temperature: 0.5,      
        top_p: 0.9,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || err.message || `OpenRouter API error: ${res.status}`);
    }

    const data = await res.json();
    return data.choices[0].message.content;
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('Request timed out');
    throw error;
  } finally {
    clearTimeout(timeout);
  }
};

/**
 * Streaming — sends tokens word by word via SSE
 */
const chatStream = async (messages, res, onDone) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);

  // Trim history to last 6 messages to reduce Time-To-First-Token (TTFT)
  const recentMessages = messages.slice(-6);

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      agent: keepAliveAgent,
      signal: controller.signal,
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'HTTP-Referer':  process.env.OPENROUTER_REFERER || 'http://localhost:3000', 
        'X-Title':       'PawBot',
        'Accept':        'text/event-stream',
      },
      body: JSON.stringify({
        model: AI_MODEL,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          ...recentMessages,
        ],
        max_tokens: 2048,
        temperature: 0.5,
        top_p: 0.9,
        stream: true,
      }),
    });

    if (!response.ok) {
      const errText = await response.text(); 
      console.error("OpenRouter API RAW ERROR:", errText); 
      res.write(`data: ${JSON.stringify({ error: errText })}\n\n`);
      res.end();
      return;
    }

    const reader    = response.body.getReader();
    const decoder   = new TextDecoder();
    let   fullText  = '';
    let   buffer    = '';
    let   pending   = ''; // Buffer to batch small chunks and reduce I/O overhead

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
            const choices = parsed.choices;
            if (!choices || !choices.length) continue;

            const delta = choices[0]?.delta?.content || '';
            if (delta) {
              fullText += delta;
              pending += delta;
              
              // Flush every ~8 characters to make the stream smoother and faster
              if (pending.length >= 8) {
                res.write(`data: ${JSON.stringify({ token: pending })}\n\n`);
                pending = '';
              }
            }
          } catch { /* skip malformed lines */ }
        }
      }
    }

    // Flush any remaining tokens in the buffer
    if (pending) {
      res.write(`data: ${JSON.stringify({ token: pending })}\n\n`);
    }

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();

    if (onDone) onDone(fullText);
  } catch (error) {
    console.error("Stream error:", error.message);
    if (!res.writableEnded) {
      res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
      res.end();
    }
  } finally {
    clearTimeout(timeout);
  }
};

module.exports = { chat, chatStream };
