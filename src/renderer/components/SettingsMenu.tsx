import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useSettings } from '../hooks/useSettings';
import { getTranslation } from '../locales';
import { CURSOR_THEME_COLORS } from '../config';
import './SettingsMenu.css';

interface SettingsMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onSettingsSaved?: () => void;
}

export const SettingsMenu: React.FC<SettingsMenuProps> = ({ isOpen, onClose, onSettingsSaved }) => {
  const { settings, updateSetting, saveSettings } = useSettings();
  const [localSettings, setLocalSettings] = useState(settings);
  const [activeTab, setActiveTab] = useState<'general' | 'ai' | 'apis' | 'about'>('general');
  const [version, setVersion] = useState<string>('');
  const menuRef = useRef<HTMLDivElement>(null);
  const hotkeyInputRef = useRef<HTMLInputElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    setLocalSettings(settings);
    if (window.electronAPI) {
      window.electronAPI.getVersion().then(setVersion);
    }
    
    // Model path'e göre model size'ı otomatik tespit et
    if (settings.voskModelPath) {
      const modelPath = settings.voskModelPath.toLowerCase();
      const isSmallModel = modelPath.includes('small') || modelPath.includes('vosk-model-small');
      const isLargeModel = !isSmallModel && (modelPath.includes('vosk-model-tr') || modelPath.includes('vosk-model-en') || modelPath.includes('vosk-model-'));
      
      // Eğer model path'te small varsa ama settings'te large seçiliyse, small'a güncelle
      if (isSmallModel && settings.voskModelSize === 'large') {
        const updatedSettings = { ...settings, voskModelSize: 'small' as const };
        setLocalSettings(updatedSettings);
      }
      // Eğer model path'te small yoksa ve large model gibi görünüyorsa, large'a güncelle
      else if (isLargeModel && settings.voskModelSize === 'small') {
        const updatedSettings = { ...settings, voskModelSize: 'large' as const };
        setLocalSettings(updatedSettings);
      }
    }
  }, [settings, isOpen]);

  // Menüyü taşınabilir yap ve başlangıç pozisyonunu ayarla
  useEffect(() => {
    if (!isOpen || !menuRef.current || !headerRef.current) return;

    const menu = menuRef.current;
    const header = headerRef.current;
    
    // Başlığı pencerenin en üstüne, ortaya yerleştir
    const menuWidth = menu.offsetWidth || 600;
    const left = (window.innerWidth - menuWidth) / 2;
    menu.style.left = `${left}px`;
    menu.style.top = `20px`;
    
    let isDraggingLocal = false;
    let startX = 0;
    let startY = 0;
    let initialX = 0;
    let initialY = 0;

    const handleMouseDown = (e: MouseEvent) => {
      if (e.target && (e.target as HTMLElement).closest('.close-button')) {
        return; // Close button'a tıklanırsa taşıma
      }
      startX = e.clientX;
      startY = e.clientY;
      const rect = menu.getBoundingClientRect();
      initialX = rect.left;
      initialY = rect.top;
      isDraggingLocal = true;
      setIsDragging(true);
      e.preventDefault();
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingLocal) return;
      const deltaX = e.clientX - startX;
      const deltaY = e.clientY - startY;
      menu.style.left = `${initialX + deltaX}px`;
      menu.style.top = `${initialY + deltaY}px`;
      menu.style.transform = 'none';
    };

    const handleMouseUp = () => {
      isDraggingLocal = false;
      setIsDragging(false);
    };

    header.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      header.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isOpen]);
  
  // Dil değiştiğinde çevirileri güncelle (localSettings.language değiştiğinde)
  const translations = useMemo(() => {
    const lang = localSettings.language || 'tr';
    return getTranslation(lang as 'tr' | 'en');
  }, [localSettings.language]);

  const handleSave = async () => {
    await saveSettings(localSettings);
    
    // Theme değişikliğini uygula
    if (localSettings.theme !== settings.theme) {
      const root = document.documentElement;
      const theme = localSettings.theme as 'light' | 'dark';
      const colors = CURSOR_THEME_COLORS[theme] || CURSOR_THEME_COLORS.dark;
      
      // CSS değişkenlerini ayarla
      root.style.setProperty('--bg-color', colors.background);
      root.style.setProperty('--text-color', colors.text);
      root.style.setProperty('--border-color', colors.border);
      root.style.setProperty('--button-color', colors.button);
      root.style.setProperty('--button-hover-color', colors.buttonHover);
      root.style.setProperty('--input-color', colors.input);
      root.style.setProperty('--accent-color', colors.accent || colors.button);
      
      // Body class'ını güncelle
      document.body.className = `theme-${theme}`;
    }
    
    // Dil değişikliğini uygula (zaten saveSettings içinde kaydediliyor, useTheme ve useSettings otomatik güncellenecek)
    
    // App.tsx'teki settings'i güncellemek için callback çağır
    if (onSettingsSaved) {
      onSettingsSaved();
    }
    
    onClose();
  };

  const handleChange = <K extends keyof typeof localSettings>(
    key: K,
    value: typeof localSettings[K]
  ) => {
    const newSettings = { ...localSettings, [key]: value };
    setLocalSettings(newSettings);
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    // Eğer tıklama menü içindeyse, overlay'i kapatma
    if (menuRef.current && menuRef.current.contains(e.target as Node)) {
      return;
    }
    // Overlay'e tıklanırsa menüyü kapat
    onClose();
  };

  if (!isOpen) return null;

  const menuContent = (
    <div 
      ref={menuRef}
      className="settings-menu" 
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
        <div 
          ref={headerRef}
          className="settings-header"
        >
          <h2>{translations.settings}</h2>
          <button 
            className="close-button" 
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            ×
          </button>
        </div>

        <div className="settings-tabs">
          <button
            className={activeTab === 'general' ? 'active' : ''}
            onClick={(e) => {
              e.stopPropagation();
              setActiveTab('general');
            }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            General
          </button>
          <button
            className={activeTab === 'ai' ? 'active' : ''}
            onClick={(e) => {
              e.stopPropagation();
              setActiveTab('ai');
            }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            AI
          </button>
          <button
            className={activeTab === 'apis' ? 'active' : ''}
            onClick={(e) => {
              e.stopPropagation();
              setActiveTab('apis');
            }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            APIs
          </button>
          <button
            className={activeTab === 'about' ? 'active' : ''}
            onClick={(e) => {
              e.stopPropagation();
              setActiveTab('about');
            }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            About
          </button>
        </div>

        <div className="settings-content">
          {activeTab === 'general' && (
            <div className="settings-section">
              <div className="setting-item">
                <label>{translations.theme}</label>
                <select
                  value={localSettings.theme}
                  onChange={(e) => handleChange('theme', e.target.value as any)}
                >
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                </select>
              </div>

              <div className="setting-item">
                <label>{translations.fontSize}</label>
                <input
                  type="number"
                  min="10"
                  max="24"
                  value={localSettings.fontSize}
                  onChange={(e) => handleChange('fontSize', parseInt(e.target.value))}
                />
              </div>

              <div className="setting-item">
                <label>{translations.fontFamily}</label>
                <input
                  type="text"
                  value={localSettings.fontFamily}
                  onChange={(e) => handleChange('fontFamily', e.target.value)}
                />
              </div>

              <div className="setting-item">
                <label>{translations.language}</label>
                <select
                  value={localSettings.language}
                  onChange={(e) => handleChange('language', e.target.value as any)}
                >
                  <option value="tr">Türkçe</option>
                  <option value="en">English</option>
                </select>
              </div>

              <div className="setting-item">
                <label>
                  <input
                    type="checkbox"
                    checked={localSettings.autoSaveNotes}
                    onChange={(e) => handleChange('autoSaveNotes', e.target.checked)}
                  />
                  {translations.autoSaveNotes}
                </label>
              </div>

              <div className="setting-item">
                <label>
                  <input
                    type="checkbox"
                    checked={localSettings.alwaysOnTop}
                    onChange={(e) => handleChange('alwaysOnTop', e.target.checked)}
                  />
                  {translations.alwaysOnTop}
                </label>
              </div>

              <div className="setting-item">
                <label>
                  <input
                    type="checkbox"
                    checked={localSettings.minimizeToTray || false}
                    onChange={(e) => handleChange('minimizeToTray', e.target.checked)}
                  />
                  {translations.minimizeToTray}
                </label>
                <small>{translations.minimizeToTrayDescription}</small>
              </div>

              <div className="setting-item">
                <label>{translations.globalHotkey}</label>
                <input
                  type="text"
                  placeholder="Click here and press your key combination (e.g., Ctrl+Shift+D)"
                  value={localSettings.globalHotkey || ''}
                  readOnly
                  tabIndex={0}
                  onClick={(e) => {
                    e.currentTarget.focus();
                    console.log('Global hotkey input clicked, focusing...');
                  }}
                  onFocus={(e) => {
                    e.target.placeholder = 'Press your key combination...';
                    console.log('Global hotkey input focused');
                  }}
                  onBlur={(e) => {
                    e.target.placeholder = 'Click here and press your key combination (e.g., Ctrl+Shift+D)';
                    console.log('Global hotkey input blurred');
                  }}
                  onKeyDown={(e) => {
                    console.log('KeyDown event:', e.key, 'code:', e.code, 'ctrl:', e.ctrlKey, 'alt:', e.altKey, 'shift:', e.shiftKey, 'meta:', e.metaKey);
                    e.preventDefault();
                    e.stopPropagation();
                    
                    // Escape tuşuna basılırsa temizle
                    if (e.key === 'Escape') {
                      console.log('Escape pressed, clearing hotkey');
                      handleChange('globalHotkey', '');
                      return;
                    }
                    
                    const parts: string[] = [];
                    if (e.ctrlKey || e.metaKey) parts.push('Ctrl');
                    if (e.altKey) parts.push('Alt');
                    if (e.shiftKey) parts.push('Shift');
                    
                    // Ana tuşu al - önce code'a bak, sonra key'e
                    let key = '';
                    
                    // F tuşları
                    if (e.code.startsWith('F') && e.code.length <= 3) {
                      key = e.code; // F1, F2, vb.
                    }
                    // Sayılar (üst sıra)
                    else if (e.code.startsWith('Digit')) {
                      key = e.code.replace('Digit', '');
                    }
                    // Sayılar (numpad)
                    else if (e.code.startsWith('Numpad')) {
                      key = e.code.replace('Numpad', 'Num');
                    }
                    // Harfler
                    else if (e.code.startsWith('Key')) {
                      key = e.code.replace('Key', '');
                    }
                    // Özel tuşlar
                    else {
                      const specialKeys: { [key: string]: string } = {
                        'Space': 'Space',
                        'Enter': 'Enter',
                        'Escape': 'Escape',
                        'Tab': 'Tab',
                        'Backspace': 'Backspace',
                        'Delete': 'Delete',
                        'Insert': 'Insert',
                        'Home': 'Home',
                        'End': 'End',
                        'PageUp': 'PageUp',
                        'PageDown': 'PageDown',
                        'ArrowUp': 'Up',
                        'ArrowDown': 'Down',
                        'ArrowLeft': 'Left',
                        'ArrowRight': 'Right',
                        'PrintScreen': 'PrintScreen',
                        'ScrollLock': 'ScrollLock',
                        'Pause': 'Pause',
                        'ContextMenu': 'ContextMenu',
                        'MetaLeft': 'Meta',
                        'MetaRight': 'Meta',
                        'ControlLeft': '',
                        'ControlRight': '',
                        'AltLeft': '',
                        'AltRight': '',
                        'ShiftLeft': '',
                        'ShiftRight': ''
                      };
                      
                      // Özel tuşlar için key veya code kullan
                      key = specialKeys[e.code] || specialKeys[e.key] || '';
                      
                      // Eğer hala boşsa ve key tek karakter ise
                      if (!key && e.key.length === 1 && e.key.match(/[a-zA-Z0-9]/)) {
                        key = e.key.toUpperCase();
                      }
                    }
                    
                    console.log('Parsed key:', key, 'parts:', parts);
                    
                    // Modifier tuşlarından en az biri ve bir ana tuş olmalı
                    // Ama bazı tuşlar (F tuşları, sayılar) modifier olmadan da kabul edilebilir
                    if (key) {
                      // Modifier tuşların kendilerini atla
                      if (key === '' || key === 'Meta') {
                        console.log('Skipping modifier-only key');
                        return;
                      }
                      
                      // Modifier varsa ekle
                      if (parts.length > 0) {
                        parts.push(key);
                        const hotkey = parts.join('+');
                        console.log('Global hotkey captured:', hotkey);
                        handleChange('globalHotkey', hotkey);
                        console.log('handleChange called, new value should be:', hotkey);
                      } else {
                        // Modifier yok - sadece F tuşları ve bazı özel tuşlar kabul edilebilir
                        if (key.startsWith('F') || key === 'Space' || key === 'Enter' || key === 'Tab') {
                          const hotkey = key;
                          console.log('Global hotkey captured (no modifier):', hotkey);
                          handleChange('globalHotkey', hotkey);
                        } else {
                          console.log('Invalid hotkey: modifier key required for:', key);
                        }
                      }
                    } else {
                      console.log('No valid key found, key:', key, 'parts:', parts);
                    }
                  }}
                />
                <small>{translations.globalHotkeyDescription}</small>
              </div>

              <div className="setting-item">
                <label>{translations.notesFolder}</label>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <input
                    type="text"
                    value={localSettings.notesFolder || 'Default'}
                    readOnly
                    style={{ flex: 1 }}
                  />
                  <button
                    onClick={async (e) => {
                      e.stopPropagation();
                      if (window.electronAPI) {
                        const folder = await window.electronAPI.selectNotesFolder();
                        if (folder) {
                          handleChange('notesFolder', folder);
                        }
                      }
                    }}
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    {translations.browse}
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'ai' && (
            <div className="settings-section">
              <div className="setting-item">
                <label>{translations.selectedAI}</label>
                <select
                  value={localSettings.selectedAI}
                  onChange={(e) => handleChange('selectedAI', e.target.value)}
                >
                  <option value="openai">OpenAI</option>
                  <option value="claude">Claude (Anthropic)</option>
                  <option value="gemini">Gemini (Google)</option>
                </select>
                {localSettings.selectedAI === 'openai' && (
                  <>
                    <select
                      value={localSettings.openAIModel || 'gpt-3.5-turbo'}
                      onChange={(e) => handleChange('openAIModel', e.target.value)}
                      style={{ marginTop: '10px' }}
                    >
                      <option value="gpt-3.5-turbo">{translations.openAIModelGPT35Turbo}</option>
                      <option value="gpt-4">{translations.openAIModelGPT4}</option>
                      <option value="gpt-4-turbo">{translations.openAIModelGPT4Turbo}</option>
                      <option value="gpt-4o">{translations.openAIModelGPT4o}</option>
                      <option value="gpt-4o-mini">{translations.openAIModelGPT4oMini}</option>
                    </select>
                    <small>{translations.openAIModelDescription}</small>
                  </>
                )}
                {localSettings.selectedAI === 'claude' && (
                  <>
                    <select
                      value={localSettings.claudeModel || 'claude-3-5-sonnet-20241022'}
                      onChange={(e) => handleChange('claudeModel', e.target.value)}
                      style={{ marginTop: '10px' }}
                    >
                      <option value="claude-3-5-sonnet-20241022">{translations.claudeModelSonnet}</option>
                      <option value="claude-3-opus-20240229">{translations.claudeModelOpus}</option>
                      <option value="claude-3-sonnet-20240229">{translations.claudeModelSonnetOld}</option>
                      <option value="claude-3-haiku-20240307">{translations.claudeModelHaiku}</option>
                    </select>
                    <small>{translations.claudeModelDescription}</small>
                  </>
                )}
                {localSettings.selectedAI === 'gemini' && (
                  <>
                    <select
                      value={localSettings.geminiModel || 'gemini-pro'}
                      onChange={(e) => handleChange('geminiModel', e.target.value)}
                      style={{ marginTop: '10px' }}
                    >
                      <option value="gemini-pro">{translations.geminiModelPro}</option>
                      <option value="gemini-pro-vision">{translations.geminiModelProVision}</option>
                      <option value="gemini-1.5-pro">{translations.geminiModel15Pro}</option>
                      <option value="gemini-1.5-flash">{translations.geminiModel15Flash}</option>
                    </select>
                    <small>{translations.geminiModelDescription}</small>
                  </>
                )}
              </div>
              <p style={{ color: '#666', fontSize: '12px', marginTop: '10px' }}>
                {translations.apiKeysManaged}
              </p>
            </div>
          )}

          {activeTab === 'apis' && (
            <div className="settings-section">
              <div className="setting-item">
                <label>{translations.openAIApiKey}</label>
                <input
                  type="password"
                  placeholder="sk-..."
                  value={localSettings.openAIApiKey || ''}
                  onChange={(e) => handleChange('openAIApiKey', e.target.value)}
                />
                <small>{translations.apiKeyStoredLocally}</small>
              </div>

              <div className="setting-item">
                <label>{translations.claudeApiKey}</label>
                <input
                  type="password"
                  placeholder="sk-ant-..."
                  value={localSettings.claudeApiKey || ''}
                  onChange={(e) => handleChange('claudeApiKey', e.target.value)}
                />
                <small>{translations.apiKeyStoredLocally}</small>
              </div>

              <div className="setting-item">
                <label>{translations.geminiApiKey}</label>
                <input
                  type="password"
                  placeholder="AIza..."
                  value={localSettings.geminiApiKey || ''}
                  onChange={(e) => handleChange('geminiApiKey', e.target.value)}
                />
                <small>{translations.apiKeyStoredLocally}</small>
              </div>

              <div className="setting-item">
                <label>{translations.speechRecognitionProvider}</label>
                <select
                  value={localSettings.speechRecognitionProvider || 'vosk'}
                  onChange={(e) => handleChange('speechRecognitionProvider', e.target.value as any)}
                >
                  <option value="vosk">Vosk (Offline)</option>
                  <option value="web-speech">Web Speech API (Browser - Online)</option>
                  <option value="google-cloud">Google Cloud Speech-to-Text (Online)</option>
                  <option value="azure">Azure Speech Services (Online)</option>
                </select>
                <small>{translations.speechRecognitionProviderDescription}</small>
              </div>

              {localSettings.speechRecognitionProvider === 'vosk' && (
                <>
                  <div className="setting-item">
                    <label>
                      <input
                        type="checkbox"
                        checked={localSettings.voskEnabled || false}
                        onChange={(e) => handleChange('voskEnabled', e.target.checked)}
                      />
                      {translations.enableVoskSpeechRecognition}
                    </label>
                    <small>{translations.enableVoskSpeechRecognitionDescription}</small>
                  </div>

                  {localSettings.voskEnabled && (
                    <>
                      <div className="setting-item">
                        <label>{translations.downloadVoskModel}</label>
                        <div style={{ display: 'flex', gap: '10px', flexDirection: 'column' }}>
                          <div style={{ display: 'flex', gap: '10px' }}>
                            <select
                              value={localSettings.voskModelLanguage || 'tr'}
                              onChange={(e) => handleChange('voskModelLanguage', e.target.value as any)}
                              style={{ flex: 1 }}
                            >
                              <option value="ar">العربية (Arabic)</option>
                              <option value="zh">中文 (Chinese)</option>
                              <option value="cs">Čeština (Czech)</option>
                              <option value="nl">Nederlands (Dutch)</option>
                              <option value="en">English (English)</option>
                              <option value="fa">فارسی (Persian)</option>
                              <option value="fr">Français (French)</option>
                              <option value="de">Deutsch (German)</option>
                              <option value="he">עברית (Hebrew)</option>
                              <option value="hi">हिन्दी (Hindi)</option>
                              <option value="it">Italiano (Italian)</option>
                              <option value="ja">日本語 (Japanese)</option>
                              <option value="ko">한국어 (Korean)</option>
                              <option value="pl">Polski (Polish)</option>
                              <option value="pt">Português (Portuguese)</option>
                              <option value="ru">Русский (Russian)</option>
                              <option value="es">Español (Spanish)</option>
                              <option value="tr">Türkçe (Turkish)</option>
                              <option value="uk">Українська (Ukrainian)</option>
                              <option value="vi">Tiếng Việt (Vietnamese)</option>
                            </select>
                            <select
                              value={localSettings.voskModelSize || 'small'}
                              onChange={(e) => {
                                const modelSize = e.target.value as 'small' | 'large';
                                handleChange('voskModelSize', modelSize);
                              }}
                              style={{ flex: 1 }}
                            >
                              <option value="small">
                                {translations.voskModelSizeSmall}
                                {localSettings.voskModelLanguage === 'tr' && ' (~45MB)'}
                                {localSettings.voskModelLanguage === 'en' && ' (~39MB)'}
                                {localSettings.voskModelLanguage && localSettings.voskModelLanguage !== 'tr' && localSettings.voskModelLanguage !== 'en' && ' (~40-50MB)'}
                              </option>
                              <option value="large">
                                {translations.voskModelSizeLarge}
                                {localSettings.voskModelLanguage === 'tr' && ' (~1.8GB)'}
                                {localSettings.voskModelLanguage === 'en' && ' (~1.5GB)'}
                                {localSettings.voskModelLanguage && localSettings.voskModelLanguage !== 'tr' && localSettings.voskModelLanguage !== 'en' && ' (~1.5-2GB)'}
                              </option>
                            </select>
                          </div>
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              if (!window.electronAPI) {
                                alert('Electron API not available');
                                return;
                              }

                              const modelSize = (localSettings.voskModelSize || 'small') as 'small' | 'large';
                              const language = localSettings.voskModelLanguage || 'tr';
                              
                              // Progress listener ekle
                              const progressDiv = document.createElement('div');
                              progressDiv.style.cssText = 'margin-top: 10px; padding: 10px; background: var(--input-color); border-radius: 4px; color: var(--text-color);';
                              e.currentTarget.parentElement?.appendChild(progressDiv);
                              
                              // Progress listener'ı güvenli bir şekilde ekle
                              if (window.electronAPI.onVoskModelDownloadProgress) {
                                window.electronAPI.onVoskModelDownloadProgress((progress: number) => {
                                  progressDiv.innerHTML = `${translations.downloadingModel}: ${progress}%`;
                                });
                              } else {
                                progressDiv.innerHTML = translations.startingDownload;
                              }

                              try {
                                const result = await window.electronAPI.downloadVoskModel(language, modelSize);
                                
                                if (window.electronAPI.removeVoskModelDownloadProgressListener) {
                                  window.electronAPI.removeVoskModelDownloadProgressListener();
                                }
                                
                                if (result.success && result.modelPath) {
                                  handleChange('voskModelPath', result.modelPath);
                                  
                                  // Model path'e göre model size'ı otomatik güncelle
                                  const modelPath = result.modelPath.toLowerCase();
                                  const isSmallModel = modelPath.includes('small') || modelPath.includes('vosk-model-small');
                                  if (isSmallModel && localSettings.voskModelSize === 'large') {
                                    handleChange('voskModelSize', 'small');
                                  } else if (!isSmallModel && localSettings.voskModelSize === 'small') {
                                    handleChange('voskModelSize', 'large');
                                  }
                                  
                                  const message = result.message || 'Model downloaded successfully!';
                                  const isFallback = message.includes('using small model') || message.includes('small model');
                                  progressDiv.innerHTML = `✅ ${message}`;
                                  progressDiv.style.background = isFallback ? '#fff3cd' : '#d4edda';
                                  progressDiv.style.color = isFallback ? '#856404' : '#155724';
                                  setTimeout(() => progressDiv.remove(), isFallback ? 5000 : 3000);
                                } else {
                                  progressDiv.innerHTML = `❌ Error: ${result.error || 'Failed to download model'}`;
                                  progressDiv.style.background = '#f8d7da';
                                  progressDiv.style.color = '#721c24';
                                }
                              } catch (error: any) {
                                if (window.electronAPI.removeVoskModelDownloadProgressListener) {
                                  window.electronAPI.removeVoskModelDownloadProgressListener();
                                }
                                progressDiv.innerHTML = `❌ Error: ${error?.message || 'Failed to download model'}`;
                                progressDiv.style.background = '#f8d7da';
                                progressDiv.style.color = '#721c24';
                              }
                            }}
                            onMouseDown={(e) => e.stopPropagation()}
                            style={{ padding: '8px 16px', cursor: 'pointer' }}
                          >
                            {translations.downloadModel}
                          </button>
                        </div>
                        <small>
                          {translations.downloadVoskModelDescription}
                        </small>
                      </div>

                      <div className="setting-item">
                        <label>{translations.voskModelPath}</label>
                        <div style={{ display: 'flex', gap: '10px' }}>
                          <input
                            type="text"
                            placeholder={translations.selectVoskModelFolder}
                            value={localSettings.voskModelPath || ''}
                            readOnly
                            style={{ flex: 1 }}
                          />
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              if (window.electronAPI) {
                                const folder = await window.electronAPI.selectVoskModelFolder();
                                if (folder) {
                                  handleChange('voskModelPath', folder);
                                  
                                  // Model path'e göre model size'ı otomatik güncelle
                                  const modelPath = folder.toLowerCase();
                                  const isSmallModel = modelPath.includes('small') || modelPath.includes('vosk-model-small');
                                  if (isSmallModel && localSettings.voskModelSize === 'large') {
                                    handleChange('voskModelSize', 'small');
                                  } else if (!isSmallModel && localSettings.voskModelSize === 'small') {
                                    handleChange('voskModelSize', 'large');
                                  }
                                }
                              }
                            }}
                            onMouseDown={(e) => e.stopPropagation()}
                          >
                            {translations.browse}
                          </button>
                        </div>
                        <small>
                          {translations.voskModelPathDescription}
                        </small>
                      </div>

                      {localSettings.voskModelPath && (
                        <div className="setting-item">
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              if (window.electronAPI) {
                                try {
                                  const isValid = await window.electronAPI.validateVoskModel(localSettings.voskModelPath || '');
                                  if (isValid) {
                                    alert(translations.voskModelValid);
                                  } else {
                                    alert(translations.voskModelInvalid);
                                  }
                                } catch (error) {
                                  console.error('Error validating Vosk model:', error);
                                  alert(translations.voskModelValidationError);
                                }
                              }
                            }}
                            onMouseDown={(e) => e.stopPropagation()}
                            style={{ padding: '8px 16px', cursor: 'pointer' }}
                          >
                            Validate Model
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </>
              )}

              {localSettings.speechRecognitionProvider !== 'web-speech' && localSettings.speechRecognitionProvider !== 'vosk' && (
                <div className="setting-item">
                  <label>{translations.speechRecognitionApiKey}</label>
                  <input
                    type="password"
                    placeholder="Enter API key..."
                    value={localSettings.speechRecognitionApiKey || ''}
                    onChange={(e) => handleChange('speechRecognitionApiKey', e.target.value)}
                  />
                </div>
              )}
            </div>
          )}

          {activeTab === 'about' && (
            <div className="settings-section">
              <div className="about-content">
                <h3>{translations.devNote}</h3>
                <p>{translations.version}: {version}</p>
                <p>
                  {translations.aboutDescription}
                </p>
                <p>
                  <strong>{translations.features}:</strong>
                </p>
                <ul>
                  <li>{translations.featureVoiceToText}</li>
                  <li>{translations.featureAICodeGeneration}</li>
                  <li>{translations.featureDailyNotesAutoSave}</li>
                  <li>{translations.featureCustomizableThemes}</li>
                  <li>{translations.featureMultiPlatform}</li>
                </ul>
                <p>
                  <strong>{translations.license}:</strong> {translations.licenseMIT}
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="settings-footer">
          <button 
            className="cancel-button" 
            onClick={(e) => {
              e.stopPropagation();
              // Eski ayarları geri yükle
              setLocalSettings(settings);
              // Eski temayı geri yükle
              const root = document.documentElement;
              const theme = settings.theme || 'dark';
              const colors = CURSOR_THEME_COLORS[theme] || CURSOR_THEME_COLORS.dark;
              
              root.style.setProperty('--bg-color', colors.background);
              root.style.setProperty('--text-color', colors.text);
              root.style.setProperty('--border-color', colors.border);
              root.style.setProperty('--button-color', colors.button);
              root.style.setProperty('--button-hover-color', colors.buttonHover);
              root.style.setProperty('--input-color', colors.input);
              root.style.setProperty('--accent-color', colors.accent || colors.button);
              
              document.body.className = `theme-${theme}`;
              
              onClose();
            }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            Cancel
          </button>
          <button 
            className="save-button" 
            onClick={(e) => {
              e.stopPropagation();
              handleSave();
            }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            Save
          </button>
        </div>
      </div>
  );

  return menuContent;
};

