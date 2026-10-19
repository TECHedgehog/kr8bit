import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SettingsNavLens } from './SettingsNavLens';

const glassRenders = vi.hoisted(() => [] as Array<{ width: number; height: number; centerY: number }>);

vi.mock('@samasante/liquid-glass', async () => {
  const actual = await vi.importActual<typeof import('@samasante/liquid-glass')>('@samasante/liquid-glass');
  const React = await import('react');
  const readValue = (value: unknown): number => {
    if (typeof value === 'number') return value;
    if (value && typeof value === 'object' && 'get' in value && typeof value.get === 'function') {
      return value.get();
    }
    return Number.NaN;
  };

  return {
    ...actual,
    Glass: (props: { width: unknown; height: unknown; center?: { y: unknown } }) => {
      glassRenders.push({
        width: readValue(props.width),
        height: readValue(props.height),
        centerY: readValue(props.center?.y),
      });
      return React.createElement('div', { 'data-testid': 'glass' });
    },
  };
});

vi.mock('../context/GlassTuneContext', () => ({
  GLASS_FILTER_RESOLUTION: 4,
  useGlassTune: () => ({ pill: { effectiveOptics: {} } }),
}));

vi.mock('../context/ThemeContext', () => ({
  useTheme: () => ({ theme: 'dark' }),
}));

const originalOffsetWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetWidth');
const originalGetBoundingClientRect = HTMLElement.prototype.getBoundingClientRect;
let root: Root | undefined;
let host: HTMLDivElement | undefined;

describe('SettingsNavLens initial geometry', () => {
  beforeEach(() => {
    glassRenders.length = 0;
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
      configurable: true,
      get() {
        return this.classList.contains('settings-menu') ? 200 : 0;
      },
    });
    HTMLElement.prototype.getBoundingClientRect = function getBoundingClientRect() {
      const top = this.classList.contains('settings-menu-glass') ? 100 : 180;
      const height = this.classList.contains('settings-menu-glass') ? 200 : 36;
      return {
        x: 0,
        y: top,
        top,
        right: 200,
        bottom: top + height,
        left: 0,
        width: 200,
        height,
        toJSON: () => ({}),
      } as DOMRect;
    };
  });

  afterEach(() => {
    if (root) act(() => root?.unmount());
    root = undefined;
    host?.remove();
    host = undefined;
    if (originalOffsetWidth) Object.defineProperty(HTMLElement.prototype, 'offsetWidth', originalOffsetWidth);
    else Reflect.deleteProperty(HTMLElement.prototype, 'offsetWidth');
    HTMLElement.prototype.getBoundingClientRect = originalGetBoundingClientRect;
  });

  it('mounts Glass with measured idle geometry, never the square seed', () => {
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
    const menuRef = { current: null as HTMLElement | null };

    act(() => {
      root?.render(
        <nav ref={menuRef} className="settings-menu">
          <SettingsNavLens menuRef={menuRef} active="appearance">
            <div className="settings-menu-glass-content" />
          </SettingsNavLens>
          <div className="settings-menu-content">
            <button className="settings-menu-item is-active" />
          </div>
        </nav>,
      );
    });

    expect(glassRenders).toEqual([{ width: 184, height: 38, centerY: 0.49 }]);
  });
});
