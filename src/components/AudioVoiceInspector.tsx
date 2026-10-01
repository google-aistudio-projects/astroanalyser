import React, { useState, useEffect, useRef } from 'react';
import {
  Volume2,
  VolumeX,
  Mic,
  MicOff,
  Sparkles,
  Zap,
  Play,
  Pause,
  RotateCcw,
  Copy,
  Check,
  Download,
  X,
  Clock,
  Coins,
  Compass,
  ChevronRight,
  Bot
} from 'lucide-react';
import {
  LLMProviderId,
  LLM_PROVIDERS,
  VedicHouseContext,
  LLMThreePartNarrative
} from '../services/llm/types';
import { llmService } from '../services/llm/adapters';

interface AudioVoiceInspectorProps {
  isOpen: boolean;
  onClose: () => void;
  context: VedicHouseContext | null;
  activeProvider: LLMProviderId;
  onChangeProvider: (provider: LLMProviderId) => void;
}

const SAMPLE_QUICK_CHIPS = [
  'Will I buy a house or change jobs this month?',
  'What are the financial & resource sources for this house?',
  'Explain the 3–7 day micro-timing window for this event',
  'How does the active PD Lord impact this Bhava?'
];

export const AudioVoiceInspector: React.FC<AudioVoiceInspectorProps> = ({
  isOpen,
  onClose,
  context,
  activeProvider,
  onChangeProvider
}) => {
  const [queryText, setQueryText] = useState<string>('');
  const [isListening, setIsListening] = useState<boolean>(false);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [narrative, setNarrative] = useState<LLMThreePartNarrative | null>(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState<boolean>(false);
  const [speechRate, setSpeechRate] = useState<number>(1.0);
  const [copied, setCopied] = useState<boolean>(false);

  // Recognition ref
  const recognitionRef = useRef<any>(null);

  // Initialize synthesis when context changes
  useEffect(() => {
    if (isOpen && context) {
      handleGenerate();
    } else {
      stopSpeech();
    }
  }, [isOpen, context?.houseNumber, activeProvider]);

  // Clean up speech when unmounting or closing
  useEffect(() => {
    return () => {
      stopSpeech();
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {}
      }
    };
  }, []);

  const handleGenerate = async (customQuery?: string) => {
    if (!context) return;
    stopSpeech();
    setIsGenerating(true);

    try {
      const q = customQuery !== undefined ? customQuery : queryText;
      const result = await llmService.generate(activeProvider, {
        ...context,
        userQuery: q || undefined
      });
      setNarrative(result);
    } catch (e) {
      console.error('LLM synthesis error:', e);
    } finally {
      setIsGenerating(false);
    }
  };

  // Web Speech API: Voice Input (Microphone)
  const toggleListening = () => {
    if (isListening) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {}
      }
      setIsListening(false);
      return;
    }

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert('Speech recognition is not supported in this browser. Please type your query.');
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onstart = () => setIsListening(true);
      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setQueryText(transcript);
        setIsListening(false);
        handleGenerate(transcript);
      };
      recognition.onerror = () => setIsListening(false);
      recognition.onend = () => setIsListening(false);

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.error('Mic error:', err);
      setIsListening(false);
    }
  };

  // Web Speech API: Voice Output (Text-to-Speech)
  const toggleSpeech = () => {
    if (!narrative) return;

    if (isPlayingAudio) {
      stopSpeech();
      return;
    }

    if (!window.speechSynthesis) {
      alert('Text-to-speech is not supported on this browser.');
      return;
    }

    window.speechSynthesis.cancel();

    const fullSpeechText = `Astrological Synthesis for House ${context?.houseNumber}. ${narrative.summarySentence}. Part 1: Event Probability and Scope. ${narrative.part1_probabilityAndScope}. Part 2: Financial and Resource Sources. ${narrative.part2_financialAndResources}. Part 3: Micro-Timing Window. ${narrative.part3_microTimingWindow}.`;

    const utterance = new SpeechSynthesisUtterance(fullSpeechText);
    utterance.rate = speechRate;
    utterance.pitch = 1.0;

    utterance.onend = () => setIsPlayingAudio(false);
    utterance.onerror = () => setIsPlayingAudio(false);

    window.speechSynthesis.speak(utterance);
    setIsPlayingAudio(true);
  };

  const stopSpeech = () => {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setIsPlayingAudio(false);
  };

  const handleCopyTranscript = () => {
    if (!narrative) return;
    navigator.clipboard.writeText(narrative.rawMarkdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadReport = () => {
    if (!narrative || !context) return;
    const blob = new Blob([JSON.stringify({ context, narrative }, null, 2)], {
      type: 'application/json'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Vedic_Report_H${context.houseNumber}_${context.rashiName}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!isOpen || !context) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden">
        {/* HEADER BAR */}
        <div className="flex items-center justify-between px-5 py-4 bg-slate-950 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/40 flex items-center justify-center text-amber-400 font-bold shadow-inner">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white flex items-center gap-1.5">
                  <span>House {context.houseNumber}</span>
                  <span className="text-slate-400">&bull;</span>
                  <span className="text-amber-300">{context.rashiName}</span>
                  <span className="text-xs text-slate-400 font-normal font-mono">({context.tamilName})</span>
                </h3>
                {context.isEventActive ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500 text-slate-950 shadow-sm flex items-center gap-1 animate-pulse">
                    <Zap className="w-3 h-3 fill-current" />
                    Event Active ({context.activationScore.toFixed(2)})
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
                    Score: {context.activationScore.toFixed(2)}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Vedic Multi-LLM Reasoning Engine &amp; Audio Voice Inspector
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-700 transition"
              title="Close Inspector"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* CONTROLS ROW: PROVIDER SELECTOR & VOICE OVER CONTROLS */}
        <div className="px-5 py-3 bg-slate-950/60 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* LLM Provider Selector */}
          <div className="flex items-center gap-2">
            <span className="text-slate-400 font-semibold flex items-center gap-1">
              <Bot className="w-3.5 h-3.5 text-amber-400" />
              Reasoning Model:
            </span>
            <div className="flex items-center rounded-lg bg-slate-900 border border-slate-700/80 p-0.5">
              {(Object.keys(LLM_PROVIDERS) as LLMProviderId[]).map(pid => {
                const prov = LLM_PROVIDERS[pid];
                const isActive = activeProvider === pid;
                return (
                  <button
                    key={pid}
                    onClick={() => onChangeProvider(pid)}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition ${
                      isActive
                        ? 'bg-amber-500 text-slate-950 font-bold shadow'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {prov.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Audio Playback Controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={toggleSpeech}
              disabled={isGenerating || !narrative}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition shadow ${
                isPlayingAudio
                  ? 'bg-red-500 hover:bg-red-600 text-white'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white'
              } disabled:opacity-50`}
            >
              {isPlayingAudio ? (
                <>
                  <Pause className="w-3.5 h-3.5" />
                  <span>Pause Voice</span>
                </>
              ) : (
                <>
                  <Volume2 className="w-3.5 h-3.5" />
                  <span>Play Voice-Over</span>
                </>
              )}
            </button>

            {isPlayingAudio && (
              <div className="flex items-center gap-1 px-2 py-1 bg-slate-900 border border-slate-700 rounded-md">
                <span className="w-1.5 h-3 bg-emerald-400 rounded-full animate-bounce" />
                <span className="w-1.5 h-5 bg-emerald-400 rounded-full animate-bounce [animation-delay:0.15s]" />
                <span className="w-1.5 h-4 bg-emerald-400 rounded-full animate-bounce [animation-delay:0.3s]" />
              </div>
            )}

            {/* Speed Rate */}
            <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-lg p-0.5">
              {[0.8, 1.0, 1.2].map(rate => (
                <button
                  key={rate}
                  onClick={() => {
                    setSpeechRate(rate);
                    if (isPlayingAudio) {
                      stopSpeech();
                    }
                  }}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
                    speechRate === rate
                      ? 'bg-slate-700 text-amber-300 font-bold'
                      : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {rate}x
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* BODY SCROLL AREA */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* USER INTERACTIVE QUERY & MIC INPUT */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 space-y-2.5">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={queryText}
                  onChange={e => setQueryText(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleGenerate()}
                  placeholder="Ask any question (e.g. Will I buy property, get promoted, or travel this month?)..."
                  className="w-full bg-slate-900 border border-slate-700/80 rounded-lg pl-3 pr-9 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition"
                />
                <button
                  onClick={toggleListening}
                  className={`absolute right-2 top-2 p-1 rounded-md transition ${
                    isListening
                      ? 'bg-red-500 text-white animate-pulse'
                      : 'text-slate-400 hover:text-amber-400'
                  }`}
                  title={isListening ? 'Listening... click to stop' : 'Click to speak question'}
                >
                  {isListening ? <Mic className="w-3.5 h-3.5" /> : <MicOff className="w-3.5 h-3.5" />}
                </button>
              </div>

              <button
                onClick={() => handleGenerate()}
                disabled={isGenerating}
                className="px-3.5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition shadow flex items-center gap-1.5 disabled:opacity-50"
              >
                {isGenerating ? (
                  <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5" />
                )}
                <span>Synthesize</span>
              </button>
            </div>

            {/* Quick Chips */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] uppercase font-bold text-slate-500">Quick Prompts:</span>
              {SAMPLE_QUICK_CHIPS.map((chip, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setQueryText(chip);
                    handleGenerate(chip);
                  }}
                  className="px-2 py-0.5 rounded text-[11px] bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-amber-300 border border-slate-800 hover:border-slate-700 transition"
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>

          {/* TELEMETRY STRIP */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-2">
              <span className="text-[10px] text-slate-500 uppercase block font-semibold">Active PD Lord</span>
              <span className="text-amber-300 font-bold font-mono text-[11px] truncate block">
                {context.activeDasha.pratyantardasha}
              </span>
            </div>
            <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-2">
              <span className="text-[10px] text-slate-500 uppercase block font-semibold">Natal Grahas</span>
              <span className="text-slate-300 font-bold text-[11px] truncate block">
                {context.natalOccupants.length > 0
                  ? context.natalOccupants.map(o => o.body_name.split(' ')[0]).join(', ')
                  : 'Empty'}
              </span>
            </div>
            <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-2">
              <span className="text-[10px] text-slate-500 uppercase block font-semibold">Transit Grahas</span>
              <span className="text-cyan-300 font-bold text-[11px] truncate block">
                {context.transitOccupants.length > 0
                  ? context.transitOccupants.map(t => t.graha_key).join(', ')
                  : 'No Ingress'}
              </span>
            </div>
            <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-2">
              <span className="text-[10px] text-slate-500 uppercase block font-semibold">Micro Peak Window</span>
              <span className="text-emerald-400 font-bold text-[11px] truncate block">
                {narrative?.peakDateRange || 'Evaluating...'}
              </span>
            </div>
          </div>

          {/* 3-PART SYNTHESIZED NARRATIVE DISPLAY */}
          {isGenerating ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-400">
              <RotateCcw className="w-8 h-8 text-amber-400 animate-spin" />
              <p className="text-xs font-mono">
                Synthesizing Parashara telemetry with {LLM_PROVIDERS[activeProvider].name}...
              </p>
            </div>
          ) : narrative ? (
            <div className="space-y-3.5">
              {/* Summary Bottom Line */}
              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs font-medium leading-relaxed shadow-sm">
                <span className="font-bold text-amber-400 block mb-0.5">Bottom-Line Synthesis:</span>
                {narrative.summarySentence}
              </div>

              {/* PART 1: EVENT PROBABILITY & SCOPE */}
              <div className="bg-slate-950 border border-slate-800/90 rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-amber-400">
                    <Compass className="w-4 h-4 text-amber-400" />
                    <span>Part 1: Event Probability &amp; Scope</span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400 font-semibold">
                    Confidence: {(narrative.overallConfidence * 100).toFixed(0)}%
                  </span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {narrative.part1_probabilityAndScope}
                </p>
              </div>

              {/* PART 2: FINANCIAL & RESOURCE SOURCES */}
              <div className="bg-slate-950 border border-slate-800/90 rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-sky-400">
                    <Coins className="w-4 h-4 text-sky-400" />
                    <span>Part 2: Financial &amp; Resource Sources</span>
                  </div>
                  <span className="text-[10px] font-mono text-sky-400/80">Capital Origin</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {narrative.part2_financialAndResources}
                </p>
              </div>

              {/* PART 3: MICRO-TIMING WINDOW */}
              <div className="bg-slate-950 border border-slate-800/90 rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-emerald-400">
                    <Clock className="w-4 h-4 text-emerald-400" />
                    <span>Part 3: Micro-Timing Window (Peak 3–7 Days)</span>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-mono font-bold">
                    {narrative.peakDateRange}
                  </span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {narrative.part3_microTimingWindow}
                </p>
              </div>
            </div>
          ) : null}
        </div>

        {/* FOOTER ACTIONS */}
        <div className="px-5 py-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-slate-500 font-mono text-[11px]">
            <span>Model: {LLM_PROVIDERS[activeProvider].model}</span>
            <span>&bull;</span>
            <span>Latency: {narrative?.executionTimeMs || 0}ms</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyTranscript}
              disabled={!narrative}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition disabled:opacity-50"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy Report'}</span>
            </button>

            <button
              onClick={handleDownloadReport}
              disabled={!narrative}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export JSON</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
