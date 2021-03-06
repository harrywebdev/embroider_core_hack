"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPackagerCacheDir = exports.getAppMeta = exports.applyVariantToTemplateCompiler = exports.applyVariantToBabelConfig = void 0;
const shared_internals_1 = require("@embroider/shared-internals");
const fs_extra_1 = require("fs-extra");
const lodash_1 = require("lodash");
const path_1 = require("path");
function applyVariantToBabelConfig(variant, babelConfig) {
    if (variant.runtime === 'fastboot') {
        babelConfig = Object.assign({}, babelConfig);
        if (babelConfig.plugins) {
            babelConfig.plugins = babelConfig.plugins.slice();
        }
        else {
            babelConfig.plugins = [];
        }
        let macroPlugin = babelConfig.plugins.find((p) => Array.isArray(p) && p[1] && p[1].embroiderMacrosConfigMarker);
        if (macroPlugin) {
            let modifiedMacroPlugin = (0, lodash_1.cloneDeep)(macroPlugin);
            modifiedMacroPlugin[1].globalConfig.fastboot = { isRunning: true };
            babelConfig.plugins.splice(babelConfig.plugins.indexOf(macroPlugin), 1, modifiedMacroPlugin);
        }
    }
    return babelConfig;
}
exports.applyVariantToBabelConfig = applyVariantToBabelConfig;
function applyVariantToTemplateCompiler(_variant, templateCompiler) {
    // TODO: we don't actually consume the variant in the template macros yet, but
    // Packagers must call this function anyway because we will.
    return templateCompiler;
}
exports.applyVariantToTemplateCompiler = applyVariantToTemplateCompiler;
/**
 * Get the app meta-data for a package
 */
function getAppMeta(pathToVanillaApp) {
    return JSON.parse((0, fs_extra_1.readFileSync)((0, path_1.join)(pathToVanillaApp, 'package.json'), 'utf8'))['ember-addon'];
}
exports.getAppMeta = getAppMeta;
/**
 * Get the path to a cache directory in the recommended location
 *
 * This ensures they have exactly the same lifetime as some of embroider's own caches.
 */
function getPackagerCacheDir(name) {
    return (0, path_1.join)(shared_internals_1.tmpdir, 'embroider', name);
}
exports.getPackagerCacheDir = getPackagerCacheDir;
//# sourceMappingURL=packager.js.map