import { app, BrowserWindow, ipcMain, dialog, session, WebContents, Tray, Menu, nativeImage, globalShortcut, systemPreferences } from 'electron';
import { createWindow } from './window';
import { FileManager } from './fileManager';
import Store from 'electron-store';
import { DailyNote, AppSettings } from './shared/types';
import { DEFAULT_SETTINGS, APP_VERSION } from './shared/config';
import * as path from 'path';
import * as fs from 'fs';

let mainWindow: BrowserWindow | null = null;
let fileManager: FileManager;
let tray: Tray | null = null;
let closeEventHandler: ((event: Electron.Event) => void) | null = null;
let forceQuit = false; // Quit butonuna tıklandığında true olur
let voskService: any | null = null; // VoskService - lazy loaded
const store = new Store<AppSettings>({
  defaults: DEFAULT_SETTINGS
});

// FileManager'ı başlat
function initializeFileManager() {
  const notesFolder = store.get('notesFolder') as string;
  fileManager = new FileManager(notesFolder || undefined);
}

// Helper function to setup minimize to tray handlers
// Handler zaten pencere oluşturulurken kaydedildi, sadece tray'i ayarla
function setupMinimizeToTray(shouldMinimizeToTray: boolean) {
  if (!mainWindow) {
    console.log('setupMinimizeToTray: mainWindow is null, returning');
    return;
  }
  
  console.log('=== setupMinimizeToTray called ===');
  console.log('shouldMinimizeToTray:', shouldMinimizeToTray);
  console.log('setupMinimizeToTray: Current close listener count:', mainWindow.listenerCount('close'));
  
  // Handler'ı KALDIRMA! Handler zaten pencere oluşturulurken kaydedildi
  // Sadece tray'i ayarla
  
  // Tray'i her zaman oluştur (minimizeToTray açık veya kapalı)
  // Bu şekilde Quit butonu her zaman kullanılabilir
  if (!tray) {
    console.log('Tray does not exist, creating tray...');
    createTray();
    if (tray) {
      console.log('✓ Tray created successfully, tray exists:', !!tray);
    } else {
      console.error('✗ Tray creation FAILED!');
    }
  } else {
    console.log('✓ Tray already exists');
  }
  
  if (shouldMinimizeToTray) {
    console.log('Minimize to tray ENABLED');
  } else {
    console.log('Minimize to tray DISABLED (but tray remains for Quit button)');
  }
  
  // Handler zaten pencere oluşturulurken kaydedildi
  // Handler'ı kontrol et
  const listenerCount = mainWindow.listenerCount('close');
  console.log('setupMinimizeToTray: Close listener count after tray setup:', listenerCount);
  
  if (listenerCount === 0) {
    console.error('CRITICAL ERROR: Close event handler is missing! Re-registering...');
    // Handler kaybolmuş, yeniden kaydet
    if (mainWindow && !mainWindow.isDestroyed()) {
      closeEventHandler = (event: Electron.Event) => {
        console.log('========================================');
        console.log('=== WINDOW CLOSE EVENT TRIGGERED ===');
        console.log('========================================');
        console.log('Close event: event defaultPrevented:', event.defaultPrevented);
        
        // Settings'i her zaman store'dan oku (güncel değeri al)
        const currentSettings = store.store as AppSettings;
        const currentMinimizeToTray = currentSettings.minimizeToTray === true;
        console.log('Close event: minimizeToTray setting:', currentMinimizeToTray, 'raw:', currentSettings.minimizeToTray);
        console.log('Close event: mainWindow exists:', !!mainWindow);
        console.log('Close event: mainWindow isDestroyed:', mainWindow ? mainWindow.isDestroyed() : 'N/A');
        console.log('Close event: mainWindow isVisible:', mainWindow ? mainWindow.isVisible() : 'N/A');
        
        if (currentMinimizeToTray) {
          console.log('→ minimizeToTray is TRUE - Preventing close, hiding window to tray');
          event.preventDefault();
          console.log('→ preventDefault() called, event.defaultPrevented:', event.defaultPrevented);
          if (mainWindow && !mainWindow.isDestroyed()) {
            // Tray yoksa oluştur
            if (!tray) {
              console.log('→ Tray not found, creating...');
              createTray();
            }
            console.log('→ Hiding window...');
            mainWindow.hide();
            console.log('→ Window hidden to tray, isVisible:', mainWindow.isVisible());
          }
        } else {
          console.log('→ minimizeToTray is FALSE - Allowing close (NOT calling preventDefault)');
          console.log('→ Window should close normally');
          console.log('→ NOT calling preventDefault(), event.defaultPrevented:', event.defaultPrevented);
          // event.preventDefault() çağrılmıyor, bu yüzden pencere kapanacak
          // Electron'un kendi davranışı devreye girecek
        }
        console.log('=== WINDOW CLOSE EVENT HANDLER FINISHED ===');
        console.log('========================================');
      };
      
      mainWindow.on('close', closeEventHandler);
      console.log('✓ Close event handler re-registered');
      const newCount = mainWindow.listenerCount('close');
      console.log('Close listener count after re-registration:', newCount);
    }
  } else {
    console.log('✓ Close event handler is still registered');
  }
  
  console.log('=== setupMinimizeToTray finished ===');
}

