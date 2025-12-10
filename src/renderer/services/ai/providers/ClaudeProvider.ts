import Anthropic from '@anthropic-ai/sdk';
import { BaseAIProvider } from './BaseAIProvider';

export class ClaudeProvider extends BaseAIProvider {
  id = 'claude';
  name = 'Claude';
  private client: Anthropic | null = null;
  private apiKey: string | null = null;
  private model: string = 'claude-3-5-sonnet-20241022';

  constructor(apiKey?: string, model?: string) {
    super();
    this.apiKey = apiKey || null;
    this.model = model || 'claude-3-5-sonnet-20241022';
    if (this.apiKey) {
      this.initialize();
    }
  }

  protected async initialize(): Promise<void> {
    if (this.apiKey) {
      this.client = new Anthropic({
        apiKey: this.apiKey,
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
      throw new Error('Claude API key not configured. Please set your API key in settings.');
    }

    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 2000,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      });

      const content = response.content.find((item: any) => item.type === 'text');
      return content?.text || 'No response generated.';
    } catch (error: any) {
      if (error instanceof Error) {
        if (error.message.includes('API key') || error.message.includes('401') || error.message.includes('authentication')) {
          throw new Error('Invalid Claude API key. Please check your settings.');
        }
        if (error.message.includes('429') || error.status === 429) {
          throw new Error('Claude API quota exceeded. Please check your billing and usage limits at https://console.anthropic.com/.');
        }
        if (error.message.includes('quota')) {
          throw new Error('Claude API quota exceeded. Please check your billing and usage limits at https://console.anthropic.com/.');
        }
        throw new Error(`Claude API error: ${error.message}`);
      }
      throw new Error('Unknown error occurred while processing prompt.');
    }
  }
}

