import React, { useEffect, useState } from 'react';
import OnlineGame from './online-game';
import CardGenerator, { Language } from './card-generator';
function currentMode() {
  const params = new URLSearchParams(location.search);
  // An invitation/rejoin always opens the authoritative game, even with a stale mode flag.
  return !params.has('room') && params.get('mode') === 'cards' ? 'cards' : 'online';
}
export default function GameEntry() {
  const [mode, setMode] = useState(currentMode);
  useEffect(() => {
    const navigate = () => setMode(currentMode());
    window.addEventListener('popstate', navigate);
    return () => window.removeEventListener('popstate', navigate);
  }, []);
  function navigate(next: string, language: Language) {
    const url = new URL(location.href);
    url.search = '';
    url.searchParams.set('lang', language);
    if (next === 'cards') url.searchParams.set('mode', 'cards');
    history.pushState(null, '', url);
    setMode(next);
  }
  return mode === 'cards'
    ? <CardGenerator onOnline={language => navigate('online', language)} />
    : <OnlineGame onCards={language => navigate('cards', language)} />;
}
