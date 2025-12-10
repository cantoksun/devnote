export interface SpeechRecognitionCallbacks {
  onResult: (text: string, isFinal: boolean) => void;
  onError: (error: Error) => void;
  onStart: () => void;
  onEnd: () => void;
}

export class SpeechRecognitionService {
  private recognition: any | null = null;
  private isListening = false;
  private currentLanguage = 'tr-TR';
  private retryCount = 0;
  private maxRetries = 2;
  private startTimeout: NodeJS.Timeout | null = null;
  private currentCallbacks: SpeechRecognitionCallbacks | null = null;

  constructor(language: string = 'tr-TR') {
    console.log('🔧 SpeechRecognitionService constructor called with language:', language);
    this.currentLanguage = language;
    this.initializeRecognition();
    console.log('🔧 SpeechRecognitionService constructor completed');
  }

  private initializeRecognition(): void {
    if (typeof window !== 'undefined') {
      // Detaylı ortam bilgileri - Console'u grupla
      console.group('🔍 Web Speech API Environment Check');
      console.log('User Agent:', navigator.userAgent);
      console.log('Platform:', navigator.platform);
      console.log('Vendor:', navigator.vendor);
      console.log('Is Electron:', !!(window as any).process?.type);
      console.log('Window properties:', {
        SpeechRecognition: !!(window as any).SpeechRecognition,
        webkitSpeechRecognition: !!(window as any).webkitSpeechRecognition,
        chrome: !!(window as any).chrome,
        electron: !!(window as any).electron
      });
      
      // Network durumu kontrolü
      if ('onLine' in navigator) {
        console.log('Online status:', navigator.onLine ? '✅ Online' : '❌ Offline');
      } else {
        console.warn('⚠️ navigator.onLine not available');
      }
      
      const SpeechRecognition = (window as any).SpeechRecognition || 
                                (window as any).webkitSpeechRecognition;
      
      console.log('SpeechRecognition class found:', !!SpeechRecognition);
      
      if (SpeechRecognition) {
        try {
          console.log('Creating SpeechRecognition instance...');
          this.recognition = new SpeechRecognition();
          this.recognition.continuous = false;
          this.recognition.interimResults = true;
          this.recognition.lang = this.currentLanguage;
          
          // Web Speech API için service URI ayarı (bazı tarayıcılarda çalışabilir)
          try {
            // Chrome'un varsayılan Web Speech API endpoint'ini kullan
            if (this.recognition.serviceURI !== undefined) {
              // serviceURI ayarlanabilirse ayarla (bazı implementasyonlarda çalışmayabilir)
              console.log('Service URI available, using default');
            }
          } catch (e) {
            console.warn('Could not set serviceURI:', e);
          }
          
          // Recognition objesinin özelliklerini logla
          console.log('✅ SpeechRecognition object created successfully');
          console.log('SpeechRecognition object properties:', {
            continuous: this.recognition.continuous,
            interimResults: this.recognition.interimResults,
            lang: this.recognition.lang,
            serviceURI: this.recognition.serviceURI || 'default',
            grammars: this.recognition.grammars,
            maxAlternatives: this.recognition.maxAlternatives || 1
          });
          
          // Electron'da Web Speech API için ek ayarlar
          // Google'ın servislerine erişim için
          if ((window as any).webkitSpeechRecognition) {
            // Chrome/Chromium tabanlı tarayıcılar için
            console.log('✅ Web Speech API initialized with language:', this.currentLanguage);
          }
          
          // Handler'ları bir kez kur (initializeRecognition'da)
          // Not: Callbacks start() metodunda set edilecek
          this.setupRecognitionHandlersPlaceholder();
          
          console.groupEnd();
        } catch (error: any) {
          console.error('❌ Failed to initialize speech recognition:', error);
          console.error('Error details:', {
            name: error?.name,
            message: error?.message,
            stack: error?.stack,
            fullError: error
          });
          console.groupEnd();
          this.recognition = null;
        }
      } else {
        console.error('❌ Speech Recognition API not available. Web Speech API may not be supported in Electron.');
        console.warn('Available window properties:', Object.keys(window).filter(key => 
          key.toLowerCase().includes('speech') || 
          key.toLowerCase().includes('recognition') ||
          key.toLowerCase().includes('webkit')
        ));
        console.groupEnd();
      }
    }
  }

  setLanguage(language: string): void {
    this.currentLanguage = language;
    if (this.recognition) {
      this.recognition.lang = language;
    }
  }

  start(callbacks: SpeechRecognitionCallbacks): void {
    if (!this.recognition) {
      callbacks.onError(new Error('Speech recognition not supported in this browser'));
      return;
    }

    if (this.isListening) {
      this.stop();
    }

    // Callbacks'i sakla (retry için gerekli)
    this.currentCallbacks = callbacks;
    this.retryCount = 0; // Retry sayacını sıfırla

    // Handler'lar zaten initializeRecognition'da kuruldu
    // Sadece start'ı çağır
    this.attemptStart();
  }

