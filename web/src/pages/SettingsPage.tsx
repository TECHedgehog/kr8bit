import { useEffect, useLayoutEffect, useRef, useState, type ComponentType } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { IconProps } from '@tabler/icons-react';
import IconAdjustments from '@tabler/icons-react/dist/esm/icons/IconAdjustments.mjs';
import IconLayoutGrid from '@tabler/icons-react/dist/esm/icons/IconLayoutGrid.mjs';
import IconMapPin from '@tabler/icons-react/dist/esm/icons/IconMapPin.mjs';
import IconPalette from '@tabler/icons-react/dist/esm/icons/IconPalette.mjs';
import IconWorld from '@tabler/icons-react/dist/esm/icons/IconWorld.mjs';
import IconTool from '@tabler/icons-react/dist/esm/icons/IconTool.mjs';
import { useEffectsSettings } from '../context/EffectsSettingsContext';
import { BACKGROUND_EFFECTS } from '../components/effects/catalog';
import { BACKGROUND_DARK_SHADES, BACKGROUND_LIGHT_SHADES, BACKGROUND_TINTS, useBackgroundSettings, type BackgroundTint } from '../context/BackgroundSettingsContext';
import { ScannerSection } from '../components/ScannerSection';
import { LibraryLocationSection } from '../components/LibraryLocationSection';
import { LibraryNamingSection } from '../components/LibraryNamingSection';
import { useGlowFollow } from '../hooks/useGlowFollow';
import { useNavigationPreferences } from '../context/NavigationPreferencesContext';
import { TodoPanel } from '../components/TodoPanel';
import { useDeveloperAccess } from '../context/DeveloperAccessContext';
import { api } from '../api/client';
import type { RepackSettings } from '../api/types';
import { SettingsNavLens } from '../components/SettingsNavLens';
import { isSettingsCategory, type SettingsCategory } from '../settings-categories';
import { useRepackCatalogEnabled } from '../context/RepackCatalogEnabledContext';
import { DiagnosticsSection } from '../components/DiagnosticsSection';
import { MaintenancePanel } from '../components/MaintenancePanel';

type SettingsNavigationItem = {
  id: string;
  label: string;
  icon: ComponentType<IconProps>;
  color: string;
  category: SettingsCategory;
};

const SETTINGS_GROUPS: { label: string; items: SettingsNavigationItem[] }[] = [
  {
    label: 'Overview',
    items: [{ id: 'review', label: 'Review', icon: IconLayoutGrid, color: '#14b8a6', category: 'review' }],
  },
  {
    label: 'General',
    items: [
      { id: 'appearance', label: 'Appearance', icon: IconPalette, color: '#a855f7', category: 'appearance' },
      { id: 'behavior', label: 'Behavior', icon: IconAdjustments, color: '#f59e0b', category: 'behavior' },
    ],
  },
  {
    label: 'Library',
    items: [{ id: 'locations', label: 'Locations', icon: IconMapPin, color: '#10b981', category: 'locations' }],
  },
  {
    label: 'Sources',
    items: [{ id: 'repack-catalog', label: 'Repack catalog', icon: IconWorld, color: '#f97316', category: 'sources' }],
  },
  {
    label: 'System',
    items: [{ id: 'maintenance', label: 'Maintenance', icon: IconTool, color: '#ef4444', category: 'maintenance' }],
  },
];

