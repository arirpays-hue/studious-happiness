/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { 
  HardDrive, FileVideo, FileAudio, Download, CheckCircle, AlertCircle, 
  Loader2, Cpu, Lock, Trash2, Bookmark, AlertTriangle, Zap, Sparkles, 
  Settings2, FileText, Activity, LogOut, Users, Mail, Copy, Check, 
  AlignLeft, CheckSquare, List, Key, Settings, Moon, Sun, Globe, 
  Wand2, Type, FileJson, Eye, EyeOff, XCircle, Rocket 
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { SUPPORTED_LANGUAGES, I18N } from './constants';

const APP_ID = 'ai-subtitle-generator';

export default function App() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<'idle' | 'processing' | 'complete' | 'error'>('idle'); 
  const [errorMessage, setErrorMessage] = useState('');
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('');
  const [srtResult, setSrtResult] = useState('');
  const [modelSize, setModelSize] = useState('Xenova/whisper-base');
  
  // Language Settings
  const [sourceLang, setSourceLang] = useState(() => localStorage.getItem('sourceLang') || 'auto');
  const [targetLang, setTargetLang] = useState(() => localStorage.getItem('targetLang') || 'original');
  const [isDetectingLanguage, setIsDetectingLanguage] = useState(false);
  
  const [isPersistent, setIsPersistent] = useState(false);
  const [storageUsedMB, setStorageUsedMB] = useState('0.00');
  const [isDragging, setIsDragging] = useState(false);
  const [copied, setCopied] = useState(false);
  
  // Gemini API States
  const [llmResult, setLlmResult] = useState('');
  const [isLlmLoading, setIsLlmLoading] = useState(false);
  const [llmError, setLlmError] = useState('');
  const [activeLlmAction, setActiveLlmAction] = useState<string | null>(null);
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [tempApiKey, setTempApiKey] = useState('');
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  
  // AI Typing Effect State
  const [displayedLlmResult, setDisplayedLlmResult] = useState('');
  
  // API Key Validation & UI State
  const [isApiKeyVisible, setIsApiKeyVisible] = useState(false);
  const [isEditingApiKey, setIsEditingApiKey] = useState(false);
  const isApiKeyValid = tempApiKey.trim() === '' || tempApiKey.trim().startsWith('AIza');
  
  // Theme & Additional Settings States
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');
  const [numChunks, setNumChunks] = useState(() => parseInt(localStorage.getItem('numChunks') || '16'));
  const [exportFormat, setExportFormat] = useState(() => localStorage.getItem('exportFormat') || 'srt');
  const [editorFontSize, setEditorFontSize] = useState(() => localStorage.getItem('editorFontSize') || '15px');
  const [threads, setThreads] = useState(() => parseInt(localStorage.getItem('threads') || '0'));
  const [useWebGPU, setUseWebGPU] = useState(() => localStorage.getItem('useWebGPU') === 'true');
  
  // Subtitle Customization States
  const [maxCharsPerLine, setMaxCharsPerLine] = useState(() => parseInt(localStorage.getItem('maxCharsPerLine') || '42'));
  const [removePunctuation, setRemovePunctuation] = useState(() => localStorage.getItem('removePunctuation') === 'true');
  
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [workerSession, setWorkerSession] = useState(0);
  const processingSessionRef = useRef(0);
  const [sessionStats, setSessionStats] = useState(() => {
      const saved = localStorage.getItem('sessionStats');
      return saved ? JSON.parse(saved) : { files: 0, totalTime: 0 };
  });
  const [uiLang, setUiLang] = useState<'he' | 'en'>(() => (localStorage.getItem('uiLang') as 'he' | 'en') || 'he');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const workerRef = useRef<Worker | null>(null);
  
  const whisperDownloadsRef = useRef<any>({});
  const nllbDownloadsRef = useRef<any>({});

  const t = I18N[uiLang];

  // Initialization & LocalStorage Saves
  useEffect(() => {
      const savedKey = localStorage.getItem('gemini_api_key');
      if (savedKey) setGeminiApiKey(savedKey);
      
      if (theme === 'dark') document.documentElement.classList.add('dark');
      else document.documentElement.classList.remove('dark');
  }, [theme]);
  
  useEffect(() => localStorage.setItem('numChunks', numChunks.toString()), [numChunks]);
  useEffect(() => localStorage.setItem('exportFormat', exportFormat), [exportFormat]);
  useEffect(() => localStorage.setItem('editorFontSize', editorFontSize), [editorFontSize]);
  useEffect(() => localStorage.setItem('threads', threads.toString()), [threads]);
  useEffect(() => localStorage.setItem('sessionStats', JSON.stringify(sessionStats)), [sessionStats]);
  useEffect(() => localStorage.setItem('useWebGPU', useWebGPU.toString()), [useWebGPU]);
  useEffect(() => localStorage.setItem('maxCharsPerLine', maxCharsPerLine.toString()), [maxCharsPerLine]);
  useEffect(() => localStorage.setItem('removePunctuation', removePunctuation.toString()), [removePunctuation]);
  useEffect(() => localStorage.setItem('sourceLang', sourceLang), [sourceLang]);
  useEffect(() => localStorage.setItem('targetLang', targetLang), [targetLang]);
  useEffect(() => {
      localStorage.setItem('uiLang', uiLang);
      document.documentElement.dir = uiLang === 'he' ? 'rtl' : 'ltr';
      document.documentElement.lang = uiLang;
  }, [uiLang]);

  // AI Typing Effect
  useEffect(() => {
      if (!llmResult) {
          setDisplayedLlmResult('');
          return;
      }
      
      let i = 0;
      setDisplayedLlmResult('');
      const timer = setInterval(() => {
          i += 3; // Typing speed
          if (i > llmResult.length) {
              setDisplayedLlmResult(llmResult);
              clearInterval(timer);
          } else {
              setDisplayedLlmResult(llmResult.substring(0, i));
          }
      }, 15);
      
      return () => clearInterval(timer);
  }, [llmResult]);

  // Language Detection
  const detectLanguageFromText = (text: string) => {
      if (!text) return null;
      const lowerText = text.toLowerCase();
      
      if (/[\u0590-\u05FF]/.test(text)) return 'he'; // Hebrew
      if (/[\u0400-\u04FF]/.test(text)) return 'ru'; // Russian
      if (/[\u0600-\u06FF]/.test(text)) return 'ar'; // Arabic
      if (/[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/.test(text)) return 'ja'; // Japanese
      if (/[\uac00-\ud7a3]/.test(text)) return 'ko'; // Korean
      if (/[\u0900-\u097F]/.test(text)) return 'hi'; // Hindi
      if (/[\u0E00-\u0E7F]/.test(text)) return 'th'; // Thai
      
      const words = lowerText.split(/\W+/);
      const countWords = (stopWords: string[]) => stopWords.reduce((acc, word) => acc + (words.includes(word) ? 1 : 0), 0);

      const scores: Record<string, number> = {
          en: countWords(['the', 'and', 'to', 'of', 'a', 'in', 'is', 'that', 'it', 'you']),
          es: countWords(['el', 'la', 'de', 'que', 'y', 'en', 'un', 'una', 'por', 'los']),
          fr: countWords(['le', 'la', 'de', 'et', 'est', 'je', 'un', 'une', 'dans', 'pour']),
          de: countWords(['der', 'die', 'das', 'und', 'in', 'den', 'von', 'zu', 'ist']),
          it: countWords(['il', 'la', 'di', 'e', 'che', 'un', 'una', 'in', 'per']),
          pt: countWords(['o', 'a', 'de', 'e', 'que', 'do', 'da', 'um', 'uma', 'para']),
          nl: countWords(['de', 'het', 'en', 'van', 'een', 'in', 'dat', 'op', 'te']),
          pl: countWords(['w', 'i', 'z', 'na', 'do', 'nie', 'ale', 'to', 'jak']),
          tr: countWords(['ve', 'bir', 'bu', 'da', 'de', 'için', 'ile', 'o', 'çok'])
      };

      let maxScore = 0;
      let detectedLang = null;
      for (const [lang, score] of Object.entries(scores)) {
          if (score > maxScore && score >= 1) {
              maxScore = score;
              detectedLang = lang;
          }
      }
      return detectedLang;
  };

  // Worker Management
  useEffect(() => {
    workerRef.current = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });

    workerRef.current.onmessage = (e) => {
        const { type, text, percent, step, data, chunks, error } = e.data;
        
        if (type === 'status') setStatusText(text);
        else if (type === 'progress_percent') setProgress(percent);
        else if (type === 'progress') handleWorkerProgress(step, data);
        else if (type === 'complete') {
            const srt = formatSRT(chunks, maxCharsPerLine, removePunctuation);
            setSrtResult(srt);
            setProgress(100);
            setStatus('complete');
            calculateStorageUsed(); 
            setSessionStats(prev => ({ ...prev, files: prev.files + 1 }));
            
            confetti({
                particleCount: 150,
                spread: 80,
                origin: { y: 0.6 },
                colors: ['#6366f1', '#a855f7', '#ec4899', '#10b981']
            });
        } 
        else if (type === 'detect_complete') {
            const detectedCode = detectLanguageFromText(text);
            if (detectedCode) {
                setSourceLang(detectedCode);
                if (detectedCode !== 'auto') setTargetLang('original');
                alert(uiLang === 'he' ? `זוהתה שפה: ${SUPPORTED_LANGUAGES.find(l=>l.code===detectedCode)?.name.he}` : `Detected language: ${SUPPORTED_LANGUAGES.find(l=>l.code===detectedCode)?.name.en}`);
            } else {
                alert(uiLang === 'he' ? 'לא הצלחנו לזהות בוודאות. ייתכן שיש מעט מדי דיבור בהתחלה או שפה לא נתמכת.' : 'Could not detect language with certainty. Try manual selection.');
            }
            setIsDetectingLanguage(false);
        }
        else if (type === 'detect_error') {
            alert((uiLang === 'he' ? "שגיאה בזיהוי השפה: " : "Language detection error: ") + error);
            setIsDetectingLanguage(false);
        }
        else if (type === 'error') {
            console.error("Worker Error:", error);
            setStatus('error');
            setErrorMessage(error || 'אירעה שגיאה בעיבוד נתונים ברקע.');
            setIsDetectingLanguage(false);
        }
    };

    async function initStorage() {
      if (navigator.storage && navigator.storage.persist) {
        let persisted = await navigator.storage.persisted();
        if (!persisted) persisted = await navigator.storage.persist();
        setIsPersistent(persisted);
      }
      calculateStorageUsed();
    }
    initStorage();

    return () => {
        if (workerRef.current) {
            workerRef.current.terminate();
        }
    };
  }, [workerSession]);

  const handleWorkerProgress = (step: string, data: any) => {
      if (step === 'transcribe_load') {
          const downloads = whisperDownloadsRef.current;
          if (data.status === 'initiate') downloads[data.file] = { loaded: 0, total: 0 };
          else if (data.status === 'progress') downloads[data.file] = { loaded: data.loaded || 0, total: data.total || 0 };
          else if (data.status === 'done' && downloads[data.file]) downloads[data.file].loaded = downloads[data.file].total;
          updateProgressFromDownloads(downloads, 10, 0.3, "זיהוי קולי");
      } else if (step === 'translate_load') {
          const downloads = nllbDownloadsRef.current;
          if (data.status === 'initiate') downloads[data.file] = { loaded: 0, total: 0 };
          else if (data.status === 'progress') downloads[data.file] = { loaded: data.loaded || 0, total: data.total || 0 };
          else if (data.status === 'done' && downloads[data.file]) downloads[data.file].loaded = downloads[data.file].total;
          updateProgressFromDownloads(downloads, 60, 0.2, "תרגום");
      }
  };

  const updateProgressFromDownloads = (downloadsObj: any, baseProgress: number, weight: number, modelName: string) => {
      let totalLoaded = 0;
      let totalSize = 0;
      Object.values(downloadsObj).forEach((f: any) => {
          totalLoaded += f.loaded;
          totalSize += f.total;
      });
      if (totalSize > 0) {
          const overallProgress = (totalLoaded / totalSize) * 100;
          if (!isNaN(overallProgress)) {
              setProgress(baseProgress + Math.round(overallProgress * weight));
              setStatusText(`מוריד/קורא מודל ${modelName}... ${Math.round(overallProgress)}% (מואץ)`);
          }
      }
  };

  const calculateStorageUsed = async () => {
    try {
      let totalBytes = 0;
      if (navigator.storage && navigator.storage.estimate) {
        const estimate = await navigator.storage.estimate();
        // @ts-ignore
        if (estimate.usageDetails && estimate.usageDetails.caches) totalBytes = estimate.usageDetails.caches;
        else totalBytes = estimate.usage || 0;
      }
      setStorageUsedMB((totalBytes / (1024 * 1024)).toFixed(2));
    } catch (err) {}
  };

  const clearStorage = async () => {
    if (window.confirm(uiLang === 'he' ? "האם אתה בטוח שברצונך למחוק את כל קובצי הבינה המלאכותית מהמחשב?" : "Are you sure you want to delete all AI models from your computer?")) {
      try {
        if ('caches' in window) {
          const cacheNames = await caches.keys();
          for (const cacheName of cacheNames) {
            if (cacheName.includes('transformers')) await caches.delete(cacheName);
          }
        }
        setStorageUsedMB('0.00');
        processingSessionRef.current += 1;
        setWorkerSession(prev => prev + 1);
        alert(uiLang === 'he' ? 'כל קובצי המודלים נמחקו בהצלחה מהכספת והזיכרון פונה!' : 'All models deleted successfully and memory freed!');
      } catch (err) { alert(uiLang === 'he' ? 'אירעה שגיאה בעת ניקוי האחסון.' : 'Error clearing storage.'); }
    }
  };

  const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return "00:00:00,000";
    const date = new Date(seconds * 1000);
    const hh = String(Math.floor(seconds / 3600)).padStart(2, '0');
    const mm = String(date.getUTCMinutes()).padStart(2, '0');
    const ss = String(date.getUTCSeconds()).padStart(2, '0');
    const ms = String(date.getUTCMilliseconds()).padStart(3, '0');
    return `${hh}:${mm}:${ss},${ms}`;
  };

  const formatSRT = (chunks: any[], maxChars = 42, removePunct = false) => {
    const breakText = (text: string) => {
        let processed = text.trim();
        if (removePunct) {
            processed = processed.replace(/[.,!?]/g, '');
        }
        if (!maxChars || maxChars >= 100) return processed;
        
        const words = processed.split(' ');
        let lines = [];
        let currentLine = '';
        for (const word of words) {
            if ((currentLine + ' ' + word).trim().length <= maxChars) {
                currentLine = (currentLine + ' ' + word).trim();
            } else {
                if (currentLine) lines.push(currentLine);
                currentLine = word;
            }
        }
        if (currentLine) lines.push(currentLine);
        return lines.join('\n');
    };

    return chunks.map((chunk, index) => {
      const ts = chunk.timestamp || [0, 2];
      let startTime = formatTime(ts[0]);
      let endTime = formatTime(ts[1] || ts[0] + 2);
      return `${index + 1}\n${startTime} --> ${endTime}\n${breakText(chunk.text)}`;
    }).join('\n\n');
  };

  const handleSourceLangChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const val = e.target.value;
      setSourceLang(val);
      if (val === 'auto') {
          setTargetLang('original');
      }
  };

  const handleDetectLanguage = async () => {
      if (!file) {
          alert(uiLang === 'he' ? 'אנא בחר קובץ קודם.' : 'Please select a file first.');
          return;
      }
      
      if (file.size > 150 * 1024 * 1024) {
          if (!window.confirm(uiLang === 'he' ? 
            'הקובץ גדול (מעל 150MB). זיהוי שפה דורש פענוח חלקי שעלול לקחת זמן. להמשיך בכל זאת?' : 
            'File is large (>150MB). Language detection requires partial decoding which may take time. Proceed?')) {
              return;
          }
      }
      
      setIsDetectingLanguage(true);
      let audioCtx: AudioContext | null = null;
      try {
          const arrayBuffer = await file.arrayBuffer();
          audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
          let decodedAudio = await audioCtx.decodeAudioData(arrayBuffer);
          
          let fullAudioData;
          if (decodedAudio.numberOfChannels > 1) {
              const numChannels = decodedAudio.numberOfChannels;
              const len = decodedAudio.length;
              fullAudioData = new Float32Array(len);
              const channels = [];
              for (let c = 0; c < numChannels; c++) channels.push(decodedAudio.getChannelData(c));
              
              for (let i = 0; i < len; i++) {
                  let sum = 0;
                  for (let c = 0; c < numChannels; c++) sum += channels[c][i];
                  fullAudioData[i] = sum / numChannels;
              }
          } else {
              fullAudioData = decodedAudio.getChannelData(0);
          }
          
          const lengthToCopy = Math.min(fullAudioData.length, 16000 * 30);
          const audioData = fullAudioData.slice(0, lengthToCopy);
          
          if (audioCtx.state !== 'closed') await audioCtx.close();
          audioCtx = null;
          
          workerRef.current?.postMessage({
              type: 'detect_language',
              data: { audioChunk: audioData, modelSize, useWebGPU }
          }, [audioData.buffer]);
          
      } catch(err) {
          console.error(err);
          alert(uiLang === 'he' ? 'שגיאה בקריאת הקובץ לזיהוי שפה. נסה לבחור שפה ידנית.' : 'Error reading file for language detection.');
          setIsDetectingLanguage(false);
          if (audioCtx && audioCtx.state !== 'closed') {
              try { await audioCtx.close(); } catch(e){}
          }
      }
  };

  const processFileLocal = async () => {
    if (!file || !workerRef.current || status === 'processing') return;
    
    const currentSession = processingSessionRef.current;
    let audioCtx: AudioContext | null = null;
    
    if (file.size > 500 * 1024 * 1024) {
        if (!window.confirm(uiLang === 'he' ? 
          'הקובץ שבחרת גדול מאוד (מעל 500MB). פענוח הקובץ דורש כמות זיכרון (RAM) גדולה מאוד מהמחשב שלך ועלול לגרום לדפדפן לקרוס. האם ברצונך להמשיך בכל זאת?' : 
          'The selected file is very large (>500MB). Processing it requires significant RAM and may cause the browser to crash. Do you want to proceed?')) {
            return;
        }
    }
    
    try {
      setStatus('processing');
      setErrorMessage('');
      setProgress(5);
      setStatusText(t.loading + ` (${(file.size / (1024*1024)).toFixed(0)}MB)...`);
      
      await new Promise(resolve => setTimeout(resolve, 150));
      if (currentSession !== processingSessionRef.current) return;
      
      let arrayBuffer;
      try {
          arrayBuffer = await file.arrayBuffer();
      } catch (bufferErr) {
          throw new Error(uiLang === 'he' ? 'קריאת הקובץ נכשלה. ייתכן שהקובץ כבד מדי לזיכרון ה-RAM הפנוי במחשב שלך.' : 'File read failed. The file might be too large for available RAM.');
      }
      
      if (currentSession !== processingSessionRef.current) return;
      
      audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      
      setStatusText(uiLang === 'he' ? 'מחלץ ומפענח רצועת שמע (בסרטונים כבדים זה עשוי לקחת מספר דקות)...' : 'Extracting and decoding audio track (may take a few minutes for large videos)...');
      setProgress(8);
      await new Promise(resolve => setTimeout(resolve, 100));
      
      let decodedAudio;
      try {
          decodedAudio = await audioCtx.decodeAudioData(arrayBuffer);
      } catch (decodeErr) {
          console.error("Audio Decode Error:", decodeErr);
          throw new Error(uiLang === 'he' ? 'הדפדפן כשל בפענוח הקובץ. זיכרון ה-RAM במחשב לא הספיק לעיבוד גודל כזה של שמע. אנא המר את הקובץ לפורמט שמע מכווץ (כמו MP3) ונסה שוב.' : 'Browser failed to decode the file due to insufficient RAM. Please convert to a compressed format like MP3 and try again.');
      }
      
      if (currentSession !== processingSessionRef.current) return;
      
      let audioData;
      if (decodedAudio.numberOfChannels > 1) {
          const numChannels = decodedAudio.numberOfChannels;
          const len = decodedAudio.length;
          audioData = new Float32Array(len);
          const channels = [];
          for (let c = 0; c < numChannels; c++) channels.push(decodedAudio.getChannelData(c));
          
          for (let i = 0; i < len; i++) {
              let sum = 0;
              for (let c = 0; c < numChannels; c++) sum += channels[c][i];
              audioData[i] = sum / numChannels;
          }
      } else {
          audioData = decodedAudio.getChannelData(0);
      }
      
      if (audioCtx.state !== 'closed') await audioCtx.close();
      audioCtx = null;
      
      setProgress(12);
      setStatusText(uiLang === 'he' ? 'מעביר נתונים למנוע הבינה המלאכותית (Web Worker)...' : 'Transferring data to AI engine...');

      const isAutoSource = sourceLang === 'auto';
      const isOriginalTarget = targetLang === 'original';
      const needsTranslation = !isAutoSource && !isOriginalTarget && sourceLang !== targetLang;

      let nllbSrc = null;
      let nllbTgt = null;
      if (needsTranslation) {
          nllbSrc = SUPPORTED_LANGUAGES.find(l => l.code === sourceLang)?.nllb;
          nllbTgt = SUPPORTED_LANGUAGES.find(l => l.code === targetLang)?.nllb;
      }

      workerRef.current.postMessage({
          type: 'process',
          data: { audioData, modelSize, sourceLang, targetLang, needsTranslation, nllbSrc, nllbTgt, numChunks, threads, useWebGPU }
      }, [audioData.buffer]);

    } catch (err: any) {
      if (currentSession === processingSessionRef.current) {
          setStatus('error');
          setErrorMessage(err.message || (uiLang === 'he' ? 'אירעה שגיאה בלתי צפויה בחילוץ השמע מהקובץ.' : 'An unexpected error occurred while extracting audio.'));
      }
    } finally {
      if (audioCtx && audioCtx.state !== 'closed') {
          try { await audioCtx.close(); } catch(e){}
      }
    }
  };

  const stripSrt = (srt: string) => {
      return srt.replace(/\r\n/g, '\n')
                .replace(/^\d+$/gm, '')
                .replace(/^\d{2}:\d{2}:\d{2},\d{3} --> \d{2}:\d{2}:\d{2},\d{3}$/gm, '')
                .replace(/<[^>]*>/g, '') 
                .replace(/^\s*[\r\n]/gm, '') 
                .trim();
  };

  const downloadSrt = () => {
    if (!srtResult || !file) return;
    
    let finalContent = srtResult;
    let mimeType = 'text/plain;charset=utf-8';
    
    if (exportFormat === 'vtt') {
        finalContent = "WEBVTT\n\n" + srtResult.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2');
    } else if (exportFormat === 'txt') {
        finalContent = stripSrt(srtResult);
    } else if (exportFormat === 'json') {
        const lines = srtResult.split('\n\n').map(block => {
            const parts = block.split('\n');
            if (parts.length < 3) return null;
            return {
                index: parts[0],
                time: parts[1],
                text: parts.slice(2).join('\n')
            };
        }).filter(Boolean);
        finalContent = JSON.stringify(lines, null, 2);
        mimeType = 'application/json';
    }

    const blob = new Blob([finalContent], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    
    const originalName = file.name.substring(0, file.name.lastIndexOf('.'));
    
    let suffix = sourceLang === 'auto' ? '_auto' : `_${sourceLang}`;
    if (sourceLang !== 'auto' && targetLang !== 'original' && sourceLang !== targetLang) {
        suffix = `_${sourceLang}_to_${targetLang}`;
    }
    
    a.download = `${originalName || 'subtitles'}${suffix}.${exportFormat}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const copyToClipboard = async () => {
      try {
          await navigator.clipboard.writeText(srtResult);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
      } catch (err) {
          const textArea = document.createElement("textarea");
          textArea.value = srtResult;
          document.body.appendChild(textArea);
          textArea.select();
          document.execCommand("copy");
          document.body.removeChild(textArea);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
      }
  };

  const handleLlmAction = async (actionType: string, apiKeyToUse = geminiApiKey) => {
      if (isLlmLoading) return; 
      
      const cleanText = stripSrt(srtResult);
      if (!cleanText) {
          setLlmError(uiLang === 'he' ? 'אין טקסט לפענוח.' : 'No text to process.');
          return;
      }

      const maxChars = 150000;
      const textToProcess = cleanText.length > maxChars ? cleanText.substring(0, maxChars) + "\n...[הטקסט קוצץ עקב חריגה מאורך מותר]..." : cleanText;

      setIsLlmLoading(true);
      setLlmError('');
      setLlmResult('');
      setActiveLlmAction(actionType);

      let promptContext = "";
      if (uiLang === 'he') {
          if (actionType === 'summary') promptContext = "כתוב סיכום קצר וקולע של הטקסט הבא:";
          if (actionType === 'grammar') promptContext = "תקן שגיאות כתיב, תחביר ופיסוק בטקסט הבא. החזר רק את הטקסט המתוקן (ללא חותמות זמן):";
          if (actionType === 'topics') promptContext = "חלק את הטקסט הבא לנושאים מרכזיים עם כותרות. הצג כרשימה:";
          if (actionType === 'cinematic') promptContext = "עבור על טקסט הכתוביות הבא. זהה באופן אוטומטי קטעי שירה או חרוזים והתאם אותם לעברית בחרוזים. שים לב להקשר ולדוברים והתאם את לשון הפנייה (זכר/נקבה) באופן מדויק. שפר את הניסוח כך שיתאים לכתוביות סרט טבעיות וזורמות. החזר רק את הטקסט המתוקן (ללא חותמות זמן):";
      } else {
          if (actionType === 'summary') promptContext = "Write a short and concise summary of the following text:";
          if (actionType === 'grammar') promptContext = "Fix spelling, grammar, and punctuation errors in the following text. Return only the corrected text (without timestamps):";
          if (actionType === 'topics') promptContext = "Divide the following text into main topics with headings. Present as a list:";
          if (actionType === 'cinematic') promptContext = "Review the following subtitle text. Automatically identify poetic or rhyming sections and adapt them appropriately. Pay attention to context and speakers, and adjust the tone accurately. Improve the phrasing to sound natural and cinematic. Return only the corrected text (without timestamps):";
      }

      const payload = {
          contents: [{ parts: [{ text: `${promptContext}\n\n${textToProcess}` }] }],
          systemInstruction: { parts: [{ text: uiLang === 'he' ? "אתה עורך תוכן חכם. ענה תמיד באותה שפה של טקסט המקור (אלא אם התבקשת לתרגם), ושמור על שפה נקייה ומכבדת." : "You are a smart content editor. Always respond in the same language as the source text (unless asked to translate), and maintain clean, respectful language." }] },
          safetySettings: [
              { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
              { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
              { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
              { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
          ]
      };

      try {
          const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKeyToUse}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
          });
          
          if (!response.ok) {
              const errorData = await response.json();
              throw new Error(errorData.error?.message || response.statusText);
          }
          
          const result = await response.json();
          let generatedText = result.candidates?.[0]?.content?.parts?.[0]?.text;
          
          if (generatedText) {
              generatedText = generatedText.replace(/^```(markdown|text|txt)?\n?/i, '').replace(/\n?```$/i, '').trim();
              setLlmResult(generatedText);
          } else {
              throw new Error(uiLang === 'he' ? 'הבקשה הצליחה אך ה-AI החזיר תשובה ריקה. נסה שוב.' : 'Request succeeded but AI returned an empty response.');
          }
      } catch (e: any) {
          setLlmError((uiLang === 'he' ? 'שגיאה בתקשורת עם ה-AI: ' : 'AI Communication error: ') + e.message);
      } finally {
          setIsLlmLoading(false);
      }
  };

  const resetApp = () => {
    setFile(null); setStatus('idle'); setSrtResult(''); setErrorMessage(''); setProgress(0); setCopied(false);
    setLlmResult(''); setLlmError(''); setActiveLlmAction(null);
    processingSessionRef.current += 1;
    setWorkerSession(prev => prev + 1);
    calculateStorageUsed();
  };

  const openApiKeyModal = () => {
      setIsEditingApiKey(!geminiApiKey);
      setTempApiKey(geminiApiKey || '');
      setIsApiKeyVisible(false);
      setShowApiKeyModal(true);
  };

  const closeApiKeyModal = () => {
      setShowApiKeyModal(false);
      setTempApiKey('');
      setPendingAction(null);
      setIsApiKeyVisible(false);
  };

  const handleSaveApiKey = () => {
      if (tempApiKey.trim()) {
          localStorage.setItem('gemini_api_key', tempApiKey.trim());
          setGeminiApiKey(tempApiKey.trim());
          closeApiKeyModal();
          
          if (pendingAction) {
              handleLlmAction(pendingAction, tempApiKey.trim());
              setPendingAction(null);
          }
      }
  };

  const handleRemoveApiKey = () => {
      localStorage.removeItem('gemini_api_key');
      setGeminiApiKey('');
      setTempApiKey('');
      setIsApiKeyVisible(false);
      setIsEditingApiKey(true);
  };

  const triggerLlmAction = (actionType: string) => {
      if (!geminiApiKey) {
          setPendingAction(actionType);
          openApiKeyModal();
      } else {
          handleLlmAction(actionType, geminiApiKey);
      }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files && e.target.files.length > 0 ? e.target.files[0] : null;
    if (selected) validateAndSetFile(selected);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); 
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const validateAndSetFile = (selectedFile: File) => {
    const maxSizeMB = 2048; 
    if (selectedFile.size > maxSizeMB * 1024 * 1024) {
      setStatus('error');
      setErrorMessage(`הקובץ גדול מדי (${(selectedFile.size / (1024*1024)).toFixed(1)}MB). המערכת תומכת כעת בקבצים כבדים עד 2GB.`);
      return;
    }
    if (selectedFile.type.startsWith('video/') || selectedFile.type.startsWith('audio/') || selectedFile.name.match(/\.(mp4|mkv|avi|mpeg|mpga|m4a|wav|webm|mp3)$/i)) {
      setFile(selectedFile);
      setStatus('idle'); setSrtResult(''); setErrorMessage(''); setProgress(0); setCopied(false);
      whisperDownloadsRef.current = {}; nllbDownloadsRef.current = {}; 
    } else {
      setStatus('error');
      setErrorMessage(uiLang === 'he' ? 'סוג הקובץ אינו נתמך. אנא העלה וידאו או שמע.' : 'File type not supported. Please upload video or audio.');
    }
  };

  return (
    <div dir={uiLang === 'he' ? 'rtl' : 'ltr'} className="min-h-screen pb-12 pt-6 px-4 sm:px-6 lg:px-8 flex flex-col items-center relative text-slate-800 dark:text-slate-200 overflow-x-hidden">
      
      {/* Background Orbs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0 flex justify-center items-center opacity-40 dark:opacity-20 mix-blend-multiply dark:mix-blend-screen transition-opacity duration-1000">
          <div className="absolute w-[500px] h-[500px] bg-indigo-400 dark:bg-indigo-600 rounded-full blur-[100px] animate-blob"></div>
          <div className="absolute w-[400px] h-[400px] bg-purple-400 dark:bg-purple-600 rounded-full blur-[100px] animate-blob" style={{ animationDelay: '2s', transform: 'translate(100px, -100px)' }}></div>
          <div className="absolute w-[600px] h-[600px] bg-pink-400 dark:bg-pink-600 rounded-full blur-[120px] animate-blob" style={{ animationDelay: '4s', transform: 'translate(-150px, 150px)' }}></div>
      </div>

      <div className="w-full flex flex-col items-center transition-all duration-700 relative z-10">
          
          {/* Header */}
          <div className="w-full max-w-4xl flex justify-between items-end mb-6">
            <div className="flex flex-col gap-1">
              <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
                <span className="bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-400 bg-clip-text text-transparent">AI Subtitles</span>
                <Sparkles className="text-indigo-500 dark:text-indigo-400 animate-pulse" size={28} />
              </h1>
              <p className="text-slate-500 dark:text-slate-400 font-medium ml-1">{t.subtitle}</p>
            </div>
            
            <div className="hidden sm:flex items-center gap-3 bg-white/60 dark:bg-slate-800/60 backdrop-blur-md border border-slate-200/60 dark:border-slate-700/60 shadow-sm rounded-full py-1.5 px-4 hover:bg-white dark:hover:bg-slate-800 transition-colors group">

              <button 
                  onClick={() => setUiLang(uiLang === 'he' ? 'en' : 'he')} 
                  className="flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-bold transition-colors border bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:bg-slate-200 dark:hover:bg-slate-600"
              >
                  <Globe size={14} />
                  {uiLang === 'he' ? 'EN' : 'HE'}
              </button>
              
              <button 
                  onClick={() => setShowSettingsModal(true)} 
                  className="flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-bold transition-colors border bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:bg-slate-200 dark:hover:bg-slate-600"
              >
                  <Settings size={14} />
                  {t.settings}
              </button>

              <button 
                  onClick={openApiKeyModal} 
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-bold transition-colors border ${geminiApiKey ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:bg-slate-200 dark:hover:bg-slate-600'}`}
              >
                  <Key size={14} />
                  {geminiApiKey ? t.apiConnected : t.setApi}
              </button>
              
              <div className="w-px h-5 bg-slate-300 dark:bg-slate-600 mx-1"></div>

              <HardDrive size={16} className="text-indigo-500 dark:text-indigo-400 mr-2" />
              <span className="text-sm font-medium text-slate-600 dark:text-slate-400">{t.storage} <span className="font-bold text-slate-800 dark:text-slate-200" dir="ltr">{storageUsedMB} MB</span></span>
              {parseFloat(storageUsedMB) > 0 && (
                <button onClick={clearStorage} title={t.clear} className="text-slate-400 hover:text-red-500 dark:hover:text-red-400 p-1 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-full"><Trash2 size={14} /></button>
              )}
            </div>
          </div>

          <main className="w-full max-w-4xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-[2rem] shadow-xl border border-white/60 dark:border-slate-800/60 overflow-hidden relative">
            <div className="absolute top-0 inset-x-0 h-2 bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500 animate-gradient-x"></div>
            <div className="p-6 sm:p-10">
              
              <div className="grid sm:grid-cols-2 gap-4 mb-8">
                <div className="bg-blue-50/80 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/50 rounded-2xl p-4 flex items-start gap-4 shadow-sm">
                  <Lock className="text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" size={24} />
                  <div>
                    <h3 className="font-bold text-blue-900 dark:text-blue-200 text-sm">{t.privacyTitle}</h3>
                    <p className="text-blue-800 dark:text-blue-300 text-xs mt-1">{t.privacyDesc}</p>
                  </div>
                </div>
                <div className="bg-indigo-50/80 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800/50 rounded-2xl p-4 flex items-center justify-between shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="bg-indigo-600 dark:bg-indigo-500 text-white p-2 rounded-xl"><Activity size={18} /></div>
                    <div>
                      <h3 className="font-bold text-indigo-900 dark:text-indigo-200 text-sm">{uiLang === 'he' ? 'סטטיסטיקת שימוש' : 'Usage Stats'}</h3>
                      <p className="text-indigo-700 dark:text-indigo-300 text-xs">{uiLang === 'he' ? 'קבצים שעובדו:' : 'Files processed:'} <strong className="bg-indigo-100 dark:bg-indigo-800 px-1.5 py-0.5 rounded">{sessionStats.files}</strong></p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-bold text-indigo-400 dark:text-indigo-500 uppercase tracking-wider">{uiLang === 'he' ? 'מצב מקומי' : 'Local Mode'}</p>
                    <div className="flex items-center gap-1 justify-end text-emerald-500">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                      <span className="text-[10px] font-bold uppercase">{uiLang === 'he' ? 'פעיל' : 'Active'}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* File Selection */}
              {status === 'idle' && !file && (
                <div 
                  className={`relative overflow-hidden border-2 border-dashed rounded-[2rem] p-12 sm:p-20 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-500 ease-out ${
                    isDragging ? 'border-indigo-500 bg-indigo-50/80 dark:bg-indigo-900/30 scale-[1.03] animate-pulse-glow z-20' : 'border-slate-300 dark:border-slate-700 hover:border-indigo-400 dark:hover:border-indigo-500 bg-slate-50/50 dark:bg-slate-800/50 hover:bg-slate-50 hover:shadow-lg dark:hover:bg-slate-800 z-10'
                  }`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {isDragging && <div className="absolute left-0 right-0 h-1 bg-indigo-500 animate-scan z-0"></div>}
                  <div className={`relative z-10 bg-white dark:bg-slate-800 p-5 rounded-3xl shadow-md border border-slate-100 dark:border-slate-700 text-indigo-500 dark:text-indigo-400 mb-6 transition-transform duration-500 ${isDragging ? 'scale-125 rotate-6 shadow-xl' : 'hover:scale-110 hover:-rotate-3'}`}>
                    <FileVideo size={56} className={isDragging ? 'animate-bounce text-indigo-600 dark:text-indigo-300' : ''} />
                  </div>
                  <h3 className="relative z-10 text-2xl font-bold text-slate-800 dark:text-white mb-2">{t.dragTitle}</h3>
                  <p className="relative z-10 text-slate-500 dark:text-slate-400 font-medium">{t.dragDesc}</p>
                  <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" accept="video/*,audio/*" />
                </div>
              )}

              {/* File Info & Settings */}
              {(file || status !== 'idle') && (
                <div className="space-y-6">
                  <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 flex flex-col sm:flex-row items-center gap-5 transition-all">
                    <div className="bg-white dark:bg-slate-800 p-3.5 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 text-indigo-600 dark:text-indigo-400">
                      {file?.type?.startsWith('audio') ? <FileAudio size={28} /> : <FileVideo size={28} />}
                    </div>
                    <div className="flex-1 text-center sm:text-right">
                      <h4 className="font-bold text-slate-800 dark:text-white text-lg truncate max-w-xs sm:max-w-md mx-auto sm:mx-0" dir="ltr">{file?.name}</h4>
                      <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 font-mono">{((file?.size || 0) / (1024 * 1024)).toFixed(2)} MB</p>
                    </div>
                    {status === 'idle' && (
                      <button onClick={resetApp} className="text-sm font-bold text-slate-600 dark:text-slate-300 hover:text-red-500 dark:hover:text-red-400 px-5 py-2.5 border border-slate-300 dark:border-slate-600 rounded-xl hover:bg-white dark:hover:bg-slate-800 shadow-sm transition-all w-full sm:w-auto">{t.changeFile}</button>
                    )}
                  </div>

                  {status === 'idle' && (
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
                      <h4 className="font-bold text-slate-800 dark:text-white flex items-center gap-2 text-lg border-b border-slate-100 dark:border-slate-800 pb-3">
                        <Settings2 size={20} className="text-indigo-500 dark:text-indigo-400" />
                        {t.settings}
                      </h4>
                      <div className="grid md:grid-cols-3 gap-4 pt-2">
                        <div className="space-y-2">
                          <label className="text-sm font-bold text-slate-700 dark:text-slate-300 flex justify-between items-center w-full mb-2">
                              <span>{t.sourceLangLabel}</span>
                              <button 
                                 onClick={handleDetectLanguage} 
                                 disabled={isDetectingLanguage || !file || status === 'processing'}
                                 className="text-indigo-600 dark:text-indigo-400 text-xs flex items-center gap-1 hover:underline disabled:opacity-50 disabled:no-underline"
                              >
                                 {isDetectingLanguage ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                                 {isDetectingLanguage ? t.detecting : t.detectLanguageBtn}
                              </button>
                          </label>
                          <div className="relative">
                              <select disabled={status === 'processing'} value={sourceLang} onChange={handleSourceLangChange} className="w-full p-3.5 pl-10 border border-slate-300 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 outline-none focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 font-medium text-slate-700 dark:text-slate-200 appearance-none transition-all shadow-sm disabled:opacity-50">
                                  <option value="auto" className="font-bold text-indigo-600 dark:text-indigo-400">{t.autoDetect}</option>
                                  {SUPPORTED_LANGUAGES.map(l => (
                                      <option key={`src-${l.code}`} value={l.code}>{l.name[uiLang]}</option>
                                  ))}
                              </select>
                              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400 dark:text-slate-500">
                                  <Globe className="h-5 w-5" />
                              </div>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">{t.targetLangLabel}</label>
                          <div className="relative">
                              <select 
                                  value={targetLang} 
                                  onChange={(e) => setTargetLang(e.target.value)} 
                                  disabled={sourceLang === 'auto' || status === 'processing'}
                                  className={`w-full p-3.5 pl-10 border border-slate-300 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 font-medium text-slate-700 dark:text-slate-200 appearance-none transition-all shadow-sm ${sourceLang === 'auto' ? 'opacity-50 cursor-not-allowed bg-slate-100 dark:bg-slate-800' : 'bg-slate-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-900'} disabled:opacity-50`}
                              >
                                  <option value="original" className="font-bold text-indigo-600 dark:text-indigo-400">{t.originalLang}</option>
                                  {SUPPORTED_LANGUAGES.map(l => (
                                      <option key={`tgt-${l.code}`} value={l.code}>{l.name[uiLang]}</option>
                                  ))}
                              </select>
                              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400 dark:text-slate-500">
                                  <Wand2 className="h-5 w-5" />
                              </div>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">{t.modelSize}</label>
                          <div className="relative">
                              <select disabled={status === 'processing'} value={modelSize} onChange={(e) => setModelSize(e.target.value)} className="w-full p-3.5 pl-10 border border-slate-300 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 outline-none focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 font-medium text-slate-700 dark:text-slate-200 appearance-none transition-all shadow-sm disabled:opacity-50">
                                  <option value="Xenova/whisper-tiny">{uiLang === 'he' ? "Tiny (מהיר מאוד)" : "Tiny (Very Fast)"}</option>
                                  <option value="Xenova/whisper-base">{uiLang === 'he' ? "Base (מומלץ ומהיר!)" : "Base (Recommended!)"}</option>
                                  <option value="Xenova/whisper-small">{uiLang === 'he' ? "Small (איכותי - מחשב ממוצע)" : "Small (High Quality)"}</option>
                                  <option value="Xenova/whisper-medium">{uiLang === 'he' ? "Medium (מדויק - מחשב חזק)" : "Medium (Accurate - Strong PC)"}</option>
                                  <option value="Xenova/whisper-large-v3">{uiLang === 'he' ? "Large V3 (הכי מדויק בעולם - כבד מאוד)" : "Large V3 (Most Accurate - Very Heavy)"}</option>
                              </select>
                              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400 dark:text-slate-500">
                                  <Cpu className="h-5 w-5" />
                              </div>
                          </div>
                        </div>
                      </div>
                      <button onClick={processFileLocal} disabled={status === 'processing'} className="w-full mt-4 bg-slate-900 dark:bg-indigo-600 hover:bg-indigo-600 dark:hover:bg-indigo-500 disabled:opacity-50 text-white font-bold py-4 rounded-xl shadow-lg hover:shadow-[0_8px_25px_rgba(79,70,229,0.4)] hover:-translate-y-1 transition-all flex justify-center items-center gap-3 text-lg">
                        <Activity size={24} className="animate-pulse" /> {t.startProcessing}
                      </button>
                    </div>
                  )}

                  {status === 'processing' && (
                    <div className="bg-slate-50 dark:bg-slate-800/50 rounded-3xl p-10 flex flex-col items-center text-center relative overflow-hidden border border-slate-200/60 dark:border-slate-700/60 shadow-inner">

                      <div className="flex items-end justify-center gap-1.5 h-16 mb-6">
                          {[1, 2, 3, 4, 5, 6, 7].map(i => (
                              <div key={i} className={`w-2.5 bg-gradient-to-t from-indigo-600 to-purple-400 rounded-full animate-sound-wave delay-${i % 5 + 1}`} style={{ animationDuration: `${0.6 + (i * 0.1)}s` }}></div>
                          ))}
                      </div>

                      <h3 className="text-2xl font-bold text-slate-800 dark:text-white mb-3">{statusText}</h3>
                      <p className="text-slate-500 dark:text-slate-400 text-sm mb-6 max-w-sm">{t.processingWarn}</p>
                      
                      <div className="w-full max-w-md">
                          <div className="flex justify-between text-sm font-bold text-slate-600 dark:text-slate-400 mb-2">
                              <span>{t.progress}</span>
                              <span dir="ltr" className="text-indigo-600 dark:text-indigo-400">{progress}%</span>
                          </div>
                          <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-3 overflow-hidden shadow-inner">
                            <div className="h-full bg-gradient-to-l from-indigo-500 to-purple-500 transition-all duration-300 relative" style={{ width: `${progress}%` }}>
                                <div className="absolute inset-0 w-full h-full bg-[linear-gradient(45deg,rgba(255,255,255,0.2)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.2)_50%,rgba(255,255,255,0.2)_75%,transparent_75%,transparent)] bg-[length:1rem_1rem] animate-[stripes_1s_linear_infinite]"></div>
                            </div>
                          </div>
                      </div>
                      
                      <button onClick={resetApp} className="mt-8 flex items-center justify-center gap-2 px-6 py-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm">
                          <XCircle size={18} /> {t.cancelProcess}
                      </button>
                    </div>
                  )}

                  {status === 'complete' && (
                    <div className="space-y-6 animate-fade-in">
                        
                        <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-2xl p-6 sm:p-8 text-white flex flex-col sm:flex-row items-center justify-between gap-6 shadow-xl relative overflow-hidden">
                            <div className="absolute -right-10 -top-10 opacity-10"><CheckCircle size={150} /></div>
                            <div className="flex flex-col sm:flex-row items-center gap-5 relative z-10 text-center sm:text-right">
                                <div className="bg-white/20 p-4 rounded-2xl backdrop-blur-sm border border-white/30 shadow-inner"><CheckCircle size={36}/></div>
                                <div>
                                    <h4 className="font-extrabold text-2xl mb-1">{t.readyTitle}</h4>
                                    <p className="text-emerald-50 text-sm font-medium opacity-90">{t.readyDesc}</p>
                                </div>
                            </div>
                            <div className="flex gap-3 w-full sm:w-auto relative z-10">
                                <button onClick={copyToClipboard} className="flex-1 sm:flex-none bg-emerald-700/50 hover:bg-emerald-700 text-white font-bold py-3 px-4 rounded-xl transition-all shadow border border-emerald-500/30 flex items-center justify-center gap-2">
                                    {copied ? <Check size={18} /> : <Copy size={18} />}
                                    {copied ? t.copied : t.copy}
                                </button>
                                <button onClick={downloadSrt} className="flex-1 sm:flex-none bg-white text-emerald-700 hover:bg-emerald-50 font-bold py-3 px-6 rounded-xl hover:scale-105 transition-all shadow-lg flex items-center justify-center gap-2">
                                    <Download size={18}/> {t.downloadBtn} {exportFormat.toUpperCase()}
                                </button>
                            </div>
                        </div>

                        {/* Live Editor */}
                        <div className="bg-[#0f172a] rounded-2xl overflow-hidden shadow-2xl border border-slate-700 focus-within:border-indigo-500 transition-colors">
                            <div className="bg-slate-900 px-5 py-3.5 flex items-center justify-between border-b border-slate-800">
                                <div className="flex items-center gap-3">
                                    <div className="flex gap-2">
                                        <div className="w-3 h-3 rounded-full bg-red-500"></div>
                                        <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                                        <div className="w-3 h-3 rounded-full bg-green-500"></div>
                                    </div>
                                    <span className="text-slate-400 text-sm font-mono tracking-wider">{t.editorTitle}</span>
                                </div>
                                <FileText size={16} className="text-slate-500" />
                            </div>
                            <div className="relative">
                                <textarea 
                                    value={srtResult}
                                    onChange={(e) => setSrtResult(e.target.value)}
                                    style={{ fontSize: editorFontSize }}
                                    className="w-full bg-transparent text-slate-300 leading-relaxed font-mono p-6 outline-none custom-scrollbar resize-y min-h-[300px] transition-all"
                                    dir="ltr"
                                    spellCheck="false"
                                    placeholder="..."
                                />
                            </div>
                        </div>

                        {/* Gemini AI Features */}
                        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-xl border border-slate-200 dark:border-slate-800 mt-6 relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 dark:bg-indigo-900/20 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
                            
                            <div className="flex justify-between items-start relative z-10 mb-4">
                                <h4 className="font-bold text-slate-800 dark:text-white text-lg flex items-center gap-2">
                                    <Sparkles className="text-indigo-500" size={20} />
                                    {t.aiFeatures}
                                </h4>
                                
                                {geminiApiKey ? (
                                    <div className="flex items-center gap-2 text-xs font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 px-3 py-1.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                                        <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                                        {t.apiConnected}
                                        <button onClick={openApiKeyModal} className="ml-2 text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 underline">{uiLang === 'he' ? 'שנה מפתח' : 'Change Key'}</button>
                                    </div>
                                ) : (
                                    <button onClick={openApiKeyModal} className="text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 px-3 py-1.5 rounded-full border border-slate-300 dark:border-slate-600 transition-colors">
                                        {t.setApi}
                                    </button>
                                )}
                            </div>
                            
                            <div className="flex flex-wrap gap-3 relative z-10">
                                <button 
                                    onClick={() => triggerLlmAction('summary')}
                                    disabled={isLlmLoading}
                                    className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:hover:bg-indigo-900/50 dark:text-indigo-300 font-bold py-2.5 px-5 rounded-xl border border-indigo-200 dark:border-indigo-800 transition-colors flex items-center gap-2 disabled:opacity-50"
                                >
                                    <AlignLeft size={18} /> {t.summary}
                                </button>
                                <button 
                                    onClick={() => triggerLlmAction('grammar')}
                                    disabled={isLlmLoading}
                                    className="bg-purple-50 hover:bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:hover:bg-purple-900/50 dark:text-purple-300 font-bold py-2.5 px-5 rounded-xl border border-purple-200 dark:border-purple-800 transition-colors flex items-center gap-2 disabled:opacity-50"
                                >
                                    <CheckSquare size={18} /> {t.grammar}
                                </button>
                                <button 
                                    onClick={() => triggerLlmAction('topics')}
                                    disabled={isLlmLoading}
                                    className="bg-blue-50 hover:bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 dark:text-blue-300 font-bold py-2.5 px-5 rounded-xl border border-blue-200 dark:border-blue-800 transition-colors flex items-center gap-2 disabled:opacity-50"
                                >
                                    <List size={18} /> {t.topics}
                                </button>
                                <button 
                                    onClick={() => triggerLlmAction('cinematic')}
                                    disabled={isLlmLoading}
                                    className="bg-pink-50 hover:bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:hover:bg-pink-900/50 dark:text-pink-300 font-bold py-2.5 px-5 rounded-xl border border-pink-200 dark:border-pink-800 transition-colors flex items-center gap-2 disabled:opacity-50"
                                >
                                    <Wand2 size={18} /> {t.cinematic}
                                </button>
                            </div>

                            {isLlmLoading && (
                                <div className="mt-6 flex items-center justify-center text-indigo-600 dark:text-indigo-400 gap-3 bg-slate-50 dark:bg-slate-800 p-6 rounded-xl border border-slate-100 dark:border-slate-700">
                                    <Loader2 className="animate-spin" size={24} />
                                    <span className="font-medium">...</span>
                                </div>
                            )}

                            {llmError && (
                                <div className="mt-6 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-4 rounded-xl border border-red-100 dark:border-red-900/50 font-bold flex items-center gap-2">
                                    <AlertCircle size={20} /> {llmError}
                                </div>
                            )}

                            {llmResult && !isLlmLoading && (
                                <div className="mt-6 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden shadow-inner">
                                    <div className="bg-slate-100 dark:bg-slate-900 px-4 py-2 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
                                        <span className="text-sm font-bold text-slate-700 dark:text-slate-300">AI:</span>
                                    </div>
                                    <div className="p-5">
                                        <pre className="text-slate-800 dark:text-slate-200 text-sm font-sans whitespace-pre-wrap leading-relaxed">{displayedLlmResult}<span className="animate-pulse font-bold text-indigo-500 ml-1">_</span></pre>
                                    </div>
                                </div>
                            )}
                        </div>

                        <button onClick={resetApp} className="w-full py-4 border-2 border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all shadow-sm mt-6">
                            {t.startOver}
                        </button>
                    </div>
                  )}

                  {status === 'error' && (
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/50 rounded-2xl p-8 text-center flex flex-col items-center gap-4 shadow-sm animate-fade-in">
                        <div className="bg-red-100 dark:bg-red-900/50 p-4 rounded-full text-red-500 dark:text-red-400"><AlertCircle size={40}/></div>
                        <div>
                            <h4 className="font-bold text-red-800 dark:text-red-300 text-lg mb-1">{t.errorTitle}</h4>
                            <p className="font-medium text-red-600 dark:text-red-400">{errorMessage}</p>
                        </div>
                        <button onClick={resetApp} className="mt-4 px-8 py-2.5 bg-white dark:bg-slate-800 border border-red-200 dark:border-red-800 text-sm font-bold text-red-700 dark:text-red-400 rounded-xl shadow-sm hover:bg-red-50 dark:hover:bg-slate-700 transition-all">{t.tryAgain}</button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </main>
      </div>

      {/* Mobile Footer Status */}
      <div className="mt-8 sm:hidden flex flex-col items-center gap-3 w-full max-w-sm">
         <div className="flex items-center justify-between w-full bg-white/60 dark:bg-slate-800/60 backdrop-blur-md border border-slate-200/60 dark:border-slate-700/60 shadow-sm rounded-full py-2.5 px-5">
            <button 
                onClick={() => setUiLang(uiLang === 'he' ? 'en' : 'he')} 
                className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-colors border bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600"
            >
                <Globe size={14} /> {uiLang === 'he' ? 'EN' : 'HE'}
            </button>
            <button 
                onClick={() => setShowSettingsModal(true)} 
                className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-colors border bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600"
            >
                <Settings size={14} /> {t.settings}
            </button>
            <button 
                onClick={openApiKeyModal} 
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-colors border ${geminiApiKey ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600'}`}
            >
                <Key size={14} />
                {geminiApiKey ? t.apiConnected : t.setApi}
            </button>
         </div>
      </div>
      
      {/* Settings Modal */}
      {showSettingsModal && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm transition-all duration-300 p-4">
              <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-md w-full p-6 animate-fade-in border border-slate-200 dark:border-slate-800 max-h-[90vh] overflow-y-auto custom-scrollbar">
                  
                  <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-6 flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                      <Settings className="text-indigo-500" size={20} />
                      {t.settingsTitle}
                  </h3>
                  
                  <div className="space-y-6 mb-8">
                      <div>
                          <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-3">{t.theme}</label>
                          <div className="flex gap-3">
                              <button 
                                  onClick={() => setTheme('light')}
                                  className={`flex-1 py-2 px-4 rounded-xl flex items-center justify-center gap-2 border-2 font-bold transition-all ${theme === 'light' ? 'bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-900/30 dark:border-indigo-500/50 dark:text-indigo-300' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-700'}`}
                              >
                                  <Sun size={18} /> {t.light}
                              </button>
                              <button 
                                  onClick={() => setTheme('dark')}
                                  className={`flex-1 py-2 px-4 rounded-xl flex items-center justify-center gap-2 border-2 font-bold transition-all ${theme === 'dark' ? 'bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-900/30 dark:border-indigo-500/50 dark:text-indigo-300' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-700'}`}
                              >
                                  <Moon size={18} /> {t.dark}
                              </button>
                          </div>
                      </div>

                      <div>
                          <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-3">{t.cpuLabel}</label>
                          <div className="relative">
                              <select value={threads} onChange={(e) => setThreads(parseInt(e.target.value))} className="w-full p-3.5 pl-10 border border-slate-300 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 outline-none focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 font-medium text-slate-700 dark:text-slate-200 appearance-none transition-all shadow-sm">
                                  <option value="0">{t.cpuAuto}</option>
                                  <option value="1">{t.cpu1}</option>
                                  <option value="2">{t.cpu2}</option>
                                  <option value="4">{t.cpu4}</option>
                                  <option value="8">{t.cpu8}</option>
                              </select>
                              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400 dark:text-slate-500">
                                  <Cpu size={18} />
                              </div>
                          </div>
                      </div>

                      <label className="flex items-start gap-3 cursor-pointer p-4 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-700/80 transition-colors">
                          <input 
                              type="checkbox" 
                              checked={useWebGPU} 
                              onChange={(e) => setUseWebGPU(e.target.checked)}
                              className="w-5 h-5 mt-0.5 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 bg-white dark:bg-slate-900 cursor-pointer"
                          />
                          <div className="flex flex-col">
                              <span className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5"><Rocket size={14} className="text-indigo-500"/> {t.webGpuLabel}</span>
                              <span className="text-xs text-slate-500 dark:text-slate-400 mt-1">{t.webGpuDesc}</span>
                          </div>
                      </label>

                      <div>
                          <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-3">{t.cpuLabel}</label>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                              {[
                                  {id: 0, label: t.cpuAuto},
                                  {id: 1, label: t.cpu1},
                                  {id: 2, label: t.cpu2},
                                  {id: 4, label: t.cpu4},
                                  {id: 8, label: t.cpu8}
                              ].map(core => (
                                  <button
                                      key={core.id}
                                      onClick={() => setThreads(core.id)}
                                      className={`py-2 px-3 rounded-xl text-xs font-bold transition-all border-2 ${threads === core.id ? 'bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-900/30 dark:border-indigo-500/50 dark:text-indigo-300' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-700'}`}
                                  >
                                      {core.label}
                                  </button>
                              ))}
                          </div>
                      </div>
                      
                      <div>
                          <label className="flex justify-between items-center text-sm font-bold text-slate-700 dark:text-slate-300 mb-3">
                              <span>{t.chunks}</span>
                              <span className="bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300 px-2 py-0.5 rounded font-mono">{numChunks}</span>
                          </label>
                          <input 
                              type="range" 
                              min="4" 
                              max="64" 
                              step="4"
                              value={numChunks}
                              onChange={(e) => setNumChunks(parseInt(e.target.value))}
                              className="w-full accent-indigo-600 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer dark:bg-slate-700"
                          />
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-3 leading-relaxed">
                              {t.chunksDesc}
                          </p>
                      </div>
                  </div>

                  <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-6 flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3 mt-8">
                      <FileText className="text-indigo-500" size={20} />
                      {t.subtitleSettingsTitle}
                  </h3>

                  <div className="space-y-6 mb-8">
                      <div>
                          <label className="flex justify-between items-center text-sm font-bold text-slate-700 dark:text-slate-300 mb-3">
                              <span>{t.maxCharsLabel}</span>
                              <span className="bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300 px-2 py-0.5 rounded font-mono">
                                  {maxCharsPerLine >= 100 ? t.unlimited : maxCharsPerLine}
                              </span>
                          </label>
                          <input 
                              type="range" 
                              min="20" 
                              max="100" 
                              step="2"
                              value={maxCharsPerLine}
                              onChange={(e) => setMaxCharsPerLine(parseInt(e.target.value))}
                              className="w-full accent-indigo-600 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer dark:bg-slate-700"
                          />
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-3 leading-relaxed">
                              {t.maxCharsDesc}
                          </p>
                      </div>

                      <label className="flex items-center gap-3 cursor-pointer p-3 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                          <input 
                              type="checkbox" 
                              checked={removePunctuation} 
                              onChange={(e) => setRemovePunctuation(e.target.checked)}
                              className="w-5 h-5 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 bg-white dark:bg-slate-900"
                          />
                          <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{t.removePunctuationLabel}</span>
                      </label>

                      <div>
                          <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-3">{t.exportFormatLabel}</label>
                          <div className="flex gap-3">
                              {['srt', 'vtt', 'txt', 'json'].map(fmt => (
                                  <button
                                      key={fmt}
                                      onClick={() => setExportFormat(fmt)}
                                      className={`flex-1 py-2 px-3 rounded-xl font-bold transition-all border-2 ${exportFormat === fmt ? 'bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-900/30 dark:border-indigo-500/50 dark:text-indigo-300' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-700'}`}
                                  >
                                      {fmt.toUpperCase()}
                                  </button>
                              ))}
                          </div>
                      </div>

                      <div>
                          <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-3">{t.fontSizeLabel}</label>
                          <div className="flex gap-3">
                              {[
                                  {id: '13px', label: t.fontSmall, icon: <Type size={14}/>},
                                  {id: '15px', label: t.fontMedium, icon: <Type size={18}/>},
                                  {id: '18px', label: t.fontLarge, icon: <Type size={22}/>}
                              ].map(size => (
                                  <button
                                      key={size.id}
                                      onClick={() => setEditorFontSize(size.id)}
                                      className={`flex-1 py-2 px-2 rounded-xl font-bold transition-all border-2 flex items-center justify-center gap-1.5 ${editorFontSize === size.id ? 'bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-900/30 dark:border-indigo-500/50 dark:text-indigo-300' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-700'}`}
                                  >
                                      {size.icon}
                                      <span className="text-sm">{size.label}</span>
                                  </button>
                              ))}
                          </div>
                      </div>
                  </div>
                  
                  <div className="flex flex-col sm:flex-row justify-between gap-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                      <button 
                          onClick={() => {
                              if (window.confirm(uiLang === 'he' ? 'לאפס את כל ההגדרות לברירת המחדל?' : 'Reset all settings to default?')) {
                                  localStorage.clear();
                                  window.location.reload();
                              }
                          }}
                          className="text-slate-400 hover:text-red-500 text-xs font-bold transition-colors"
                      >
                          {uiLang === 'he' ? 'איפוס הגדרות' : 'Reset Settings'}
                      </button>
                      <button 
                          onClick={() => setShowSettingsModal(false)}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-6 rounded-xl transition-colors w-full sm:w-auto"
                      >
                          {t.closeSave}
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* API Key Modal */}
      {showApiKeyModal && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm transition-all duration-300 p-4">
              <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-md w-full p-6 animate-fade-in border border-slate-200 dark:border-slate-800">
                  <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2 flex items-center gap-2">
                      <Lock className="text-indigo-500" size={20} />
                      {t.apiTitle}
                  </h3>
                  <p className="text-slate-600 dark:text-slate-400 text-sm mb-6 leading-relaxed">
                      {t.apiDesc}
                  </p>
                  
                  {geminiApiKey && !isEditingApiKey ? (
                      <div className="mb-6 space-y-4">
                          <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl flex items-center gap-3">
                              <div className="bg-emerald-100 dark:bg-emerald-800 p-2 rounded-full text-emerald-600 dark:text-emerald-400">
                                  <CheckCircle size={20} />
                              </div>
                              <div className="flex-1">
                                  <p className="font-bold text-emerald-800 dark:text-emerald-300">{t.keyActiveTitle}</p>
                                  <p className="text-sm font-mono text-emerald-600 dark:text-emerald-400 mt-1" dir="ltr">
                                      {geminiApiKey.substring(0, 4)}••••••••••••••••••••••••••••{geminiApiKey.substring(geminiApiKey.length - 4)}
                                  </p>
                              </div>
                          </div>
                      </div>
                  ) : (
                      <div className="mb-6">
                          <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">{t.apiKeyLabel}</label>
                          <div className="relative">
                              <input 
                                  type={isApiKeyVisible ? "text" : "password"} 
                                  value={tempApiKey}
                                  onChange={(e) => setTempApiKey(e.target.value)}
                                  placeholder={t.apiKeyPlaceholder}
                                  className={`w-full p-3 border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-800 font-mono text-left dark:text-white transition-colors ${!isApiKeyValid ? 'border-amber-400 focus:ring-amber-500/50' : 'border-slate-300 dark:border-slate-700'}`}
                                  dir="ltr"
                              />
                              <button
                                  type="button"
                                  onClick={() => setIsApiKeyVisible(!isApiKeyVisible)}
                                  className="absolute inset-y-0 flex items-center justify-center w-12 text-slate-400 hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors"
                                  style={{ right: uiLang === 'he' ? 'auto' : '0', left: uiLang === 'he' ? '0' : 'auto' }}
                              >
                                  {isApiKeyVisible ? <EyeOff size={18} /> : <Eye size={18} />}
                              </button>
                          </div>
                          {!isApiKeyValid && (
                              <p className="text-xs text-amber-600 dark:text-amber-400 mt-2 flex items-center gap-1 font-bold animate-fade-in">
                                  <AlertTriangle size={12} /> {t.invalidKeyFormat}
                              </p>
                          )}
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                              {t.noApiKey} <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-indigo-600 dark:text-indigo-400 hover:underline">{t.getApiKey}</a>.
                          </p>
                      </div>
                  )}
                  
                  <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 border-t border-slate-100 dark:border-slate-800 pt-4 mt-4">
                      <div className="flex gap-3 mt-4 sm:mt-0">
                          {geminiApiKey && !isEditingApiKey && (
                              <button 
                                  onClick={handleRemoveApiKey}
                                  className="px-4 py-2 text-sm font-bold text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/30 rounded-xl transition-colors border border-transparent hover:border-red-200 dark:hover:border-red-800"
                              >
                                  {t.deleteKey}
                              </button>
                          )}
                          {geminiApiKey && !isEditingApiKey && (
                              <button 
                                  onClick={() => { setIsEditingApiKey(true); setTempApiKey(geminiApiKey); }}
                                  className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 rounded-xl transition-colors border border-slate-200 dark:border-slate-700"
                              >
                                  {t.editKey}
                              </button>
                          )}
                          <button 
                              onClick={closeApiKeyModal}
                              className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 rounded-xl transition-colors"
                          >
                              {geminiApiKey && !isEditingApiKey ? t.close : t.cancel}
                          </button>
                      </div>
                      {(!geminiApiKey || isEditingApiKey) && (
                          <button 
                              onClick={handleSaveApiKey}
                              disabled={!tempApiKey.trim()}
                              className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 dark:disabled:bg-indigo-800/50 text-white font-bold py-2 px-6 rounded-xl transition-colors"
                          >
                              {t.closeSave}
                          </button>
                      )}
                  </div>
              </div>
          </div>
      )}
    </div>
  );
}

