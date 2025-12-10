import { GoogleGenerativeAI } from '@google/generative-ai';
import { BaseAIProvider } from './BaseAIProvider';

export class GeminiProvider extends BaseAIProvider {
  id = 'gemini';
  name = 'Gemini';
  private genAI: GoogleGenerativeAI | null = null;
  private apiKey: string | null = null;
  private model: string = 'gemini-pro';

  constructor(apiKey?: string, model?: string) {
    super();
    this.apiKey = apiKey || null;
    this.model = model || 'gemini-pro';
    if (this.apiKey) {
      this.initialize();
    }
  }

  protected async initialize(): Promise<void> {
    if (this.apiKey) {
      this.genAI = new GoogleGenerativeAI(this.apiKey);
    }
  }

  setApiKey(apiKey: string): void {
    this.apiKey = apiKey;
    this.initialize();
  }

  setModel(model: string): void {
    this.model = model;
  }

  async processPrompt(prompt: string): Promise<string> {
    if (!this.genAI) {
      throw new Error('Gemini API key not configured. Please set your API key in settings.');
    }

    try {
      const model = this.genAI.getGenerativeModel({ model: this.model });
      const result = await model.generateContent(prompt);
      const response = await result.response;
      return response.text() || 'No response generated.';
    } catch (error: any) {
      if (error instanceof Error) {
        if (error.message.includes('API key') || error.message.includes('401') || error.message.includes('authentication')) {
          throw new Error('Invalid Gemini API key. Please check your settings.');
        }
        if (error.message.includes('429') || error.status === 429) {
          throw new Error('Gemini API quota exceeded. Please check your billing and usage limits at https://makersuite.google.com/app/apikey.');
        }
        if (error.message.includes('quota')) {
          throw new Error('Gemini API quota exceeded. Please check your billing and usage limits at https://makersuite.google.com/app/apikey.');
        }
        throw new Error(`Gemini API error: ${error.message}`);
      }
      throw new Error('Unknown error occurred while processing prompt.');
    }
  }
}

