"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getEmberExports = void 0;
const fs_1 = require("fs");
const vm_1 = require("vm");
const crypto_1 = require("crypto");
const patch_template_compiler_1 = require("./patch-template-compiler");
const CACHE = new Map();
function getEmberExports(templateCompilerPath) {
    let entry = CACHE.get(templateCompilerPath);
    if (entry) {
        let currentStat = (0, fs_1.statSync)(templateCompilerPath);
        // Let's ensure the template is still what we cached
        if (currentStat.mode === entry.stat.mode &&
            currentStat.size === entry.stat.size &&
            currentStat.mtime.getTime() === entry.stat.mtime.getTime()) {
            return entry.value;
        }
    }
    let stat = (0, fs_1.statSync)(templateCompilerPath);
    let source = (0, patch_template_compiler_1.patch)((0, fs_1.readFileSync)(templateCompilerPath, 'utf8'), templateCompilerPath);
    let theExports = undefined;
    // cacheKey, theExports
    let cacheKey = (0, crypto_1.createHash)('md5').update(source).digest('hex');
    entry = Object.freeze({
        value: {
            cacheKey,
            get theExports() {
                if (theExports) {
                    return theExports;
                }
                // matches (essentially) what ember-cli-htmlbars does in https://git.io/Jtbpj
                let sandbox = {
                    module: { require, exports: {} },
                    require,
                };
                if (typeof globalThis === 'undefined') {
                    // for Node 10 usage with Ember 3.27+ we have to define the `global` global
                    // in order for ember-template-compiler.js to evaluate properly
                    // due to this code https://git.io/Jtb7
                    sandbox.global = sandbox;
                }
                // using vm.createContext / vm.Script to ensure we evaluate in a fresh sandbox context
                // so that any global mutation done within ember-template-compiler.js does not leak out
                let context = (0, vm_1.createContext)(sandbox);
                let script = new vm_1.Script(source, { filename: templateCompilerPath });
                script.runInContext(context);
                return (theExports = context.module.exports);
            },
        },
        stat, // This is stored, so we can reload the templateCompiler if it changes mid-build.
    });
    CACHE.set(templateCompilerPath, entry);
    return entry.value;
}
exports.getEmberExports = getEmberExports;
//# sourceMappingURL=load-ember-template-compiler.js.map