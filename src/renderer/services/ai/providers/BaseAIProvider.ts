import { AIProvider } from '../../../../shared/types';

export abstract class BaseAIProvider implements AIProvider {
  abstract id: string;
  abstract name: string;

  abstract processPrompt(prompt: string): Promise<string>;

  protected abstract initialize(): Promise<void>;
}

