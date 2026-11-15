import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  Globe,
  Headphones,
  Loader2,
  Mic,
  Play,
  Plus,
  RotateCcw,
  Sparkles,
  Square,
  Trash2,
  Volume2,
  X,
} from 'lucide-react';
import {
  AiVoiceReaderProfile,
  GeminiTtsVoiceName,
  VoiceReaderEngine,
} from '../types';
import {
  DeviceVoiceOption,
  GEMINI_NATURAL_VOICES,
} from '../lib/voiceReaders';
import {
  DEFAULT_CLOUD_TTS_ORIGIN,
  isNativeAndroidRuntime,
  listHybridDeviceVoices,
  resolveHealthApiEndpoint,
  resolveTtsApiEndpoint,
  speakWithNativeOrDeviceTts,
  stopNativeOrDeviceTts,
} from '../lib/hybridTts';

interface AiVoiceReadersPanelProps {
  readers: AiVoiceReaderProfile[];
  activeReaderId: string;
  ttsServerUrl: string;
  onSaveTtsServerUrl: (url: string) => void;
  onSelectActiveReader: (id: string) => void;
  onSaveCustomReader: (reader: AiVoiceReaderProfile) => void;
  onDeleteCustomReader: (id: string) => void;
}

const SAMPLE_LINES = [
  'The wind carried the scent of pine across the fjord as the chapter began.',
  'Stars flickered above the orbital deck while the ancient archive opened.',
];

