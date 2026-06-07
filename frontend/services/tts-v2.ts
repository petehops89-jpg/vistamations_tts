let preferredVoice: SpeechSynthesisVoice | null = null;
let isTTSActive = true;

const loadVoices = () => {
  if (!window.speechSynthesis) return;
  const voices = window.speechSynthesis.getVoices();
  
  // Filter for female voices using common identifiers
  const femaleVoices = voices.filter(v => 
    v.name.toLowerCase().includes('female') || 
    v.name.toLowerCase().includes('zira') || 
    v.name.toLowerCase().includes('samantha') ||
    v.name.toLowerCase().includes('karen') ||
    v.name.toLowerCase().includes('tessa') ||
    v.name.toLowerCase().includes('victoria')
  );

  // Filter specifically for WaveNet female voices
  const waveNetFemaleVoices = femaleVoices.filter(v => v.name.toLowerCase().includes('wavenet'));

  // Select 2nd tier (index 1) WaveNet female voice if available
  // Fallback to 1st WaveNet, then 2nd tier general female, then 1st female, then 2nd overall voice
  if (waveNetFemaleVoices.length > 1) {
    preferredVoice = waveNetFemaleVoices[1]; // 2nd tier WaveNet female
  } else if (waveNetFemaleVoices.length === 1) {
    preferredVoice = waveNetFemaleVoices[0];
  } else if (femaleVoices.length > 1) {
    preferredVoice = femaleVoices[1]; // 2nd tier female
  } else if (femaleVoices.length === 1) {
    preferredVoice = femaleVoices[0];
  } else {
    preferredVoice = voices[1] || voices[0] || null;
  }
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