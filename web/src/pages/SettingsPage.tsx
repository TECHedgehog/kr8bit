import { useState } from 'react';
import { useTheme } from '../context/ThemeContext';
import { useEffectsSettings } from '../context/EffectsSettingsContext';
import { BACKGROUND_EFFECTS } from '../components/effects/catalog';
import type { SettingControl } from '../components/effects/effectSettings';

type SettingsCategory = 'appearance' | 'background' | 'library';

const CATEGORIES: { id: SettingsCategory; label: string; description: string }[] = [
  { id: 'appearance', label: 'Appearance', description: 'Theme and surface' },
  { id: 'background', label: 'Background', description: 'Atmosphere and effects' },
  { id: 'library', label: 'Library', description: 'Collection preferences' },
];

export function SettingsPage(): JSX.Element {
  const [category, setCategory] = useState<SettingsCategory>('appearance');
  const { theme, toggleTheme } = useTheme();
  const { background, params, setBackground, setParam, resetParams } = useEffectsSettings();
  const activeBackground = BACKGROUND_EFFECTS.find((entry) => entry.id === background);

  const renderControl = (effectId: string, control: SettingControl) => {
    const value = params[effectId]?.[control.key] ?? control.default;
    if (control.kind === 'number') {
      return (
        <label className="settings-control" key={control.key}>
          <span>{control.label}</span>
          <input type="range" min={control.min} max={control.max} step={control.step} value={Number(value)} onChange={(event) => setParam(effectId, control.key, Number(event.target.value))} />
          <output>{String(value)}</output>
        </label>
      );
    }
    if (control.kind === 'boolean') {
      return <label className="settings-control settings-control-toggle" key={control.key}><span>{control.label}</span><input type="checkbox" checked={value === true} onChange={(event) => setParam(effectId, control.key, event.target.checked)} /></label>;
    }
    if (control.kind === 'select') {
      return <label className="settings-control" key={control.key}><span>{control.label}</span><select value={String(value)} onChange={(event) => setParam(effectId, control.key, event.target.value)}>{control.options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>;
    }
    return null;
  };

  const renderAppearance = () => (
    <SettingsPanel title="Surface profile" eyebrow="Appearance">
      <div className="settings-option-grid">
        <button type="button" className={`settings-choice${theme === 'dark' ? ' is-active' : ''}`} onClick={() => theme !== 'dark' && toggleTheme()}><strong>Dark mode</strong><span>Deep contrast, neon accents</span></button>
        <button type="button" className={`settings-choice${theme === 'light' ? ' is-active' : ''}`} onClick={() => theme !== 'light' && toggleTheme()}><strong>Light mode</strong><span>Bright surfaces, soft contrast</span></button>
      </div>
    </SettingsPanel>
  );

  const renderBackground = () => (
    <SettingsPanel title="Background effects" eyebrow="Atmosphere">
      <p className="settings-help">Animated backgrounds add depth, but use GPU and battery while active.</p>
      <div className="settings-option-grid">
        <button type="button" className={`settings-choice${background === null ? ' is-active' : ''}`} onClick={() => setBackground(null)}><strong>Flat field</strong><span>Lowest GPU cost</span></button>
        {BACKGROUND_EFFECTS.map((entry) => <button type="button" className={`settings-choice${background === entry.id ? ' is-active' : ''}`} key={entry.id} onClick={() => setBackground(background === entry.id ? null : entry.id)}><strong>{entry.name}</strong><span>Animated background</span></button>)}
      </div>
      {activeBackground && activeBackground.controls.length > 0 && <div className="settings-subpanel"><div className="settings-subpanel-heading"><strong>{activeBackground.name} tuning</strong><button type="button" className="settings-link" onClick={() => resetParams(activeBackground.id)}>Reset tuning</button></div>{activeBackground.controls.map((control) => renderControl(activeBackground.id, control))}</div>}
    </SettingsPanel>
  );

  const renderLibrary = () => (
    <SettingsPanel title="Library preferences" eyebrow="Library">
      <div className="settings-placeholder"><strong>More library controls are on their way.</strong><span>Grid density, sorting, and collection behavior will live here.</span></div>
    </SettingsPanel>
  );

  const panels: Record<SettingsCategory, () => JSX.Element> = { appearance: renderAppearance, background: renderBackground, library: renderLibrary };

  return (
    <div className="page">
      <div className="settings-page">
        <header className="library-header settings-header">
          <div className="library-toolbar settings-title-toolbar">
            <div className="library-title-block"><div className="library-title">Settings</div><div className="library-subtitle">Tune your space</div></div>
          </div>
        </header>
        <div className="settings-shell">
          <nav className="settings-menu" aria-label="Settings categories">
            <span className="settings-menu-label">Categories</span>
            {CATEGORIES.map((item) => <button type="button" key={item.id} className={`settings-menu-item${category === item.id ? ' is-active' : ''}`} onClick={() => setCategory(item.id)} aria-current={category === item.id ? 'page' : undefined}><strong>{item.label}</strong><span>{item.description}</span></button>)}
          </nav>
          <main className="settings-panel">{panels[category]()}</main>
        </div>
      </div>
    </div>
  );
}

function SettingsPanel({ title, eyebrow, children }: { title: string; eyebrow: string; children: React.ReactNode }): JSX.Element {
  return <section className="settings-panel-content"><div className="settings-card-heading"><div><p className="eyebrow">{eyebrow}</p><h2>{title}</h2></div></div>{children}</section>;
}
