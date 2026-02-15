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
      const modelName = import.meta.env.VITE_GEMINI_MODEL || 'gemini-1.5-flash';
      this.model = this.client.getGenerativeModel({ model: modelName });
      console.log(`Gemini model initialized: ${modelName}`);
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
      maxOutputTokens: options.maxTokens ?? 8192,
      topP: 0.9,
    };

    console.log('[GeminiClient] Calling API with prompt length:', prompt.length);

    try {
      const result = await this.model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig
      });

      const response = result.response;
      const text = response.text();

      console.log('[GeminiClient] API call successful, response length:', text.length);

      return text;
    } catch (error) {
      console.error('[GeminiClient] Gemini API error:', error);
      console.error('[GeminiClient] Error details:', error.message);
      throw error;
    }
  }

  async generateJSON(prompt, options = {}) {
    const jsonPrompt = `${prompt}

【重要】你的回复必须是纯 JSON 格式。不要包含任何 markdown 格式、代码块或解释文字。直接以 { 或 [ 开头。`;

    console.log('[GeminiClient] Generating JSON response...');

    const text = await this.generate(jsonPrompt, options);

    console.log('[GeminiClient] Raw response length:', text.length);
    console.log('[GeminiClient] Raw response preview:', text.substring(0, 800));

    // Try to extract JSON from the response
    let jsonText = text.trim();

    // Remove markdown code blocks if present (handle various formats)
    const codeBlockMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
      jsonText = codeBlockMatch[1].trim();
      console.log('[GeminiClient] Extracted from code block');
    }

    // Try to find the outermost JSON object
    const firstBrace = jsonText.indexOf('{');
    const lastBrace = jsonText.lastIndexOf('}');

    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      jsonText = jsonText.substring(firstBrace, lastBrace + 1);
      console.log('[GeminiClient] Extracted JSON object from position', firstBrace, 'to', lastBrace);
    }

    try {
      const parsed = JSON.parse(jsonText);
      console.log('[GeminiClient] JSON parsed successfully');
      return parsed;
    } catch (error) {
      console.error('[GeminiClient] JSON parse error:', error.message);
      console.error('[GeminiClient] Attempted to parse:', jsonText.substring(0, 1500));

      // Try to fix common JSON issues
      try {
        // Remove trailing commas before } or ]
        let fixedJson = jsonText.replace(/,(\s*[}\]])/g, '$1');
        // Try parsing again
        const parsed = JSON.parse(fixedJson);
        console.log('[GeminiClient] JSON parsed after fixing trailing commas');
        return parsed;
      } catch (e) {
        console.error('[GeminiClient] Could not fix JSON');
        throw new Error('Invalid JSON response from LLM');
      }
    }
  }
}

export const GeminiClient = new GeminiClientManager();
export default GeminiClient;
