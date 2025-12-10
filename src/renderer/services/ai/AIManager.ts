import { AIProvider } from '../../../shared/types';
import { OpenAIProvider } from './providers/OpenAIProvider';
import { ClaudeProvider } from './providers/ClaudeProvider';
import { GeminiProvider } from './providers/GeminiProvider';

export class AIManager {
  private providers: Map<string, AIProvider> = new Map();
  private currentProvider: AIProvider | null = null;

  constructor(
    openAIApiKey?: string,
    openAIModel?: string,
    claudeApiKey?: string,
    claudeModel?: string,
    geminiApiKey?: string,
    geminiModel?: string
  ) {
    // Tüm provider'ları ekle
    const openAI = new OpenAIProvider(openAIApiKey, openAIModel);
    this.registerProvider(openAI);
    
    const claude = new ClaudeProvider(claudeApiKey, claudeModel);
    this.registerProvider(claude);
    
    const gemini = new GeminiProvider(geminiApiKey, geminiModel);
    this.registerProvider(gemini);
    
    // Varsayılan olarak OpenAI seç
    this.setCurrentProvider('openai');
  }

  registerProvider(provider: AIProvider): void {
    this.providers.set(provider.id, provider);
  }

  setCurrentProvider(providerId: string): void {
    const provider = this.providers.get(providerId);
    if (provider) {
      this.currentProvider = provider;
    } else {
      throw new Error(`AI provider with id "${providerId}" not found`);
    }
  }

  getCurrentProvider(): AIProvider | null {
    return this.currentProvider;
  }

  async processPrompt(prompt: string): Promise<string> {
    if (!this.currentProvider) {
      throw new Error('No AI provider selected');
    }
    return await this.currentProvider.processPrompt(prompt);
  }

  getAvailableProviders(): AIProvider[] {
    return Array.from(this.providers.values());
  }

  updateOpenAIApiKey(apiKey: string): void {
    const openAIProvider = this.providers.get('openai') as OpenAIProvider;
    if (openAIProvider) {
      openAIProvider.setApiKey(apiKey);
    }
  }

  updateOpenAIModel(model: string): void {
    const openAIProvider = this.providers.get('openai') as OpenAIProvider;
    if (openAIProvider) {
      openAIProvider.setModel(model);
    }
  }

  updateClaudeApiKey(apiKey: string): void {
    const claudeProvider = this.providers.get('claude') as ClaudeProvider;
    if (claudeProvider) {
      claudeProvider.setApiKey(apiKey);
    }
  }

  updateClaudeModel(model: string): void {
    const claudeProvider = this.providers.get('claude') as ClaudeProvider;
    if (claudeProvider) {
      claudeProvider.setModel(model);
    }
  }

  updateGeminiApiKey(apiKey: string): void {
    const geminiProvider = this.providers.get('gemini') as GeminiProvider;
    if (geminiProvider) {
      geminiProvider.setApiKey(apiKey);
    }
  }

  updateGeminiModel(model: string): void {
    const geminiProvider = this.providers.get('gemini') as GeminiProvider;
    if (geminiProvider) {
      geminiProvider.setModel(model);
    }
  }
}

