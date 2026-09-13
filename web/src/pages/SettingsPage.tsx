import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Glass, animateGlassValue, cubicBezier, glassValue } from '@samasante/liquid-glass';
import { useEffectsSettings } from '../context/EffectsSettingsContext';
import { BACKGROUND_EFFECTS } from '../components/effects/catalog';
import { BACKGROUND_DARK_SHADES, BACKGROUND_LIGHT_SHADES, BACKGROUND_TINTS, useBackgroundSettings, type BackgroundTint } from '../context/BackgroundSettingsContext';
import { ScannerSection } from '../components/ScannerSection';
import { useTheme } from '../context/ThemeContext';
import { useGlassTune } from '../context/GlassTuneContext';

const SETTINGS_LENS_MARGIN = 1;
const SETTINGS_LENS_RISE = 20;
const SETTINGS_LENS_CLEARANCE = SETTINGS_LENS_RISE / 2;
const SETTINGS_LENS_RADIUS = 24;
const SETTINGS_LENS_DEPTH = 0.7;
const SETTINGS_LENS_SCALE_IDLE = 0;
const SETTINGS_LENS_SCALE_PEAK = 0.05;
const SETTINGS_MOVE_ANIMATION = { duration: 0.4, ease: cubicBezier(0.42, 0, 0.58, 1) };
const SETTINGS_RAISE_ANIMATION = { duration: 0.25, ease: cubicBezier(0.42, 0, 0.58, 1) };
const SETTINGS_LOWER_ANIMATION = { duration: 0.2, ease: cubicBezier(0.33, 1, 0.68, 1) };

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
  const { theme } = useTheme();
  const { pill } = useGlassTune();
  const menuRef = useRef<HTMLElement>(null);
  const lastCategoryRef = useRef(category);
  const transitRef = useRef(0);
  const [isLensMoving, setIsLensMoving] = useState(false);
  const lensY = useMemo(() => glassValue(0.5), []);
  const lensW = useMemo(() => glassValue(160), []);
  const lensH = useMemo(() => glassValue(160), []);
  const lensScale = useMemo(() => glassValue(SETTINGS_LENS_SCALE_IDLE), []);
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

  useLayoutEffect(() => {
    const menu = menuRef.current;
    if (!menu) return;
    const glass = menu.querySelector('.settings-menu-glass') as HTMLElement | null;
    const active = menu.querySelector('.settings-menu-content .settings-menu-item.is-active') as HTMLElement | null;
    if (!glass || !active) return;

    const glassRect = glass.getBoundingClientRect();
    const activeRect = active.getBoundingClientRect();
    const activeCenterY = activeRect.top + activeRect.height / 2;
    const targetY = glassRect.height > 0 ? (activeCenterY - glassRect.top) / glassRect.height : 0.5;
    const clampedY = Math.max(0, Math.min(1, targetY));
    const idleW = Math.max(0, glassRect.width - 2 * SETTINGS_LENS_CLEARANCE - 2 * SETTINGS_LENS_MARGIN);
    const idleH = activeRect.height + 2 * SETTINGS_LENS_MARGIN;
    const peakW = idleW + SETTINGS_LENS_RISE;
    const peakH = idleH + SETTINGS_LENS_RISE;
    const targetChanged = lastCategoryRef.current !== category;
    lastCategoryRef.current = category;

    if (!targetChanged) {
      lensY.set(clampedY);
      lensW.set(idleW);
      lensH.set(idleH);
      lensScale.set(SETTINGS_LENS_SCALE_IDLE);
      return;
    }

    const transit = ++transitRef.current;
    setIsLensMoving(true);
    animateGlassValue(lensY, clampedY, SETTINGS_MOVE_ANIMATION);
    animateGlassValue(lensW, peakW, {
      ...SETTINGS_RAISE_ANIMATION,
      onComplete: () => {
        if (transitRef.current !== transit) return;
        animateGlassValue(lensW, idleW, {
          ...SETTINGS_LOWER_ANIMATION,
          onComplete: () => {
            if (transitRef.current === transit) setIsLensMoving(false);
          },
        });
        animateGlassValue(lensH, idleH, SETTINGS_LOWER_ANIMATION);
        animateGlassValue(lensScale, SETTINGS_LENS_SCALE_IDLE, SETTINGS_LOWER_ANIMATION);
      },
    });
    animateGlassValue(lensH, peakH, SETTINGS_RAISE_ANIMATION);
    animateGlassValue(lensScale, SETTINGS_LENS_SCALE_PEAK, SETTINGS_RAISE_ANIMATION);
  }, [category, lensH, lensScale, lensW, lensY]);

  useLayoutEffect(() => {
    if (isLensMoving) return;
    const menu = menuRef.current;
    const active = menu?.querySelector('.settings-menu-content .settings-menu-item.is-active') as HTMLElement | null;
    const glass = menu?.querySelector('.settings-menu-glass') as HTMLElement | null;
    if (!active || !glass) return;
    const glassRect = glass.getBoundingClientRect();
    const activeRect = active.getBoundingClientRect();
    const idleW = Math.max(0, glassRect.width - 2 * SETTINGS_LENS_CLEARANCE - 2 * SETTINGS_LENS_MARGIN);
    const idleH = activeRect.height + 2 * SETTINGS_LENS_MARGIN;
    lensW.set(idleW);
    lensH.set(idleH);
    lensY.set(Math.max(0, Math.min(1, (activeRect.top + activeRect.height / 2 - glassRect.top) / glassRect.height)));
  }, [isLensMoving, lensH, lensW, lensY]);

  const renderMenu = (as: 'button' | 'copy') => {
    const content = SETTINGS_GROUPS.map((group) => (
      <section className="settings-menu-group" key={group.label}>
        <h2 className="settings-menu-label">{group.label}</h2>
        <div className="settings-menu-items">
          {group.items.map((item) => {
            const isAvailable = item.category !== undefined;
            const isActive = item.category === category;
            const className = `settings-menu-item${isActive ? ' is-active' : ''}${!isAvailable ? ' is-disabled' : ''}`;
            const itemContent = <strong>{item.label}</strong>;
            return as === 'button'
              ? <button type="button" key={item.id} className={className} onClick={isAvailable ? () => setCategory(item.category!) : undefined} aria-current={isActive ? 'page' : undefined} disabled={!isAvailable}>{itemContent}</button>
              : <div key={item.id} className={className} aria-hidden="true">{itemContent}</div>;
          })}
        </div>
      </section>
    ));

    return as === 'copy' ? <div className="settings-menu-glass-content">{content}</div> : <>{content}</>;
  };

  const behind = theme === 'dark' ? '#1a1d24' : '#e8ebf0';

  return (
    <div className="page">
      <div className="settings-page">
        <div className="settings-shell">
          <nav ref={menuRef} className={`settings-menu${isLensMoving ? ' is-moving' : ''}`} aria-label="Settings categories">
            <div className="settings-menu-glass" aria-hidden="true">
              <Glass optics={pill.effectiveOptics} width={lensW} height={lensH} radius={SETTINGS_LENS_RADIUS} center={{ x: 0.5, y: lensY }} scale={lensScale} depth={SETTINGS_LENS_DEPTH} refract={renderMenu('copy')} behind={behind} filterResolution={2} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible', pointerEvents: 'none' }} />
            </div>
            <div className="settings-menu-content">{renderMenu('button')}</div>
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