// IPC Handlers
function setupIpcHandlers() {
  // Notes handlers
  ipcMain.handle('save-daily-note', async (event, note: DailyNote) => {
    const autoSave = store.get('autoSaveNotes') as boolean;
    if (!autoSave) {
      return { success: false, error: 'Auto-save is disabled' };
    }
    return fileManager.saveDailyNote(note);
  });

  ipcMain.handle('load-daily-note', async (event, date: string) => {
    return fileManager.loadDailyNote(date);
  });

  ipcMain.handle('select-notes-folder', async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      properties: ['openDirectory'],
      title: 'Select Notes Folder'
    });

    if (!result.canceled && result.filePaths.length > 0) {
      const selectedPath = result.filePaths[0];
      fileManager.setNotesDirectory(selectedPath);
      store.set('notesFolder', selectedPath);
      return selectedPath;
    }
    return null;
  });

  // Settings handlers
  ipcMain.handle('get-settings', async (): Promise<AppSettings> => {
    return store.store as AppSettings;
  });

  ipcMain.handle('save-settings', async (event, settings: AppSettings) => {
    console.log('=== save-settings IPC handler called ===');
    store.set(settings);
    
    // Notes folder değiştiyse FileManager'ı güncelle
    if (settings.notesFolder) {
      fileManager.setNotesDirectory(settings.notesFolder);
    }

    // Always on top ayarını uygula
    if (mainWindow) {
      mainWindow.setAlwaysOnTop(settings.alwaysOnTop || false);
    } else {
      console.error('save-settings: mainWindow is null!');
    }

    // Minimize to tray ayarını uygula
    const shouldMinimizeToTray = settings.minimizeToTray === true;
    console.log('save-settings: Minimize to tray setting:', shouldMinimizeToTray, 'raw value:', settings.minimizeToTray);
    console.log('save-settings: mainWindow exists:', !!mainWindow);
    
      if (mainWindow) {
      setupMinimizeToTray(shouldMinimizeToTray);
    } else {
      console.error('save-settings: Cannot setup minimize to tray - mainWindow is null');
      }
    

    // Global hotkey kaydet - sadece minimizeToTray açıksa
    // minimizeToTray kapalıyken global hotkey'i devre dışı bırak
    if (shouldMinimizeToTray && settings.globalHotkey) {
      setTimeout(() => {
        registerGlobalHotkey(settings.globalHotkey);
      }, 100);
    } else {
      // minimizeToTray kapalıysa, global hotkey'i kaldır
      console.log('save-settings: minimizeToTray disabled, unregistering global hotkey');
      globalShortcut.unregisterAll();
    }
  });

  // App info handlers
  ipcMain.handle('get-version', async () => {
    return APP_VERSION;
  });

  // Window control handlers
  ipcMain.handle('minimize-window', () => {
    if (mainWindow) {
      mainWindow.minimize();
    }
  });

  ipcMain.handle('maximize-window', () => {
    if (mainWindow) {
      if (mainWindow.isMaximized()) {
        mainWindow.unmaximize();
      } else {
        mainWindow.maximize();
      }
    }
  });

  ipcMain.handle('close-window', () => {
    console.log('========================================');
    console.log('=== close-window IPC handler called ===');
    console.log('========================================');
    if (mainWindow) {
      const settings = store.store as AppSettings;
      const shouldMinimizeToTray = settings.minimizeToTray === true;
      console.log('close-window: minimizeToTray setting:', shouldMinimizeToTray);
      console.log('close-window: close listener count:', mainWindow.listenerCount('close'));
      console.log('close-window: mainWindow isVisible:', mainWindow.isVisible());
      console.log('close-window: mainWindow isDestroyed:', mainWindow.isDestroyed());
      
      if (shouldMinimizeToTray) {
        // minimizeToTray açıksa, close() çağrısı close event handler'ını tetikleyecek
        console.log('close-window: minimizeToTray enabled, calling close() (will trigger handler)');
        mainWindow.close();
      } else {
        // minimizeToTray kapalıysa, direkt quit et
        console.log('close-window: minimizeToTray disabled, quitting app directly');
        console.log('close-window: Calling app.quit()');
        app.quit();
      }
    } else {
      console.log('close-window: mainWindow is null!');
    }
    console.log('=== close-window IPC handler finished ===');
    console.log('========================================');
  });

  ipcMain.handle('move-window', (event, deltaX: number, deltaY: number) => {
    if (mainWindow) {
      const [x, y] = mainWindow.getPosition();
      mainWindow.setPosition(x + deltaX, y + deltaY);
    }
  });

  ipcMain.handle('get-window-position', (): [number, number] => {
    if (mainWindow) {
      const pos = mainWindow.getPosition();
      return [pos[0], pos[1]];
    }
    return [0, 0];
  });

  ipcMain.handle('set-window-position', (event, x: number, y: number) => {
    if (mainWindow) {
      mainWindow.setPosition(x, y);
    }
  });

  ipcMain.handle('toggle-window', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    }
  });

  // Mikrofon izni kontrolü
  ipcMain.handle('check-microphone-permission', async (): Promise<{ granted: boolean; status?: string }> => {
    try {
      // Windows'ta systemPreferences.getMediaAccessStatus kullanılabilir
      if (process.platform === 'win32' || process.platform === 'darwin') {
        const status = systemPreferences.getMediaAccessStatus('microphone');
        console.log('Microphone permission status:', status);
        return { 
          granted: status === 'granted', 
          status: status 
        };
      }
      // Linux'ta her zaman true döndür (sistem seviyesinde kontrol yok)
      return { granted: true, status: 'granted' };
    } catch (error) {
      console.error('Error checking microphone permission:', error);
      return { granted: false, status: 'unknown' };
    }
  });

  // Mikrofon izni iste
  ipcMain.handle('request-microphone-permission', async (): Promise<boolean> => {
    try {
      if (process.platform === 'win32' || process.platform === 'darwin') {
        const status = systemPreferences.getMediaAccessStatus('microphone');
        if (status === 'granted') {
          return true;
        }
        // İzin yoksa, kullanıcıyı sistem ayarlarına yönlendir
        // Electron'da doğrudan izin isteyemeyiz, sistem ayarlarını açmamız gerekir
        console.log('Microphone permission not granted, status:', status);
        return false;
      }
      return true; // Linux'ta her zaman true
    } catch (error) {
      console.error('Error requesting microphone permission:', error);
      return false;
    }
  });

  // Vosk model klasörü seç
  ipcMain.handle('select-vosk-model-folder', async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      properties: ['openDirectory'],
      title: 'Select Vosk Model Folder'
    });

    if (!result.canceled && result.filePaths.length > 0) {
      return result.filePaths[0];
    }
    return null;
  });

  // Vosk model indir
  ipcMain.handle('download-vosk-model', async (event, language: string, modelSize: 'small' | 'large' = 'small') => {
    try {
      // Lazy load dependencies
      const fetch = require('node-fetch');
      const AdmZip = require('adm-zip');
      const os = require('os');

      // Model URL'leri - Tüm diller için güncel URL'ler
      // Not: Bazı diller için large model mevcut olmayabilir, bu durumda small model kullanılır
      const modelUrls: Record<string, Record<string, string>> = {
        tr: {
          small: 'https://alphacephei.com/vosk/models/vosk-model-small-tr-0.3.zip', // 0.3 versiyonu (güncel)
          // Not: Türkçe için resmi large model mevcut değil, ancak alternatif URL'ler deneniyor
          large: 'https://alphacephei.com/vosk/models/vosk-model-tr-0.3.zip' // Large model için 0.3 versiyonu (eğer varsa)
        },
        en: {
          small: 'https://alphacephei.com/vosk/models/vosk-model-small-en-us-0.15.zip',
          large: 'https://alphacephei.com/vosk/models/vosk-model-en-us-0.22.zip'
        },
        de: {
          small: 'https://alphacephei.com/vosk/models/vosk-model-small-de-0.22.zip',
          large: 'https://alphacephei.com/vosk/models/vosk-model-de-0.22.zip'
        },
        fr: {
          small: 'https://alphacephei.com/vosk/models/vosk-model-small-fr-0.22.zip',
          large: 'https://alphacephei.com/vosk/models/vosk-model-fr-0.22.zip'
        },
        es: {
          small: 'https://alphacephei.com/vosk/models/vosk-model-small-es-0.22.zip',
          large: 'https://alphacephei.com/vosk/models/vosk-model-es-0.22.zip'
        },
        it: {
          small: 'https://alphacephei.com/vosk/models/vosk-model-small-it-0.22.zip',
          large: 'https://alphacephei.com/vosk/models/vosk-model-it-0.22.zip'
        },
        pt: {
          small: 'https://alphacephei.com/vosk/models/vosk-model-small-pt-0.22.zip',
          large: 'https://alphacephei.com/vosk/models/vosk-model-pt-0.22.zip'
        },
        ru: {
          small: 'https://alphacephei.com/vosk/models/vosk-model-small-ru-0.22.zip',
          large: 'https://alphacephei.com/vosk/models/vosk-model-ru-0.22.zip'
        },
        zh: {
          small: 'https://alphacephei.com/vosk/models/vosk-model-small-cn-0.22.zip',
          large: 'https://alphacephei.com/vosk/models/vosk-model-cn-0.22.zip'
        },
        ja: {
          small: 'https://alphacephei.com/vosk/models/vosk-model-small-ja-0.22.zip',
          large: 'https://alphacephei.com/vosk/models/vosk-model-ja-0.22.zip'
        },
        ko: {
          small: 'https://alphacephei.com/vosk/models/vosk-model-small-ko-0.22.zip',
          large: 'https://alphacephei.com/vosk/models/vosk-model-ko-0.22.zip'
        },
        ar: {
          small: 'https://alphacephei.com/vosk/models/vosk-model-small-ar-0.22.zip',
          large: 'https://alphacephei.com/vosk/models/vosk-model-ar-0.22.zip'
        },
        hi: {
          small: 'https://alphacephei.com/vosk/models/vosk-model-small-in-0.22.zip',
          large: 'https://alphacephei.com/vosk/models/vosk-model-in-0.22.zip'
        },
        nl: {
          small: 'https://alphacephei.com/vosk/models/vosk-model-small-nl-0.22.zip',
          large: 'https://alphacephei.com/vosk/models/vosk-model-nl-0.22.zip'
        },
        pl: {
          small: 'https://alphacephei.com/vosk/models/vosk-model-small-pl-0.22.zip',
          large: 'https://alphacephei.com/vosk/models/vosk-model-pl-0.22.zip'
        },
        cs: {
          small: 'https://alphacephei.com/vosk/models/vosk-model-small-cz-0.22.zip',
          large: 'https://alphacephei.com/vosk/models/vosk-model-cz-0.22.zip'
        },
        uk: {
          small: 'https://alphacephei.com/vosk/models/vosk-model-small-uk-0.22.zip',
          large: 'https://alphacephei.com/vosk/models/vosk-model-uk-0.22.zip'
        },
        vi: {
          small: 'https://alphacephei.com/vosk/models/vosk-model-small-vn-0.22.zip',
          large: 'https://alphacephei.com/vosk/models/vosk-model-vn-0.22.zip'
        },
        fa: {
          small: 'https://alphacephei.com/vosk/models/vosk-model-small-fa-0.22.zip',
          large: 'https://alphacephei.com/vosk/models/vosk-model-fa-0.22.zip'
        },
        he: {
          small: 'https://alphacephei.com/vosk/models/vosk-model-small-he-0.22.zip',
          large: 'https://alphacephei.com/vosk/models/vosk-model-he-0.22.zip'
        }
      };
      
      // Alternatif URL'ler - GitHub releases ve mirror'lar
      const alternativeUrls: Record<string, Record<string, string[]>> = {
        tr: {
          small: [
            'https://alphacephei.com/vosk/models/vosk-model-small-tr-0.22.zip', // 0.22 versiyonu (fallback)
            'https://github.com/alphacep/vosk-api/releases/download/v0.3.45/vosk-model-small-tr-0.3.zip', // GitHub'dan 0.3
            'https://github.com/alphacep/vosk-api/releases/download/v0.3.45/vosk-model-small-tr-0.22.zip' // GitHub'dan 0.22 (fallback)
          ],
          large: [
            'https://alphacephei.com/vosk/models/vosk-model-tr-0.3.zip', // 0.3 versiyonu (primary)
            'https://github.com/alphacep/vosk-api/releases/download/v0.3.45/vosk-model-tr-0.3.zip', // GitHub'dan 0.3
            'https://alphacephei.com/vosk/models/vosk-model-tr-0.22.zip', // 0.22 versiyonu (fallback)
            'https://alphacephei.com/vosk/models/vosk-model-tr-0.6.zip', // 0.6 versiyonu (fallback)
            'https://alphacephei.com/vosk/models/vosk-model-tr.zip', // Alternatif format
            'https://alphacephei.com/vosk/models/vosk-model-large-tr-0.3.zip', // Alternatif isim formatı
            'https://alphacephei.com/vosk/models/vosk-model-large-tr.zip' // Alternatif isim formatı
          ]
        },
        en: {
          small: [
            'https://github.com/alphacep/vosk-api/releases/download/v0.3.45/vosk-model-small-en-us-0.15.zip'
          ],
          large: [
            'https://github.com/alphacep/vosk-api/releases/download/v0.3.45/vosk-model-en-us-0.22.zip',
            'https://alphacephei.com/vosk/models/vosk-model-en-us-0.22-lgraph.zip' // Alternatif format
          ]
        }
      };
      
      // Large model için fallback: Eğer large model bulunamazsa small model kullan
      const getModelUrl = (lang: string, size: string): string | null => {
        const url = modelUrls[lang]?.[size];
        if (url) return url;
        
        // Large model bulunamazsa small model kullan
        if (size === 'large') {
          console.warn(`Large model not available for ${lang}, falling back to small model`);
          return modelUrls[lang]?.small || null;
        }
        
        return null;
      };

      let modelUrl = getModelUrl(language, modelSize);
      if (!modelUrl) {
        const availableLanguages = Object.keys(modelUrls).join(', ');
        throw new Error(`Model not found for language: ${language}, size: ${modelSize}. Available languages: ${availableLanguages}`);
      }
      
      // Türkçe large model için özel uyarı
      if (language === 'tr' && modelSize === 'large') {
        console.warn('Turkish large model may not be officially available. Trying alternative URLs...');
      }

      // Model indirme klasörü (kullanıcının Documents klasörü)
      const modelsDir = path.join(os.homedir(), 'Documents', 'devnote', 'vosk-models');
      if (!fs.existsSync(modelsDir)) {
        fs.mkdirSync(modelsDir, { recursive: true });
      }

      const modelName = modelUrl.split('/').pop()?.replace('.zip', '') || `vosk-model-${language}-${modelSize}`;
      const modelPath = path.join(modelsDir, modelName);
      const zipPath = path.join(modelsDir, `${modelName}.zip`);

      // Large model için fallback kontrolü
      const isUsingFallback = modelSize === 'large' && modelUrl === modelUrls[language]?.small;
      let fallbackMessage = '';
      if (isUsingFallback) {
        fallbackMessage = ' (Large model not available, using small model instead)';
        console.warn(`Large model not available for ${language}, using small model instead`);
      }

      // Eğer model zaten varsa, direkt path'i döndür
      // Ancak model klasörü içinde am ve graph dosyaları olup olmadığını kontrol et
      if (fs.existsSync(modelPath)) {
        const isModelValid = fs.existsSync(path.join(modelPath, 'am')) || 
                            fs.existsSync(path.join(modelPath, 'graph')) ||
                            fs.existsSync(path.join(modelPath, 'conf')) ||
                            fs.readdirSync(modelPath).some((file: string) => 
                              file.toLowerCase().includes('am') || 
                              file.toLowerCase().includes('graph') ||
                              file.toLowerCase().endsWith('.fst') ||
                              file.toLowerCase().endsWith('.mdl')
                            );
        
        if (isModelValid) {
          console.log('Model already exists and is valid:', modelPath);
          const message = isUsingFallback 
            ? `Model already downloaded${fallbackMessage}`
            : 'Model already downloaded';
          return { success: true, modelPath, message };
        } else {
          console.log('Model path exists but is not valid, will re-download:', modelPath);
          // Geçersiz model klasörünü sil
          try {
            fs.rmSync(modelPath, { recursive: true, force: true });
          } catch (error) {
            console.warn('Could not remove invalid model directory:', error);
          }
        }
      }

      // İndirme progress callback
      const sendProgress = (progress: number) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('vosk-model-download-progress', progress);
        }
      };

      console.log('Downloading Vosk model from:', modelUrl);
      sendProgress(0);

      // ZIP dosyasını indir - alternatif URL'lerle deneme
      const urlsToTry = [modelUrl, ...(alternativeUrls[language]?.[modelSize] || [])];
      let response: any = null;
      let lastError: Error | null = null;
      let lastStatusCode: number | null = null;
      
      for (const url of urlsToTry) {
        try {
          console.log('Trying to download from:', url);
          // Timeout için AbortController kullan
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 saniye timeout
          
          response = await fetch(url, {
            signal: controller.signal,
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
          });
          
          clearTimeout(timeoutId);
          if (response.ok) {
            console.log('Successfully connected to:', url);
            break;
          } else {
            lastStatusCode = response.status;
            console.warn(`Failed to download from ${url}: ${response.status} ${response.statusText}`);
            lastError = new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
        } catch (error) {
          console.warn(`Error downloading from ${url}:`, error);
          lastError = error instanceof Error ? error : new Error(String(error));
          continue;
        }
      }
      
      if (!response || !response.ok) {
        const errorMsg = lastError?.message || 'Unknown error';
        const statusCode = lastStatusCode ? ` (HTTP ${lastStatusCode})` : '';
        // Türkçe large model için özel mesaj
        if (language === 'tr' && modelSize === 'large') {
          throw new Error(`Turkish large model may not be officially available. All URLs failed${statusCode}. Last error: ${errorMsg}. Please try using the small model instead, or manually download a Turkish model if available.`);
        }
        
        throw new Error(`Failed to download model from all URLs${statusCode}. Last error: ${errorMsg}. Please check your internet connection and try again. If the problem persists, the model URL may be incorrect or the model may not be available for this language/size combination.`);
      }

      const totalSize = parseInt(response.headers.get('content-length') || '0', 10);
      let downloadedSize = 0;

      const fileStream = fs.createWriteStream(zipPath);
      const body = response.body;

      return new Promise((resolve, reject) => {
        body.on('data', (chunk: Buffer) => {
          downloadedSize += chunk.length;
          const progress = totalSize > 0 ? Math.round((downloadedSize / totalSize) * 100) : 0;
          sendProgress(progress);
        });

        body.on('end', () => {
          sendProgress(100);
          console.log('Model downloaded, extracting...');

          try {
            // ZIP'i aç
            const zip = new AdmZip(zipPath);
            zip.extractAllTo(modelsDir, true);

            // ZIP dosyasını sil
            fs.unlinkSync(zipPath);

            // Model klasörünü bul (ZIP içinde model klasörü olabilir)
            const extractedFiles = fs.readdirSync(modelsDir);
            let finalModelPath = modelPath;

            // Önce modelName ile başlayan klasörü ara
            let modelFolder = extractedFiles.find((file: string) => {
              const fullPath = path.join(modelsDir, file);
              return file.startsWith(modelName.replace('.zip', '')) && 
                     fs.statSync(fullPath).isDirectory();
            });

            // Eğer bulunamazsa, am ve graph içeren klasörü ara
            if (!modelFolder) {
              for (const file of extractedFiles) {
                const fullPath = path.join(modelsDir, file);
                if (fs.statSync(fullPath).isDirectory()) {
                  const subFiles = fs.readdirSync(fullPath);
                  const hasAm = subFiles.some((f: string) => f === 'am' || f.startsWith('am.'));
                  const hasGraph = subFiles.some((f: string) => f === 'graph' || f.startsWith('graph.'));
                  if (hasAm && hasGraph) {
                    modelFolder = file;
                    break;
                  }
                }
              }
            }

            if (modelFolder) {
              finalModelPath = path.join(modelsDir, modelFolder);
            } else {
              // Model dosyaları direkt modelsDir'de olabilir - kontrol et
              const hasAm = extractedFiles.some((f: string) => f === 'am' || f.startsWith('am.'));
              const hasGraph = extractedFiles.some((f: string) => f === 'graph' || f.startsWith('graph.'));
              if (hasAm && hasGraph) {
                finalModelPath = modelsDir;
              } else {
                // Son çare: modelName klasörünü oluştur ve oraya taşı
                finalModelPath = path.join(modelsDir, modelName.replace('.zip', ''));
                if (!fs.existsSync(finalModelPath)) {
                  fs.mkdirSync(finalModelPath, { recursive: true });
                }
              }
            }

            console.log('Model extracted to:', finalModelPath);
            console.log('Model folder contents:', fs.existsSync(finalModelPath) ? fs.readdirSync(finalModelPath) : 'Path does not exist');
            const message = isUsingFallback
              ? `Model downloaded and extracted successfully${fallbackMessage}`
              : 'Model downloaded and extracted successfully';
            resolve({ success: true, modelPath: finalModelPath, message });
          } catch (error) {
            console.error('Error extracting model:', error);
            reject(new Error(`Failed to extract model: ${error instanceof Error ? error.message : 'Unknown error'}`));
          }
        });

        body.on('error', (error: Error) => {
          reject(new Error(`Download failed: ${error.message}`));
        });

        body.pipe(fileStream);
      });
    } catch (error) {
      console.error('Error downloading Vosk model:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  });

  // Vosk model doğrula
  ipcMain.handle('validate-vosk-model', async (event, modelPath: string): Promise<boolean> => {
    try {
      if (!modelPath || !fs.existsSync(modelPath)) {
        console.error('Vosk model path does not exist:', modelPath);
        return false;
      }

      console.log('Validating Vosk model at:', modelPath);
      console.log('Model path exists:', fs.existsSync(modelPath));

      // Recursive olarak model dosyalarını kontrol et
      const checkModelFiles = (dir: string, depth: number = 0): { hasAm: boolean; hasGraph: boolean; files: string[] } => {
        if (depth > 3) {
          // Çok derin klasörlere girme
          return { hasAm: false, hasGraph: false, files: [] };
        }

        const files = fs.readdirSync(dir);
        let hasAm = false;
        let hasGraph = false;
        const allFiles: string[] = [];

        for (const file of files) {
          const fullPath = path.join(dir, file);
          const stat = fs.statSync(fullPath);
          
          allFiles.push(file);
          const fileLower = file.toLowerCase();

          // am klasörü veya dosyası kontrolü
          // Vosk modellerinde am şu şekillerde olabilir:
          // - am/ klasörü
          // - am.* dosyası
          // - final.mdl dosyası (bazı modellerde)
          if (fileLower === 'am' || fileLower.startsWith('am.') || 
              fileLower === 'final.mdl' || fileLower.endsWith('final.mdl')) {
            console.log('Found AM file:', file);
            hasAm = true;
          }

          // graph klasörü veya dosyası kontrolü
          // Vosk modellerinde graph şu şekillerde olabilir:
          // - graph/ klasörü
          // - graph.* dosyası
          // - Gr.fst, HCLr.fst gibi dosyalar (bazı modellerde)
          if (fileLower === 'graph' || fileLower.startsWith('graph.') || 
              fileLower === 'gr.fst' || fileLower === 'hclr.fst' || 
              fileLower.endsWith('.fst')) {
            console.log('Found Graph file:', file);
            hasGraph = true;
          }

          // Alt klasörlere de bak (maksimum 2 seviye derinlik)
          if (stat.isDirectory() && depth < 2) {
            const subResult = checkModelFiles(fullPath, depth + 1);
            if (subResult.hasAm) hasAm = true;
            if (subResult.hasGraph) hasGraph = true;
            allFiles.push(...subResult.files.map(f => path.join(file, f)));
          }
        }

        return { hasAm, hasGraph, files: allFiles };
      };

      const result = checkModelFiles(modelPath);
      
      console.log('Model validation result:', {
        hasAm: result.hasAm,
        hasGraph: result.hasGraph,
        filesFound: result.files.length,
        sampleFiles: result.files.slice(0, 10)
      });

      if (!result.hasAm || !result.hasGraph) {
        console.error('Vosk model is missing required files');
        console.error('Files found:', result.files);
        console.error('Has am:', result.hasAm, 'Has graph:', result.hasGraph);
        return false;
      }

      console.log('✅ Vosk model validation successful:', modelPath);
      return true;
    } catch (error) {
      console.error('Error validating Vosk model:', error);
      return false;
    }
  });

  // Vosk speech recognition handlers
  ipcMain.handle('vosk-initialize', async (event, modelPath: string): Promise<boolean> => {
    try {
      console.group('🎤 Vosk Initialize IPC Handler');
      console.log('Model path:', modelPath);
      
      if (!voskService) {
        // Lazy load VoskService to avoid native module errors on startup
        console.log('VoskService not loaded, importing...');
        try {
          const { VoskService } = await import('./services/VoskService');
          voskService = new VoskService();
          console.log('✅ VoskService imported and created');
        } catch (importError: any) {
          console.error('❌ Failed to import VoskService:', importError);
          console.error('Error details:', {
            message: importError?.message,
            code: importError?.code,
            stack: importError?.stack
          });
          console.groupEnd();
          return false;
        }
      }

      console.log('Initializing Vosk service...');
      const result = await voskService.initialize(modelPath);
      
      if (result) {
        console.log('✅ Vosk service initialized successfully');
        console.log('✅ Vosk service isReady:', voskService.isReady());
      } else {
        console.error('❌ Vosk service initialization failed');
        console.error('❌ Vosk service isReady:', voskService.isReady());
      }
      
      console.groupEnd();
      console.log('🎤 Vosk Initialize IPC Handler returning:', result);
      return result;
    } catch (error: any) {
      console.group('❌ Error in Vosk Initialize IPC Handler');
      console.error('Error type:', error?.constructor?.name);
      console.error('Error message:', error?.message);
      console.error('Error code:', error?.code);
      console.error('Error stack:', error?.stack);
      
      // Native callback hatası kontrolü
      if (error?.message?.includes('native callback') || 
          error?.message?.includes('Error in native callback') ||
          error?.message?.includes('dlopen')) {
        console.error('⚠️ This is a native module compatibility issue.');
        console.error('Possible solutions:');
        console.error('1. Run: npm run rebuild-vosk');
        console.error('2. Check if all native dependencies are installed');
        console.error('3. Try reinstalling vosk: npm uninstall vosk && npm install vosk');
      }
      
      console.groupEnd();
      return false;
    }
  });

  ipcMain.handle('vosk-recognize', async (event, audioBuffer: ArrayBuffer): Promise<{ text: string; isFinal: boolean }> => {
    try {
      if (!voskService || !voskService.isReady()) {
        throw new Error('Vosk service is not initialized');
      }
      const buffer = Buffer.from(audioBuffer);
      return await voskService.recognize(buffer);
    } catch (error) {
      console.error('Error during Vosk recognition:', error);
      throw error;
    }
  });

  ipcMain.handle('vosk-get-final-result', async (): Promise<string> => {
    try {
      if (!voskService || !voskService.isReady()) {
        return '';
      }
      // VoskService artık async getFinalResultAsync kullanıyor
      if (typeof (voskService as any).getFinalResultAsync === 'function') {
        return await (voskService as any).getFinalResultAsync();
      }
      return voskService.getFinalResult();
    } catch (error) {
      console.error('Error getting final result:', error);
      return '';
    }
  });

  ipcMain.handle('vosk-reset', async (): Promise<void> => {
    if (voskService) {
      voskService.reset();
    }
  });

  ipcMain.handle('vosk-cleanup', async (): Promise<void> => {
    if (voskService) {
      voskService.cleanup();
      voskService = null;
    }
  });

  ipcMain.handle('vosk-is-ready', async (): Promise<boolean> => {
    const isReady = voskService ? voskService.isReady() : false;
    console.log('🎤 Vosk IsReady IPC Handler:', { hasService: !!voskService, isReady });
    return isReady;
  });
}

// System Tray oluştur
function createTray() {
  // Eğer tray zaten varsa, önce destroy et
  if (tray) {
    tray.destroy();
    tray = null;
  }

  // Tray icon için logo kullan (veya default icon)
  // Production ve development için farklı path'ler
  let iconPath: string;
  if (app.isPackaged) {
    // Production build
    iconPath = path.join(process.resourcesPath, 'public', 'logo.png');
  } else {
    // Development
    iconPath = path.join(__dirname, '../../public/logo.png');
  }
  
  console.log('Attempting to load tray icon from:', iconPath);
  console.log('__dirname:', __dirname);
  console.log('app.getAppPath():', app.getAppPath());
  
  let icon = nativeImage.createFromPath(iconPath);
  console.log('Icon loaded, isEmpty:', icon.isEmpty());
  
  // Eğer icon yüklenemezse, alternatif path'leri dene
  if (icon.isEmpty()) {
    // Alternatif path: app.getAppPath() kullan
    const altPath = path.join(app.getAppPath(), 'public', 'logo.png');
    console.log('Trying alternative path:', altPath);
    icon = nativeImage.createFromPath(altPath);
    console.log('Alternative icon loaded, isEmpty:', icon.isEmpty());
  }
  
  // Hala yüklenemezse, basit bir icon oluştur
  if (icon.isEmpty()) {
    console.warn('Tray icon could not be loaded from any path, creating simple icon');
    // Basit bir 16x16 icon oluştur (gri kare)
    const buffer = Buffer.alloc(16 * 16 * 4);
    for (let i = 0; i < buffer.length; i += 4) {
      buffer[i] = 100;     // R
      buffer[i + 1] = 100; // G
      buffer[i + 2] = 100; // B
      buffer[i + 3] = 255; // A
    }
    icon = nativeImage.createFromBuffer(buffer, { width: 16, height: 16 });
    console.log('Created fallback icon, isEmpty:', icon.isEmpty());
  }
  
  // Windows için icon boyutunu ayarla (16x16 veya 32x32)
  // Windows'ta genellikle 16x16 yeterli ama bazı sistemlerde 32x32 daha iyi çalışır
  const iconSize = process.platform === 'win32' ? 16 : 16;
  const resizedIcon = icon.resize({ width: iconSize, height: iconSize });
  
  try {
    tray = new Tray(resizedIcon);
    console.log('Tray created successfully with icon size:', iconSize);
    console.log('Tray object:', tray ? 'exists' : 'null');
  } catch (error) {
    console.error('Error creating tray:', error);
    // Hata durumunda bile tray oluşturmayı dene (boş icon ile)
    const emptyIcon = nativeImage.createEmpty();
    tray = new Tray(emptyIcon);
    console.log('Tray created with empty icon as fallback');
  }

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show Dev Note',
      click: () => {
        console.log('Tray menu: Show Dev Note clicked');
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      }
    },
    {
      label: 'Quit',
      click: () => {
        console.log('========================================');
        console.log('=== Tray menu: Quit clicked ===');
        console.log('========================================');
        const settings = store.store as AppSettings;
        const shouldMinimizeToTray = settings.minimizeToTray === true;
        console.log('Tray menu Quit: minimizeToTray setting:', shouldMinimizeToTray);
        console.log('Tray menu Quit: Setting forceQuit flag to true');
        forceQuit = true; // Quit butonuna tıklandı, zorla kapat
        console.log('Tray menu Quit: Calling app.quit()');
        app.quit();
        console.log('=== Tray menu: Quit finished ===');
        console.log('========================================');
      }
    }
  ]);

  tray.setToolTip('Dev Note');
  tray.setContextMenu(contextMenu);

  tray.on('click', () => {
    console.log('Tray icon clicked');
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        console.log('Window is visible, hiding...');
        mainWindow.hide();
      } else {
        console.log('Window is hidden, showing...');
        mainWindow.show();
        mainWindow.focus();
      }
    } else {
      console.log('Main window is null');
    }
  });
  
  // Tray icon'a sağ tık yapıldığında context menu gösterilir
  // Quit butonu context menu'de, bu yüzden tray.on('click') sadece sol tık için

  tray.on('double-click', () => {
    console.log('Tray icon double-clicked');
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  console.log('Tray created successfully');
}

// Global hotkey kaydet
function registerGlobalHotkey(hotkey: string | undefined) {
  // Önce mevcut hotkey'i kaldır
  globalShortcut.unregisterAll();

  if (!hotkey || !mainWindow) {
    console.log('No hotkey provided or window not ready');
    return;
  }

  try {
    // Electron formatına çevir (Ctrl -> CommandOrControl)
    let electronHotkey = hotkey
      .replace(/Ctrl\+/gi, 'CommandOrControl+')
      .replace(/Meta\+/gi, 'Command+')
      .replace(/CommandOrControl\+CommandOrControl\+/gi, 'CommandOrControl+'); // Çift Ctrl'ü önle
    
    console.log('Registering hotkey:', electronHotkey, 'from:', hotkey);
    
    const registered = globalShortcut.register(electronHotkey, () => {
      console.log('Hotkey pressed!');
      if (mainWindow) {
        if (mainWindow.isVisible()) {
          console.log('Hiding window');
          mainWindow.hide();
        } else {
          console.log('Showing window');
          mainWindow.show();
          mainWindow.focus();
        }
      }
    });

    if (!registered) {
      console.error('Failed to register global hotkey:', electronHotkey);
    } else {
      console.log('Global hotkey successfully registered:', electronHotkey);
    }
  } catch (error) {
    console.error('Error registering global hotkey:', error);
  }
}

// GPU hatasını önlemek için command line argümanları
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-gpu-compositing');
app.commandLine.appendSwitch('disable-software-rasterizer');

// Web Speech API için command line switch'leri
app.commandLine.appendSwitch('enable-features', 'SpeechRecognition');
app.commandLine.appendSwitch('enable-experimental-web-platform-features');
app.commandLine.appendSwitch('unsafely-treat-insecure-origin-as-secure', 'https://www.google.com');
app.commandLine.appendSwitch('disable-site-isolation-trials'); // CORS için

// Uygulama başlatma
// Global hata yakalayıcılar - native modül hatalarını yakalamak için
process.on('uncaughtException', (error: Error) => {
  console.error('❌ Uncaught Exception:', error);
  console.error('Error name:', error.name);
  console.error('Error message:', error.message);
  console.error('Error stack:', error.stack);
  
  // Vosk ile ilgili hataları özel olarak işle
  if (error.message?.includes('native callback') || 
      error.message?.includes('dlopen') ||
      error.message?.includes('vosk')) {
    console.error('⚠️ Vosk native module error detected');
    console.error('This is likely a compatibility issue between Vosk and Electron');
    console.error('Possible solutions:');
    console.error('1. Run: npm run rebuild-vosk');
    console.error('2. Check Electron and Node.js version compatibility');
    console.error('3. Try reinstalling Vosk: npm uninstall vosk && npm install vosk');
  }
});

process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
  console.error('❌ Unhandled Rejection:', reason);
  if (reason instanceof Error) {
    console.error('Rejection error name:', reason.name);
    console.error('Rejection error message:', reason.message);
    console.error('Rejection error stack:', reason.stack);
  }
});

