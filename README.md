# devnote
electron-based, **offline speech recognition** and **online ai-powered** **speech-to-text** application
![Uploading intro.gif…]()

## 🚀 features

offline speech recognition using vosk

in-app language model download and activation (user-controlled)

online ai-powered speech-to-text integration

real-time microphone audio recording

fast and lightweight electron desktop application

privacy-focused offline mode

clean and minimal user interface

---

## 🧩 requirements

- [node.js](https://nodejs.org/) v16 or newer

- npm

- microphone access

- internet connection (required only for model download and online ai mode)

---

## ⚙️ setup
### 1️⃣ clone the repository
```bash
git clone https://github.com/cantoksun/devnote.git
```
```bash
cd devnote
```
### 2️⃣ install dependencies
```bash
npm install
```

the vosk language model can be downloaded and activated by the user from the in-app model management section.

### ▶️ run the app
```bash
npm run dev
```

## 💬 usage

click the microphone button

start speaking

speech is converted to text in real time

offline mode:

requires a vosk language model to be downloaded and activated in the app

works fully offline after activation

online ai mode:

requires an internet connection

transcribed text is sent to an ai service for further processing

offers higher accuracy and extended capabilities

---

## 🤖 ai integration

when users provide their own ai api key, the application can send transcribed speech text to an online ai service.

this allows users to:

speak freely

convert speech to text

forward recognized text to an ai model for chat, summarization, or command processing

ai integration is optional and fully controlled by the user.

---

## 🔐 environment variable security

all environment variables provided by the user (including api keys) are stored encrypted within the application.

sensitive values are never stored in plain text

encryption and decryption are handled internally

variables are accessed only at runtime

note: no client-side encryption can guarantee absolute security. users should always treat api keys as sensitive data.

---

## 🔒 privacy & data usage

offline speech recognition runs entirely on the local machine

audio data is never sent to external services

only transcribed text is optionally sent to the ai service

api keys and sensitive settings are stored in encrypted form

---

## 🧑‍💻 author

cantoksun
