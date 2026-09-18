import React, { useCallback, useRef, useState } from 'react';

interface Props {
  value: string;
  onChange: (text: string) => void;
  lang?: string;
  title?: string;
}

const SpeechRecognition =
  typeof window !== 'undefined'
    ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    : null;

// Gesprochene Satzzeichen in Symbole umwandeln
function applyPunctuation(text: string): string {
  return text
    .replace(/\s*\bKomma\b\s*/gi, ', ')
    .replace(/\s*\bPunkt\b\s*/gi, '. ')
    .replace(/\s*\bAusrufezeichen\b\s*/gi, '! ')
    .replace(/\s*\bFragezeichen\b\s*/gi, '? ')
    .replace(/\s*\bDoppelpunkt\b\s*/gi, ': ')
    .replace(/\s*\bSemikolon\b\s*/gi, '; ')
    .replace(/\s*\bBindestrich\b\s*/gi, '-')
    .replace(/\s*\b(?:neue Zeile|Absatz|Zeilenumbruch)\b\s*/gi, '\n')
    .replace(/  +/g, ' ')
    .trim();
}

export default function MicButton({ value, onChange, lang = 'de-DE', title = 'Spracheingabe' }: Props) {
  const [active, setActive] = useState(false);
  const recRef = useRef<any>(null);
  const activeRef = useRef(false);
  // Text im Feld bevor Mikrofon gestartet wurde (+ bereits bestätigte Finals aus Neustarts)
  const baseRef = useRef('');
  // Finals die in der aktuellen Erkennungs-Session gesammelt wurden
  const finalRef = useRef('');

  const startRec = useCallback(() => {
    if (!SpeechRecognition || !activeRef.current) return;

    const rec = new SpeechRecognition();
    rec.lang = lang;
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    rec.onresult = (e: any) => {
      let newFinals = '';
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) {
          newFinals += (newFinals ? ' ' : '') + e.results[i][0].transcript.trim();
        } else {
          interim += e.results[i][0].transcript;
        }
      }
      if (newFinals) {
        const processed = applyPunctuation(newFinals);
        finalRef.current = finalRef.current
          ? finalRef.current + ' ' + processed
          : processed;
      }
      const confirmed = [baseRef.current, finalRef.current].filter(Boolean).join(' ');
      const display = interim ? [confirmed, interim].filter(Boolean).join(' ') : confirmed;
      onChange(display);
    };

    rec.onend = () => {
      if (!activeRef.current) {
        setActive(false);
        return;
      }
      // Vor dem Neustart: bestätigte Finals in die Basis übernehmen
      const confirmed = [baseRef.current, finalRef.current].filter(Boolean).join(' ');
      baseRef.current = confirmed;
      finalRef.current = '';
      // Kurze Pause damit der Browser nicht sofort wieder abbricht
      setTimeout(startRec, 150);
    };

    rec.onerror = (e: any) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        activeRef.current = false;
        setActive(false);
      }
      // Bei 'no-speech', 'network' usw. feuert onend → Neustart läuft dort
    };

    recRef.current = rec;
    try { rec.start(); } catch { /* bereits aktiv */ }
  }, [lang, onChange]);

  const toggle = useCallback(() => {
    if (activeRef.current) {
      activeRef.current = false;
      setActive(false);
      recRef.current?.stop();
      return;
    }
    // Aktuellen Feldinhalt als Basis merken
    baseRef.current = value;
    finalRef.current = '';
    activeRef.current = true;
    setActive(true);
    startRec();
  }, [value, startRec]);

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
        className="ti ti-microphone"
        style={{ animation: active ? 'mic-pulse 1s ease-in-out infinite' : 'none' }}
      />
      <style>{`@keyframes mic-pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }`}</style>
    </button>
  );
}
