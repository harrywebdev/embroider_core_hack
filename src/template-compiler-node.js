"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NodeTemplateCompiler = void 0;
const path_1 = require("path");
const core_1 = require("@babel/core");
const load_ember_template_compiler_1 = require("./load-ember-template-compiler");
const template_compiler_common_1 = require("./template-compiler-common");
const babel_plugin_adjust_imports_1 = __importDefault(require("./babel-plugin-adjust-imports"));
class NodeTemplateCompiler extends template_compiler_common_1.TemplateCompiler {
    constructor(params) {
        super({
            loadEmberTemplateCompiler: () => (0, load_ember_template_compiler_1.getEmberExports)(params.compilerPath),
            resolver: params.resolver,
            EmberENV: params.EmberENV,
            plugins: params.plugins,
        });
        this.params = params;
    }
    compile(moduleName, contents) {
        let src = super.compile(moduleName, contents);
        let resolver = this.params.resolver;
        if (resolver) {
            let opts = resolver.adjustImportsOptions;
            return (0, core_1.transform)(src, {
                filename: moduleName,
                generatorOpts: {
                    compact: false,
                },
                plugins: [[babel_plugin_adjust_imports_1.default, opts]],
            }).code;
        }
        else {
            return src;
        }
    }
    // Use applyTransforms on the contents of inline hbs template strings inside
    // Javascript.
    inlineTransformsBabelPlugin() {
        return [
            (0, path_1.join)(__dirname, 'babel-plugin-stage1-inline-hbs-node.js'),
            {
                templateCompiler: this.params,
            },
        ];
    }
    baseDir() {
        return (0, path_1.join)(__dirname, '..');
    }
    // tests for the classic ember-cli-htmlbars-inline-precompile babel plugin
    static isInlinePrecompilePlugin(item) {
        if (typeof item === 'string') {
            return (0, template_compiler_common_1.matchesSourceFile)(item);
        }
        if (hasProperties(item) && item._parallelBabel) {
            return (0, template_compiler_common_1.matchesSourceFile)(item._parallelBabel.requireFile);
        }
        if (Array.isArray(item) && item.length > 0) {
            if (typeof item[0] === 'string') {
                return (0, template_compiler_common_1.matchesSourceFile)(item[0]);
            }
            if (hasProperties(item[0]) && item[0]._parallelBabel) {
                return (0, template_compiler_common_1.matchesSourceFile)(item[0]._parallelBabel.requireFile);
            }
        }
        return false;
    }
}
exports.NodeTemplateCompiler = NodeTemplateCompiler;
function hasProperties(item) {
    return item && (typeof item === 'object' || typeof item === 'function');
}
//# sourceMappingURL=template-compiler-node.js.map