app.whenReady().then(() => {
  // Mikrofon ve diğer izinleri ayarla
  session.defaultSession.setPermissionRequestHandler((
    webContents: WebContents,
    permission: string,
    callback: (granted: boolean) => void,
    details?: any
  ) => {
    // Tüm izinleri ver (development için)
    // Mikrofon, medya ve diğer izinler
    if (permission === 'media' || 
        permission === 'microphone' || 
        permission === 'notifications' ||
        details?.mediaTypes?.includes('audio')) {
      callback(true);
    } else {
      callback(false);
    }
  });

  // Web Speech API için ek izinler
  session.defaultSession.setPermissionCheckHandler((
    webContents: WebContents | null,
    permission: string,
    requestingOrigin: string,
    details: any
  ): boolean => {
    if (permission === 'microphone' || permission === 'media') {
      return true;
    }
    return false;
  });

  // Web Speech API için ek session ayarları
  // Google'ın servislerine erişim için user agent ve diğer ayarlar
  const filter = {
    urls: ['*://*/*']
  };

  session.defaultSession.webRequest.onBeforeSendHeaders(filter, (details, callback) => {
    // Detaylı loglama - Web Speech API isteklerini yakala
    const isGoogleAPI = details.url.includes('googleapis.com') || 
                        details.url.includes('google.com') || 
                        details.url.includes('gstatic.com') ||
                        details.url.includes('speech');
    
    if (isGoogleAPI) {
      console.group('🌐 Web Speech API Request (onBeforeSendHeaders)');
      console.log('URL:', details.url);
      console.log('Method:', details.method);
      console.log('Resource Type:', details.resourceType);
      console.log('Request ID:', details.id);
      console.log('Timestamp:', details.timestamp);
      console.log('Original Headers:', JSON.stringify(details.requestHeaders, null, 2));
    }
    
    // Tüm isteklere Chrome user agent ekle (Web Speech API için)
    if (!details.requestHeaders['User-Agent']) {
      details.requestHeaders['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    }
    
    // Google servislerine özel header'lar
    if (isGoogleAPI) {
      details.requestHeaders['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
      details.requestHeaders['Accept'] = '*/*';
      details.requestHeaders['Accept-Language'] = 'en-US,en;q=0.9,tr-TR;q=0.8,tr;q=0.7';
      details.requestHeaders['Accept-Encoding'] = 'gzip, deflate, br';
      details.requestHeaders['Origin'] = 'https://www.google.com';
      details.requestHeaders['Referer'] = 'https://www.google.com/';
      details.requestHeaders['Sec-Fetch-Dest'] = 'empty';
      details.requestHeaders['Sec-Fetch-Mode'] = 'cors';
      details.requestHeaders['Sec-Fetch-Site'] = 'cross-site';
      details.requestHeaders['Sec-Ch-Ua'] = '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"';
      details.requestHeaders['Sec-Ch-Ua-Mobile'] = '?0';
      details.requestHeaders['Sec-Ch-Ua-Platform'] = '"Windows"';
      
      console.log('Modified Headers:', JSON.stringify(details.requestHeaders, null, 2));
      console.groupEnd();
    }
    
    callback({ requestHeaders: details.requestHeaders });
  });

  // CORS ve diğer güvenlik ayarları
  session.defaultSession.webRequest.onHeadersReceived(filter, (details, callback) => {
    const isGoogleAPI = details.url.includes('googleapis.com') || 
                        details.url.includes('google.com') || 
                        details.url.includes('gstatic.com') ||
                        details.url.includes('speech');
    
    if (isGoogleAPI) {
      const statusEmoji = details.statusCode >= 200 && details.statusCode < 300 ? '✅' : '❌';
      console.group(`${statusEmoji} Web Speech API Response (onHeadersReceived)`);
      console.log('URL:', details.url);
      console.log('Status Code:', details.statusCode);
      console.log('Status Line:', details.statusLine);
      console.log('Response Headers:', JSON.stringify(details.responseHeaders, null, 2));
    }
    
    const responseHeaders = { ...details.responseHeaders };
    
    // CORS header'ları ekle - Web Speech API için
    if (isGoogleAPI) {
      // Google servislerinden gelen response'lara CORS header'ları ekle
      if (!responseHeaders['Access-Control-Allow-Origin']) {
        responseHeaders['Access-Control-Allow-Origin'] = ['*'];
      }
      if (!responseHeaders['Access-Control-Allow-Methods']) {
        responseHeaders['Access-Control-Allow-Methods'] = ['GET', 'POST', 'OPTIONS', 'PUT', 'DELETE', 'HEAD'];
      }
      if (!responseHeaders['Access-Control-Allow-Headers']) {
        responseHeaders['Access-Control-Allow-Headers'] = ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin', 'Referer'];
      }
      if (!responseHeaders['Access-Control-Allow-Credentials']) {
        responseHeaders['Access-Control-Allow-Credentials'] = ['true'];
      }
      if (!responseHeaders['Access-Control-Expose-Headers']) {
        responseHeaders['Access-Control-Expose-Headers'] = ['Content-Length', 'Content-Type'];
      }
    }
    
    if (isGoogleAPI) {
      console.log('Modified Response Headers:', JSON.stringify(responseHeaders, null, 2));
      console.groupEnd();
    }
    
    callback({ responseHeaders });
  });
  
  // Hata durumlarını yakala
  session.defaultSession.webRequest.onErrorOccurred(filter, (details) => {
    const isGoogleAPI = details.url.includes('googleapis.com') || 
                        details.url.includes('google.com') || 
                        details.url.includes('gstatic.com') ||
                        details.url.includes('speech');
    
    if (isGoogleAPI) {
      console.group('❌ Web Speech API Request Error');
      console.error('URL:', details.url);
      console.error('Error:', details.error);
      console.error('Request ID:', details.id);
      console.error('Resource Type:', details.resourceType);
      console.error('Timestamp:', details.timestamp);
      console.groupEnd();
    }
  });
  
  // Tamamlanan istekleri logla
  session.defaultSession.webRequest.onCompleted(filter, (details) => {
    const isGoogleAPI = details.url.includes('googleapis.com') || 
                        details.url.includes('google.com') || 
                        details.url.includes('gstatic.com') ||
                        details.url.includes('speech');
    
    if (isGoogleAPI) {
      const statusEmoji = details.statusCode >= 200 && details.statusCode < 300 ? '✅' : '❌';
      console.group(`${statusEmoji} Web Speech API Request Completed`);
      console.log('URL:', details.url);
      console.log('Status Code:', details.statusCode);
      console.log('Request ID:', details.id);
      console.log('Timestamp:', details.timestamp);
      console.groupEnd();
    }
  });

  // Web Speech API için ek session ayarları
  const chromeUserAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
  session.defaultSession.setUserAgent(chromeUserAgent);
  
  // Web Speech API için protocol handler (gerekirse)
  // Not: Electron'da Web Speech API'nin çalışması Google'ın servislerine bağlıdır
  // ve Electron user agent'ları engellenmiş olabilir
  console.log('🌐 Web Speech API Configuration:');
  console.log('  User Agent:', chromeUserAgent);
  console.log('  ⚠️  Note: Web Speech API may not work in Electron due to Google service restrictions');
  console.log('  💡 Recommendation: Use Vosk (offline) for reliable speech recognition');

  initializeFileManager();
  mainWindow = createWindow();
  
  // ÖNEMLİ: close event handler'ını pencere oluşturulur oluşturulmaz kaydet
  // Bu şekilde Electron'un kendi davranışını override edebiliriz
  if (mainWindow) {
    console.log('========================================');
    console.log('=== Registering initial close event handler ===');
    console.log('========================================');
    
    closeEventHandler = (event: Electron.Event) => {
      console.log('========================================');
      console.log('=== WINDOW CLOSE EVENT TRIGGERED ===');
      console.log('========================================');
      console.log('Close event: event defaultPrevented:', event.defaultPrevented);
      
      // Settings'i her zaman store'dan oku (güncel değeri al)
      const currentSettings = store.store as AppSettings;
      const currentMinimizeToTray = currentSettings.minimizeToTray === true;
      console.log('Close event: minimizeToTray setting:', currentMinimizeToTray, 'raw:', currentSettings.minimizeToTray);
      console.log('Close event: mainWindow exists:', !!mainWindow);
      
      // mainWindow'a güvenli erişim - destroy edilmiş olabilir
      let mainWindowDestroyed = true;
      let mainWindowVisible = false;
      if (mainWindow) {
        try {
          mainWindowDestroyed = mainWindow.isDestroyed();
          if (!mainWindowDestroyed) {
            mainWindowVisible = mainWindow.isVisible();
          }
        } catch (error) {
          console.log('Close event: Error accessing mainWindow properties:', error);
          mainWindowDestroyed = true;
        }
      }
      console.log('Close event: mainWindow isDestroyed:', mainWindowDestroyed);
      console.log('Close event: mainWindow isVisible:', mainWindowVisible);
      
      if (currentMinimizeToTray) {
        console.log('→ minimizeToTray is TRUE - Preventing close, hiding window to tray');
        event.preventDefault();
        console.log('→ preventDefault() called, event.defaultPrevented:', event.defaultPrevented);
        if (mainWindow && !mainWindowDestroyed) {
          // Tray yoksa oluştur
          if (!tray) {
            console.log('→ Tray not found, creating...');
            createTray();
          }
          console.log('→ Hiding window...');
          try {
            mainWindow.hide();
            console.log('→ Window hidden to tray, isVisible:', mainWindow.isVisible());
          } catch (error) {
            console.error('Close event: Error hiding window:', error);
          }
        }
      } else {
        console.log('→ minimizeToTray is FALSE - Allowing close (NOT calling preventDefault)');
        console.log('→ Window should close normally');
        console.log('→ NOT calling preventDefault(), event.defaultPrevented:', event.defaultPrevented);
        // event.preventDefault() çağrılmıyor, bu yüzden pencere kapanacak
        // Electron'un kendi davranışı devreye girecek
      }
      console.log('=== WINDOW CLOSE EVENT HANDLER FINISHED ===');
      console.log('========================================');
    };
    
    mainWindow.on('close', closeEventHandler);
    console.log('✓ Initial close event handler registered');
    const listenerCount = mainWindow.listenerCount('close');
    console.log('Close listener count after initial registration:', listenerCount);
    console.log('========================================');
    
    if (listenerCount !== 1) {
      console.error('ERROR: Expected 1 close listener, but found:', listenerCount);
    }
  }
  
  setupIpcHandlers();

  // Settings'ten ayarları uygula
  const settings = store.store as AppSettings;
  if (mainWindow) {
    if (settings.alwaysOnTop) {
      mainWindow.setAlwaysOnTop(true);
    }

    // Tray'i her zaman oluştur (minimizeToTray açık veya kapalı)
    // Bu şekilde Quit butonu her zaman kullanılabilir
    if (!tray) {
      console.log('Initial setup: Creating tray (always available for Quit button)');
      createTray();
    }
    
    // Minimize to tray ayarını uygula
    // Close event handler zaten kaydedildi, sadece ayarı kontrol et
    const shouldMinimizeToTray = settings.minimizeToTray === true;
    console.log('Initial setup: Minimize to tray setting:', shouldMinimizeToTray, 'raw value:', settings.minimizeToTray);
    
    setupMinimizeToTray(shouldMinimizeToTray);

    // Global hotkey kaydet - sadece minimizeToTray açıksa
    // minimizeToTray kapalıyken global hotkey'i devre dışı bırak
    if (shouldMinimizeToTray && settings.globalHotkey) {
      // Biraz gecikme ile kaydet (window hazır olana kadar bekle)
      setTimeout(() => {
        registerGlobalHotkey(settings.globalHotkey);
      }, 500);
    } else {
      // minimizeToTray kapalıysa, global hotkey'i kaldır
      console.log('Initial setup: minimizeToTray disabled, unregistering global hotkey');
      globalShortcut.unregisterAll();
    }
  }
});

app.on('window-all-closed', () => {
  console.log('========================================');
  console.log('=== window-all-closed event triggered ===');
  console.log('========================================');
  const settings = store.store as AppSettings;
  const shouldMinimizeToTray = settings.minimizeToTray === true;
  console.log('window-all-closed: minimizeToTray setting:', shouldMinimizeToTray);
  console.log('window-all-closed: mainWindow exists:', !!mainWindow);
  // mainWindow'a erişmeye çalışma - pencere destroy edilmiş olabilir
  // console.log('window-all-closed: mainWindow isVisible:', mainWindow ? mainWindow.isVisible() : 'N/A');
  // console.log('window-all-closed: mainWindow isDestroyed:', mainWindow ? mainWindow.isDestroyed() : 'N/A');
  // console.log('window-all-closed: close listener count:', mainWindow ? mainWindow.listenerCount('close') : 'N/A');
  
  // minimizeToTray kapalıysa ve macOS değilse, uygulamayı kapat
  if (process.platform !== 'darwin') {
    if (!shouldMinimizeToTray) {
      console.log('window-all-closed: minimizeToTray is disabled, quitting app');
      console.log('window-all-closed: Calling app.quit()');
      app.quit();
    } else {
      console.log('window-all-closed: minimizeToTray is enabled, NOT quitting (window is hidden to tray)');
      // minimizeToTray açıksa, pencere gizli olabilir, quit etme
    }
  } else {
    // macOS'ta window-all-closed'da quit etme
    console.log('window-all-closed: macOS - not quitting');
  }
  console.log('=== window-all-closed event finished ===');
  console.log('========================================');
});

app.on('before-quit', (event) => {
  console.log('========================================');
  console.log('=== before-quit event triggered ===');
  console.log('========================================');
  const settings = store.store as AppSettings;
  const shouldMinimizeToTray = settings.minimizeToTray === true;
  console.log('before-quit: minimizeToTray setting:', shouldMinimizeToTray);
  console.log('before-quit: forceQuit flag:', forceQuit);
  console.log('before-quit: mainWindow exists:', !!mainWindow);
  
  // mainWindow'a güvenli erişim - destroy edilmiş olabilir
  let mainWindowVisible = false;
  let mainWindowDestroyed = true;
  if (mainWindow && !mainWindow.isDestroyed()) {
    try {
      mainWindowVisible = mainWindow.isVisible();
      mainWindowDestroyed = false;
    } catch (error) {
      console.log('before-quit: Error accessing mainWindow properties:', error);
    }
  }
  console.log('before-quit: mainWindow isVisible:', mainWindowVisible);
  console.log('before-quit: mainWindow isDestroyed:', mainWindowDestroyed);
  
  // Eğer forceQuit true ise (Quit butonuna tıklandı), her zaman quit'e izin ver
  if (forceQuit) {
    console.log('before-quit: forceQuit is true, allowing quit (user clicked Quit button)');
    forceQuit = false; // Flag'i sıfırla
    // preventDefault çağırma, quit'e izin ver
    return; // Erken çık, diğer kontrollere gerek yok
  }
  
  // forceQuit false ise, minimizeToTray ayarına göre davran
  if (shouldMinimizeToTray) {
    // minimizeToTray açıksa, quit'i engelle ve pencereyi gizle
    console.log('before-quit: minimizeToTray enabled, preventing quit and hiding window');
    event.preventDefault();
    if (mainWindow && !mainWindowDestroyed && mainWindowVisible) {
      if (!tray) {
        console.log('before-quit: Tray not found, creating...');
        createTray();
      }
      console.log('before-quit: Hiding window to tray');
      try {
        mainWindow.hide();
      } catch (error) {
        console.error('before-quit: Error hiding window:', error);
      }
    }
  } else {
    console.log('before-quit: minimizeToTray disabled, allowing quit (NOT calling preventDefault)');
    // minimizeToTray kapalıysa, quit'e izin ver - preventDefault çağırma
    // Bu şekilde uygulama normal kapanacak
  }
  console.log('=== before-quit event finished ===');
  console.log('========================================');
});

app.on('will-quit', () => {
  console.log('=== will-quit event triggered ===');
  globalShortcut.unregisterAll();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    mainWindow = createWindow();
  }
});

// Ayarlar değiştiğinde FileManager'ı güncelle
store.onDidChange('notesFolder', (newValue) => {
  if (newValue && typeof newValue === 'string') {
    fileManager.setNotesDirectory(newValue);
  }
});

