import { GoogleGenAI } from '@google/genai';
import { LLM } from '../config.js';

class GeminiClientManager {
  constructor() {
    this.client = null;
    this.modelName = null;
  }

  init() {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

    if (!apiKey || apiKey === 'your_api_key_here') {
      console.warn('Gemini API key not configured. LLM features will use fallback mode.');
      return false;
    }

    try {
      this.client = new GoogleGenAI({ apiKey });
      this.modelName = import.meta.env.VITE_GEMINI_MODEL || 'gemini-2.0-flash';
      console.log(`Gemini client initialized with model: ${this.modelName}`);
      return true;
    } catch (error) {
      console.error('Failed to initialize Gemini client:', error);
      return false;
    }
  }

  isAvailable() {
    return this.client !== null;
  }

  async generate(prompt, options = {}) {
    if (!this.isAvailable()) {
      throw new Error('Gemini client not initialized');
    }

    const config = {
      temperature: options.temperature ?? LLM.DEFAULT_TEMPERATURE,
      maxOutputTokens: options.maxTokens ?? LLM.DEFAULT_MAX_TOKENS,
      topP: LLM.DEFAULT_TOP_P,
    };
    if (options.responseMimeType) {
      config.responseMimeType = options.responseMimeType;
    }

    console.log('[GeminiClient] Calling API with prompt length:', prompt.length);

    try {
      const response = await this.client.models.generateContent({
        model: this.modelName,
        contents: prompt,
        config
      });

      const text = response.text;

      console.log('[GeminiClient] API call successful, response length:', text.length);

      return text;
    } catch (error) {
      console.error('[GeminiClient] Gemini API error:', error);
      console.error('[GeminiClient] Error details:', error.message);
      throw error;
    }
  }

  async generateJSON(prompt, options = {}) {
    console.log('[GeminiClient] Generating JSON response...');

    const text = await this.generate(prompt, {
      ...options,
      maxTokens: options.maxTokens ?? LLM.JSON_DEFAULT_MAX_TOKENS,
      responseMimeType: 'application/json',
    });

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

    // Try to find the outermost JSON structure (object or array)
    const firstBrace = jsonText.indexOf('{');
    const lastBrace = jsonText.lastIndexOf('}');
    const firstBracket = jsonText.indexOf('[');
    const lastBracket = jsonText.lastIndexOf(']');

    const hasBrace = firstBrace !== -1 && lastBrace > firstBrace;
    const hasBracket = firstBracket !== -1 && lastBracket > firstBracket;

    if (hasBracket && (!hasBrace || firstBracket < firstBrace)) {
      jsonText = jsonText.substring(firstBracket, lastBracket + 1);
    } else if (hasBrace) {
      jsonText = jsonText.substring(firstBrace, lastBrace + 1);
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
