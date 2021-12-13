"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.mangledEngineRoot = exports.throwOnWarnings = exports.expectWarning = exports.debug = exports.warn = exports.unsupported = exports.todo = exports.AppBuilder = exports.jsHandlebarsCompile = exports.BuildStage = exports.WaitForTrees = exports.toBroccoliPlugin = exports.optionsWithDefaults = exports.templateCompilerModule = exports.TemplateCompiler = exports.NodeTemplateCompiler = exports.HTMLEntrypoint = exports.getPackagerCacheDir = exports.getAppMeta = exports.applyVariantToTemplateCompiler = exports.applyVariantToBabelConfig = void 0;
var packager_1 = require("./packager");
Object.defineProperty(exports, "applyVariantToBabelConfig", { enumerable: true, get: function () { return packager_1.applyVariantToBabelConfig; } });
Object.defineProperty(exports, "applyVariantToTemplateCompiler", { enumerable: true, get: function () { return packager_1.applyVariantToTemplateCompiler; } });
Object.defineProperty(exports, "getAppMeta", { enumerable: true, get: function () { return packager_1.getAppMeta; } });
Object.defineProperty(exports, "getPackagerCacheDir", { enumerable: true, get: function () { return packager_1.getPackagerCacheDir; } });
var html_entrypoint_1 = require("./html-entrypoint");
Object.defineProperty(exports, "HTMLEntrypoint", { enumerable: true, get: function () { return html_entrypoint_1.HTMLEntrypoint; } });
var template_compiler_node_1 = require("./template-compiler-node");
Object.defineProperty(exports, "NodeTemplateCompiler", { enumerable: true, get: function () { return template_compiler_node_1.NodeTemplateCompiler; } });
var template_compiler_common_1 = require("./template-compiler-common");
Object.defineProperty(exports, "TemplateCompiler", { enumerable: true, get: function () { return template_compiler_common_1.TemplateCompiler; } });
var write_template_compiler_1 = require("./write-template-compiler");
Object.defineProperty(exports, "templateCompilerModule", { enumerable: true, get: function () { return write_template_compiler_1.templateCompilerModule; } });
var options_1 = require("./options");
Object.defineProperty(exports, "optionsWithDefaults", { enumerable: true, get: function () { return options_1.optionsWithDefaults; } });
var to_broccoli_plugin_1 = require("./to-broccoli-plugin");
Object.defineProperty(exports, "toBroccoliPlugin", { enumerable: true, get: function () { return __importDefault(to_broccoli_plugin_1).default; } });
var wait_for_trees_1 = require("./wait-for-trees");
Object.defineProperty(exports, "WaitForTrees", { enumerable: true, get: function () { return __importDefault(wait_for_trees_1).default; } });
var build_stage_1 = require("./build-stage");
Object.defineProperty(exports, "BuildStage", { enumerable: true, get: function () { return __importDefault(build_stage_1).default; } });
var js_handlebars_1 = require("./js-handlebars");
Object.defineProperty(exports, "jsHandlebarsCompile", { enumerable: true, get: function () { return js_handlebars_1.compile; } });
var app_1 = require("./app");
Object.defineProperty(exports, "AppBuilder", { enumerable: true, get: function () { return app_1.AppBuilder; } });
var messages_1 = require("./messages");
Object.defineProperty(exports, "todo", { enumerable: true, get: function () { return messages_1.todo; } });
Object.defineProperty(exports, "unsupported", { enumerable: true, get: function () { return messages_1.unsupported; } });
Object.defineProperty(exports, "warn", { enumerable: true, get: function () { return messages_1.warn; } });
Object.defineProperty(exports, "debug", { enumerable: true, get: function () { return messages_1.debug; } });
Object.defineProperty(exports, "expectWarning", { enumerable: true, get: function () { return messages_1.expectWarning; } });
Object.defineProperty(exports, "throwOnWarnings", { enumerable: true, get: function () { return messages_1.throwOnWarnings; } });
var engine_mangler_1 = require("./engine-mangler");
Object.defineProperty(exports, "mangledEngineRoot", { enumerable: true, get: function () { return engine_mangler_1.mangledEngineRoot; } });
// this is reexported because we already make users manage a peerDep from some
// other packages (like embroider/webpack and @embroider/
__exportStar(require("@embroider/shared-internals"), exports);
//# sourceMappingURL=index.js.map