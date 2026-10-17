import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { GlassTuneProvider } from '../../context/GlassTuneContext';
import { PerformanceSettingsProvider } from '../../context/PerformanceSettingsContext';
import { RepackCatalogEnabledProvider } from '../../context/RepackCatalogEnabledContext';
import { ThemeProvider } from '../../context/ThemeContext';
import { TopBar } from './TopBar';

const { navCenter } = vi.hoisted(() => ({ navCenter: { current: null as unknown } }));

vi.mock('@samasante/liquid-glass', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@samasante/liquid-glass')>();

  return {
    ...actual,
    Glass: (props: Record<string, unknown>) => {
      const width = props.width as { get?: () => number } | number;
      const widthValue = typeof width === 'number' ? width : width.get?.() ?? 0;
      if (widthValue >= 80) {
        navCenter.current = (props.center as { x: unknown }).x;
      }
      return <div data-liquid-glass="">{props.children as ReactNode}</div>;
    },
  };
});

function mockRect(left: number, width: number, height = 40): DOMRect {
  return {
    x: left,
    y: 0,
    left,
    top: 0,
    right: left + width,
    bottom: height,
    width,
    height,
    toJSON: () => ({}),
  } as DOMRect;
}

describe('TopBar nav lens', () => {
  let container: HTMLDivElement;
  let root: Root;
  let resolveSettings: ((value: Response) => void) | undefined;
  let originalGetBoundingClientRect: typeof Element.prototype.getBoundingClientRect;

  beforeEach(() => {
    navCenter.current = null;
    resolveSettings = undefined;
    localStorage.clear();
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>((resolve) => {
      resolveSettings = resolve;
    })));
    vi.stubGlobal('matchMedia', vi.fn(() => ({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })));

    originalGetBoundingClientRect = Element.prototype.getBoundingClientRect;
    Element.prototype.getBoundingClientRect = function getBoundingClientRect() {
      if (this.hasAttribute('data-liquid-glass')) {
        const nav = this.closest('.topbar-nav-fixed');
        const count = nav?.querySelector('.topbar-nav-items')?.children.length ?? 2;
        return mockRect(0, count * 100);
      }
      if (this.classList.contains('topbar-link') && this.classList.contains('active')) {
        const nav = this.closest('.topbar-nav-fixed');
        const items = nav?.querySelector('.topbar-nav-items');
        const index = Array.from(items?.children ?? []).indexOf(this);
        return mockRect(index * 100, 80);
      }
      return originalGetBoundingClientRect.call(this);
    };

    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    Element.prototype.getBoundingClientRect = originalGetBoundingClientRect;
    vi.unstubAllGlobals();
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: false });
  });

  it('repositions settings lens when async source enablement inserts nav item', async () => {
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={['/settings']}>
          <ThemeProvider>
            <GlassTuneProvider>
              <PerformanceSettingsProvider>
                <RepackCatalogEnabledProvider>
                  <TopBar />
                </RepackCatalogEnabledProvider>
              </PerformanceSettingsProvider>
            </GlassTuneProvider>
          </ThemeProvider>
        </MemoryRouter>,
      );
    });

    expect(navCenter.current).not.toBeNull();
    expect((navCenter.current as { get: () => number }).get()).toBeCloseTo(0.7);

    await act(async () => {
      resolveSettings?.({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ enabled: true }),
      } as Response);
    });

    expect((navCenter.current as { get: () => number }).get()).toBeCloseTo(0.8);
    expect(localStorage.getItem('kr8bit-repack-catalog-enabled')).toBe('true');
  });

  it('uses cached source enablement before settings fetch resolves', async () => {
    localStorage.setItem('kr8bit-repack-catalog-enabled', 'true');

    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={['/settings']}>
          <ThemeProvider>
            <GlassTuneProvider>
              <PerformanceSettingsProvider>
                <RepackCatalogEnabledProvider>
                  <TopBar />
                </RepackCatalogEnabledProvider>
              </PerformanceSettingsProvider>
            </GlassTuneProvider>
          </ThemeProvider>
        </MemoryRouter>,
      );
    });

    expect((navCenter.current as { get: () => number }).get()).toBeCloseTo(0.8);

    await act(async () => {
      resolveSettings?.({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ enabled: true }),
      } as Response);
    });

    expect((navCenter.current as { get: () => number }).get()).toBeCloseTo(0.8);
  });
});
