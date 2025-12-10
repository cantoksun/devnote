import OpenAI from 'openai';
import { BaseAIProvider } from './BaseAIProvider';

export class OpenAIProvider extends BaseAIProvider {
  id = 'openai';
  name = 'OpenAI GPT-4';
  private client: OpenAI | null = null;
  private apiKey: string | null = null;
  private model: string = 'gpt-3.5-turbo';

  constructor(apiKey?: string, model?: string) {
    super();
    this.apiKey = apiKey || null;
    this.model = model || 'gpt-3.5-turbo';
    if (this.apiKey) {
      this.initialize();
    }
  }

  protected async initialize(): Promise<void> {
    if (this.apiKey) {
      this.client = new OpenAI({
        apiKey: this.apiKey,
        dangerouslyAllowBrowser: true // Electron için güvenli
      });
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
    if (!this.client) {
      throw new Error('OpenAI API key not configured. Please set your API key in settings.');
    }

    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 2000
      });

      return response.choices[0]?.message?.content || 'No response generated.';
    } catch (error: any) {
      if (error instanceof Error) {
        if (error.message.includes('API key') || error.message.includes('401')) {
          throw new Error('Invalid OpenAI API key. Please check your settings.');
        }
        if (error.message.includes('429') || error.status === 429) {
          throw new Error('OpenAI API quota exceeded. Please check your billing and usage limits at https://platform.openai.com/usage. You may need to add payment method or upgrade your plan.');
        }
        if (error.message.includes('quota')) {
          throw new Error('OpenAI API quota exceeded. Please check your billing and usage limits at https://platform.openai.com/usage.');
        }
        throw new Error(`OpenAI API error: ${error.message}`);
      }
      throw new Error('Unknown error occurred while processing prompt.');
    }
  }
}

