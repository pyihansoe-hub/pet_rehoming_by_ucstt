/**
 * PawBot AI Service — now powered by OpenRouter (Free Tier)
 * OpenRouter Console: https://openrouter.ai/keys
 *
 * Add to .env:
 *   OPENROUTER_API_KEY=sk-or-v1-xxxxxxxxxxxx
 */

const API_URL = 'https://openrouter.ai/api/v1/chat/completions';


const AI_MODEL = 'google/gemma-4-26b-a4b-it:free'; 

const SYSTEM_PROMPT = `You are PawBot, a warm and knowledgeable assistant for the Pet Rehoming & Monitoring System.
You help users with:
- Pet care advice for dogs, cats, rabbits, birds, fish, reptiles, hamsters, guinea pigs
- Adoption guidance and what to expect
- Health, nutrition, and training tips for pets
- Questions about the platform (listing pets, adoption process, payments, monitoring)

Keep responses friendly, concise, and helpful. Use bullet points for lists.
Never give medical diagnoses — always recommend a vet for serious health concerns.
If a question is unrelated to pets or the platform, still help politely as a general assistant.
Reply directly and concisely with only the final answer.
PLEASE WRITE ONLY IN THE LANGUAGE OF THE USER'S QUERY`;

/**
 * Non-streaming — returns full response
 */
const chat = async (messages) => {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'HTTP-Referer':  'http://localhost:3000', 
      'X-Title':       'PawBot',
    },
    body: JSON.stringify({
      model: AI_MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        ...messages,
      ],
      max_tokens: 8000,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || err.message || `OpenRouter API error: ${res.status}`);
  }

  const data = await res.json();
  return data.choices[0].message.content;
};

/**
 * Streaming — sends tokens word by word via SSE
 */
const chatStream = async (messages, res, onDone) => {
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'HTTP-Referer':  'http://localhost:3000',
      'X-Title':       'PawBot',
      'Accept':        'text/event-stream',
    },
    body: JSON.stringify({
      model: AI_MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        ...messages,
      ],
      max_tokens: 8000,
      stream: true,
    }),
  });

  if (!response.ok) {
    const errText = await response.text(); 
    console.error("OPENROUTER RAW ERROR:", errText); 
    res.write(`data: ${JSON.stringify({ error: errText })}\n\n`);
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
          const choices = parsed.choices;
          if (!choices || !choices.length) continue;

          const delta = choices[0]?.delta?.content || '';
          if (delta) {
            fullText += delta;
            res.write(`data: ${JSON.stringify({ token: delta })}\n\n`);
          }
        } catch { /* skip malformed lines */ }
      }
    }
  }

  res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
  res.end();

  if (onDone) onDone(fullText);
};

module.exports = { chat, chatStream };