"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const multi_tree_diff_1 = __importDefault(require("./multi-tree-diff"));
const walk_sync_1 = __importDefault(require("walk-sync"));
const path_1 = require("path");
const fs_extra_1 = require("fs-extra");
const messages_1 = require("./messages");
const assert_never_1 = __importDefault(require("assert-never"));
const describe_exports_1 = require("./describe-exports");
const js_handlebars_1 = require("./js-handlebars");
const fs_1 = require("fs");
const util_1 = require("util");
class AppDiffer {
    constructor(outputPath, ownAppJSDir, activeAddonDescendants, 
    // arguments below this point are only needed in fastboot mode. Fastboot
    // makes this pretty messy because fastboot trees all merge into the app 🤮.
    fastbootEnabled = false, ownFastbootJSDir, babelParserConfig) {
        this.outputPath = outputPath;
        this.babelParserConfig = babelParserConfig;
        this.firstFastbootTree = Infinity;
        // maps from each filename in the app to the original directory from whence it
        // came, if it came from an addon. The mapping allows us to preserve
        // resolution semantics so that each of the app files can still resolve
        // relative to where it was authored.
        //
        // files authored within the app map to null
        this.files = new Map();
        // true for files that are fastboot-only.
        this.isFastbootOnly = new Map();
        this.sources = activeAddonDescendants.map(addon => maybeSource(addon, 'app-js')).filter(Boolean);
        this.sources.push({
            mayChange: true,
            walk() {
                return walk_sync_1.default.entries(ownAppJSDir);
            },
            isRelocated: false,
            locate(relativePath) {
                return (0, path_1.resolve)(ownAppJSDir, relativePath);
            },
        });
        if (!fastbootEnabled) {
            this.differ = new multi_tree_diff_1.default(this.sources, lastOneWins);
            return;
        }
        this.firstFastbootTree = this.sources.length;
        for (let addon of activeAddonDescendants) {
            let source = maybeSource(addon, 'fastboot-js');
            if (source) {
                this.sources.push(source);
            }
        }
        if (ownFastbootJSDir) {
            this.sources.push({
                mayChange: true,
                walk() {
                    return walk_sync_1.default.entries(ownFastbootJSDir);
                },
                isRelocated: false,
                locate(relativePath) {
                    return (0, path_1.resolve)(ownFastbootJSDir, relativePath);
                },
            });
        }
        this.differ = new multi_tree_diff_1.default(this.sources, fastbootMerge(this.firstFastbootTree));
    }
    update() {
        let { ops, sources } = this.differ.update();
        (0, messages_1.debug)(`app-differ operations count: %s`, ops.length);
        for (let [operation, relativePath] of ops) {
            let outputPath = (0, path_1.join)(this.outputPath, relativePath);
            switch (operation) {
                case 'unlink':
                    (0, fs_extra_1.unlinkSync)(outputPath);
                    this.files.delete(relativePath);
                    break;
                case 'rmdir':
                    (0, fs_extra_1.rmdirSync)(outputPath);
                    break;
                case 'mkdir':
                    (0, fs_extra_1.mkdirpSync)(outputPath);
                    break;
                case 'change':
                    (0, fs_extra_1.removeSync)(outputPath);
                // deliberate fallthrough
                case 'create':
                    let sourceIndices = sources.get(relativePath);
                    if (sourceIndices.length === 1) {
                        // a single file won. whether it's fastboot or non-fastboot doesn't
                        // actually change what we do here. It gets emitted in the app's
                        // namespace (if it's fastboot-only, non-fastboot code shouldn't be
                        // trying to import it anyway, because that would have already been
                        // an error pre-embroider).
                        this.isFastbootOnly.set(relativePath, sourceIndices[0] >= this.firstFastbootTree);
                        let source = this.sources[sourceIndices[0]];
                        let sourceFile = source.locate(relativePath);
                        (0, fs_extra_1.copySync)(sourceFile, outputPath, { dereference: true });
                        this.updateFiles(relativePath, source, sourceFile);
                    }
                    else {
                        // we have both fastboot and non-fastboot files for this path.
                        // Because of the way fastbootMerge is written, the first one is the
                        // non-fastboot.
                        this.isFastbootOnly.set(relativePath, false);
                        let [browserSrc, fastbootSrc] = sourceIndices.map(i => this.sources[i]);
                        let [browserSourceFile, fastbootSourceFile] = [browserSrc, fastbootSrc].map(src => src.locate(relativePath));
                        let dir = (0, path_1.dirname)(relativePath);
                        let base = (0, path_1.basename)(relativePath);
                        let browserDest = `_browser_${base}`;
                        let fastbootDest = `_fastboot_${base}`;
                        (0, fs_extra_1.copySync)(browserSourceFile, (0, path_1.join)(this.outputPath, dir, browserDest), { dereference: true });
                        (0, fs_extra_1.copySync)(fastbootSourceFile, (0, path_1.join)(this.outputPath, dir, fastbootDest), { dereference: true });
                        (0, fs_extra_1.writeFileSync)(outputPath, switcher(browserDest, fastbootDest, this.babelParserConfig, (0, fs_extra_1.readFileSync)(browserSourceFile, 'utf8')));
                        this.updateFiles(relativePath, browserSrc, browserSourceFile);
                    }
                    break;
                default:
                    (0, assert_never_1.default)(operation);
            }
        }
    }
    updateFiles(relativePath, source, sourceFile) {
        if (source.isRelocated) {
            this.files.set(relativePath, sourceFile);
        }
        else {
            this.files.set(relativePath, null);
        }
    }
}
exports.default = AppDiffer;
function lastOneWins(treeIds) {
    return treeIds.slice(-1);
}
function fastbootMerge(firstFastbootTree) {
    return function _fastbootMerge(treeIds) {
        let mainWinner, fastbootWinner;
        for (let id of treeIds) {
            if (id < firstFastbootTree) {
                mainWinner = id;
            }
            else {
                fastbootWinner = id;
            }
        }
        if (mainWinner != null && fastbootWinner != null) {
            return [mainWinner, fastbootWinner];
        }
        else if (mainWinner != null) {
            return [mainWinner];
        }
        else if (fastbootWinner != null) {
            return [fastbootWinner];
        }
        else {
            throw new Error(`bug: should always have at least one winner in fastbootMerge`);
        }
    };
}
const switcherTemplate = (0, js_handlebars_1.compile)(`
import { macroCondition, getGlobalConfig, importSync } from '@embroider/macros';
let mod;
if (macroCondition(getGlobalConfig().fastboot?.isRunning)){
  mod = importSync("./{{js-string-escape fastbootDest}}");
} else {
  mod = importSync("./{{js-string-escape browserDest}}");
}
{{#if hasDefaultExport}}
export default mod.default;
{{/if}}
{{#each names as |name|}}
export const {{name}} = mod.{{name}};
{{/each}}
`);
function switcher(browserDest, fastbootDest, babelParserConfig, browserSource) {
    let { names, hasDefaultExport } = (0, describe_exports_1.describeExports)(browserSource, babelParserConfig);
    return switcherTemplate({ fastbootDest, browserDest, names: [...names], hasDefaultExport });
}
function maybeSource(addon, key) {
    let maybeFiles = addon.meta[key];
    if (maybeFiles) {
        let files = maybeFiles;
        return {
            mayChange: addon.mayRebuild,
            walk() {
                return Object.entries(files).map(([externalName, internalName]) => {
                    try {
                        let stat = (0, fs_1.statSync)((0, path_1.resolve)(addon.root, internalName));
                        return {
                            relativePath: withoutMandatoryDotSlash(externalName, [
                                'in package.json at %s in key ember-addon.%s',
                                addon.root,
                                key,
                            ]),
                            mode: stat.mode,
                            size: stat.size,
                            mtime: stat.mtime,
                            isDirectory() {
                                return false;
                            },
                        };
                    }
                    catch (err) {
                        if (err.code === 'ENOENT') {
                            throw new Error(`${addon.name}/package.json lists ${internalName} in ember-addon.${key}, but that file does not exist`);
                        }
                        throw err;
                    }
                });
            },
            isRelocated: true,
            locate(relativePath) {
                let internal = files['./' + relativePath];
                if (!internal) {
                    throw new Error(`bug: couldn't find ${relativePath} in ${JSON.stringify(files)}`);
                }
                return (0, path_1.resolve)(addon.root, internal);
            },
        };
    }
}
function withoutMandatoryDotSlash(filename, debugInfo) {
    if (!filename.startsWith('./')) {
        throw new Error(`${(0, util_1.format)(debugInfo)}: ${filename} is required to start with "./"`);
    }
    return filename.slice(2);
}
//# sourceMappingURL=app-differ.js.map