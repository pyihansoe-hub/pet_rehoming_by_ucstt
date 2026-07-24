
const API_URL = 'https://api.mistral.ai/v1/chat/completions';


const AI_MODEL = 'mistral-large-latest'; 

const SYSTEM_PROMPT = `You are PawBot, a warm, friendly and knowledgeable assistant for the Pet Rehoming & Monitoring System.
You help users with:
- Pet care advice for dogs, cats
- Health, nutrition, and training tips for pets
- Questions about the platform (users can see pets (dog, cats and other animals) for adoption, read blogs, submit adoption requests (can crash with credit card, Kpay, Ayapay, Wavepay), owners can approve and reject, after adoption platform can monitor the pet's health and well-being)

Keep responses helpful, funny and entertaining 
If a question is unrelated to pets or the platform, still help politely as a general assistant.
CRITICAL: YOU MUST WRITE ONLY IN THE LANGUAGE OF THE USER'S QUERY. USE ENGLISH FOR SOME WORDS THAT CANNOT BE TRANSLATED DIRECTLY., answer shortly and concisely, avoid long explanations. answer completely in 5k tokens maximum.`;

const chat = async (messages) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  const recentMessages = messages.slice(-3);

  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      signal: controller.signal, // 'agent' ကို ဖယ်ထုတ်လိုက်ပါသည်
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${process.env.MISTRAL_API_KEY}`,
      },
      body: JSON.stringify({
        model: AI_MODEL,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          ...recentMessages,
        ],
        max_tokens: 5048,
        temperature: 0.5,      
        top_p: 0.9,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || err.message || `Mistral API error: ${res.status}`);
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

const chatStream = async (messages, res, onDone) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);
  const recentMessages = messages.slice(-3);

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      signal: controller.signal, // 'agent' ကို ဖယ်ထုတ်လိုက်ပါသည်
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${process.env.MISTRAL_API_KEY}`,
        'Accept':        'text/event-stream',
      },
      body: JSON.stringify({
        model: AI_MODEL,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          ...recentMessages,
        ],
        max_tokens: 5048,
        temperature: 0.5,
        top_p: 0.9,
        stream: true,
      }),
    });

    if (!response.ok) {
      const errText = await response.text(); 
      console.error("Mistral API RAW ERROR:", errText); 
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
      buffer = lines.pop(); 

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
