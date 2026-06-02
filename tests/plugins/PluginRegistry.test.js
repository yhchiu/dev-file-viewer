import { describe, it, expect, vi } from 'vitest';
import { PluginRegistry } from '../../src/plugins/PluginRegistry.js';

describe('PluginRegistry', () => {
  it('runs init/afterRender only on enabled plugins', async () => {
    const enabled = { enabled: true, init: vi.fn(), afterRender: vi.fn() };
    const disabled = { enabled: false, init: vi.fn(), afterRender: vi.fn() };
    const registry = new PluginRegistry([enabled, disabled]);

    await registry.init({ ctx: 1 });
    await registry.runAfterRender('root', { ctx: 2 });

    expect(enabled.init).toHaveBeenCalledWith({ ctx: 1 });
    expect(enabled.afterRender).toHaveBeenCalledWith('root', { ctx: 2 });
    expect(disabled.init).not.toHaveBeenCalled();
    expect(disabled.afterRender).not.toHaveBeenCalled();
  });

  it('tolerates plugins without init/afterRender hooks', async () => {
    const registry = new PluginRegistry([{ id: 'noop' }]);
    await expect(registry.init()).resolves.toBeUndefined();
    await expect(registry.runAfterRender(document.createElement('div'))).resolves.toBeUndefined();
  });
});
