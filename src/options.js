"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.optionsWithDefaults = void 0;
function optionsWithDefaults(options) {
    let defaults = {
        staticHelpers: false,
        staticModifiers: false,
        staticComponents: false,
        packageRules: [],
        splitAtRoutes: [],
        splitControllers: false,
        splitRouteClasses: false,
        staticAppPaths: [],
        skipBabel: [],
        pluginHints: [],
        implicitModulesStrategy: 'relativePaths',
    };
    if (options) {
        return Object.assign(defaults, options);
    }
    return defaults;
}
exports.optionsWithDefaults = optionsWithDefaults;
//# sourceMappingURL=options.js.map