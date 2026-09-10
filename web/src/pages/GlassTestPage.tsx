import { useTheme } from '../context/ThemeContext';
import { GlassLens } from '../components/glass/GlassLens';
import { GlassSlider } from '../components/glass/GlassSlider';
import {
  DEMO_EFFECTS,
  BACKGROUND_EFFECTS,
  CURSOR_EFFECTS,
  type EffectEntry,
} from '../components/effects/catalog';
import type { SettingControl } from '../components/effects/effectSettings';
import { useEffectsSettings, type EffectId } from '../context/EffectsSettingsContext';
import {
  useGlassTune,
  GEOMETRY_SLIDERS_BY_TARGET,
  OPTIC_SECTIONS,
  formatValue,
  type GeometryKey,
  type OpticKey,
  type SliderConfig,
  type MovementPattern,
} from '../context/GlassTuneContext';

// Mirror the CSS design tokens (styles.css :root / [data-theme]) so the glass
// controls get concrete colour values — the `behind` prop samples an SVG/canvas
// fill that won't resolve a var() reference, so hex is safest here.
const PANEL_BG = {
  dark: '#121419',
  light: '#f7f8fb',
} as const;

const TRACK = {
  dark: '#252932',
  light: '#d8dce4',
} as const;

const ACTIVE = {
  dark: '#8288fe',
  light: '#6366f1',
} as const;

const PATTERNS: { key: MovementPattern; label: string }[] = [
  { key: 'lissajous', label: 'Lissajous' },
  { key: 'linear', label: 'Linear' },
  { key: 'circular', label: 'Circular' },
  { key: 'random', label: 'Random' },
];

