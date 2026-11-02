import { useState } from 'react';
import CheckPage from './pages/CheckPage';
import BankPage from './pages/BankPage';

type Tab = 'check' | 'bank';

export default function App() {
  const [tab, setTab] = useState<Tab>('check');

  return (
    <div className="app">
      <header className="header">
        <div className="header-inner">
          <div className="brand">
            <span className="brand-mark">NS</span>
            <div>
              <h1>NativeSense</h1>
              <p className="tagline">Your English naturalness coach</p>
            </div>
          </div>
          <nav className="tabs">
            <button
              className={tab === 'check' ? 'tab active' : 'tab'}
              onClick={() => setTab('check')}
            >
              Check
            </button>
            <button
              className={tab === 'bank' ? 'tab active' : 'tab'}
              onClick={() => setTab('bank')}
            >
              Learning Bank
            </button>
          </nav>
        </div>
      </header>

      <main className="container">
        {tab === 'check' ? (
          <CheckPage onGoToBank={() => setTab('bank')} />
        ) : (
          <BankPage onGoToCheck={() => setTab('check')} />
        )}
      </main>

      <footer className="footer">
        <p>
          NativeSense coaches natural English — not just grammar. Runs with your
          own AI model; your data stays on your machine.
        </p>
      </footer>
    </div>
  );
}