export function SettingsPage(): JSX.Element {
  const [searchParams] = useSearchParams();
  const { refresh: refreshRepackCatalog } = useRepackCatalogEnabled();
  const {
    rememberSettingsCategory,
    rememberLibraryPanel,
    lastSettingsCategory,
    setRememberSettingsCategory,
    setRememberLibraryPanel,
    setLastSettingsCategory,
  } = useNavigationPreferences();
  const categoryFromUrl = searchParams.get('category');
  const initialCategory = isSettingsCategory(categoryFromUrl)
    ? categoryFromUrl
    : rememberSettingsCategory && isSettingsCategory(lastSettingsCategory)
      ? lastSettingsCategory
      : 'review';
  const [category, setCategory] = useState<SettingsCategory>(initialCategory);
  const menuRef = useRef<HTMLElement>(null);
  useGlowFollow(menuRef);
  const [isTodoOpen, setIsTodoOpen] = useState(false);
  const [repackSettings, setRepackSettings] = useState<RepackSettings | null>(null);
  const [repackSaveState, setRepackSaveState] = useState('');
  useEffect(() => {
    void api.get<RepackSettings>('/api/repack-catalog/settings').then(setRepackSettings).catch(() => setRepackSaveState('Unable to load source settings'));
  }, []);
  const saveRepackSettings = async (next: Partial<RepackSettings>) => {
    if (!repackSettings) return;
    const value = { ...repackSettings, ...next };
    setRepackSettings(value);
    setRepackSaveState('Saving…');
    try {
      await api.put('/api/repack-catalog/settings', {
        enabled: value.enabled,
        baseUrl: value.baseUrl,
        intervalHours: value.intervalHours,
        auditEnabled: value.auditEnabled,
        auditIntervalHours: value.auditIntervalHours,
      });
      const saved = await api.get<RepackSettings>('/api/repack-catalog/settings');
      setRepackSettings(saved);
      setRepackSaveState('Saved');
      void refreshRepackCatalog();
    } catch (error) {
      setRepackSaveState((error as Error).message || 'Unable to save settings');
      throw error;
    }
  };
  const { enabled: developerToolsEnabled } = useDeveloperAccess();
  const { background, setBackground } = useEffectsSettings();
  const { tint, darkShade, lightShade, setTint, setDarkShade, setLightShade } = useBackgroundSettings();
  const hasBackgroundEffect = background !== null && BACKGROUND_EFFECTS.some((entry) => entry.id === background);
  const showShadeSelectors = background !== 'dither';

  useLayoutEffect(() => {
    if (isSettingsCategory(categoryFromUrl)) {
      setCategory(categoryFromUrl);
    }
  }, [categoryFromUrl]);

  useLayoutEffect(() => {
    if (rememberSettingsCategory) setLastSettingsCategory(category);
  }, [category, rememberSettingsCategory, setLastSettingsCategory]);

  const renderReview = () => (
    <SettingsPanel title="System review" eyebrow="Review">
      <div className="settings-review-grid">
        <article className="settings-review-card settings-review-card--wide">
          <div className="settings-review-card__heading">
            <div>
              <p className="settings-review-card__eyebrow">Resources</p>
              <h3>Library overview</h3>
            </div>
            <span className="settings-review-badge">Ready</span>
          </div>
          <div className="settings-review-metrics">
            <div><strong>—</strong><span>Games</span></div>
            <div><strong>—</strong><span>Platforms</span></div>
            <div><strong>—</strong><span>Collections</span></div>
          </div>
          <p className="settings-review-copy">Library resource summaries will appear here.</p>
        </article>
        <article className="settings-review-card">
          <div className="settings-review-card__heading">
            <div>
              <p className="settings-review-card__eyebrow">Services</p>
              <h3>Service status</h3>
            </div>
            <span className="settings-review-status"><span />Operational</span>
          </div>
          <ul className="settings-review-list">
            <li><span>Library service</span><strong>Ready</strong></li>
            <li><span>Scanner</span><strong>Idle</strong></li>
            <li><span>Metadata providers</span><strong>Not configured</strong></li>
          </ul>
        </article>
        <DiagnosticsSection />
      </div>
    </SettingsPanel>
  );

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
    <SettingsPanel title="Locations" eyebrow="Library">
      <section className="settings-subpanel settings-subpanel--first locations-subsection">
        <div className="settings-subpanel-heading locations-subsection-heading">
          <div><h3>Library location</h3><p>Configured game library folder</p></div>
        </div>
        <LibraryLocationSection />
      </section>
      <section className="settings-subpanel locations-subsection">
        <div className="settings-subpanel-heading locations-subsection-heading"><h3>Scan activity</h3></div>
        <ScannerSection />
      </section>
      <section className="settings-subpanel settings-library-naming locations-subsection">
        <div className="settings-subpanel-heading locations-subsection-heading"><h3>Library naming</h3></div>
        <LibraryNamingSection />
      </section>
    </SettingsPanel>
  );

  const renderSources = () => (
    <SettingsPanel title="Repack catalog" eyebrow="Sources">
      <p className="settings-help">Scrape FitGirl game posts into a separate catalog. Sync reads recent listings; full history import is always manual.</p>
      <div className="settings-subpanel settings-subpanel--first">
        <label className="settings-switch">
          <span><strong>Enable FitGirl source</strong><small>Disabled by default. Enabling starts a recent-post sync.</small></span>
          <span className="settings-switch__control"><input type="checkbox" checked={repackSettings?.enabled ?? false} disabled={!repackSettings} onChange={(event) => void saveRepackSettings({ enabled: event.target.checked }).catch(() => {})} aria-label="Enable FitGirl source" /><span className="settings-switch__track" aria-hidden="true"><span className="settings-switch__thumb" /></span></span>
        </label>
        <label className="settings-field"><span>FitGirl site URL</span><input type="url" value={repackSettings?.baseUrl ?? ''} disabled={!repackSettings} onChange={(event) => setRepackSettings((current) => current ? { ...current, baseUrl: event.target.value } : current)} onBlur={() => { if (repackSettings?.baseUrl) void saveRepackSettings({ baseUrl: repackSettings.baseUrl }).catch(() => {}); }} /></label>
        <label className="settings-field"><span>Recent sync interval (hours)</span><input type="number" min={repackSettings?.constraints.intervalHours?.min ?? 1} max={repackSettings?.constraints.intervalHours?.max ?? 8760} value={repackSettings?.intervalHours ?? repackSettings?.defaults.intervalHours ?? 24} disabled={!repackSettings} onChange={(event) => setRepackSettings((current) => current ? { ...current, intervalHours: Number(event.target.value) || current.defaults.intervalHours } : current)} onBlur={() => { if (repackSettings) void saveRepackSettings({ intervalHours: repackSettings.intervalHours }).catch(() => {}); }} /></label>
        <label className="settings-switch">
          <span><strong>Rolling history audit</strong><small>Recheck up to 50 older posts per run to detect edits.</small></span>
          <span className="settings-switch__control"><input type="checkbox" checked={repackSettings?.auditEnabled ?? false} disabled={!repackSettings} onChange={(event) => void saveRepackSettings({ auditEnabled: event.target.checked }).catch(() => {})} aria-label="Enable rolling repack audit" /><span className="settings-switch__track" aria-hidden="true"><span className="settings-switch__thumb" /></span></span>
        </label>
        <label className="settings-field"><span>Audit interval (hours)</span><input type="number" min={repackSettings?.constraints.auditIntervalHours?.min ?? 1} max={repackSettings?.constraints.auditIntervalHours?.max ?? 8760} value={repackSettings?.auditIntervalHours ?? repackSettings?.defaults.auditIntervalHours ?? 720} disabled={!repackSettings || !repackSettings.auditEnabled} onChange={(event) => setRepackSettings((current) => current ? { ...current, auditIntervalHours: Number(event.target.value) || current.defaults.auditIntervalHours } : current)} onBlur={() => { if (repackSettings) void saveRepackSettings({ auditIntervalHours: repackSettings.auditIntervalHours }).catch(() => {}); }} /></label>
        <p className="settings-help" role="status">{repackSaveState}</p>
      </div>
    </SettingsPanel>
  );

  const renderBehavior = () => (
    <SettingsPanel title="Navigation" eyebrow="Behavior">
      <div className="settings-subpanel settings-subpanel--first">
        <label className="settings-switch">
          <span><strong>Remember Settings section</strong><small>Restore last section when returning or reloading Settings.</small></span>
          <span className="settings-switch__control">
            <input type="checkbox" checked={rememberSettingsCategory} onChange={(event) => setRememberSettingsCategory(event.target.checked)} aria-label="Remember Settings section" />
            <span className="settings-switch__track" aria-hidden="true"><span className="settings-switch__thumb" /></span>
          </span>
        </label>
        <label className="settings-switch">
          <span><strong>Remember Library panel</strong><small>Restore Advanced or Settings panel when returning or reloading Library.</small></span>
          <span className="settings-switch__control">
            <input type="checkbox" checked={rememberLibraryPanel} onChange={(event) => setRememberLibraryPanel(event.target.checked)} aria-label="Remember Library panel" />
            <span className="settings-switch__track" aria-hidden="true"><span className="settings-switch__thumb" /></span>
          </span>
        </label>
      </div>
    </SettingsPanel>
  );

  const renderMaintenance = () => (
    <SettingsPanel title="Maintenance" eyebrow="System">
      <MaintenancePanel />
    </SettingsPanel>
  );

  const panels: Record<SettingsCategory, () => JSX.Element> = { review: renderReview, appearance: renderAppearance, behavior: renderBehavior, locations: renderLibrary, sources: renderSources, maintenance: renderMaintenance };

  const renderMenu = (as: 'button' | 'copy') => {
    const content = SETTINGS_GROUPS.map((group) => (
      <section className="settings-menu-group" key={group.label}>
        <h2 className="settings-menu-label">{group.label}</h2>
        <div className="settings-menu-items">
          {group.items.map((item) => {
            const isActive = item.category === category;
            const className = `settings-menu-item${isActive ? ' is-active' : ''}`;
            const itemContent = <><item.icon className="settings-menu-item-icon" size={18} stroke={1.8} aria-hidden="true" color={as === 'copy' ? item.color : undefined} /><strong>{item.label}</strong></>;
            return as === 'button'
              ? <button type="button" key={item.id} className={className} onClick={() => setCategory(item.category)} aria-current={isActive ? 'page' : undefined}>{itemContent}</button>
              : <div key={item.id} className={className} aria-hidden="true">{itemContent}</div>;
          })}
        </div>
      </section>
    ));

    return as === 'copy' ? <div className="settings-menu-glass-content">{content}</div> : <>{content}</>;
  };

  return (
    <div className="page">
      <div className="settings-page">
        {developerToolsEnabled && <div className="settings-todo-anchor">
          <>
            <button type="button" className="settings-todo-toggle" onClick={() => setIsTodoOpen((open) => !open)} aria-expanded={isTodoOpen} aria-controls="settings-todo-panel">To-do</button>
            {isTodoOpen && <div id="settings-todo-panel" className="settings-todo-popover"><TodoPanel /></div>}
          </>
        </div>}
        <div className="settings-shell">
          <nav ref={menuRef} className="settings-menu glow-follow" aria-label="Settings categories">
            <SettingsNavLens menuRef={menuRef} active={category}>{renderMenu('copy')}</SettingsNavLens>
            <div className="settings-menu-content">{renderMenu('button')}</div>
          </nav>
          <main className="settings-panel">{panels[category]()}</main>
        </div>
      </div>
    </div>
  );
}

function SettingsPanel({ title, eyebrow, children }: { title: string; eyebrow?: string; children: React.ReactNode }): JSX.Element {
  return <section className="settings-panel-content"><div className="settings-card-heading"><div>{eyebrow && <p className="eyebrow">{eyebrow}</p>}<h2>{title}</h2></div></div>{children}</section>;
}
