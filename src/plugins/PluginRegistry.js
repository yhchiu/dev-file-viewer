export class PluginRegistry {
  constructor(plugins = []) {
    this.plugins = plugins;
  }

  async init(context = {}) {
    for (const plugin of this.plugins) {
      if (plugin.enabled === false) continue;
      await plugin.init?.(context);
    }
  }

  async runAfterRender(root, context = {}) {
    for (const plugin of this.plugins) {
      if (plugin.enabled === false) continue;
      await plugin.afterRender?.(root, context);
    }
  }
}
