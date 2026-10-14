import { useEffect, useState, type CSSProperties } from 'react';
import { BrandMark } from './BrandMark';

type LaunchPhase = 'intro' | 'reveal' | 'done';
const revealAt = 1220;
const finishAt = 1840;

export function useBrandLaunch() {
  const [phase, setPhase] = useState<LaunchPhase>(() =>
    window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'done' : 'intro');

  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (preference.matches) { setPhase('done'); return; }
    // Branding never waits for authentication or a network response.
    const reveal = window.setTimeout(() => setPhase('reveal'), revealAt);
    const finish = window.setTimeout(() => setPhase('done'), finishAt);
    const skip = () => {
      if (!preference.matches) return;
      window.clearTimeout(reveal); window.clearTimeout(finish);
      setPhase('done');
    };
    preference.addEventListener('change', skip);
    return () => {
      window.clearTimeout(reveal); window.clearTimeout(finish);
      preference.removeEventListener('change', skip);
    };
  }, []);

  return { showIntro: phase !== 'done', revealing: phase === 'reveal', appReady: phase !== 'intro' };
}

export function BrandLaunch({ tagline, revealing }: { tagline: string; revealing: boolean }) {
  return <div className={`launch-screen${revealing ? ' launch-revealing' : ''}`} aria-hidden="true">
    <div className="launch-atmosphere"><i/><i/></div>
    <div className="launch-grid"/>
    <div className="launch-streak"/>
    <div className="launch-composition">
      <div className="launch-scene">
        <div className="launch-halo"/>
        <div className="launch-orbit launch-orbit-outer"><i/></div>
        <div className="launch-orbit launch-orbit-inner"><i/></div>
        <div className="launch-orbit launch-orbit-cross"/>
        <div className="launch-particles">{Array.from({ length: 8 }, (_, index) =>
          <i key={index} style={{ '--particle': index } as CSSProperties}/>)}</div>
        <div className="launch-mark"><BrandMark/><div className="launch-logo-sheen"/></div>
        <div className="launch-floor"/>
      </div>
      <strong className="launch-wordmark">{'UZDONATE'.split('').map((letter, index) =>
        <span key={index} style={{ '--letter': index } as CSSProperties}>{letter}</span>)}<b>.</b></strong>
      <small>{tagline}</small>
      <div className="launch-signature"><i/></div>
    </div>
  </div>;
}
