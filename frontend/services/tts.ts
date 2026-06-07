let preferredVoice: SpeechSynthesisVoice | null = null;
let isTTSActive = true;

const loadVoices = () => {
  if (!window.speechSynthesis) return;
  const voices = window.speechSynthesis.getVoices();
  
  // Attempt to find a high-quality female voice (WaveNet, Google UK, Zira, etc.)
  preferredVoice = 
    voices.find(v => v.name.toLowerCase().includes('wavenet') && v.name.toLowerCase().includes('female')) ||
    voices.find(v => v.name.toLowerCase().includes('google uk english female')) ||
    voices.find(v => v.name.toLowerCase().includes('zira')) ||
    voices.find(v => v.name.toLowerCase().includes('female')) ||
    voices[0] || null;
};

if (window.speechSynthesis) {
  window.speechSynthesis.onvoiceschanged = loadVoices;
  loadVoices();
}

export const toggleTTS = () => {
  isTTSActive = !isTTSActive;
  if (!isTTSActive && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
  return isTTSActive;
};

export const getTTSStatus = () => isTTSActive;

export const speakText = (text: string) => {
  if (!isTTSActive || !window.speechSynthesis) return;
  
  window.speechSynthesis.cancel(); // Stop any current speech
  
  // Clean up text for better speech (remove markdown asterisks, etc.)
  const cleanText = text.replace(/\*/g, '').replace(/_/g, '');
  
  const utterance = new SpeechSynthesisUtterance(cleanText);
  if (preferredVoice) {
    utterance.voice = preferredVoice;
  }
  
  // Devina's voice settings: slightly lower pitch, slightly slower rate for a mysterious tone
  utterance.pitch = 0.85;
  utterance.rate = 0.9;
  
  window.speechSynthesis.speak(utterance);
};
