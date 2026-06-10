require('dotenv').config();

async function listModels() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("Error: GEMINI_API_KEY is not defined in your .env file.");
    return;
  }

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    const data = await response.json();
    
    if (data.error) {
      console.error("API Error:", data.error.message);
      return;
    }

    console.log("=== Available Models for your API Key ===");
    data.models.forEach(model => {
      // Filter for models that support generating content
      if (model.supportedGenerationMethods.includes('generateContent')) {
        console.log(`- ${model.name.replace('models/', '')}`);
      }
    });
  } catch (err) {
    console.error("Failed to fetch models:", err);
  }
}

listModels();
