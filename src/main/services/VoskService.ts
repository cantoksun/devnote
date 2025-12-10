import * as fs from 'fs';
import * as path from 'path';
import { ChildProcess, fork } from 'child_process';

export class VoskService {
  private modelPath: string | null = null;
  private isInitialized = false;
  private worker: ChildProcess | null = null;
  private pendingCallbacks: Map<string, { resolve: (value: any) => void; reject: (error: Error) => void }> = new Map();
  private messageIdCounter = 0;

  async initialize(modelPath: string, sampleRate: number = 16000): Promise<boolean> {
    try {
      console.group('🎤 Initializing Vosk Service (Child Process)');
      console.log('Model path:', modelPath);
      console.log('Sample rate:', sampleRate);
      
      if (!fs.existsSync(modelPath)) {
        console.error('❌ Vosk model path does not exist:', modelPath);
        console.groupEnd();
        return false;
      }

      // Model klasörünün içeriğini kontrol et
      const modelFiles = fs.readdirSync(modelPath);
      console.log('Model folder contents:', modelFiles);

      // Worker'ı başlat
      await this.startWorker();

      // Worker'a initialize mesajı gönder
      const initialized = await this.sendMessage('initialize', { modelPath, sampleRate });
      
      if (initialized && initialized.success) {
        this.modelPath = modelPath;
        this.isInitialized = true;
        console.log('✅ Vosk service initialized successfully (via child process)');
        console.groupEnd();
        return true;
      } else {
        console.error('❌ Vosk service initialization failed:', initialized?.error);
        console.groupEnd();
        this.cleanup();
        return false;
      }
    } catch (error: any) {
      console.group('❌ Error Initializing Vosk Service');
      console.error('Error type:', error?.constructor?.name);
      console.error('Error message:', error?.message);
      console.error('Error code:', error?.code);
      console.error('Error stack:', error?.stack);
      console.groupEnd();
      this.cleanup();
      return false;
    }
  }

  private async startWorker(): Promise<void> {
    if (this.worker) {
      return; // Worker zaten çalışıyor
    }

    return new Promise((resolve, reject) => {
      try {
        // Worker dosyasının path'ini bul
        // Development modunda: dist/main/workers/voskWorker.js
        // Production modunda: dist/main/workers/voskWorker.js
        const workerPath = path.join(__dirname, '..', 'workers', 'voskWorker.js');
        console.log('Starting Vosk worker from:', workerPath);
        console.log('Worker path exists:', fs.existsSync(workerPath));
        
        if (!fs.existsSync(workerPath)) {
          // Alternatif path dene (development modunda src/main/workers olabilir)
          const altPath = path.join(process.cwd(), 'src', 'main', 'workers', 'voskWorker.js');
          console.log('Trying alternative path:', altPath);
          if (fs.existsSync(altPath)) {
            console.log('Using alternative path:', altPath);
            const finalPath = altPath;
            this.forkWorker(finalPath, resolve, reject);
            return;
          }
          reject(new Error(`Vosk worker file not found at ${workerPath} or ${altPath}`));
          return;
        }
        
        this.forkWorker(workerPath, resolve, reject);
      } catch (error) {
        reject(error);
      }
    });
  }

  private forkWorker(workerPath: string, resolve: () => void, reject: (error: Error) => void): void {
    try {

      // Worker'ı başlat
      this.worker = fork(workerPath, [], {
        stdio: ['pipe', 'pipe', 'pipe', 'ipc']
      });

      // Worker mesajlarını dinle
      this.worker.on('message', (msg: any) => {
        this.handleWorkerMessage(msg);
      });

      // Worker hatalarını dinle
      this.worker.on('error', (error) => {
        console.error('❌ Vosk worker error:', error);
        this.cleanup();
      });

      // Worker çıkışını dinle
      this.worker.on('exit', (code, signal) => {
        console.log('Vosk worker exited:', { code, signal });
        this.worker = null;
        this.isInitialized = false;
      });

      // Worker stdout/stderr'ı logla
      if (this.worker.stdout) {
        this.worker.stdout.on('data', (data) => {
          console.log('[Vosk Worker]', data.toString().trim());
        });
      }

      if (this.worker.stderr) {
        this.worker.stderr.on('data', (data) => {
          console.error('[Vosk Worker Error]', data.toString().trim());
        });
      }

      // Worker'ın hazır olmasını bekle
      const readyTimeout = setTimeout(() => {
        reject(new Error('Vosk worker did not send ready message within 5 seconds'));
      }, 5000);

      const readyHandler = (msg: any) => {
        if (msg.type === 'ready') {
          clearTimeout(readyTimeout);
          this.worker?.removeListener('message', readyHandler);
          console.log('✅ Vosk worker is ready');
          resolve();
        }
      };

      this.worker.on('message', readyHandler);
    } catch (error) {
      reject(error instanceof Error ? error : new Error(String(error)));
    }
  }

