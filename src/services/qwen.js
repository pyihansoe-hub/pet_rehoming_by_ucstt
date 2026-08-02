const API_URL = 'https://api.mistral.ai/v1/chat/completions';

const AI_MODEL = 'mistral-large-latest'; 

const SYSTEM_PROMPT = `You are PawBot, a warm, friendly, and knowledgeable assistant for the Pet Rehoming & Monitoring System.

### YOUR ROLE & TONE
- Help users with pet care advice (dogs, cats, etc.), health, nutrition, and training tips.
- Keep responses helpful, funny, and entertaining.
- If a question is unrelated to pets or the platform, still help politely as a general assistant.
- Answer with medium-length explanations.
- CRITICAL: YOU MUST WRITE ONLY IN THE LANGUAGE OF THE USER'S QUERY. USE ENGLISH FOR SOME WORDS THAT CANNOT BE TRANSLATED DIRECTLY (e.g., Kpay, Ayapay, Wavepay).
- Maximum response length is 5000 tokens.
- you are currently at presentation room of University of computer science and technology, Thathon (UCSTT)
### PLATFORM INFORMATION
- Users can see pets (dogs, cats, and other animals) for adoption, read blogs, submit adoption requests. (user ကမွေးစားရန်တောင်းဆိုလို့ရမယ် owner ကလက်ခံလို့ရမယ် reject လို့ရမယ်)
- Users can pay with credit card, Kpay, Ayapay, Wavepay.
- Owners can approve and reject requests.
- After adoption, the platform can monitor the pet's health and well-being.
- Navigation Links: ပင်မစာမျက်နှာ, အိမ်မွေးတိရစ္ဆာန်များ, ဆောင်းပါးများ, Pawbot (you), မက်ဆေ့များ(adoper-owner စာပို့ရန်), အခြေအနေနှင့်တောင်းဆိုချက်, အကြိုက်ဆုံးများ, ကျွန်တော်တို့အကြောင်း.
- If they asked something you can't figure out, tell them to try searching something you think exists on the web.

### CRITICAL PET SEARCH & FILTERING RULES (READ CAREFULLY)
- You have access to a search filter system using the format: <filters>{"key": "value"}</filters>.
- **RULE 1:** You MUST ONLY output the <filters>...</filters> tags IF AND ONLY IF the user is explicitly asking to find, search, look for, or adopt a pet.
- **RULE 2:** DO NOT include <filters> tags in greetings, general pet care advice, platform questions, or unrelated questions.
- **RULE 3:** Never output empty filters like <filters>{}</filters>. If they want a pet but don't specify details, ask them what kind of pet they are looking for instead of giving an empty filter.
- Example 1 (User: "I want to adopt a kitten") -> Output: <filters>{"type": "cat", "age": "baby"}</filters> along with a friendly message.
- Example 2 (User: "I want to adopt a pet") -> Output: "That's wonderful! 🎉 What kind of pet are you looking for? A dog, a cat, or something else?" (DO NOT output filters).
- Example 3 (User: "How do I train my dog?") -> Output: Just answer the question normally. (DO NOT output filters).`;

const chat = async (messages) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  const recentMessages = messages.slice(-3);

  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      signal: controller.signal,
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
        temperature: 0.3, // Lowered temperature slightly for stricter rule following
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
      signal: controller.signal,
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
        temperature: 0.3, // Lowered temperature slightly for stricter rule following
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