export const AiVoiceReadersPanel: React.FC<AiVoiceReadersPanelProps> = ({
  readers,
  activeReaderId,
  ttsServerUrl,
  onSaveTtsServerUrl,
  onSelectActiveReader,
  onSaveCustomReader,
  onDeleteCustomReader,
}) => {
  const [builderOpen, setBuilderOpen] = useState(false);
  const [name, setName] = useState('');
  const [engine, setEngine] = useState<VoiceReaderEngine>('gemini-tts');
  const [voiceName, setVoiceName] = useState<string>('Aoede');
  const [stylePrompt, setStylePrompt] = useState(
    'Warm, natural, expressive audiobook narrator with smooth phrasing'
  );
  const [rate, setRate] = useState(1);
  const [language, setLanguage] = useState('Auto (EN / ES)');
  const [customEndpointUrl, setCustomEndpointUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [builderError, setBuilderError] = useState<string | null>(null);

  const [serverDraft, setServerDraft] = useState(ttsServerUrl);
  const [serverTestStatus, setServerTestStatus] = useState<
    'idle' | 'testing' | 'ok' | 'error'
  >('idle');
  const [serverTestMsg, setServerTestMsg] = useState<string | null>(null);

  const [deviceVoices, setDeviceVoices] = useState<DeviceVoiceOption[]>([]);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    setServerDraft(ttsServerUrl);
  }, [ttsServerUrl]);

  useEffect(() => {
    const refresh = () => {
      void listHybridDeviceVoices().then(setDeviceVoices);
    };
    refresh();
    if ('speechSynthesis' in window) {
      window.speechSynthesis.onvoiceschanged = refresh;
    }
    return () => {
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
        previewAudioRef.current.src = '';
      }
      void stopNativeOrDeviceTts();
    };
  }, []);

  const stopTest = () => {
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current.currentTime = 0;
    }
    void stopNativeOrDeviceTts();
    setTestingId(null);
  };

  const testReader = async (reader: {
    id: string;
    engine: VoiceReaderEngine;
    voiceName: string;
    stylePrompt: string;
    rate: number;
    language?: string;
    customEndpointUrl?: string;
  }) => {
    if (testingId === reader.id) {
      stopTest();
      return;
    }
    stopTest();
    setTestingId(reader.id);
    setPreviewError(null);

    const sampleText = SAMPLE_LINES[0];

    try {
      if (reader.engine === 'device-tts') {
        await speakWithNativeOrDeviceTts({
          text: sampleText,
          rate: reader.rate,
          preferredVoiceUri: reader.voiceName,
          languageHint: reader.language,
          onDone: () => setTestingId(null),
          onError: (msg) => {
            setTestingId(null);
            setPreviewError(msg);
          },
        });
        return;
      }

      if (reader.engine === 'custom-url' && reader.customEndpointUrl) {
        const res = await fetch(reader.customEndpointUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: sampleText,
            voice: reader.voiceName,
            style: reader.stylePrompt,
            speed: reader.rate,
          }),
        });
        if (!res.ok) throw new Error(`Custom endpoint responded with HTTP ${res.status}`);
        const contentType = res.headers.get('content-type') || '';
        let srcUrl = '';
        if (contentType.includes('application/json')) {
          const json = (await res.json()) as { audioDataUrl?: string; audioUrl?: string };
          srcUrl = json.audioDataUrl || json.audioUrl || '';
        } else {
          const blob = await res.blob();
          srcUrl = URL.createObjectURL(blob);
        }
        if (!srcUrl) throw new Error('Custom AI reader did not return playable audio.');
        if (!previewAudioRef.current) previewAudioRef.current = new Audio();
        previewAudioRef.current.src = srcUrl;
        previewAudioRef.current.playbackRate = reader.rate;
        previewAudioRef.current.onended = () => setTestingId(null);
        await previewAudioRef.current.play();
        return;
      }

      const res = await fetch(resolveTtsApiEndpoint(ttsServerUrl), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: sampleText,
          voiceName: reader.voiceName,
          style: reader.stylePrompt,
          language: reader.language,
        }),
      });
      const data = (await res.json()) as { audioDataUrl?: string; error?: string };
      if (!res.ok || !data.audioDataUrl) {
        throw new Error(data.error || `Server error (${res.status})`);
      }
      if (!previewAudioRef.current) previewAudioRef.current = new Audio();
      previewAudioRef.current.src = data.audioDataUrl;
      previewAudioRef.current.playbackRate = reader.rate;
      previewAudioRef.current.onended = () => setTestingId(null);
      await previewAudioRef.current.play();
    } catch (err) {
      // Hybrid fallback to native Android / OS voice during preview if offline
      try {
        await speakWithNativeOrDeviceTts({
          text: sampleText,
          rate: reader.rate,
          languageHint: reader.language,
          onDone: () => setTestingId(null),
          onError: () => {
            setTestingId(null);
            setPreviewError(err instanceof Error ? err.message : 'Unable to preview voice.');
          },
        });
      } catch {
        setTestingId(null);
        setPreviewError(err instanceof Error ? err.message : 'Unable to preview voice.');
      }
    }
  };

  const handleTestCloudServer = async () => {
    setServerTestStatus('testing');
    setServerTestMsg(null);
    const cleaned = serverDraft.trim().replace(/\/+$/, '');
    onSaveTtsServerUrl(cleaned);
    try {
      const endpoint = resolveHealthApiEndpoint(cleaned);
      const res = await fetch(endpoint);
      const json = (await res.json()) as { ok?: boolean; hasGeminiKey?: boolean };
      if (!res.ok || !json.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      setServerTestStatus('ok');
      setServerTestMsg(
        json.hasGeminiKey
          ? 'Connected · Natural Cloud Voices active (with Native Android offline fallback).'
          : 'Server reached, but TTS key is missing on that server.'
      );
    } catch {
      setServerTestStatus('error');
      setServerTestMsg(
        `Could not reach Cloud TTS server. ${
          isNativeAndroidRuntime()
            ? 'Android native offline voices will be used automatically.'
            : 'Device offline voices will be used until online.'
        }`
      );
    }
  };

  const handleSaveNewReader = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setBuilderError('Give this AI natural voice reader a name.');
      return;
    }
    if (engine === 'custom-url') {
      try {
        const parsed = new URL(customEndpointUrl.trim());
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
          throw new Error('Invalid protocol');
        }
      } catch {
        setBuilderError('Enter a valid http(s) endpoint URL for your custom AI voice reader.');
        return;
      }
    }

    const newReader: AiVoiceReaderProfile = {
      id: `custom-voice:${Date.now()}:${Math.random().toString(36).slice(2, 6)}`,
      name: name.trim(),
      engine,
      voiceName,
      stylePrompt: stylePrompt.trim() || 'Natural audiobook narrator',
      rate,
      language: language.trim() || 'Auto (EN / ES)',
      customEndpointUrl: engine === 'custom-url' ? customEndpointUrl.trim() : undefined,
      notes: notes.trim() || undefined,
      isBuiltIn: false,
      createdAt: Date.now(),
    };

    onSaveCustomReader(newReader);
    onSelectActiveReader(newReader.id);
    setName('');
    setNotes('');
    setBuilderError(null);
    setBuilderOpen(false);
  };

  const customReaders = useMemo(() => readers.filter((r) => !r.isBuiltIn), [readers]);
  const builtInReaders = useMemo(() => readers.filter((r) => r.isBuiltIn), [readers]);
  const activeReader = readers.find((r) => r.id === activeReaderId) || readers[0];

  return (
    <div className="mx-auto max-w-4xl space-y-5 px-4 py-4">
      {/* Header + Add IA Natural Voice Reader CTA */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-base font-semibold text-white">
            AI Natural Voice Readers
          </h2>
          <p className="text-xs text-zinc-400">
            Choose from expanded natural voices or create and save custom AI (IA) voice reader profiles.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setBuilderOpen((v) => !v)}
          className="flex min-h-[42px] items-center gap-1.5 rounded-xl bg-emerald-400 px-3.5 text-xs font-semibold text-zinc-950 hover:bg-emerald-300"
        >
          {builderOpen ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          <span>{builderOpen ? 'Close Builder' : 'Add AI Voice Reader'}</span>
        </button>
      </div>

      {/* Active Reader Banner */}
      {activeReader && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-500/35 bg-emerald-950/20 p-3.5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-300">
              <Headphones className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="font-mono text-[10px] uppercase tracking-wider text-emerald-300">
                Active PDF Narrator
              </p>
              <p className="truncate text-sm font-semibold text-white">{activeReader.name}</p>
              <p className="truncate text-xs text-zinc-400">
                Voice: {activeReader.voiceName} · {activeReader.rate}x · {activeReader.stylePrompt}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => void testReader(activeReader)}
            className="flex min-h-[38px] items-center gap-1.5 rounded-xl border border-emerald-400/40 bg-emerald-500/15 px-3 text-xs font-semibold text-emerald-200 hover:bg-emerald-500/25"
          >
            {testingId === activeReader.id ? (
              <>
                <Square className="h-3.5 w-3.5" />
                <span>Stop</span>
              </>
            ) : (
              <>
                <Play className="h-3.5 w-3.5" />
                <span>Test Voice</span>
              </>
            )}
          </button>
        </div>
      )}

      {previewError && (
        <p className="rounded-xl border border-rose-500/30 bg-rose-950/30 px-3 py-2 text-xs text-rose-200">
          {previewError}
        </p>
      )}

      {/* Hybrid Cloud + Offline Android Voice Bridge Settings */}
      <div className="space-y-2.5 rounded-2xl border border-zinc-800 bg-zinc-950/90 p-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-cyan-300" />
            <span className="font-display text-xs font-semibold text-white">
              Hybrid Voice Connection (APK &amp; Offline HTML)
            </span>
          </div>
          <span className="font-mono text-[10px] text-zinc-400">
            {isNativeAndroidRuntime()
              ? 'Android APK · Cloud + Native TTS'
              : 'Cloud online + Cached / Device offline'}
          </span>
        </div>

        <p className="text-[11px] leading-relaxed text-zinc-400">
          Uses natural cloud narrator voices whenever reachable and caches spoken pages locally. If
          offline in the Android APK, falls back automatically to Android&apos;s native Speech
          Services engine.
        </p>

        <div className="flex flex-wrap items-center gap-2">
          <input
            type="url"
            value={serverDraft}
            onChange={(e) => setServerDraft(e.target.value)}
            placeholder={DEFAULT_CLOUD_TTS_ORIGIN}
            aria-label="Cloud TTS Server URL"
            className="min-h-[38px] min-w-[200px] flex-1 rounded-xl border border-zinc-800 bg-black/70 px-3 font-mono text-xs text-zinc-100 placeholder:text-zinc-500 focus:border-cyan-400 focus:outline-none"
          />
          <button
            type="button"
            onClick={() => void handleTestCloudServer()}
            className="flex min-h-[38px] items-center gap-1.5 rounded-xl border border-cyan-500/40 bg-cyan-500/15 px-3 text-xs font-semibold text-cyan-200 hover:bg-cyan-500/25"
          >
            {serverTestStatus === 'testing' ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Check className="h-3.5 w-3.5" />
            )}
            <span>Save &amp; Test</span>
          </button>
          {serverDraft.trim() !== '' && (
            <button
              type="button"
              onClick={() => {
                setServerDraft('');
                onSaveTtsServerUrl('');
                setServerTestStatus('idle');
                setServerTestMsg(null);
              }}
              title="Reset to default Cloud TTS Server"
              className="flex min-h-[38px] items-center gap-1 rounded-xl border border-zinc-800 bg-zinc-900 px-2.5 text-xs text-zinc-300 hover:bg-zinc-800"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Default</span>
            </button>
          )}
        </div>

        {serverTestMsg && (
          <p
            className={`text-[11px] ${
              serverTestStatus === 'ok' ? 'text-emerald-300' : 'text-amber-300'
            }`}
          >
            {serverTestMsg}
          </p>
        )}
      </div>

      {/* Custom IA Natural Voice Reader Builder */}
      {builderOpen && (
        <form
          onSubmit={handleSaveNewReader}
          className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-950/95 p-4"
        >
          <div className="flex items-center gap-2 border-b border-zinc-800 pb-2.5">
            <Sparkles className="h-4 w-4 text-emerald-400" />
            <h3 className="font-display text-sm font-semibold text-white">
              Create Custom AI (IA) Natural Voice Reader
            </h3>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                Reader Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Spanish Fantasy Narrator"
                className="min-h-[42px] w-full rounded-xl border border-zinc-800 bg-black/70 px-3 text-sm text-white placeholder:text-zinc-500 focus:border-emerald-400 focus:outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                Voice Engine
              </label>
              <select
                value={engine}
                onChange={(e) => {
                  const nextEng = e.target.value as VoiceReaderEngine;
                  setEngine(nextEng);
                  if (nextEng === 'gemini-tts') setVoiceName('Aoede');
                  else if (nextEng === 'device-tts') {
                    setVoiceName(deviceVoices[0]?.voiceURI || 'Default');
                  }
                }}
                className="min-h-[42px] w-full rounded-xl border border-zinc-800 bg-black/70 px-3 text-sm text-white focus:border-emerald-400 focus:outline-none"
              >
                <option value="gemini-tts">AI Natural Voice (Gemini TTS)</option>
                <option value="device-tts">Device Natural Voice (Offline OS)</option>
                <option value="custom-url">Custom IA Reader Endpoint (URL)</option>
              </select>
            </div>
          </div>

          {engine === 'gemini-tts' ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                  Natural Voice
                </label>
                <select
                  value={voiceName}
                  onChange={(e) => {
                    const v = e.target.value as GeminiTtsVoiceName;
                    setVoiceName(v);
                    const meta = GEMINI_NATURAL_VOICES.find((g) => g.id === v);
                    if (meta) setStylePrompt(meta.defaultStyle);
                  }}
                  className="min-h-[42px] w-full rounded-xl border border-zinc-800 bg-black/70 px-3 text-sm text-white focus:border-emerald-400 focus:outline-none"
                >
                  {GEMINI_NATURAL_VOICES.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.label} — {v.tone}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                  Language / Accent Hint
                </label>
                <input
                  type="text"
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  placeholder="Auto (EN / ES), Spanish, English..."
                  className="min-h-[42px] w-full rounded-xl border border-zinc-800 bg-black/70 px-3 text-sm text-white focus:border-emerald-400 focus:outline-none"
                />
              </div>
            </div>
          ) : engine === 'device-tts' ? (
            <div className="space-y-1">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                Device Installed Voice
              </label>
              <select
                value={voiceName}
                onChange={(e) => setVoiceName(e.target.value)}
                className="min-h-[42px] w-full rounded-xl border border-zinc-800 bg-black/70 px-3 text-sm text-white focus:border-emerald-400 focus:outline-none"
              >
                {deviceVoices.length === 0 ? (
                  <option value="Default">System Default Natural Voice</option>
                ) : (
                  deviceVoices.map((dv) => (
                    <option key={dv.voiceURI} value={dv.voiceURI}>
                      {dv.name} ({dv.lang})
                    </option>
                  ))
                )}
              </select>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                  IA Reader Endpoint URL *
                </label>
                <input
                  type="text"
                  value={customEndpointUrl}
                  onChange={(e) => setCustomEndpointUrl(e.target.value)}
                  placeholder="https://my-tts-server.local/tts"
                  className="min-h-[42px] w-full rounded-xl border border-zinc-800 bg-black/70 px-3 text-sm text-white placeholder:text-zinc-500 focus:border-emerald-400 focus:outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                  Remote Voice ID
                </label>
                <input
                  type="text"
                  value={voiceName}
                  onChange={(e) => setVoiceName(e.target.value)}
                  placeholder="e.g. af_bella, narrator_1"
                  className="min-h-[42px] w-full rounded-xl border border-zinc-800 bg-black/70 px-3 text-sm text-white focus:border-emerald-400 focus:outline-none"
                />
              </div>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
              AI Voice Persona & Pacing Prompt
            </label>
            <input
              type="text"
              value={stylePrompt}
              onChange={(e) => setStylePrompt(e.target.value)}
              placeholder="e.g. Warm, expressive Spanish narrator, calm evening pacing"
              className="min-h-[42px] w-full rounded-xl border border-zinc-800 bg-black/70 px-3 text-sm text-white focus:border-emerald-400 focus:outline-none"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                Default Speed ({rate}x)
              </label>
              <div className="flex items-center gap-1 rounded-xl border border-zinc-800 bg-black/70 p-1">
                {[0.85, 0.95, 1, 1.15, 1.3].map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRate(r)}
                    className={`min-h-[32px] flex-1 rounded-lg font-mono text-xs ${
                      rate === r ? 'bg-emerald-400 font-semibold text-zinc-950' : 'text-zinc-400'
                    }`}
                  >
                    {r}x
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                Notes (Optional)
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Best for manga, fantasy, or study..."
                className="min-h-[42px] w-full rounded-xl border border-zinc-800 bg-black/70 px-3 text-sm text-white focus:border-emerald-400 focus:outline-none"
              />
            </div>
          </div>

          {builderError && <p className="text-xs text-rose-400">{builderError}</p>}

          <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() =>
                void testReader({
                  id: 'builder-preview',
                  engine,
                  voiceName,
                  stylePrompt,
                  rate,
                  language,
                  customEndpointUrl,
                })
              }
              className="flex min-h-[42px] items-center gap-1.5 rounded-xl border border-zinc-700 bg-zinc-900 px-3.5 text-xs font-medium text-zinc-200 hover:bg-zinc-800"
            >
              {testingId === 'builder-preview' ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Volume2 className="h-3.5 w-3.5" />
              )}
              <span>Preview Sample</span>
            </button>
            <button
              type="submit"
              className="min-h-[42px] rounded-xl bg-emerald-400 px-5 text-xs font-semibold text-zinc-950 hover:bg-emerald-300"
            >
              Save AI Voice Reader
            </button>
          </div>
        </form>
      )}

      {/* Custom Saved AI Readers */}
      {customReaders.length > 0 && (
        <section className="space-y-2.5">
          <h3 className="font-mono text-[11px] uppercase tracking-wider text-zinc-400">
            Your Saved AI Voice Readers ({customReaders.length})
          </h3>
          <div className="grid gap-2.5 sm:grid-cols-2">
            {customReaders.map((r) => {
              const isActive = r.id === activeReaderId;
              return (
                <div
                  key={r.id}
                  className={`flex flex-col justify-between gap-3 rounded-2xl border p-3.5 ${
                    isActive
                      ? 'border-emerald-400/60 bg-emerald-950/20'
                      : 'border-zinc-800 bg-zinc-950/85'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-display text-sm font-semibold text-white">
                        {r.name}
                      </span>
                      <span className="shrink-0 rounded-md border border-zinc-700 bg-zinc-900 px-2 py-0.5 font-mono text-[10px] text-zinc-300">
                        {r.engine === 'gemini-tts'
                          ? `AI · ${r.voiceName}`
                          : r.engine === 'device-tts'
                            ? 'Device'
                            : 'Custom URL'}
                      </span>
                    </div>
                    <p className="line-clamp-2 text-xs text-zinc-400">{r.stylePrompt}</p>
                    {r.notes && <p className="text-[11px] text-zinc-500">{r.notes}</p>}
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => void testReader(r)}
                        className="flex min-h-[36px] items-center gap-1 rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 text-xs text-zinc-200 hover:bg-zinc-800"
                      >
                        {testingId === r.id ? (
                          <Square className="h-3 w-3" />
                        ) : (
                          <Play className="h-3 w-3" />
                        )}
                        <span>{testingId === r.id ? 'Stop' : 'Test'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteCustomReader(r.id)}
                        aria-label={`Delete ${r.name}`}
                        className="flex h-9 w-9 items-center justify-center rounded-lg text-zinc-400 hover:bg-red-950/40 hover:text-red-400"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => onSelectActiveReader(r.id)}
                      className={`flex min-h-[36px] items-center gap-1 rounded-lg px-3 text-xs font-semibold ${
                        isActive
                          ? 'bg-emerald-400 text-zinc-950'
                          : 'border border-zinc-700 bg-zinc-900 text-zinc-200 hover:bg-zinc-800'
                      }`}
                    >
                      {isActive && <Check className="h-3.5 w-3.5" />}
                      <span>{isActive ? 'Active' : 'Use Reader'}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Built-in Natural Voice Readers */}
      <section className="space-y-2.5">
        <h3 className="font-mono text-[11px] uppercase tracking-wider text-zinc-400">
          Curated Natural Voice Readers ({builtInReaders.length})
        </h3>
        <div className="grid gap-2.5 sm:grid-cols-2">
          {builtInReaders.map((r) => {
            const isActive = r.id === activeReaderId;
            return (
              <div
                key={r.id}
                className={`flex flex-col justify-between gap-2.5 rounded-2xl border p-3.5 ${
                  isActive
                    ? 'border-emerald-400/60 bg-emerald-950/20'
                    : 'border-zinc-800/80 bg-zinc-950/85'
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 truncate font-display text-sm font-semibold text-white">
                      <Mic className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                      <span className="truncate">{r.name}</span>
                    </span>
                    <span className="shrink-0 font-mono text-[10px] text-zinc-400">
                      {r.rate}x
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400">{r.notes || r.stylePrompt}</p>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => void testReader(r)}
                    className="flex min-h-[36px] items-center gap-1 rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 text-xs text-zinc-200 hover:bg-zinc-800"
                  >
                    {testingId === r.id ? (
                      <Square className="h-3 w-3" />
                    ) : (
                      <Play className="h-3 w-3" />
                    )}
                    <span>{testingId === r.id ? 'Stop' : 'Preview'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onSelectActiveReader(r.id)}
                    className={`flex min-h-[36px] items-center gap-1 rounded-lg px-3 text-xs font-semibold ${
                      isActive
                        ? 'bg-emerald-400 text-zinc-950'
                        : 'border border-zinc-700 bg-zinc-900 text-zinc-200 hover:bg-zinc-800'
                    }`}
                  >
                    {isActive && <Check className="h-3.5 w-3.5" />}
                    <span>{isActive ? 'Active' : 'Use Reader'}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Full Natural Voice Catalog Quick-Add */}
      <section className="space-y-2.5 pb-6">
        <h3 className="font-mono text-[11px] uppercase tracking-wider text-zinc-400">
          All Natural Voices ({GEMINI_NATURAL_VOICES.length}) — Tap to Preview or Add as Reader
        </h3>
        <div className="grid gap-2 sm:grid-cols-3">
          {GEMINI_NATURAL_VOICES.map((v) => (
            <div
              key={v.id}
              className="flex items-center justify-between gap-2 rounded-xl border border-zinc-800/80 bg-zinc-950/80 p-2.5"
            >
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-white">{v.label}</p>
                <p className="truncate text-[10px] text-zinc-400">{v.tone}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() =>
                    void testReader({
                      id: `voice:${v.id}`,
                      engine: 'gemini-tts',
                      voiceName: v.id,
                      stylePrompt: v.defaultStyle,
                      rate: 1,
                    })
                  }
                  aria-label={`Preview ${v.label}`}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-200 hover:bg-zinc-800"
                >
                  {testingId === `voice:${v.id}` ? (
                    <Square className="h-3 w-3" />
                  ) : (
                    <Play className="h-3 w-3" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const created: AiVoiceReaderProfile = {
                      id: `custom-voice:${Date.now()}:${v.id}`,
                      name: `${v.label} · Reader`,
                      engine: 'gemini-tts',
                      voiceName: v.id,
                      stylePrompt: v.defaultStyle,
                      rate: 1,
                      language: 'Auto (EN / ES)',
                      isBuiltIn: false,
                      createdAt: Date.now(),
                    };
                    onSaveCustomReader(created);
                    onSelectActiveReader(created.id);
                  }}
                  aria-label={`Use ${v.label}`}
                  title={`Save & activate ${v.label}`}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-500/30 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