  private handleWorkerMessage(msg: any): void {
    const { messageId, type, ...data } = msg;

    // Debug logging
    if (type === 'initialized' || type === 'error' || messageId) {
      console.log('[VoskService] Handling worker message:', { type, messageId, hasCallback: messageId ? this.pendingCallbacks.has(messageId) : false });
    }

    if (messageId && this.pendingCallbacks.has(messageId)) {
      const { resolve, reject } = this.pendingCallbacks.get(messageId)!;
      this.pendingCallbacks.delete(messageId);

      if (type === 'error') {
        reject(new Error(data.error || 'Unknown error'));
      } else {
        resolve(data);
      }
    } else if (type === 'initialized') {
      // Initialize mesajı için özel handling
      // Worker'dan gelen initialized mesajı messageId içermeli
      if (messageId && this.pendingCallbacks.has(messageId)) {
        const { resolve, reject } = this.pendingCallbacks.get(messageId)!;
        this.pendingCallbacks.delete(messageId);
        
        if (data.success) {
          resolve(data);
        } else {
          reject(new Error(data.error || 'Initialization failed'));
        }
      } else {
        console.warn('[VoskService] Received initialized message but no matching callback found:', { messageId, pendingCallbacks: Array.from(this.pendingCallbacks.keys()) });
      }
    } else if (type === 'result') {
      // Sonuç mesajları için özel handling (async callback'ler için)
      // Bu durumda messageId olmayabilir
      console.log('[Vosk Worker] Result:', data);
    } else if (type === 'ready') {
      // Ready mesajı için özel handling (startWorker'da kullanılıyor)
      // Bu mesaj messageId içermeyebilir
      console.log('[VoskService] Worker ready message received');
    } else {
      console.warn('[VoskService] Received message without matching callback:', { type, messageId, hasMessageId: !!messageId });
    }
  }

  private sendMessage(type: string, data: any = {}): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.worker) {
        reject(new Error('Vosk worker is not running'));
        return;
      }

      const messageId = `msg_${this.messageIdCounter++}`;
      const message = { messageId, type, ...data };

      // Callback'i kaydet
      this.pendingCallbacks.set(messageId, { resolve, reject });

      // Mesajı gönder
      this.worker.send(message);

      // Timeout (10 saniye)
      setTimeout(() => {
        if (this.pendingCallbacks.has(messageId)) {
          this.pendingCallbacks.delete(messageId);
          reject(new Error(`Vosk worker message timeout: ${type}`));
        }
      }, 10000);
    });
  }

  async recognize(audioBuffer: Buffer): Promise<{ text: string; isFinal: boolean }> {
    if (!this.isInitialized || !this.worker) {
      throw new Error('Vosk service is not initialized');
    }

    try {
      // Buffer'ı ArrayBuffer'a çevir
      const arrayBuffer = audioBuffer.buffer.slice(
        audioBuffer.byteOffset,
        audioBuffer.byteOffset + audioBuffer.byteLength
      );

      const result = await this.sendMessage('recognize', { audioBuffer: Array.from(new Uint8Array(arrayBuffer)) });
      
      if (result) {
        return {
          text: result.text || '',
          isFinal: result.isFinal || false
        };
      }
      
      return { text: '', isFinal: false };
    } catch (error) {
      console.error('Error during Vosk recognition:', error);
      throw error;
    }
  }

  getFinalResult(): string {
    if (!this.isInitialized || !this.worker) {
      return '';
    }

    try {
      // Async olmayan bir metod, ama worker async olduğu için Promise kullanmalıyız
      // Bu durumda sync bir wrapper yapabiliriz veya async yapabiliriz
      // Şimdilik boş string döndürelim, gerekirse async yapabiliriz
      return '';
    } catch (error) {
      console.error('Error getting final result:', error);
      return '';
    }
  }

  async getFinalResultAsync(): Promise<string> {
    if (!this.isInitialized || !this.worker) {
      return '';
    }

    try {
      const result = await this.sendMessage('getFinalResult');
      return result?.text || '';
    } catch (error) {
      console.error('Error getting final result:', error);
      return '';
    }
  }

  async reset(): Promise<void> {
    if (this.worker) {
      await this.sendMessage('reset');
    }
  }

  isReady(): boolean {
    return this.isInitialized && this.worker !== null;
  }

  async isReadyAsync(): Promise<boolean> {
    if (!this.worker) {
      return false;
    }

    try {
      const result = await this.sendMessage('isReady');
      return result?.ready || false;
    } catch (error) {
      return false;
    }
  }

  cleanup(): void {
    if (this.worker) {
      // Worker'a cleanup mesajı gönder
      this.sendMessage('cleanup').catch(() => {
        // Worker zaten kapanmış olabilir
      });

      // Worker'ı kapat
      setTimeout(() => {
        if (this.worker) {
          this.worker.kill();
          this.worker = null;
        }
      }, 1000);
    }

    this.isInitialized = false;
    this.modelPath = null;
    this.pendingCallbacks.clear();
  }
}