  private attemptStart(): void {
    if (!this.recognition || !this.currentCallbacks) {
      return;
    }

    // Önceki timeout'u temizle
    if (this.startTimeout) {
      clearTimeout(this.startTimeout);
      this.startTimeout = null;
    }

    // Timeout ekle - eğer 5 saniye içinde başlamazsa retry yap
    this.startTimeout = setTimeout(() => {
      if (!this.isListening && this.retryCount < this.maxRetries) {
        this.retryCount++;
        console.warn(`Web Speech API start timeout, retrying (${this.retryCount}/${this.maxRetries})...`);
        this.attemptStart();
      }
    }, 5000);

    try {
      console.log(`🎤 Starting Web Speech API (attempt ${this.retryCount + 1}/${this.maxRetries + 1})...`);
      this.recognition.start();
    } catch (error: any) {
      console.error('Error starting recognition:', error);
      if (this.startTimeout) {
        clearTimeout(this.startTimeout);
        this.startTimeout = null;
      }
      if (this.retryCount < this.maxRetries) {
        this.retryCount++;
        console.warn(`Retrying Web Speech API start (${this.retryCount}/${this.maxRetries})...`);
        setTimeout(() => this.attemptStart(), 1000);
      } else {
        if (this.currentCallbacks) {
          this.currentCallbacks.onError(new Error(`Failed to start speech recognition after ${this.maxRetries + 1} attempts: ${error.message}`));
        }
      }
    }
  }

  private setupRecognitionHandlersPlaceholder(): void {
    if (!this.recognition) return;

    // Handler'ları kur (callbacks start() metodunda set edilecek)
    this.recognition.onstart = () => {
      if (this.startTimeout) {
        clearTimeout(this.startTimeout);
        this.startTimeout = null;
      }
      this.isListening = true;
      this.retryCount = 0; // Başarılı oldu, retry sayacını sıfırla
      console.log('✅ Web Speech API started successfully');
      if (this.currentCallbacks) {
        this.currentCallbacks.onStart();
      }
    };

    this.recognition.onresult = (event: any) => {
      if (!this.currentCallbacks) return;
      
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript + ' ';
        } else {
          interimTranscript += transcript;
        }
      }

