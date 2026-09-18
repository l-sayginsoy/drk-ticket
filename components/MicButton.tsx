import React, { useCallback, useRef, useState } from 'react';

interface Props {
  onResult: (text: string) => void;
  lang?: string;
  title?: string;
}

const SpeechRecognition =
  typeof window !== 'undefined'
    ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    : null;

export default function MicButton({ onResult, lang = 'de-DE', title = 'Spracheingabe' }: Props) {
  const [active, setActive] = useState(false);
  const recRef = useRef<any>(null);

  const toggle = useCallback(() => {
    if (active) {
      recRef.current?.stop();
      return;
    }
    const rec = new SpeechRecognition();
    rec.lang = lang;
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onresult = (e: any) => {
      const transcript = e.results[0][0].transcript;
      onResult(transcript);
    };
    rec.onend = () => setActive(false);
    rec.onerror = () => setActive(false);
    recRef.current = rec;
    rec.start();
    setActive(true);
  }, [active, lang, onResult]);

  if (!SpeechRecognition) return null;

  return (
    <button
      type="button"
      onClick={toggle}
      title={active ? 'Aufnahme stoppen' : title}
      style={{
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        padding: '4px 5px',
        borderRadius: 6,
        color: active ? '#dc2626' : 'var(--text-muted)',
        fontSize: 17,
        lineHeight: 1,
        flexShrink: 0,
        display: 'inline-flex',
        alignItems: 'center',
        transition: 'color 0.15s',
      }}
    >
      <i
        className={`ti ${active ? 'ti-microphone' : 'ti-microphone'}`}
        style={{
          animation: active ? 'mic-pulse 1s ease-in-out infinite' : 'none',
        }}
      />
      <style>{`
        @keyframes mic-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.35; }
        }
      `}</style>
    </button>
  );
}
