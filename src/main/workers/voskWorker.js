// Vosk Worker - Child process olarak çalışır
// Bu sayede native modül yükleme sorunları önlenir

const fs = require('fs');
const path = require('path');

// Vosk'u yüklemeyi dene - hata yakalama ile
let vosk;
try {
  console.log('[Vosk Worker] Attempting to load Vosk native module...');
  console.log('[Vosk Worker] Node version:', process.versions.node);
  console.log('[Vosk Worker] Platform:', process.platform);
  console.log('[Vosk Worker] Architecture:', process.arch);
  
  vosk = require('vosk');
  console.log('[Vosk Worker] ✅ Vosk native module loaded successfully');
} catch (error) {
  console.error('[Vosk Worker] ❌ Failed to load Vosk native module:', error);
  console.error('[Vosk Worker] Error details:', {
    name: error?.name,
    message: error?.message,
    code: error?.code,
    stack: error?.stack
  });
  
  // Parent process'e hata bildir
  process.send({ 
    type: 'error', 
    error: `Failed to load Vosk: ${error?.message || 'Unknown error'}`,
    details: {
      name: error?.name,
      code: error?.code,
      stack: error?.stack
    }
  });
  
  // Worker'ı kapat
  setTimeout(() => {
    process.exit(1);
  }, 1000);
  return;
}

let model = null;
let recognizer = null;
let isInitialized = false;

// Parent process'ten mesaj al
process.on('message', async (msg) => {
  try {
    switch (msg.type) {
      case 'initialize':
        await handleInitialize(msg);
        break;
      
      case 'recognize':
        await handleRecognize(msg);
        break;
      
      case 'getFinalResult':
        handleGetFinalResult(msg);
        break;
      
      case 'reset':
        handleReset(msg);
        break;
      
      case 'cleanup':
        handleCleanup(msg);
        break;
      
      case 'isReady':
        process.send({ messageId: msg.messageId, type: 'isReady', ready: isInitialized });
        break;
      
      default:
        process.send({ type: 'error', error: `Unknown message type: ${msg.type}` });
    }
  } catch (error) {
    process.send({ 
      type: 'error', 
      error: error.message,
      stack: error.stack 
    });
  }
});

async function handleInitialize(msg) {
  try {
    const { modelPath, sampleRate = 16000, messageId } = msg;
    console.log('[Vosk Worker] Initializing with model path:', modelPath);
    
    if (!fs.existsSync(modelPath)) {
      throw new Error(`Model path does not exist: ${modelPath}`);
    }

    // Model'i yükle
    model = new vosk.Model(modelPath);
    console.log('[Vosk Worker] Model loaded');
    
    // Recognizer oluştur
    recognizer = new vosk.Recognizer({ model: model, sampleRate });
    console.log('[Vosk Worker] Recognizer created');
    
    isInitialized = true;
    
    process.send({ 
      messageId,
      type: 'initialized', 
      success: true 
    });
  } catch (error) {
    console.error('[Vosk Worker] Initialization error:', error);
    process.send({ 
      messageId: msg.messageId,
      type: 'initialized', 
      success: false, 
      error: error.message 
    });
  }
}

async function handleRecognize(msg) {
  try {
    const { audioBuffer, messageId } = msg;
    
    if (!isInitialized || !recognizer) {
      throw new Error('Vosk is not initialized');
    }

    // Audio buffer'ı işle
    const buffer = Buffer.from(audioBuffer);
    
    // Recognizer'a gönder
    let result;
    if (recognizer.acceptWaveform(buffer)) {
      result = recognizer.result();
      process.send({ 
        messageId,
        type: 'result', 
        text: result.text || '',
        isFinal: true 
      });
    } else {
      const partial = recognizer.partialResult();
      process.send({ 
        messageId,
        type: 'result', 
        text: partial.partial || '',
        isFinal: false 
      });
    }
  } catch (error) {
    console.error('[Vosk Worker] Recognition error:', error);
    process.send({ 
      messageId: msg.messageId,
      type: 'error', 
      error: error.message 
    });
  }
}

function handleGetFinalResult(msg) {
  try {
    const { messageId } = msg || {};
    
    if (!isInitialized || !recognizer) {
      process.send({ messageId, type: 'finalResult', text: '' });
      return;
    }

    const result = recognizer.finalResult();
    process.send({ 
      messageId,
      type: 'finalResult', 
      text: result.text || '' 
    });
  } catch (error) {
    console.error('[Vosk Worker] Get final result error:', error);
    process.send({ 
      messageId: msg?.messageId,
      type: 'error', 
      error: error.message 
    });
  }
}

function handleReset(msg) {
  try {
    const { messageId } = msg || {};
    
    if (recognizer) {
      recognizer.reset();
      process.send({ messageId, type: 'reset', success: true });
    } else {
      process.send({ messageId, type: 'reset', success: false });
    }
  } catch (error) {
    console.error('[Vosk Worker] Reset error:', error);
    process.send({ 
      messageId: msg?.messageId,
      type: 'error', 
      error: error.message 
    });
  }
}

function handleCleanup(msg) {
  try {
    const { messageId } = msg || {};
    
    if (recognizer) {
      recognizer.free();
      recognizer = null;
    }
    
    if (model) {
      model.free();
      model = null;
    }
    
    isInitialized = false;
    
    process.send({ messageId, type: 'cleanup', success: true });
    
    // Worker'ı kapat
    setTimeout(() => {
      process.exit(0);
    }, 100);
  } catch (error) {
    console.error('[Vosk Worker] Cleanup error:', error);
    process.send({ 
      messageId: msg?.messageId,
      type: 'error', 
      error: error.message 
    });
  }
}

// Hata yakalama
process.on('uncaughtException', (error) => {
  console.error('[Vosk Worker] Uncaught exception:', error);
  process.send({ 
    type: 'error', 
    error: error.message,
    stack: error.stack 
  });
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[Vosk Worker] Unhandled rejection:', reason);
  process.send({ 
    type: 'error', 
    error: reason instanceof Error ? reason.message : String(reason)
  });
});

// Worker hazır olduğunu bildir
console.log('[Vosk Worker] Worker is ready, sending ready message to parent...');
process.send({ type: 'ready' });
console.log('[Vosk Worker] Ready message sent');

