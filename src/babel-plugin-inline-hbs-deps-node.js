"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.precompile = void 0;
const template_compiler_node_1 = require("./template-compiler-node");
const babel_plugin_inline_hbs_deps_1 = __importStar(require("./babel-plugin-inline-hbs-deps"));
Object.defineProperty(exports, "precompile", { enumerable: true, get: function () { return babel_plugin_inline_hbs_deps_1.precompile; } });
exports.default = (0, babel_plugin_inline_hbs_deps_1.default)((opts) => new template_compiler_node_1.NodeTemplateCompiler(opts.templateCompiler));
//# sourceMappingURL=babel-plugin-inline-hbs-deps-node.js.map