import { useState } from 'react';
import { useEffectsSettings } from '../context/EffectsSettingsContext';
import { BACKGROUND_EFFECTS } from '../components/effects/catalog';
import { BACKGROUND_DARK_SHADES, BACKGROUND_LIGHT_SHADES, BACKGROUND_TINTS, useBackgroundSettings, type BackgroundTint } from '../context/BackgroundSettingsContext';
import { ScannerSection } from '../components/ScannerSection';

type SettingsCategory = 'appearance' | 'locations';

type SettingsNavigationItem = {
  id: string;
  label: string;
  category?: SettingsCategory;
};

const SETTINGS_GROUPS: { label: string; items: SettingsNavigationItem[] }[] = [
  {
    label: 'General',
    items: [
      { id: 'appearance', label: 'Appearance', category: 'appearance' },
      { id: 'behavior', label: 'Behavior' },
    ],
  },
  {
    label: 'Library',
    items: [
      { id: 'display', label: 'Display' },
      { id: 'locations', label: 'Locations', category: 'locations' },
      { id: 'metadata', label: 'Metadata' },
    ],
  },
  {
    label: 'Providers',
    items: [{ id: 'steam', label: 'Steam' }],
  },
  {
    label: 'System',
    items: [
      { id: 'storage', label: 'Storage' },
      { id: 'maintenance', label: 'Maintenance' },
    ],
  },
];

export function SettingsPage(): JSX.Element {
  const [category, setCategory] = useState<SettingsCategory>('locations');
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
    <SettingsPanel title="Library locations" eyebrow="Locations">
      <ScannerSection />
    </SettingsPanel>
  );

  const panels: Record<SettingsCategory, () => JSX.Element> = { appearance: renderAppearance, locations: renderLibrary };

  return (
    <div className="page">
      <div className="settings-page">
        <div className="settings-shell">
          <nav className="settings-menu" aria-label="Settings categories">
            {SETTINGS_GROUPS.map((group) => (
              <section className="settings-menu-group" key={group.label}>
                <h2 className="settings-menu-label">{group.label}</h2>
                <div className="settings-menu-items">
                  {group.items.map((item) => {
                    const isAvailable = item.category !== undefined;
                    const isActive = item.category === category;

                    return <button type="button" key={item.id} className={`settings-menu-item${isActive ? ' is-active' : ''}${!isAvailable ? ' is-disabled' : ''}`} onClick={isAvailable ? () => setCategory(item.category!) : undefined} aria-current={isActive ? 'page' : undefined} disabled={!isAvailable}><strong>{item.label}</strong>{!isAvailable && <small>Coming soon</small>}</button>;
                  })}
                </div>
              </section>
            ))}
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
