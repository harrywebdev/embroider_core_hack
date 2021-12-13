"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.templateCompilerModule = void 0;
const path_1 = require("path");
const portable_1 = require("./portable");
const js_string_escape_1 = __importDefault(require("js-string-escape"));
function templateCompilerModule(params, hints) {
    let p = new portable_1.Portable({ hints });
    let result = p.dehydrate(params);
    return {
        src: [
            `const { NodeTemplateCompiler } = require("${(0, js_string_escape_1.default)((0, path_1.resolve)(__dirname, './template-compiler-node.js'))}");`,
            `const { Portable } = require("${(0, js_string_escape_1.default)((0, path_1.resolve)(__dirname, './portable.js'))}");`,
            `let p = new Portable({ hints: ${JSON.stringify(hints, null, 2)} });`,
            `module.exports = new NodeTemplateCompiler(p.hydrate(${JSON.stringify(result.value, null, 2)}))`,
        ].join('\n'),
        isParallelSafe: result.isParallelSafe,
    };
}
exports.templateCompilerModule = templateCompilerModule;
//# sourceMappingURL=write-template-compiler.js.map