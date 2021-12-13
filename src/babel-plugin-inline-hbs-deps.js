"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.precompile = void 0;
const path_1 = require("path");
const shared_internals_1 = require("@embroider/shared-internals");
const babel_import_util_1 = require("babel-import-util");
/*
  In order to coordinate with babel-plugin-htmlbars-inline-precompile, we need
  to give it a `precompile` function that, as a side-effect, captures the
  dependencies needed within the current file. We do this coordination via this
  module-scoped variable, which is safe given Javascript's single-threaded
  nature and babel's synchronicity.
*/
let currentState;
/*
  This is the precompile function you should pass to
  babel-plugin-htmlbars-inline-precompile.
*/
function precompile(templateSource, options) {
    if (!currentState) {
        throw new Error(`bug: babel-plugin-htmlbars-inline-precompile and babel-plugin-inline-hbs-deps aren't coordinating correctly`);
    }
    let { compiled, dependencies } = compiler(currentState).precompile(templateSource, Object.assign({ filename: currentState.file.opts.filename }, options));
    for (let dep of dependencies) {
        currentState.dependencies.set(dep.runtimeName, dep);
    }
    return compiled;
}
exports.precompile = precompile;
function make(getCompiler) {
    function inlineHBSTransform(babel) {
        let t = babel.types;
        return {
            visitor: {
                Program: {
                    enter(path, state) {
                        state.dependencies = new Map();
                        state.adder = new babel_import_util_1.ImportUtil(t, path);
                        state.emittedCallExpressions = new Set();
                        state.getCompiler = getCompiler;
                        currentState = state;
                    },
                    exit(path, state) {
                        // we are responsible for rewriting all usages of all the
                        // templateCompilationModules to standardize on
                        // @ember/template-compilation, so all imports other than that one
                        // need to be cleaned up here.
                        for (let moduleConfig of shared_internals_1.templateCompilationModules) {
                            if (moduleConfig.module !== '@ember/template-compilation') {
                                state.adder.removeImport(moduleConfig.module, moduleConfig.exportedName);
                            }
                        }
                        let counter = 0;
                        for (let dep of state.dependencies.values()) {
                            path.node.body.unshift(amdDefine(dep.runtimeName, counter, t));
                            path.node.body.unshift(t.importDeclaration([t.importDefaultSpecifier(t.identifier(`a${counter++}`))], t.stringLiteral(dep.path)));
                        }
                        currentState = undefined;
                    },
                },
                TaggedTemplateExpression(path, state) {
                    for (let { module, exportedName } of shared_internals_1.templateCompilationModules) {
                        if (path.get('tag').referencesImport(module, exportedName)) {
                            handleTagged(path, state, t);
                        }
                    }
                },
                CallExpression(path, state) {
                    if (state.emittedCallExpressions.has(path.node)) {
                        return;
                    }
                    for (let { module, exportedName } of shared_internals_1.templateCompilationModules) {
                        if (path.get('callee').referencesImport(module, exportedName)) {
                            handleCalled(path, state, t);
                        }
                    }
                },
            },
        };
    }
    inlineHBSTransform._parallelBabel = {
        requireFile: __filename,
    };
    inlineHBSTransform.baseDir = function () {
        return (0, path_1.join)(__dirname, '..');
    };
    function handleTagged(path, state, t) {
        if (path.node.quasi.expressions.length) {
            throw path.buildCodeFrameError('placeholders inside a tagged template string are not supported');
        }
        let template = path.node.quasi.quasis.map(quasi => quasi.value.cooked).join('');
        let newCallExpression = t.callExpression(state.adder.import(path, '@ember/template-compilation', 'precompileTemplate'), [
            t.stringLiteral(template),
            // TODO: here is where we will put scope once ember support that
        ]);
        state.emittedCallExpressions.add(newCallExpression);
        path.replaceWith(newCallExpression);
    }
    function handleCalled(path, state, t) {
        let newCallExpression = t.callExpression(state.adder.import(path, '@ember/template-compilation', 'precompileTemplate'), path.node.arguments);
        state.emittedCallExpressions.add(newCallExpression);
        path.replaceWith(newCallExpression);
    }
    function amdDefine(runtimeName, importCounter, t) {
        return t.expressionStatement(t.callExpression(t.memberExpression(t.identifier('window'), t.identifier('define')), [
            t.stringLiteral(runtimeName),
            t.functionExpression(null, [], t.blockStatement([t.returnStatement(t.identifier(`a${importCounter}`))])),
        ]));
    }
    return inlineHBSTransform;
}
exports.default = make;
function compiler(state) {
    if (!state.templateCompiler) {
        state.templateCompiler = state.getCompiler(state.opts);
    }
    return state.templateCompiler;
}
//# sourceMappingURL=babel-plugin-inline-hbs-deps.js.map