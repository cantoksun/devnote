import { BrowserWindow, screen } from 'electron';
import * as path from 'path';

export function createWindow(): BrowserWindow {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  
  const mainWindow = new BrowserWindow({
    width: Math.min(800, width * 0.8),
    height: Math.min(600, height * 0.8),
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    titleBarStyle: 'hidden',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      // Web Speech API için webSecurity'i false yapmak gerekli
      // Web Speech API Google servislerine erişim gerektirir
      webSecurity: false,
      allowRunningInsecureContent: true,
      // Web Speech API için ek ayarlar
      experimentalFeatures: true,
      // Web Speech API için ek ayarlar
      spellcheck: false,
      // GPU hatasını önlemek için
      disableBlinkFeatures: 'Accelerated2dCanvas',
      enableBlinkFeatures: ''
    },
    minWidth: 400,
    minHeight: 300,
    show: false
  });

  // Pencere yüklendiğinde göster
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    if (process.env.NODE_ENV === 'development') {
      mainWindow.webContents.openDevTools();
    }
    
    // Web Speech API için ek ayarlar
    mainWindow.webContents.on('did-finish-load', () => {
      // Google'ın speech recognition servislerine erişim için
      mainWindow.webContents.executeJavaScript(`
        // Web Speech API'nin çalışması için gerekli
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          console.log('MediaDevices API available');
        }
        
        // Web Speech API için user agent ayarı
        try {
          Object.defineProperty(navigator, 'userAgent', {
            get: function() {
              return 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
            },
            configurable: true
          });
        } catch (e) {
          console.warn('Could not set userAgent:', e);
        }
        
        // Web Speech API için platform ayarı
        try {
          Object.defineProperty(navigator, 'platform', {
            get: function() {
              return 'Win32';
            },
            configurable: true
          });
        } catch (e) {
          console.warn('Could not set platform:', e);
        }
        
        // Web Speech API için vendor ayarı
        try {
          Object.defineProperty(navigator, 'vendor', {
            get: function() {
              return 'Google Inc.';
            },
            configurable: true
          });
        } catch (e) {
          console.warn('Could not set vendor:', e);
        }
        
        // Web Speech API için chrome objesi ekle
        try {
          if (!window.chrome) {
            window.chrome = {
              runtime: {}
            };
          }
        } catch (e) {
          console.warn('Could not set chrome object:', e);
        }
        
        // Web Speech API için navigator.mediaDevices kontrolü
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          console.log('✅ MediaDevices API available');
        } else {
          console.warn('⚠️ MediaDevices API not available');
        }
        
        console.log('Web Speech API setup completed');
        console.log('User Agent:', navigator.userAgent);
        console.log('Platform:', navigator.platform);
        console.log('Vendor:', navigator.vendor);
        console.log('Chrome object:', typeof window.chrome !== 'undefined' ? 'Available' : 'Not available');
      `).catch(console.error);
    });
    
    // User agent'ı Chrome gibi ayarla (Web Speech API için)
    mainWindow.webContents.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  });

  // URL yükleme
  const isDev = process.env.NODE_ENV === 'development' || !process.env.NODE_ENV;
  
  if (isDev) {
    // Development modunda Vite server'ı bekle
    const loadDevURL = () => {
      mainWindow.loadURL('http://localhost:5173').catch((err) => {
        console.error('Failed to load dev URL, retrying...', err);
        setTimeout(loadDevURL, 1000);
      });
    };
    loadDevURL();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  return mainWindow;
}

