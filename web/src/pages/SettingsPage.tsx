import { useState } from 'react';
import { useEffectsSettings } from '../context/EffectsSettingsContext';
import { BACKGROUND_EFFECTS } from '../components/effects/catalog';
import { BACKGROUND_DARK_SHADES, BACKGROUND_LIGHT_SHADES, BACKGROUND_TINTS, useBackgroundSettings, type BackgroundTint } from '../context/BackgroundSettingsContext';

type SettingsCategory = 'appearance' | 'library';

const CATEGORIES: { id: SettingsCategory; label: string; description: string }[] = [
  { id: 'appearance', label: 'Appearance', description: 'Theme and surface' },
  { id: 'library', label: 'Library', description: 'Collection preferences' },
];

export function SettingsPage(): JSX.Element {
  const [category, setCategory] = useState<SettingsCategory>('appearance');
  const { background, setBackground } = useEffectsSettings();
  const { tint, darkShade, lightShade, setTint, setDarkShade, setLightShade } = useBackgroundSettings();
  const hasBackgroundEffect = background !== null && BACKGROUND_EFFECTS.some((entry) => entry.id === background);
  const showShadeSelectors = background !== 'dither';

  const renderAppearance = () => (
    <SettingsPanel title="Background" eyebrow="Appearance">
      <div className="settings-subpanel settings-subpanel--first">
        <div className="settings-option-grid">
          <button type="button" className={`settings-choice${background === null ? ' is-active' : ''}`} onClick={() => setBackground(null)}><strong>No background</strong><span>Lowest GPU cost</span></button>
          {BACKGROUND_EFFECTS.map((entry) => <button type="button" className={`settings-choice${background === entry.id ? ' is-active' : ''}`} key={entry.id} onClick={() => setBackground(background === entry.id ? null : entry.id)}><strong>{entry.name}</strong><span>Animated background</span></button>)}
        </div>
      </div>
      <div className="settings-subpanel settings-subpanel--controls">
        <div className="settings-swatch-groups">
          <div className={`settings-swatch-group${showShadeSelectors ? '' : ' settings-swatch-group--unavailable'}`}><span>Dark shade</span>{showShadeSelectors ? <div className="settings-shade-grid" role="group" aria-label="Dark background shades">
            {BACKGROUND_DARK_SHADES.map((entry) => <button type="button" className={`settings-shade${darkShade === entry.id ? ' is-active' : ''}`} key={entry.id} onClick={() => setDarkShade(entry.id)} aria-label={entry.label} aria-pressed={darkShade === entry.id}><span style={{ background: entry.color }} /></button>)}
          </div> : <strong>Not available</strong>}</div>
          <div className={`settings-swatch-group${showShadeSelectors ? '' : ' settings-swatch-group--unavailable'}`}><span>Light shade</span>{showShadeSelectors ? <div className="settings-shade-grid" role="group" aria-label="Light background shades">
            {BACKGROUND_LIGHT_SHADES.map((entry) => <button type="button" className={`settings-shade${lightShade === entry.id ? ' is-active' : ''}`} key={entry.id} onClick={() => setLightShade(entry.id)} aria-label={entry.label} aria-pressed={lightShade === entry.id}><span style={{ background: entry.color }} /></button>)}
          </div> : <strong>Not available</strong>}</div>
          <div className={`settings-swatch-group${hasBackgroundEffect ? '' : ' settings-swatch-group--unavailable'}`}><span>Effect tint</span>{hasBackgroundEffect ? <div className="settings-swatch-grid" role="group" aria-label="Effect tint">
              {(Object.keys(BACKGROUND_TINTS) as BackgroundTint[]).map((entry) => <button type="button" className={`settings-swatch settings-swatch--${entry}${tint === entry ? ' is-active' : ''}`} key={entry} onClick={() => setTint(entry)} aria-label={`${BACKGROUND_TINTS[entry].label} tint`} aria-pressed={tint === entry}><span aria-hidden="true" /></button>)}
            </div> : <strong>Not available</strong>}</div>
        </div>
      </div>
    </SettingsPanel>
  );

  const renderLibrary = () => (
    <SettingsPanel title="Library preferences" eyebrow="Library">
      <div className="settings-placeholder"><strong>More library controls are on their way.</strong><span>Grid density, sorting, and collection behavior will live here.</span></div>
    </SettingsPanel>
  );

  const panels: Record<SettingsCategory, () => JSX.Element> = { appearance: renderAppearance, library: renderLibrary };

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
