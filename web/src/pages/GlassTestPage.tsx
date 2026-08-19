import { useTheme } from '../context/ThemeContext';
import { HeroLens } from '../components/glass/HeroLens';
import { GlassSlider } from '../components/glass/GlassSlider';
import {
  useGlassTune,
  GEOMETRY_SLIDERS_BY_TARGET,
  OPTIC_SECTIONS,
  formatValue,
  type GeometryKey,
  type OpticKey,
  type SliderConfig,
  type GlassTarget,
  type MovementPattern,
} from '../context/GlassTuneContext';

// Mirror the CSS design tokens (styles.css :root / [data-theme]) so the glass
// controls get concrete colour values — the `behind` prop samples an SVG/canvas
// fill that won't resolve a var() reference, so hex is safest here.
const PANEL_BG = {
  dark: '#121419',
  light: '#ffffff',
} as const;

const TRACK = {
  dark: '#252932',
  light: '#e6e8ec',
} as const;

const ACTIVE = {
  dark: '#8288fe',
  light: '#6366f1',
} as const;

const TARGETS: { key: GlassTarget; label: string }[] = [
  { key: 'hero', label: 'Hero' },
  { key: 'pill', label: 'Pill' },
];

const PATTERNS: { key: MovementPattern; label: string }[] = [
  { key: 'lissajous', label: 'Lissajous' },
  { key: 'linear', label: 'Linear' },
  { key: 'circular', label: 'Circular' },
  { key: 'random', label: 'Random' },
];

export function GlassTestPage(): JSX.Element {
  const { theme } = useTheme();
  const {
    activeTarget,
    setActiveTarget,
    active,
    hero,
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

  const sliderSurface = PANEL_BG[theme];
  const sliderTrack = TRACK[theme];
  const sliderActive = ACTIVE[theme];

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
          <HeroLens
            className="glass-test-herolens"
            width={hero.geometry.width}
            height={hero.geometry.height}
            radius={hero.geometry.radius}
            optics={hero.optics}
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
                tempora incidunt ut labore et dolore magnam aliquam quaerat
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
          </HeroLens>

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

        {/* Controls — right column, sticky */}
        <aside className="glass-test-panel">
          <div className="glass-test-panel-head">
            <div className="glass-test-target-switch">
              {TARGETS.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  className={`glass-test-target-btn${activeTarget === t.key ? ' active' : ''}`}
                  onClick={() => setActiveTarget(t.key)}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <div className="glass-test-panel-buttons">
              {activeTarget === 'hero' && (
                <button
                  type="button"
                  className="glass-test-btn"
                  onClick={saveActive}
                  disabled={!isDirty}
                >
                  Save
                </button>
              )}
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
            {GEOMETRY_SLIDERS_BY_TARGET[activeTarget].map((cfg) =>
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
    </div>
  );
}
