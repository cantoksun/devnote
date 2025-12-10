import { SpeechRecognitionCallbacks } from './SpeechRecognitionService';

export class VoskRecognitionService {
  private isListening = false;
  private audioContext: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private recognitionInterval: number | null = null;
  private callbacks: SpeechRecognitionCallbacks | null = null;
  private scriptProcessor: ScriptProcessorNode | null = null;
  private accumulatedText: string = ''; // Biriktirilmiş metin
  private lastPartialText: string = ''; // Son partial result

  async start(callbacks: SpeechRecognitionCallbacks, modelPath: string): Promise<void> {
    if (this.isListening) {
      this.stop();
    }

    this.callbacks = callbacks;
    this.accumulatedText = ''; // Yeni başlangıç için temizle
    this.lastPartialText = '';

    try {
      // Vosk servisinin hazır olup olmadığını kontrol et
      if (!window.electronAPI) {
        throw new Error('Electron API not available');
      }

      console.log('🔍 Checking Vosk service readiness...');
      let isReady = await window.electronAPI.voskIsReady();
      console.log('🔍 Vosk service isReady result:', isReady);
      
      if (!isReady) {
        // Vosk'u başlat
        console.log('🚀 Initializing Vosk with model path:', modelPath);
        const initialized = await window.electronAPI.voskInitialize(modelPath);
        console.log('🚀 Vosk initialize result:', initialized);
        
        // Initialize başarılı olsa bile, tekrar kontrol et
        await new Promise(resolve => setTimeout(resolve, 500)); // Worker'ın hazır olması için bekle
        isReady = await window.electronAPI.voskIsReady();
        console.log('🔍 Vosk service isReady after init:', isReady);
        
        if (!isReady && !initialized) {
          throw new Error('Failed to initialize Vosk service');
        }
        
        // Initialize başarılıysa devam et (isReady false olsa bile)
        if (initialized) {
          console.log('✅ Vosk initialized, continuing despite isReady check');
          isReady = true; // Force continue
        }
      } else {
        console.log('✅ Vosk service is already ready');
      }
      
      if (!isReady) {
        throw new Error('Vosk service is not ready');
      }

      // Mikrofon erişimi al
      this.stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true
        }
      });

      // AudioContext oluştur
      this.audioContext = new AudioContext({ sampleRate: 16000 });
      const source = this.audioContext.createMediaStreamSource(this.stream);
      
      // ScriptProcessorNode kullanarak PCM audio al
      // Vosk 16kHz mono PCM bekliyor
      const bufferSize = 4096;
      const scriptProcessor = this.audioContext!.createScriptProcessor(bufferSize, 1, 1);
      
      scriptProcessor.onaudioprocess = async (event) => {
        if (!this.isListening) return;
        
        const inputBuffer = event.inputBuffer;
        const inputData = inputBuffer.getChannelData(0); // Mono channel
        
        // Float32Array'ı Int16Array'a çevir (Vosk PCM bekliyor)
        const pcmData = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          // Float32 (-1.0 to 1.0) -> Int16 (-32768 to 32767)
          const s = Math.max(-1, Math.min(1, inputData[i]));
          pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }
        
        // PCM verisini Buffer olarak gönder
        try {
          const result = await window.electronAPI.voskRecognize(pcmData.buffer);
          
          if (result && result.text) {
            if (result.isFinal) {
              // Final result: Biriktirilmiş metni final result ile birleştir
              const finalText = this.accumulatedText + (this.accumulatedText ? ' ' : '') + result.text.trim();
              this.accumulatedText = finalText; // Final result'ı biriktir
              this.lastPartialText = ''; // Partial text'i temizle
              
              console.log('🎤 Vosk final result:', finalText);
              if (this.callbacks) {
                this.callbacks.onResult(finalText, true);
              }
            } else {
              // Partial result: Biriktirilmiş metin + yeni partial result
              const partialText = this.accumulatedText + (this.accumulatedText ? ' ' : '') + result.text.trim();
              this.lastPartialText = result.text.trim();
              
              console.log('🎤 Vosk partial result:', partialText);
              if (this.callbacks) {
                this.callbacks.onResult(partialText, false);
              }
            }
          }
        } catch (error) {
          console.error('Vosk recognition error:', error);
          if (this.callbacks) {
            this.callbacks.onError(error as Error);
          }
        }
      };
      
      source.connect(scriptProcessor);
      scriptProcessor.connect(this.audioContext!.destination);
      
      // ScriptProcessorNode'u sakla (cleanup için)
      this.scriptProcessor = scriptProcessor;

      // Kaydı başlat
      this.isListening = true;
      
      if (this.callbacks) {
        this.callbacks.onStart();
      }

      console.log('Vosk recognition started');
    } catch (error) {
      console.error('Error starting Vosk recognition:', error);
      if (this.callbacks) {
        this.callbacks.onError(error as Error);
      }
      this.isListening = false;
    }
  }

  stop(): void {
    this.isListening = false;
    
    // ScriptProcessorNode'u disconnect et
    if (this.scriptProcessor) {
      this.scriptProcessor.disconnect();
      this.scriptProcessor = null;
    }

    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    if (this.recognitionInterval) {
      clearInterval(this.recognitionInterval);
      this.recognitionInterval = null;
    }
    
    // Final result'ı al (eğer biriktirilmiş metin varsa)
    if (window.electronAPI) {
      window.electronAPI.voskGetFinalResult().then((finalText: string) => {
        // Son partial result'ı final result ile birleştir
        if (finalText && finalText.trim()) {
          const completeText = this.accumulatedText + (this.accumulatedText ? ' ' : '') + finalText.trim();
          this.accumulatedText = completeText;
          
          if (this.callbacks) {
            console.log('🎤 Vosk final result on stop:', completeText);
            this.callbacks.onResult(completeText, true);
          }
        } else if (this.accumulatedText && this.callbacks) {
          // Sadece biriktirilmiş metin varsa onu gönder
          console.log('🎤 Vosk accumulated text on stop:', this.accumulatedText);
          this.callbacks.onResult(this.accumulatedText, true);
        }
      }).catch((error: Error) => {
        console.error('Error getting final result:', error);
        // Hata olsa bile biriktirilmiş metni gönder
        if (this.accumulatedText && this.callbacks) {
          this.callbacks.onResult(this.accumulatedText, true);
        }
      }).finally(() => {
        // Reset Vosk recognizer
        window.electronAPI.voskReset().catch((error: Error) => {
          console.error('Error resetting Vosk:', error);
        });
        
        // State'i temizle
        this.accumulatedText = '';
        this.lastPartialText = '';
        
        if (this.callbacks) {
          this.callbacks.onEnd();
        }
      });
    } else {
      // Electron API yoksa biriktirilmiş metni gönder
      if (this.accumulatedText && this.callbacks) {
        this.callbacks.onResult(this.accumulatedText, true);
      }
      
      this.accumulatedText = '';
      this.lastPartialText = '';
      
      if (this.callbacks) {
        this.callbacks.onEnd();
      }
    }

    console.log('Vosk recognition stopped');
  }

  getIsListening(): boolean {
    return this.isListening;
  }
}