      const fullTranscript = finalTranscript || interimTranscript;
      this.currentCallbacks.onResult(fullTranscript.trim(), finalTranscript.length > 0);
    };

    this.recognition.onerror = (event: any) => {
      if (!this.currentCallbacks) return;
      
      let errorMessage = 'Speech recognition error';
      const errorType = event.error || 'unknown';
      
      // Çok detaylı hata loglama - Console'u grupla
      console.group('❌ Speech Recognition Error Details');
      console.error('Error Type:', errorType);
      console.error('Error Message:', event.message || 'No message');
      console.error('Time Stamp:', event.timeStamp);
      console.error('Event Type:', event.type);
      console.error('Event Bubbles:', event.bubbles);
      console.error('Event Cancelable:', event.cancelable);
      console.error('Event Default Prevented:', event.defaultPrevented);
      
      // Event objesinin tüm özelliklerini logla
      console.error('Full Event Object:', {
        error: event.error,
        message: event.message,
        timeStamp: event.timeStamp,
        type: event.type,
        target: event.target,
        currentTarget: event.currentTarget,
        bubbles: event.bubbles,
        cancelable: event.cancelable,
        defaultPrevented: event.defaultPrevented,
        eventPhase: event.eventPhase,
        isTrusted: event.isTrusted,
        allProperties: Object.keys(event)
      });
      
      // Recognition objesinin mevcut durumunu logla
      if (this.recognition) {
        console.error('Recognition Object State:', {
          lang: this.recognition.lang,
          continuous: this.recognition.continuous,
          interimResults: this.recognition.interimResults,
          serviceURI: this.recognition.serviceURI,
          grammars: this.recognition.grammars,
          maxAlternatives: this.recognition.maxAlternatives
        });
      }
      
      // Network durumu kontrolü
      if ('onLine' in navigator) {
        console.error('Network Status:', navigator.onLine ? 'Online' : 'Offline');
      }
      
      // Electron ortam bilgileri
      console.error('Environment Info:', {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        vendor: navigator.vendor,
        isElectron: !!(window as any).electronAPI || !!(window as any).process?.type || !!(window as any).__ELECTRON__,
        electronVersion: (window as any).process?.versions?.electron,
        chromeVersion: (window as any).process?.versions?.chrome,
        hasElectronAPI: !!(window as any).electronAPI
      });
      
      console.groupEnd();
      
      if (errorType === 'no-speech') {
        errorMessage = 'No speech detected. Please try again.';
        callbacks.onEnd();
        return;
      } else if (errorType === 'audio-capture') {
        errorMessage = 'No microphone found. Please check your microphone connection and permissions.';
      } else if (errorType === 'not-allowed') {
        errorMessage = 'Microphone permission denied. Please allow microphone access in your system settings.';
      } else if (errorType === 'network') {
        // Network hatası - Retry mekanizması ile tekrar dene
        console.warn('Web Speech API network error detected');
        console.warn('Possible causes:');
        console.warn('1. Temporary network connectivity issue');
        console.warn('2. Google API endpoint temporarily unavailable');
        console.warn('3. Firewall or proxy blocking requests');
        console.warn('4. CORS or security policy restrictions');
        console.warn('5. Google blocking Electron user agents');
        
        // Network hatası durumunda retry yap
        if (this.retryCount < this.maxRetries) {
          this.retryCount++;
          console.warn(`🔄 Retrying Web Speech API after network error (${this.retryCount}/${this.maxRetries})...`);
          this.isListening = false;
          
          // Kısa bir bekleme sonrası tekrar dene
          setTimeout(() => {
            if (this.recognition && this.currentCallbacks) {
              try {
                this.recognition.stop();
              } catch (e) {
                // Ignore stop errors
              }
              this.attemptStart();
            }
          }, 2000);
          return; // Hata callback'ini çağırma, retry yapıyoruz
        } else {
          errorMessage = 'Web Speech API network error. This may be a temporary issue. Please check your internet connection and try again. If the problem persists, this is a known limitation of Web Speech API in Electron.';
          console.warn('Note: Web Speech API may not work reliably in Electron due to Google service restrictions.');
        }
      } else if (errorType === 'aborted') {
        callbacks.onEnd();
        return;
      } else if (errorType === 'service-not-allowed') {
        errorMessage = 'Speech recognition service not allowed. This may be an Electron limitation. Web Speech API may not be fully supported.';
        console.warn('Service not allowed - Google Speech API may be blocking Electron requests');
      } else if (errorType === 'bad-grammar') {
        errorMessage = 'Speech recognition grammar error.';
      } else if (errorType === 'language-not-supported') {
        errorMessage = 'Language not supported. Please check your language settings.';
      } else if (errorType) {
        errorMessage = `Speech recognition error: ${errorType}. This may be an Electron limitation. Web Speech API may not work properly in Electron applications.`;
      } else {
        errorMessage = 'Unknown speech recognition error. Web Speech API may not be fully supported in Electron.';
      }

      callbacks.onError(new Error(errorMessage));
      this.isListening = false;
    };

    this.recognition.onend = () => {
      if (startTimeout) {
        clearTimeout(startTimeout);
        startTimeout = null;
      }
      this.isListening = false;
      if (this.currentCallbacks) {
        this.currentCallbacks.onEnd();
      }
    };
  }
  
  stop(): void {
    if (this.startTimeout) {
      clearTimeout(this.startTimeout);
      this.startTimeout = null;
    }
    if (this.recognition && this.isListening) {
      try {
        this.recognition.stop();
      } catch (error) {
        // Ignore errors when stopping
      }
      this.isListening = false;
    }
    this.retryCount = 0;
    this.currentCallbacks = null;
  }

  // Eski try-catch bloğu kaldırıldı - attemptStart() kullanılıyor
  /*
  try {
      console.group('🚀 Starting Speech Recognition');
      console.log('Recognition state before start:', {
        isListening: this.isListening,
        lang: this.recognition.lang,
        continuous: this.recognition.continuous,
        interimResults: this.recognition.interimResults
      });
      
      this.recognition.start();
      console.log('✅ Speech recognition started successfully');
      console.groupEnd();
    } catch (error: any) {
      console.group('❌ Failed to Start Speech Recognition');
      console.error('Error Name:', error?.name);
      console.error('Error Message:', error?.message);
      console.error('Error Stack:', error?.stack);
      console.error('Full Error Object:', {
        name: error?.name,
        message: error?.message,
        stack: error?.stack,
        code: error?.code,
        errno: error?.errno,
        syscall: error?.syscall,
        allProperties: Object.keys(error || {})
      });
      console.error('Recognition state at error:', {
        isListening: this.isListening,
        recognitionExists: !!this.recognition,
        lang: this.recognition?.lang,
        continuous: this.recognition?.continuous
      });
      console.groupEnd();
      
      const errorMessage = error?.message || 'Failed to start speech recognition. This may be an Electron limitation.';
      callbacks.onError(new Error(errorMessage));
      this.isListening = false;
    }
  */

  isAvailable(): boolean {
    return this.recognition !== null;
  }

  getIsListening(): boolean {
    return this.isListening;
  }
}

