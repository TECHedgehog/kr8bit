import { describe, expect, it } from 'vitest';
import { demoSessionScope, ensureDemoSession } from '../src/http/demo-session.js';

describe('demo sessions', () => {
  it('reuses valid browser session cookie', () => {
    const request = { headers: { cookie: 'kr8bit_demo_session=123e4567-e89b-12d3-a456-426614174000' } } as never;
    expect(demoSessionScope(request)).toBe('/demo/sessions/123e4567-e89b-12d3-a456-426614174000/');
  });

  it('creates browser-session cookie when missing', () => {
    const request = { headers: {} } as never;
    let cookie = '';
    const reply = { header: (_name: string, value: string) => { cookie = value; } } as never;

    ensureDemoSession(request, reply);

    expect((request as { demoSessionScope?: string }).demoSessionScope).toMatch(/^\/demo\/sessions\/[0-9a-f-]+\/$/);
    expect(cookie).toMatch(/^kr8bit_demo_session=[0-9a-f-]+; Path=\/; HttpOnly; SameSite=Lax$/);
  });
});
