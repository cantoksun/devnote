import React, { useState, useEffect, useRef, useMemo } from 'react';
import { TextBox } from './components/TextBox';
import { MicrophoneButton } from './components/MicrophoneButton';
import { SendButton } from './components/SendButton';
import { SettingsMenu } from './components/SettingsMenu';
import { ThemeProvider } from './components/ThemeProvider';
import { SpeechRecognitionService } from './services/speech/SpeechRecognitionService';
import { VoskRecognitionService } from './services/speech/VoskRecognitionService';
import { AIManager } from './services/ai/AIManager';
import { NotesManager } from './services/storage/NotesManager';
import { useSettings } from './hooks/useSettings';
import { getTranslation } from './locales';
import './App.css';

export const App: React.FC = () => {
  const [text, setText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDraggingWindow, setIsDraggingWindow] = useState(false);

  const { settings, loading: settingsLoading, reloadSettings } = useSettings();
  const speechServiceRef = useRef<SpeechRecognitionService | null>(null);
  const voskServiceRef = useRef<VoskRecognitionService | null>(null);
  const aiManagerRef = useRef<AIManager | null>(null);
  const notesManagerRef = useRef<NotesManager | null>(null);
  const isDraggingRef = useRef(false);
  const dragStartPosRef = useRef<{ x: number; y: number } | null>(null);
  const windowStartPosRef = useRef<{ x: number; y: number } | null>(null);
  const hasMovedRef = useRef(false);
  
  // Dil değiştiğinde çevirileri güncelle
  const translations = useMemo(() => {
    return getTranslation((settings.language || 'tr') as 'tr' | 'en');
  }, [settings.language]);


  // Servisleri başlat
  useEffect(() => {
    if (settingsLoading) return; // Settings yüklenene kadar bekle
    
    console.group('🚀 Initializing Services');
    console.log('Settings loaded:', !settingsLoading);
    console.log('Language:', settings.language);
    
    const language = settings.language === 'tr' ? 'tr-TR' : 'en-US';
    const provider = settings.speechRecognitionProvider || 'web-speech';
    
    console.log('Speech recognition provider:', provider);
    
    // Her iki servisi de hazır tut (fallback için)
    
    if (provider === 'vosk') {
      console.log('Creating VoskRecognitionService');
      try {
        voskServiceRef.current = new VoskRecognitionService();
        console.log('✅ VoskRecognitionService created:', !!voskServiceRef.current);
      } catch (error: any) {
        console.error('❌ Failed to create VoskRecognitionService:', error);
      }
      
      // Web Speech API'yi de hazır tut (fallback için)
      if (!speechServiceRef.current) {
        console.log('Creating SpeechRecognitionService as fallback with language:', language);
        try {
          speechServiceRef.current = new SpeechRecognitionService(language);
          console.log('✅ SpeechRecognitionService created as fallback:', !!speechServiceRef.current);
          console.log('Speech service available:', speechServiceRef.current?.isAvailable() ? '✅' : '❌');
        } catch (error: any) {
          console.error('❌ Failed to create SpeechRecognitionService as fallback:', error);
        }
      }
    } else {
      console.log('Creating SpeechRecognitionService with language:', language);
      try {
        speechServiceRef.current = new SpeechRecognitionService(language);
        console.log('✅ SpeechRecognitionService created:', !!speechServiceRef.current);
        console.log('Speech service available:', speechServiceRef.current?.isAvailable() ? '✅' : '❌');
      } catch (error: any) {
        console.error('❌ Failed to create SpeechRecognitionService:', error);
        console.error('Error details:', {
          name: error?.name,
          message: error?.message,
          stack: error?.stack
        });
      }
      voskServiceRef.current = null;
    }
    
    aiManagerRef.current = new AIManager(
      settings.openAIApiKey,
      settings.openAIModel,
      settings.claudeApiKey,
      settings.claudeModel,
      settings.geminiApiKey,
      settings.geminiModel
    );
    console.log('✅ AIManager created');
    
    const notesFolder = settings.notesFolder || '';
    notesManagerRef.current = new NotesManager(notesFolder, settings.autoSaveNotes);
    console.log('✅ NotesManager created');
    console.groupEnd();
  }, [settings, settingsLoading]);

  // OpenAI API key değiştiğinde AI Manager'ı güncelle
  useEffect(() => {
    if (aiManagerRef.current && settings.openAIApiKey) {
      aiManagerRef.current.updateOpenAIApiKey(settings.openAIApiKey);
    }
  }, [settings.openAIApiKey]);

  // OpenAI model değiştiğinde AI Manager'ı güncelle
  useEffect(() => {
    if (aiManagerRef.current && settings.openAIModel) {
      aiManagerRef.current.updateOpenAIModel(settings.openAIModel);
    }
  }, [settings.openAIModel]);

  // Claude API key değiştiğinde AI Manager'ı güncelle
  useEffect(() => {
    if (aiManagerRef.current && settings.claudeApiKey) {
      aiManagerRef.current.updateClaudeApiKey(settings.claudeApiKey);
    }
  }, [settings.claudeApiKey]);

  // Claude model değiştiğinde AI Manager'ı güncelle
  useEffect(() => {
    if (aiManagerRef.current && settings.claudeModel) {
      aiManagerRef.current.updateClaudeModel(settings.claudeModel);
    }
  }, [settings.claudeModel]);

  // Gemini API key değiştiğinde AI Manager'ı güncelle
  useEffect(() => {
    if (aiManagerRef.current && settings.geminiApiKey) {
      aiManagerRef.current.updateGeminiApiKey(settings.geminiApiKey);
    }
  }, [settings.geminiApiKey]);

  // Gemini model değiştiğinde AI Manager'ı güncelle
  useEffect(() => {
    if (aiManagerRef.current && settings.geminiModel) {
      aiManagerRef.current.updateGeminiModel(settings.geminiModel);
    }
  }, [settings.geminiModel]);

  // AI provider değiştiğinde AI Manager'ı güncelle
  useEffect(() => {
    if (aiManagerRef.current && settings.selectedAI) {
      try {
        aiManagerRef.current.setCurrentProvider(settings.selectedAI);
        console.log('✅ AI Provider changed to:', settings.selectedAI);
      } catch (error) {
        console.error('❌ Failed to set AI provider:', error);
      }
    }
  }, [settings.selectedAI]);

  const startWebSpeechAPI = async () => {
    const speechService = speechServiceRef.current;
    if (!speechService) {
      // Speech service yoksa oluştur
      const language = settings.language === 'tr' ? 'tr-TR' : 'en-US';
      try {
        speechServiceRef.current = new SpeechRecognitionService(language);
        console.log('✅ SpeechRecognitionService created for fallback');
      } catch (error: any) {
        console.error('❌ Failed to create SpeechRecognitionService for fallback:', error);
        setError('Speech recognition is not available. Please check your settings.');
        return;
      }
    }

    const service = speechServiceRef.current || speechService;
    if (!service || !service.isAvailable()) {
      setError('Web Speech API is not available in this environment.');
      return;
    }

    // Mikrofon iznini kontrol et
    if (window.electronAPI) {
      try {
        const permissionStatus = await window.electronAPI.checkMicrophonePermission();
        if (!permissionStatus.granted) {
          const requested = await window.electronAPI.requestMicrophonePermission();
          if (!requested) {
            setError('Please enable microphone access in Windows Settings > Privacy > Microphone, then try again.');
            return;
          }
        }
      } catch (err) {
        console.error('Error checking microphone permission:', err);
      }
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
    } catch (err: any) {
      const errorMessage = err?.message || 'Microphone permission denied';
      if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError') {
        setError('Microphone permission denied. Please allow microphone access.');
      } else {
        setError(`Microphone error: ${errorMessage}`);
      }
      return;
    }

    setError(null);
    console.group('🎙️ Starting Web Speech API (Fallback)');
    
    service.start({
      onResult: (transcript, isFinal) => {
        console.log('Speech result:', { transcript, isFinal });
        if (isFinal) {
          setText(transcript);
        } else {
          setText(transcript);
        }
      },
      onError: (error) => {
        console.error('Speech recognition error:', error);
        setError(error.message);
        setIsListening(false);
      },
      onStart: () => {
        console.log('✅ Web Speech API Started (Fallback)');
        setIsListening(true);
        setError(null);
      },
      onEnd: () => {
        console.log('⏹️ Web Speech API Ended');
        setIsListening(false);
      }
    });
    
    console.groupEnd();
  };

  const handleMicrophoneClick = async () => {
    const provider = settings.speechRecognitionProvider || 'web-speech';
    
    if (provider === 'vosk') {
      const voskService = voskServiceRef.current;
      if (!voskService) {
        setError('Vosk service is not available. Please check your Vosk model settings.');
        return;
      }

      if (!settings.voskEnabled || !settings.voskModelPath) {
        setError('Vosk is not enabled or model path is not set. Please configure Vosk in settings.');
        return;
      }

      if (isListening) {
        voskService.stop();
        setIsListening(false);
      } else {
        // Mikrofon iznini kontrol et
        if (window.electronAPI) {
          try {
            const permissionStatus = await window.electronAPI.checkMicrophonePermission();
            if (!permissionStatus.granted) {
              setError('Microphone permission not granted. Please allow microphone access in your system settings.');
              return;
            }
          } catch (err) {
            console.error('Error checking microphone permission:', err);
          }
        }

        setError(null);
        console.group('🎙️ Starting Vosk Speech Recognition');
        
        try {
          await voskService.start({
            onResult: (transcript, isFinal) => {
              console.log('Vosk result:', { transcript, isFinal });
              if (isFinal) {
                setText(transcript);
              } else {
                setText(transcript);
              }
            },
            onError: (error) => {
              console.error('Vosk recognition error:', error);
              
              // Vosk hatası durumunda Web Speech API'ye otomatik geçiş
              const errorMessage = error.message || '';
              if (errorMessage.includes('Failed to initialize') || 
                  errorMessage.includes('not available') ||
                  errorMessage.includes('native module') ||
                  errorMessage.includes('native callback') ||
                  errorMessage.includes('Error in native')) {
                console.warn('Vosk failed due to native module error, falling back to Web Speech API');
                setError('Vosk native module is not compatible. Switching to Web Speech API...');
                
                // Web Speech API'yi başlat
                setTimeout(() => {
                  startWebSpeechAPI();
                }, 500);
              } else {
                setError(`Vosk error: ${errorMessage}`);
                setIsListening(false);
              }
            },
            onStart: () => {
              console.log('✅ Vosk recognition started');
              setIsListening(true);
              setError(null);
            },
            onEnd: () => {
              console.log('⏹️ Vosk recognition ended');
              setIsListening(false);
            }
          }, settings.voskModelPath);
        } catch (error: any) {
          console.error('Error starting Vosk recognition:', error);
          
          // Vosk hatası durumunda Web Speech API'ye otomatik geçiş
          const errorMessage = error?.message || '';
          if (errorMessage.includes('Failed to initialize') || 
              errorMessage.includes('not available') ||
              errorMessage.includes('native module') ||
              errorMessage.includes('native callback') ||
              errorMessage.includes('Error in native')) {
            console.warn('Vosk failed due to native module error, falling back to Web Speech API');
            setError('Vosk native module is not compatible with this Electron version. Switching to Web Speech API...');
            
            // Web Speech API'yi başlat
            setTimeout(() => {
              startWebSpeechAPI();
            }, 500);
          } else {
            setError(`Vosk error: ${errorMessage}. Please check your Vosk model settings or switch to Web Speech API in Settings.`);
            setIsListening(false);
          }
        }
        
        console.groupEnd();
      }
      return;
    }

    const speechService = speechServiceRef.current;
    if (!speechService) {
      setError(translations.speechRecognitionNotAvailable);
      return;
    }

    if (isListening) {
      speechService.stop();
      setIsListening(false);
    } else {
      // Önce Electron seviyesinde mikrofon iznini kontrol et
      if (window.electronAPI) {
        try {
          const permissionStatus = await window.electronAPI.checkMicrophonePermission();
          console.log('Microphone permission status:', permissionStatus);
          
          if (!permissionStatus.granted) {
            setError('Microphone permission not granted. Please allow microphone access in your system settings.');
            // İzin iste
            const requested = await window.electronAPI.requestMicrophonePermission();
            if (!requested) {
              setError('Please enable microphone access in Windows Settings > Privacy > Microphone, then try again.');
              return;
            }
          }
        } catch (err) {
          console.error('Error checking microphone permission:', err);
        }
      }

      // Mikrofon iznini kontrol et (browser seviyesinde)
      console.group('🎤 Microphone Permission Check');
      console.log('MediaDevices available:', !!navigator.mediaDevices ? '✅' : '❌');
      console.log('getUserMedia available:', !!navigator.mediaDevices?.getUserMedia ? '✅' : '❌');
      
      try {
        console.log('Requesting microphone access...');
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        console.log('Microphone stream obtained:', {
          id: stream.id,
          active: stream.active,
          tracks: stream.getTracks().map(track => ({
            id: track.id,
            kind: track.kind,
            label: track.label,
            enabled: track.enabled,
            muted: track.muted,
            readyState: track.readyState,
            settings: track.getSettings()
          }))
        });
        
        // Stream'i hemen kapat (sadece izin kontrolü için)
        stream.getTracks().forEach(track => {
          console.log('Stopping track:', track.id);
          track.stop();
        });
        console.log('✅ Microphone permission granted (browser level)');
        console.groupEnd();
      } catch (err: any) {
        console.group('❌ Microphone Permission Error');
        console.error('Error Name:', err?.name);
        console.error('Error Message:', err?.message);
        console.error('Error Stack:', err?.stack);
        console.error('Full Error Object:', {
          name: err?.name,
          message: err?.message,
          stack: err?.stack,
          constraint: err?.constraint,
          allProperties: Object.keys(err || {})
        });
        console.error('MediaDevices state:', {
          getUserMedia: !!navigator.mediaDevices?.getUserMedia,
          enumerateDevices: !!navigator.mediaDevices?.enumerateDevices,
          getSupportedConstraints: !!navigator.mediaDevices?.getSupportedConstraints
        });
        console.groupEnd();
        
        const errorMessage = err?.message || translations.microphonePermissionDenied;
        if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError') {
          setError('Microphone permission denied. Please allow microphone access in your system settings and browser permissions.');
        } else if (err?.name === 'NotFoundError') {
          setError('No microphone found. Please check your microphone connection.');
        } else {
          setError(`Microphone error: ${errorMessage}`);
        }
        return;
      }

      setError(null);
      console.group('🎙️ Starting Speech Recognition');
      console.log('Speech service available:', speechService.isAvailable() ? '✅' : '❌');
      console.log('Speech service is listening:', speechService.getIsListening() ? '✅' : '❌');
      console.log('Current language:', speechService['currentLanguage'] || 'unknown');
      
      speechService.start({
        onResult: (transcript, isFinal) => {
          console.log('Speech result:', { transcript, isFinal });
          if (isFinal) {
            setText(transcript);
          } else {
            setText(transcript);
          }
        },
        onError: (error) => {
          console.group('❌ Speech Recognition Error in App.tsx');
          console.error('Error Name:', error?.name);
          console.error('Error Message:', error?.message);
          console.error('Error Stack:', error?.stack);
          console.error('Full Error Object:', {
            name: error?.name,
            message: error?.message,
            stack: error?.stack,
            allProperties: Object.keys(error || {})
          });
          console.groupEnd();
          
          // Tüm hata mesajlarını göster
          setError(error.message);
          setIsListening(false);
        },
        onStart: () => {
          console.log('✅ Speech Recognition Started');
          console.log('Speech service is listening:', speechService.getIsListening() ? '✅' : '❌');
          console.groupEnd();
          setIsListening(true);
          setError(null);
        },
        onEnd: () => {
          console.log('⏹️ Speech Recognition Ended');
          console.log('Speech service is listening:', speechService.getIsListening() ? '✅' : '❌');
          console.groupEnd();
          setIsListening(false);
        }
      });
    }
  };

  const handleSend = async () => {
    if (!text.trim() || isProcessing) {
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const aiManager = aiManagerRef.current;
      if (!aiManager) {
        throw new Error(translations.aiManagerNotInitialized);
      }

      const aiResponse = await aiManager.processPrompt(text);
      const fullContent = `${text}\n\n--- AI Response ---\n\n${aiResponse}`;
      setText(aiResponse);

      // Notları kaydet
      const notesManager = notesManagerRef.current;
      if (notesManager) {
        await notesManager.saveDailyNote(fullContent);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : translations.unknownError;
      setError(errorMessage);
      console.error('AI processing error:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRightClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (text && text.trim()) {
      navigator.clipboard.writeText(text).then(() => {
        // Kopyalandı feedback'i (opsiyonel)
      }).catch((err) => {
        console.error('Failed to copy text:', err);
      });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Ctrl/Cmd + Enter ile gönder
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSend();
    }
  };

  // Settings butonuna basılı tutunca pencereyi taşı
  useEffect(() => {
    let animationFrameId: number | null = null;
    let pendingMove: { deltaX: number; deltaY: number } | null = null;

    // DOM'a direkt müdahale ile drag region'ları devre dışı bırak
    const disableDragRegions = () => {
      // Tüm elementleri bul ve hemen devre dışı bırak
      const allElements = document.querySelectorAll('[style*="webkit-app-region"]');
      allElements.forEach((el) => {
        (el as HTMLElement).style.webkitAppRegion = 'no-drag';
      });
      
      // Ana container'ları da devre dışı bırak
      const appContainer = document.querySelector('.app-container');
      const appContent = document.querySelector('.app-content');
      const contentWrapper = document.querySelector('.content-wrapper');
      
      if (appContainer) {
        (appContainer as HTMLElement).style.webkitAppRegion = 'no-drag';
      }
      if (appContent) {
        (appContent as HTMLElement).style.webkitAppRegion = 'no-drag';
      }
      if (contentWrapper) {
        (contentWrapper as HTMLElement).style.webkitAppRegion = 'no-drag';
      }
    };

    const enableDragRegions = () => {
      // Sadece CSS class'larına göre geri yükle (no-drag kalacak çünkü CSS'te no-drag)
      // Bu fonksiyon artık gerekli değil çünkü CSS'te zaten no-drag
    };

    // requestAnimationFrame ile optimize edilmiş taşıma - delta kullan
    const processPendingMove = () => {
      if (pendingMove && window.electronAPI && windowStartPosRef.current) {
        // Delta kullanarak pencereyi taşı
        window.electronAPI.moveWindow(pendingMove.deltaX, pendingMove.deltaY);
        // Window pozisyonunu güncelle
        windowStartPosRef.current.x += pendingMove.deltaX;
        windowStartPosRef.current.y += pendingMove.deltaY;
        pendingMove = null;
      }
      animationFrameId = null;
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (isDraggingRef.current && dragStartPosRef.current && window.electronAPI) {
        // Drag event'lerini engelle
        e.preventDefault();
        e.stopPropagation();
        
        // Mouse'un ekrandaki mutlak pozisyonunu al
        const screenX = e.screenX;
        const screenY = e.screenY;
        
        // Delta hesapla
        const deltaX = screenX - dragStartPosRef.current.x;
        const deltaY = screenY - dragStartPosRef.current.y;
        
        // İlk hareket algılama ve pencere pozisyonunu al
        if (Math.abs(deltaX) > 1 || Math.abs(deltaY) > 1) {
          hasMovedRef.current = true;
          setIsDraggingWindow(true);
          disableDragRegions(); // Hemen devre dışı bırak
          
          // Eğer pencere pozisyonu henüz alınmadıysa, al
          if (!windowStartPosRef.current) {
            window.electronAPI.getWindowPosition().then(([windowX, windowY]) => {
              windowStartPosRef.current = { x: windowX, y: windowY };
            });
            // İlk hareket için delta'yi direkt kullan
            window.electronAPI.moveWindow(deltaX, deltaY);
            dragStartPosRef.current = { x: screenX, y: screenY };
            return;
          }
        }
        
        // Eğer pencere pozisyonu alındıysa, requestAnimationFrame ile optimize et
        if (windowStartPosRef.current) {
          pendingMove = { deltaX, deltaY };
          if (!animationFrameId) {
            animationFrameId = requestAnimationFrame(processPendingMove);
          }
          dragStartPosRef.current = { x: screenX, y: screenY };
        }
      }
    };

    const handleMouseUp = () => {
      if (isDraggingRef.current) {
        // Son pending move'u işle
        if (pendingMove && window.electronAPI && windowStartPosRef.current) {
          window.electronAPI.moveWindow(pendingMove.deltaX, pendingMove.deltaY);
          windowStartPosRef.current.x += pendingMove.deltaX;
          windowStartPosRef.current.y += pendingMove.deltaY;
          pendingMove = null;
        }
        
        if (animationFrameId) {
          cancelAnimationFrame(animationFrameId);
          animationFrameId = null;
        }
        
        // hasMovedRef'i biraz geciktirerek reset et (click event'inin çalışması için)
        const wasMoved = hasMovedRef.current;
        setTimeout(() => {
          hasMovedRef.current = false;
        }, 100);
        
        isDraggingRef.current = false;
        dragStartPosRef.current = null;
        windowStartPosRef.current = null;
        setIsDraggingWindow(false);
      }
    };

    const handleDrag = (e: DragEvent) => {
      // Tüm drag event'lerini engelle
      if (isDraggingRef.current) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
    };

    const handleDragStart = (e: DragEvent) => {
      // Drag başlamadan önce engelle
      if (isDraggingRef.current) {
        e.preventDefault();
        e.stopPropagation();
        
        // Boş bir görüntü oluştur ve drag image olarak ayarla
        const emptyImg = document.createElement('img');
        emptyImg.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAUEBAAAACwAAAAAAQABAAACAkQBADs=';
        if (e.dataTransfer) {
          e.dataTransfer.setDragImage(emptyImg, 0, 0);
          e.dataTransfer.effectAllowed = 'none';
        }
        
        return false;
      }
    };

    document.addEventListener('mousemove', handleMouseMove, { passive: false });
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('drag', handleDrag, { passive: false });
    document.addEventListener('dragstart', handleDragStart, { passive: false });

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('drag', handleDrag);
      document.removeEventListener('dragstart', handleDragStart);
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, []);

  const handleSettingsButtonMouseDown = (e: React.MouseEvent) => {
    // Sadece sol tık ile taşıma
    if (e.button === 0) {
      e.preventDefault(); // Varsayılan drag önizlemesini engelle
      e.stopPropagation(); // Event propagation'ı durdur
      
      // ÖNEMLİ: requestAnimationFrame ile hemen devre dışı bırak (önizleme oluşmadan önce)
      requestAnimationFrame(() => {
        const allElements = document.querySelectorAll('*');
        allElements.forEach((el) => {
          const htmlEl = el as HTMLElement;
          if (htmlEl.style.webkitAppRegion === 'drag') {
            htmlEl.style.webkitAppRegion = 'no-drag';
          }
        });
      });
      
      // Mouse'un ekrandaki mutlak pozisyonunu al
      const screenX = e.screenX;
      const screenY = e.screenY;
      
      // Pencere pozisyonunu al ve başlangıç pozisyonlarını kaydet
      if (window.electronAPI) {
        window.electronAPI.getWindowPosition().then(([windowX, windowY]) => {
          windowStartPosRef.current = { x: windowX, y: windowY };
        });
      }
      
      isDraggingRef.current = true;
      hasMovedRef.current = false;
      dragStartPosRef.current = { x: screenX, y: screenY };
      setIsDraggingWindow(true);
    }
  };

  const handleSettingsButtonDragStart = (e: React.DragEvent) => {
    // Drag başlamadan önce engelle
    e.preventDefault();
    e.stopPropagation();
    
    // Boş bir görüntü oluştur ve drag image olarak ayarla
    const emptyImg = document.createElement('img');
    emptyImg.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAUEBAAAACwAAAAAAQABAAACAkQBADs=';
    if (e.dataTransfer) {
      e.dataTransfer.setDragImage(emptyImg, 0, 0);
      e.dataTransfer.effectAllowed = 'none';
    }
    
    return false;
  };

  const handleSettingsButtonClick = (e: React.MouseEvent) => {
    // Eğer taşıma yapıldıysa settings'i açma
    if (hasMovedRef.current) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    setShowSettings(true);
  };


  if (settingsLoading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        backgroundColor: 'transparent',
        color: '#d4d4d4'
      }}>
        {translations.loading}
      </div>
    );
  }

  return (
    <ThemeProvider>
      <div 
        className={`app-container ${showSettings ? 'settings-open' : ''} ${isDraggingWindow ? 'dragging-window' : ''}`}
        onKeyDown={handleKeyDown}
        tabIndex={0}
      >
        <div className={`app-content ${isDraggingWindow ? 'dragging-window' : ''}`}>
          <div 
            className={`content-wrapper ${isDraggingWindow ? 'dragging-window' : ''}`}
          >
            <div className="settings-button-wrapper">
              <button 
                className="logo-button" 
                onClick={handleSettingsButtonClick}
                onMouseDown={handleSettingsButtonMouseDown}
                onDragStart={handleSettingsButtonDragStart}
                draggable={false}
                title="Settings (Hold to drag window)"
              >
                <svg 
                  width="18" 
                  height="18" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth="2" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="3"></circle>
                  <path d="M12 1v6m0 6v6M5.64 5.64l4.24 4.24m4.24 4.24l4.24 4.24M1 12h6m6 0h6M5.64 18.36l4.24-4.24m4.24-4.24l4.24-4.24"></path>
                </svg>
              </button>
            </div>
            <div className="textbox-wrapper">
              {error && (
                <div className="error-message">
                  {error}
                </div>
              )}
              {showSettings && (
                <div 
                  className="settings-overlay" 
                  onClick={() => setShowSettings(false)}
                  style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    zIndex: 998,
                    background: 'transparent'
                  }}
                />
              )}
              {showSettings && (
                <SettingsMenu 
                  isOpen={showSettings} 
                  onClose={() => setShowSettings(false)}
                  onSettingsSaved={reloadSettings}
                />
              )}
              <TextBox
                value={text}
                onChange={setText}
                onRightClick={handleRightClick}
                disabled={isProcessing}
                placeholder={translations.yourSpeechWillTypeHere}
                fontSize={settings.fontSize}
                fontFamily={settings.fontFamily}
              >
                <MicrophoneButton
                  isActive={isListening}
                  onClick={handleMicrophoneClick}
                  disabled={isProcessing}
                />
                <SendButton
                  onClick={handleSend}
                  disabled={isProcessing || !text.trim()}
                />
              </TextBox>
            </div>
          </div>
        </div>
      </div>
    </ThemeProvider>
  );
};

