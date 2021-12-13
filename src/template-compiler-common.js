"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.matchesSourceFile = exports.TemplateCompiler = void 0;
const strip_bom_1 = __importDefault(require("strip-bom"));
const path_1 = require("path");
const typescript_memoize_1 = require("typescript-memoize");
const wrap_legacy_hbs_plugin_if_needed_1 = __importDefault(require("wrap-legacy-hbs-plugin-if-needed"));
const htmlbarPathMatches = [
    ['htmlbars-inline-precompile', 'index.js'].join(path_1.sep),
    ['htmlbars-inline-precompile', 'lib', 'require-from-worker.js'].join(path_1.sep),
    ['htmlbars-inline-precompile', 'index'].join(path_1.sep),
    ['htmlbars-inline-precompile', 'lib', 'require-from-worker'].join(path_1.sep),
    ['ember-cli-htmlbars', 'index.js'].join(path_1.sep),
    ['ember-cli-htmlbars', 'lib', 'require-from-worker.js'].join(path_1.sep),
    ['ember-cli-htmlbars', 'index'].join(path_1.sep),
    ['ember-cli-htmlbars', 'lib', 'require-from-worker'].join(path_1.sep),
];
class TemplateCompiler {
    constructor(params) {
        this.loadEmberTemplateCompiler = params.loadEmberTemplateCompiler;
        this.resolver = params.resolver;
        this.EmberENV = params.EmberENV;
        this.plugins = params.plugins;
        // stage3 packagers don't need to know about our instance, they can just
        // grab the compile function and use it.
        this.compile = this.compile.bind(this);
    }
    get syntax() {
        return this.setup().syntax;
    }
    get cacheKey() {
        return this.setup().cacheKey;
    }
    setup() {
        let { theExports, cacheKey } = this.loadEmberTemplateCompiler();
        let syntax = loadGlimmerSyntax(theExports);
        initializeEmberENV(syntax, this.EmberENV);
        // todo: get resolver reflected in cacheKey
        return { syntax, cacheKey };
    }
    getReversedASTPlugins(ast) {
        return ast.slice().reverse();
    }
    // Compiles to the wire format plus dependency list.
    precompile(templateSource, options) {
        var _a, _b;
        let dependencies;
        let runtimeName;
        let filename = options.filename;
        if (this.resolver) {
            runtimeName = this.resolver.absPathToRuntimePath(filename);
        }
        else {
            runtimeName = filename;
        }
        let opts = this.syntax.defaultOptions({ contents: templateSource, moduleName: filename });
        let plugins = Object.assign(Object.assign({}, opts === null || opts === void 0 ? void 0 : opts.plugins), { ast: [
                ...this.getReversedASTPlugins(this.plugins.ast),
                this.resolver && this.resolver.astTransformer(this),
                // Ember 3.27+ uses _buildCompileOptions will not add AST plugins to its result
                ...((_b = (_a = opts === null || opts === void 0 ? void 0 : opts.plugins) === null || _a === void 0 ? void 0 : _a.ast) !== null && _b !== void 0 ? _b : []),
            ].filter(Boolean) });
        let compiled = this.syntax.precompile((0, strip_bom_1.default)(templateSource), Object.assign({ contents: templateSource, moduleName: runtimeName, plugins }, options));
        if (this.resolver) {
            dependencies = this.resolver.dependenciesOf(filename);
        }
        else {
            dependencies = [];
        }
        return { compiled, dependencies };
    }
    // Compiles all the way from a template string to a javascript module string.
    compile(moduleName, contents) {
        let { compiled, dependencies } = this.precompile(contents, { filename: moduleName });
        let lines = [];
        let counter = 0;
        for (let { runtimeName, path } of dependencies) {
            lines.push(`import a${counter} from "${path.split(path_1.sep).join('/')}";`);
            lines.push(`window.define('${runtimeName}', function(){ return a${counter++}});`);
        }
        lines.push(`import { createTemplateFactory } from '@ember/template-factory';`);
        lines.push(`export default createTemplateFactory(${compiled});`);
        return lines.join('\n');
    }
    // Applies all custom AST transforms and emits the results still as
    // handlebars.
    applyTransforms(moduleName, contents) {
        let opts = this.syntax.defaultOptions({ contents, moduleName });
        // the user-provided plugins come first in the list, and those are the
        // only ones we want to run. The built-in plugins don't need to run here
        // in stage1, it's better that they run in stage3 when the appropriate
        // ember version is in charge.
        //
        // rather than slicing them off, we could choose instead to not call
        // syntax.defaultOptions, but then we lose some of the compatibility
        // normalization that it does on the user-provided plugins.
        opts.plugins = opts.plugins || {}; // Ember 3.27+ won't add opts.plugins
        opts.plugins.ast = this.getReversedASTPlugins(this.plugins.ast).map(plugin => {
            // Although the precompile API does, this direct glimmer syntax api
            // does not support these legacy plugins, so we must wrap them.
            return (0, wrap_legacy_hbs_plugin_if_needed_1.default)(plugin);
        });
        // instructs glimmer-vm to preserve entity encodings (e.g. don't parse &nbsp; -> ' ')
        opts.mode = 'codemod';
        opts.filename = moduleName;
        opts.moduleName = this.resolver ? this.resolver.absPathToRuntimePath(moduleName) || moduleName : moduleName;
        let ast = this.syntax.preprocess(contents, opts);
        return this.syntax.print(ast, { entityEncoding: 'raw' });
    }
    parse(moduleName, contents) {
        // this is just a parse, so we deliberately don't run any plugins.
        let opts = { contents, moduleName, plugins: {} };
        return this.syntax.preprocess(contents, opts);
    }
    baseDir() {
        return (0, path_1.join)(__dirname, '..');
    }
    // tests for the classic ember-cli-htmlbars-inline-precompile babel plugin
    static isInlinePrecompilePlugin(item) {
        if (typeof item === 'string') {
            return matchesSourceFile(item);
        }
        if (hasProperties(item) && item._parallelBabel) {
            return matchesSourceFile(item._parallelBabel.requireFile);
        }
        if (Array.isArray(item) && item.length > 0) {
            if (typeof item[0] === 'string') {
                return matchesSourceFile(item[0]);
            }
            if (hasProperties(item[0]) && item[0]._parallelBabel) {
                return matchesSourceFile(item[0]._parallelBabel.requireFile);
            }
        }
        return false;
    }
}
__decorate([
    (0, typescript_memoize_1.Memoize)()
], TemplateCompiler.prototype, "setup", null);
__decorate([
    (0, typescript_memoize_1.Memoize)()
], TemplateCompiler.prototype, "getReversedASTPlugins", null);
exports.TemplateCompiler = TemplateCompiler;
function matchesSourceFile(filename) {
    return Boolean(htmlbarPathMatches.find(match => filename.endsWith(match)));
}
exports.matchesSourceFile = matchesSourceFile;
function hasProperties(item) {
    return item && (typeof item === 'object' || typeof item === 'function');
}
// this matches the setup done by ember-cli-htmlbars: https://git.io/JtbN6
function initializeEmberENV(syntax, EmberENV) {
    if (!EmberENV) {
        return;
    }
    let props;
    if (EmberENV.FEATURES) {
        props = Object.keys(EmberENV.FEATURES);
        props.forEach(prop => {
            syntax._Ember.FEATURES[prop] = EmberENV.FEATURES[prop];
        });
    }
    if (EmberENV) {
        props = Object.keys(EmberENV);
        props.forEach(prop => {
            if (prop === 'FEATURES') {
                return;
            }
            syntax._Ember.ENV[prop] = EmberENV[prop];
        });
    }
}
// we could directly depend on @glimmer/syntax and have nice types and
// everything. But the problem is, we really want to use the exact version that
// the app itself is using, and its copy is bundled away inside
// ember-template-compiler.js.
function loadGlimmerSyntax(emberTemplateCompilerExports) {
    var _a, _b;
    // detect if we are using an Ember version with the exports we need
    // (from https://github.com/emberjs/ember.js/pull/19426)
    if (emberTemplateCompilerExports._preprocess !== undefined) {
        return {
            print: emberTemplateCompilerExports._print,
            preprocess: emberTemplateCompilerExports._preprocess,
            defaultOptions: emberTemplateCompilerExports._buildCompileOptions,
            precompile: emberTemplateCompilerExports.precompile,
            _Ember: emberTemplateCompilerExports._Ember,
        };
    }
    else {
        // Older Ember versions (prior to 3.27) do not expose a public way to to source 2 source compilation of templates.
        // because of this, we must resort to some hackery.
        //
        // We use the following API's (that we grab from Ember.__loader):
        //
        // * glimmer/syntax's preprocess
        // * glimmer/syntax's print
        // * ember-template-compiler/lib/system/compile-options's defaultOptions
        let syntax = ((_a = emberTemplateCompilerExports.Ember) !== null && _a !== void 0 ? _a : emberTemplateCompilerExports._Ember).__loader.require('@glimmer/syntax');
        let compilerOptions = ((_b = emberTemplateCompilerExports.Ember) !== null && _b !== void 0 ? _b : emberTemplateCompilerExports._Ember).__loader.require('ember-template-compiler/lib/system/compile-options');
        return {
            print: syntax.print,
            preprocess: syntax.preprocess,
            defaultOptions: compilerOptions.default,
            precompile: emberTemplateCompilerExports.precompile,
            _Ember: emberTemplateCompilerExports._Ember,
        };
    }
}
//# sourceMappingURL=template-compiler-common.js.map