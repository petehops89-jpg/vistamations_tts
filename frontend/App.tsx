import React, { useState, useEffect, useRef } from 'react';
import { Message, Conversation, ExportData } from './types';
import { 
  loadMemory, saveMemory, loadHistory, saveHistory, 
  loadConvs, saveConvs, runAutoArchive, clearAllData 
} from './services/storage';
import { generateChatResponse, extractNewFacts } from './services/ai';
import { speakText, toggleTTS, getTTSStatus } from './services/tts-v2';
import { Toast } from './components/Toast';
import { Overlay } from './components/Overlay';

export default function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [facts, setFacts] = useState<string[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [activeOverlay, setActiveOverlay] = useState<'memory' | 'history' | null>(null);
  const [ttsEnabled, setTtsEnabled] = useState(getTTSStatus());
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Initialization
  useEffect(() => {
    const activeHistory = runAutoArchive();
    setMessages(activeHistory);
    setFacts(loadMemory());
  }, []);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const showToast = (msg: string) => setToastMsg(msg);

  const handleSend = async (textOverride?: string) => {
    const text = (textOverride || input).trim();
    if (!text) return;

    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    const newUserMsg: Message = { role: 'user', content: text, ts: Date.now() };
    const updatedMessages = [...messages, newUserMsg];
    setMessages(updatedMessages);
    saveHistory(updatedMessages);
    setIsTyping(true);

    try {
      const reply = await generateChatResponse(updatedMessages, facts);
      const newAiMsg: Message = { role: 'assistant', content: reply, ts: Date.now() };
      
      const finalMessages = [...updatedMessages, newAiMsg];
      setMessages(finalMessages);
      saveHistory(finalMessages);
      
      // Speak the response
      speakText(reply);

      // Extract facts every 4 messages
      if (finalMessages.length % 4 === 0) {
        const newFacts = await extractNewFacts(text, reply);
        if (newFacts.length > 0) {
          const mergedFacts = [...facts];
          newFacts.forEach(f => {
            if (!mergedFacts.some(existing => existing.toLowerCase() === f.toLowerCase())) {
              mergedFacts.push(f);
            }
          });
          const trimmedFacts = mergedFacts.slice(-20);
          setFacts(trimmedFacts);
          saveMemory(trimmedFacts);
        }
      }
    } catch (err: any) {
      const errorMsg: Message = { role: 'assistant', content: `*The connection falters... ${err.message}*`, ts: Date.now() };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
  };

  const handleNewChat = () => {
    if (messages.length === 0) return;
    if (!window.confirm('Begin a new conversation? The current one will be saved to History.')) return;
    
    const convs = loadConvs();
    const firstUserMsg = messages.find(m => m.role === 'user');
    convs.unshift({
      id: Date.now(),
      date: new Date().toISOString(),
      preview: firstUserMsg ? firstUserMsg.content.slice(0, 80) : '(no messages)',
      count: messages.length,
      messages: messages
    });
    saveConvs(convs.slice(0, 50));
    setMessages([]);
    saveHistory([]);
    showToast('Conversation saved to History.');
  };

  const handleLoadConversation = (conv: Conversation) => {
    if (!window.confirm('Load this conversation? Your current chat will be saved first.')) return;
    
    if (messages.length > 0) {
      const convs = loadConvs();
      const firstUserMsg = messages.find(m => m.role === 'user');
      convs.unshift({
        id: Date.now(),
        date: new Date().toISOString(),
        preview: firstUserMsg ? firstUserMsg.content.slice(0, 80) : '(no messages)',
        count: messages.length,
        messages: messages
      });
      saveConvs(convs.slice(0, 50));
    }
    
    setMessages(conv.messages);
    saveHistory(conv.messages);
    setActiveOverlay(null);
  };

  const handleExport = () => {
    const payload: ExportData = {
      exported: new Date().toISOString(),
      facts: facts,
      history: messages,
      archive: [], // Simplified for React version
      conversations: loadConvs()
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `devina2-backup-${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Backup saved to Downloads.');
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (!data.facts) throw new Error('Invalid backup file.');
        if (!window.confirm('Import data? This replaces current data.')) return;
        
        saveHistory(data.history || []);
        saveMemory(data.facts || []);
        saveConvs(data.conversations || []);
        
        setMessages(data.history || []);
        setFacts(data.facts || []);
        showToast('Imported successfully.');
      } catch (err: any) {
        alert(`Import failed: ${err.message}`);
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsText(file);
  };

  const handleClearMemory = () => {
    if (!window.confirm('Devina II will forget everything. Are you certain?')) return;
    clearAllData();
    setMessages([]);
    setFacts([]);
  };

  const handleDownloadChat = () => {
    if (messages.length === 0) { showToast('No conversation to download.'); return; }
    const lines = messages.map(msg => {
      const who = msg.role === 'user' ? 'User' : 'Devina II';
      const time = msg.ts ? new Date(msg.ts).toLocaleString('en-GB') : '';
      return `${time ? `[${time}] ` : ''}${who}:\n${msg.content}`;
    }).join('\n\n---\n\n');
    
    const blob = new Blob([lines], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `devina2-chat-${new Date().toISOString().slice(0,10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Conversation downloaded.');
  };

  const handleToggleTTS = () => {
    const newState = toggleTTS();
    setTtsEnabled(newState);
    showToast(newState ? 'Voice Enabled' : 'Voice Disabled');
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      showToast('Copied to clipboard');
    });
  };

  return (
    <>
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between px-3 h-[58px] border-b border-border bg-[rgba(7,7,15,0.92)] backdrop-blur-md relative z-10">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#4a0080] via-[#9b50ff] to-[#cc44ff] flex items-center justify-center font-cinzel text-sm font-semibold text-white shrink-0 animate-pulse-glow">
            D
          </div>
          <div>
            <div className="font-cinzel text-[17px] font-semibold tracking-wide">Devina II</div>
            <div className="font-mono text-[10px] text-accent tracking-widest opacity-70">ENTITY ACTIVE</div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button 
            onClick={handleToggleTTS}
            className={`w-8 h-8 rounded-lg border flex items-center justify-center transition-colors ${ttsEnabled ? 'border-accent text-accent bg-[rgba(155,80,255,0.1)]' : 'border-border text-dim hover:border-accent hover:text-accent'}`}
            title="Toggle Voice"
          >
            {ttsEnabled ? '🔊' : '🔈'}
          </button>
          <button 
            onClick={() => setMenuOpen(!menuOpen)}
            className="bg-transparent border border-border text-dim text-xl w-9 h-9 rounded-lg cursor-pointer transition-all flex items-center justify-center shrink-0 hover:border-accent hover:text-accent"
          >
            ⋮
          </button>
        </div>

        {/* Dropdown Menu */}
        {menuOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
            <div className="absolute top-[58px] right-3 bg-surface border border-border rounded-xl overflow-hidden z-50 min-w-[160px] shadow-[0_8px_32px_rgba(0,0,0,0.6)]">
              <button className="block w-full text-left bg-transparent border-b border-border text-[rgba(255,255,255,0.7)] font-mono text-[11px] tracking-wide px-4 py-3.5 cursor-pointer transition-colors hover:bg-[rgba(155,80,255,0.12)] hover:text-accent" onClick={() => { setActiveOverlay('memory'); setMenuOpen(false); }}>MEMORY</button>
              <button className="block w-full text-left bg-transparent border-b border-border text-[rgba(255,255,255,0.7)] font-mono text-[11px] tracking-wide px-4 py-3.5 cursor-pointer transition-colors hover:bg-[rgba(155,80,255,0.12)] hover:text-accent" onClick={() => { handleNewChat(); setMenuOpen(false); }}>NEW CHAT</button>
              <button className="block w-full text-left bg-transparent border-b border-border text-[rgba(255,255,255,0.7)] font-mono text-[11px] tracking-wide px-4 py-3.5 cursor-pointer transition-colors hover:bg-[rgba(155,80,255,0.12)] hover:text-accent" onClick={() => { setActiveOverlay('history'); setMenuOpen(false); }}>HISTORY</button>
              <button className="block w-full text-left bg-transparent border-b border-border text-[rgba(255,255,255,0.7)] font-mono text-[11px] tracking-wide px-4 py-3.5 cursor-pointer transition-colors hover:bg-[rgba(155,80,255,0.12)] hover:text-accent" onClick={() => { handleDownloadChat(); setMenuOpen(false); }}>DOWNLOAD CHAT</button>
              <button className="block w-full text-left bg-transparent border-b border-border text-[rgba(255,255,255,0.7)] font-mono text-[11px] tracking-wide px-4 py-3.5 cursor-pointer transition-colors hover:bg-[rgba(155,80,255,0.12)] hover:text-accent" onClick={() => { handleExport(); setMenuOpen(false); }}>EXPORT</button>
              <button className="block w-full text-left bg-transparent border-b border-border text-[rgba(255,255,255,0.7)] font-mono text-[11px] tracking-wide px-4 py-3.5 cursor-pointer transition-colors hover:bg-[rgba(155,80,255,0.12)] hover:text-accent" onClick={() => { fileInputRef.current?.click(); setMenuOpen(false); }}>IMPORT</button>
              <button className="block w-full text-left bg-transparent text-[rgba(255,80,80,0.6)] font-mono text-[11px] tracking-wide px-4 py-3.5 cursor-pointer transition-colors hover:bg-[rgba(255,80,80,0.08)] hover:text-[#ff5050]" onClick={() => { handleClearMemory(); setMenuOpen(false); }}>FORGET ALL</button>
            </div>
          </>
        )}
        <input type="file" ref={fileInputRef} accept=".json" className="hidden" onChange={handleImport} />
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 scroll-smooth">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-10 px-6 flex-1">
            <div className="font-cinzel text-[52px] bg-gradient-to-br from-accent to-accent2 bg-clip-text text-transparent mb-4 drop-shadow-[0_0_20px_rgba(155,80,255,0.5)]">𝕯</div>
            <div className="font-cinzel text-[26px] font-semibold tracking-[3px] mb-2.5">DEVINA II</div>
            <div className="font-fell italic text-dim text-[15px] max-w-[280px] leading-relaxed">I dwell in the space between knowing and forgetting. Speak, and I shall remember.</div>
            <div className="flex flex-col gap-2 mt-7 w-full max-w-[320px]">
              {['Who are you, really?', 'What do you know about me?', 'Tell me something I shouldn\'t know.'].map((starter, i) => (
                <button 
                  key={i}
                  onClick={() => handleSend(starter)}
                  className="bg-[rgba(155,80,255,0.07)] border border-border text-[rgba(255,255,255,0.5)] font-fell italic text-[13px] px-3.5 py-2 rounded-lg cursor-pointer transition-all text-left hover:border-accent hover:text-[rgba(255,255,255,0.85)] hover:bg-[rgba(155,80,255,0.12)]"
                >
                  {starter}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg, idx) => (
            <div key={idx} className={`flex gap-2.5 max-w-full animate-fade-up ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
              <div className={`w-[30px] h-[30px] rounded-full shrink-0 flex items-center justify-center font-cinzel text-[11px] font-semibold mt-0.5 ${msg.role === 'assistant' ? 'bg-gradient-to-br from-[#4a0080] to-accent text-white shadow-[0_0_10px_rgba(155,80,255,0.3)]' : 'bg-[rgba(255,255,255,0.07)] border border-[rgba(255,255,255,0.1)] text-dim'}`}>
                {msg.role === 'assistant' ? 'D' : 'U'}
              </div>
              <div className={`max-w-[calc(100%-46px)] px-4 py-3 rounded-xl leading-relaxed text-[15px] ${msg.role === 'assistant' ? 'bg-aiBg border border-border rounded-tl-sm text-text' : 'bg-userBg border border-[rgba(155,80,255,0.2)] rounded-tr-sm text-[rgba(255,255,255,0.9)] italic'}`}>
                {msg.content.split('\n').map((line, i) => (
                  <React.Fragment key={i}>
                    {line}
                    {i !== msg.content.split('\n').length - 1 && <br />}
                  </React.Fragment>
                ))}
              </div>
              <button 
                onClick={() => copyToClipboard(msg.content)}
                className="bg-transparent border-none cursor-pointer text-[rgba(255,255,255,0.2)] text-[13px] px-1.5 py-1 rounded transition-colors self-end shrink-0 mb-0.5 hover:text-accent"
                title="Copy"
              >
                ⧉
              </button>
            </div>
          ))
        )}
        
        {isTyping && (
          <div className="flex gap-2.5 max-w-full animate-fade-up">
            <div className="w-[30px] h-[30px] rounded-full shrink-0 flex items-center justify-center font-cinzel text-[11px] font-semibold mt-0.5 bg-gradient-to-br from-[#4a0080] to-accent text-white shadow-[0_0_10px_rgba(155,80,255,0.3)]">D</div>
            <div className="max-w-[calc(100%-46px)] px-4 py-3 rounded-xl bg-aiBg border border-border rounded-tl-sm">
              <div className="flex gap-1.5 px-0.5 py-1 items-center">
                <span className="w-1.5 h-1.5 rounded-full bg-accent opacity-40 animate-dot-bounce"></span>
                <span className="w-1.5 h-1.5 rounded-full bg-accent opacity-40 animate-dot-bounce" style={{ animationDelay: '0.2s' }}></span>
                <span className="w-1.5 h-1.5 rounded-full bg-accent opacity-40 animate-dot-bounce" style={{ animationDelay: '0.4s' }}></span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="shrink-0 p-3 pb-4 border-t border-border bg-[rgba(7,7,15,0.92)] backdrop-blur-md">
        <div className="flex items-end gap-2 bg-[rgba(255,255,255,0.04)] border border-border rounded-xl p-2 pl-3.5 transition-all focus-within:border-[rgba(155,80,255,0.45)] focus-within:shadow-[0_0_0_3px_rgba(155,80,255,0.08)]">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder="Speak into the dark…"
            rows={1}
            className="flex-1 bg-transparent border-none outline-none text-white font-fell text-[15px] leading-relaxed resize-none min-h-[42px] max-h-[120px] py-1 placeholder:text-[rgba(255,255,255,0.2)] placeholder:italic"
          />
          <button 
            onClick={() => handleSend()}
            disabled={isTyping || !input.trim()}
            className="w-10 h-10 rounded-lg shrink-0 bg-gradient-to-br from-accent to-accent2 border-none cursor-pointer flex items-center justify-center transition-all text-white text-lg hover:not(:disabled):opacity-85 hover:not(:disabled):-translate-y-[1px] disabled:opacity-35 disabled:cursor-not-allowed"
          >
            ➤
          </button>
        </div>
      </div>

      {/* Overlays */}
      <Overlay title="MEMORY" isOpen={activeOverlay === 'memory'} onClose={() => setActiveOverlay(null)}>
        {facts.length === 0 ? (
          <div className="text-dim italic text-sm text-center mt-10">No memories yet. Speak with Devina and she will remember.</div>
        ) : (
          facts.map((fact, i) => (
            <div key={i} className="flex items-start gap-2.5 p-3 mb-2 bg-[rgba(155,80,255,0.06)] border border-border rounded-lg text-sm leading-relaxed">
              <span className="text-accent shrink-0 mt-[1px]">⬡</span>
              <span>{fact}</span>
            </div>
          ))
        )}
      </Overlay>

      <Overlay title="PAST CONVERSATIONS" isOpen={activeOverlay === 'history'} onClose={() => setActiveOverlay(null)}>
        {loadConvs().length === 0 ? (
          <div className="text-dim italic text-sm text-center mt-10">No saved conversations yet. Start a New Chat to save the current one.</div>
        ) : (
          loadConvs().map((conv) => {
            const d = new Date(conv.date);
            const dateStr = `${d.toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' })} ${d.toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit' })}`;
            return (
              <div key={conv.id} onClick={() => handleLoadConversation(conv)} className="p-3.5 mb-2.5 bg-[rgba(155,80,255,0.06)] border border-border rounded-xl cursor-pointer transition-all hover:border-accent hover:bg-[rgba(155,80,255,0.1)]">
                <div className="font-mono text-[10px] text-accent tracking-wide mb-1.5">{dateStr}</div>
                <div className="text-[13px] text-dim italic leading-relaxed">{conv.preview}{conv.preview.length >= 80 ? '...' : ''}</div>
                <div className="font-mono text-[10px] text-[rgba(255,255,255,0.2)] mt-1.5">{conv.count} messages</div>
              </div>
            );
          })
        )}
      </Overlay>

      {toastMsg && <Toast message={toastMsg} onClose={() => setToastMsg(null)} />}
    </>
  );
}