export function GlassTestPage(): JSX.Element {
  const { theme } = useTheme();
  const {
    active,
    orb,
    updateOptic,
    updateGeometry,
    resetActive,
    saveActive,
    isDirty,
    followCursor,
    independent,
    movementPattern,
    setFollowCursor,
    setIndependent,
    setMovementPattern,
  } = useGlassTune();
  const { background, cursor, params, setBackground, setCursor, setParam, resetParams } =
    useEffectsSettings();

  const sliderSurface = PANEL_BG[theme];
  const sliderTrack = TRACK[theme];
  const sliderActive = ACTIVE[theme];

  // Selectable tile — live preview + On/Off toggle wired to the global
  // effects settings. Toggling on selects this effect (replacing any other
  // in the same group); toggling off clears the group.
  const renderSelectableTile = (
    entry: EffectEntry,
    activeId: EffectId,
    onSelect: (id: EffectId) => void,
  ) => {
    const active = activeId === entry.id;
    return (
      <figure
        key={entry.id}
        className={`glass-test-effect-tile${active ? ' active' : ''}`}
      >
        <figcaption className="glass-test-effect-tile-head">
          <span className="glass-test-effect-tile-name">{entry.name}</span>
          <span className="glass-test-effect-tile-meta">
            <span className="glass-test-effect-tile-cat">{entry.category}</span>
            <button
              type="button"
              className={`glass-test-toggle${active ? ' on' : ''}`}
              onClick={() => onSelect(active ? null : entry.id)}
              aria-pressed={active}
            >
              {active ? 'On' : 'Off'}
            </button>
          </span>
        </figcaption>
        <div className="glass-test-effect-tile-body">{entry.render(params[entry.id] ?? {})}</div>
      </figure>
    );
  };

  // One settings control row — number sliders reuse the glass slider,
  // booleans reuse the On/Off toggle, selects/colors/text get native
  // inputs styled to match. Values fall back to the control default
  // until the user tweaks them (component defaults stay verbatim).
  const renderSettingControl = (effectId: string, control: SettingControl) => {
    const value = params[effectId]?.[control.key] ?? control.default;
    switch (control.kind) {
      case 'number':
        return (
          <div className="glass-test-setting-row" key={control.key}>
            <span className="glass-test-setting-label">{control.label}</span>
            <GlassSlider
              value={Number(value)}
              onValueChange={(v) => setParam(effectId, control.key, v)}
              min={control.min}
              max={control.max}
              step={control.step}
              width={180}
              thumbHeight={14}
              height={4}
              scheme={theme}
              trackColor={sliderTrack}
              activeColor={sliderActive}
              surface={sliderSurface}
              ariaLabel={control.label}
            />
            <span className="glass-test-setting-value">
              {formatValue(Number(value), control.step)}
            </span>
          </div>
        );
      case 'boolean':
        return (
          <div className="glass-test-setting-row" key={control.key}>
            <span className="glass-test-setting-label">{control.label}</span>
            <button
              type="button"
              className={`glass-test-toggle${value === true ? ' on' : ''}`}
              onClick={() => setParam(effectId, control.key, !(value === true))}
              aria-pressed={value === true}
            >
              {value === true ? 'On' : 'Off'}
            </button>
          </div>
        );
      case 'select':
        return (
          <div className="glass-test-setting-row" key={control.key}>
            <span className="glass-test-setting-label">{control.label}</span>
            <select
              className="glass-test-select"
              value={String(value)}
              onChange={(e) => setParam(effectId, control.key, e.target.value)}
            >
              {control.options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        );
      case 'color':
        return (
          <div className="glass-test-setting-row" key={control.key}>
            <span className="glass-test-setting-label">{control.label}</span>
            <input
              type="color"
              className="glass-test-color-input"
              value={String(value)}
              onChange={(e) => setParam(effectId, control.key, e.target.value)}
              aria-label={control.label}
            />
            <span className="glass-test-setting-value">{String(value)}</span>
          </div>
        );
      case 'text':
        return (
          <div className="glass-test-setting-row glass-test-setting-row-wide" key={control.key}>
            <span className="glass-test-setting-label">{control.label}</span>
            <input
              type="text"
              className="glass-test-text-input"
              value={String(value)}
              onChange={(e) => setParam(effectId, control.key, e.target.value)}
              aria-label={control.label}
            />
          </div>
        );
    }
  };

  // Settings panel for one group — shows controls only for the
  // currently active effect, plus a per-effect Reset.
  const renderSettingsGroup = (
    title: string,
    entries: EffectEntry[],
    activeId: EffectId,
  ) => {
    const entry = activeId !== null ? entries.find((e) => e.id === activeId) : undefined;
    return (
      <div className="glass-test-settings-group">
        <div className="glass-test-settings-group-head">
          <h4 className="glass-test-settings-group-title">{title}</h4>
          {entry && <span className="glass-test-settings-group-name">{entry.name}</span>}
          {entry && (
            <button
              type="button"
              className="glass-test-btn"
              onClick={() => resetParams(entry.id)}
            >
              Reset
            </button>
          )}
        </div>
        {!entry ? (
          <p className="glass-test-settings-empty">
            Nothing active — toggle one on above to tune it.
          </p>
        ) : (
          <div className="glass-test-settings-controls">
            {entry.controls.map((control) => renderSettingControl(entry.id, control))}
          </div>
        )}
      </div>
    );
  };

  const renderSlider = <K extends string>(
    cfg: SliderConfig<K>,
    value: number,
    onChange: (key: K, value: number) => void,
  ) => (
    <div className="glass-test-slider-row" key={cfg.key}>
      <span className="glass-test-slider-label">{cfg.label}</span>
      <GlassSlider
        value={value}
        onValueChange={(v) => onChange(cfg.key, v)}
        min={cfg.min}
        max={cfg.max}
        step={cfg.step}
        width={180}
        thumbHeight={14}
        height={4}
        scheme={theme}
        trackColor={sliderTrack}
        activeColor={sliderActive}
        surface={sliderSurface}
        ariaLabel={cfg.label}
      />
      <span className="glass-test-slider-value">
        {formatValue(value, cfg.step)}
      </span>
    </div>
  );

  return (
    <div className="page">
      <div className="glass-test">
        {/* Preview — left column */}
        <div className="glass-test-preview">
            <h1 className="glass-test-title">Liquid Glass Playground</h1>
            <p className="glass-test-lede">
              Move the pointer over the text below — a glass lens follows and
              refracts the live DOM. In Chrome/Edge the text bends; in Safari and
              Firefox it frosts and tints. The text stays selectable everywhere.
            </p>
            <GlassLens
              className="glass-test-orblens"
              width={orb.geometry.width}
              height={orb.geometry.height}
              radius={orb.geometry.radius}
              optics={orb.optics}
              followCursor={followCursor}
              independent={independent}
              movementPattern={movementPattern}
            >
              <div className="glass-test-text">
                <p>
                  Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do
                  eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut
                  enim ad minim veniam, quis nostrud exercitation ullamco laboris
                  nisi ut aliquip ex ea commodo consequat.
                </p>
                <p>
                  Duis aute irure dolor in reprehenderit in voluptate velit esse
                  cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat
                  cupidatat non proident, sunt in culpa qui officia deserunt
                  mollit anim id est laborum.
                </p>
                <p>
                  Sed ut perspiciatis unde omnis iste natus error sit voluptatem
                  accusantium doloremque laudantium, totam rem aperiam, eaque ipsa
                  quae ab illo inventore veritatis et quasi architecto beatae
                  vitae dicta sunt explicabo.
                </p>
                <p>
                  Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit
                  aut fugit, sed quia consequuntur magni dolores eos qui ratione
                  voluptatem sequi nesciunt.
                </p>
                <p>
                  Neque porro quisquam est, qui dolorem ipsum quia dolor sit amet,
                  consectetur, adipisci velit, sed quia non numquam eius modi
                  tempora incidunt ut labore et dolore magnam aliquam quaeret
                  voluptatem.
                </p>
                <p>
                  Ut enim ad minima veniam, quis nostrum exercitationem ullam
                  corporis suscipit laboriosam, nisi ut aliquid ex ea commodi
                  consequatur. Quis autem vel eum iure reprehenderit qui in ea
                  voluptate velit esse quam nihil molestiae consequatur.
                </p>
                <p>
                  At vero eos et accusamus et iusto odio dignissimos ducimus qui
                  blanditiis praesentium voluptatum deleniti atque corrupti quos
                  dolores et quas molestias excepturi sint occaecati cupiditate
                  non provident.
                </p>
              </div>
            </GlassLens>

            <div className="glass-test-toggles">
              <div className="glass-test-toggle-inline">
                <span className="glass-test-toggle-inline-label">Follow cursor</span>
                <button
                  type="button"
                  className={`glass-test-toggle${followCursor ? ' on' : ''}`}
                  onClick={() => setFollowCursor(!followCursor)}
                  aria-pressed={followCursor}
                >
                  {followCursor ? 'On' : 'Off'}
                </button>
              </div>
              <div className="glass-test-toggle-inline">
                <span className="glass-test-toggle-inline-label">Independent</span>
                <button
                  type="button"
                  className={`glass-test-toggle${independent ? ' on' : ''}`}
                  onClick={() => setIndependent(!independent)}
                  aria-pressed={independent}
                >
                  {independent ? 'On' : 'Off'}
                </button>
              </div>
              <div className="glass-test-toggle-inline">
                <span className="glass-test-toggle-inline-label">Pattern</span>
                <select
                  className="glass-test-select"
                  value={movementPattern}
                  onChange={(e) => setMovementPattern(e.target.value as MovementPattern)}
                  disabled={!independent}
                >
                  {PATTERNS.map((p) => (
                    <option key={p.key} value={p.key}>{p.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Controls — right column, sticky. */}
          <aside className="glass-test-panel">
            <div className="glass-test-panel-head">
              <div className="glass-test-panel-buttons">
                <button
                  type="button"
                  className="glass-test-btn"
                  onClick={saveActive}
                  disabled={!isDirty}
                >
                  Save
                </button>
                <button
                  type="button"
                  className="glass-test-btn"
                  onClick={resetActive}
                  disabled={!isDirty}
                >
                  Reset
                </button>
              </div>
            </div>

            <section className="glass-test-panel-section">
              <h3 className="glass-test-panel-heading">Lens</h3>
              {GEOMETRY_SLIDERS_BY_TARGET.orb.map((cfg) =>
                renderSlider(cfg, active.geometry[cfg.key], updateGeometry as (key: GeometryKey, value: number) => void),
              )}
            </section>

            {OPTIC_SECTIONS.map((section) => (
              <section className="glass-test-panel-section" key={section.title}>
                <h3 className="glass-test-panel-heading">{section.title}</h3>
                {section.sliders.map((cfg) =>
                  renderSlider(
                    cfg,
                    active.effectiveOptics[cfg.key] as number,
                    updateOptic as (key: OpticKey, value: number) => void,
                  ),
                )}
              </section>
            ))}
          </aside>
      </div>

      {/* Effects playground — global toggles + demo previews. */}
      <section className="glass-test-effects">
        <h2 className="glass-test-effects-title">Effects Playground</h2>
        <p className="glass-test-effects-lede">
          Backgrounds and cursors are global — toggle one on and it applies to
          every page of the app (one active at a time per group, persisted per
          browser). The remaining tiles are playground-only previews of
          components adapted from react-bits (reactbits.dev).
        </p>

        <h3 className="glass-test-effects-sub">Background</h3>
        <p className="glass-test-effects-sub-hint">
          One active background across the whole app. Toggle it off to return
          to the flat theme background.
        </p>
        <div className="glass-test-effects-grid">
          {BACKGROUND_EFFECTS.map((entry) =>
            renderSelectableTile(entry, background, setBackground),
          )}
        </div>

        <h3 className="glass-test-effects-sub">Cursor</h3>
        <p className="glass-test-effects-sub-hint">
          One active cursor across the whole app. Move the pointer over a tile
          to preview it. Blob cursor replaces the native cursor.
        </p>
        <div className="glass-test-effects-grid glass-test-effects-grid-cursors">
          {CURSOR_EFFECTS.map((entry) =>
            renderSelectableTile(entry, cursor, setCursor),
          )}
        </div>

        <h3 className="glass-test-effects-sub">Settings</h3>
        <p className="glass-test-effects-sub-hint">
          Every prop of the active background and cursor, live-tuned. Tweaks
          apply to the preview and the whole app, and persist per effect —
          switch away and back and they are restored. Reset returns the
          react-bits defaults.
        </p>
        <div className="glass-test-settings">
          {renderSettingsGroup('Background', BACKGROUND_EFFECTS, background)}
          {renderSettingsGroup('Cursor', CURSOR_EFFECTS, cursor)}
        </div>

        <h3 className="glass-test-effects-sub">Demos</h3>
        <p className="glass-test-effects-sub-hint">
          Playground-only previews — hover, click or move the pointer over a
          tile to drive the interactive ones.
        </p>
        <div className="glass-test-effects-grid">
          {DEMO_EFFECTS.map((entry) => (
            <figure key={entry.id} className="glass-test-effect-tile">
              <figcaption className="glass-test-effect-tile-head">
                <span className="glass-test-effect-tile-name">{entry.name}</span>
                <span className="glass-test-effect-tile-cat">{entry.category}</span>
              </figcaption>
              <div className="glass-test-effect-tile-body">{entry.render({})}</div>
            </figure>
          ))}
        </div>
      </section>
    </div>
  );
}
