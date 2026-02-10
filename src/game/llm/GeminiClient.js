import { GoogleGenerativeAI } from '@google/generative-ai';

class GeminiClientManager {
  constructor() {
    this.client = null;
    this.model = null;
  }

  init() {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

    if (!apiKey || apiKey === 'your_api_key_here') {
      console.warn('Gemini API key not configured. LLM features will use fallback mode.');
      return false;
    }

    try {
      this.client = new GoogleGenerativeAI(apiKey);
      this.model = this.client.getGenerativeModel({ model: 'gemini-1.5-flash' });
      return true;
    } catch (error) {
      console.error('Failed to initialize Gemini client:', error);
      return false;
    }
  }

  isAvailable() {
    return this.model !== null;
  }

  async generate(prompt, options = {}) {
    if (!this.isAvailable()) {
      throw new Error('Gemini client not initialized');
    }

    const generationConfig = {
      temperature: options.temperature ?? 0.8,
      maxOutputTokens: options.maxTokens ?? 2048,
      topP: 0.9,
    };

    try {
      const result = await this.model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig
      });

      const response = result.response;
      const text = response.text();

      return text;
    } catch (error) {
      console.error('Gemini API error:', error);
      throw error;
    }
  }

  async generateJSON(prompt, options = {}) {
    const jsonPrompt = `${prompt}

IMPORTANT: Your response must be ONLY valid JSON. Do not include any markdown formatting, code blocks, or explanation text. Start directly with { or [.`;

    const text = await this.generate(jsonPrompt, options);

    // Try to extract JSON from the response
    let jsonText = text.trim();

    // Remove markdown code blocks if present
    if (jsonText.startsWith('```')) {
      const match = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (match) {
        jsonText = match[1].trim();
      }
    }

    // Find JSON object or array
    const jsonMatch = jsonText.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    if (jsonMatch) {
      jsonText = jsonMatch[1];
    }

    try {
      return JSON.parse(jsonText);
    } catch (error) {
      console.error('Failed to parse JSON response:', jsonText);
      throw new Error('Invalid JSON response from LLM');
    }
  }
}

export const GeminiClient = new GeminiClientManager();
export default GeminiClient;
