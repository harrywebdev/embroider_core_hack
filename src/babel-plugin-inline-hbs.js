"use strict";
/*
  This plugin is used only for Ember < 3.27. For newer Ember's we have a
  different implementation that shares the standard
  babel-plugin-htmlbars-inline-precompile and supports passing Javascript
  lexically scoped names into templates.
*/
Object.defineProperty(exports, "__esModule", { value: true });
const path_1 = require("path");
const core_1 = require("@babel/core");
const babel_import_util_1 = require("babel-import-util");
const shared_internals_1 = require("@embroider/shared-internals");
function make(getCompiler) {
    function inlineHBSTransform(babel) {
        let t = babel.types;
        return {
            visitor: {
                Program: {
                    enter(path, state) {
                        state.dependencies = new Map();
                        state.adder = new babel_import_util_1.ImportUtil(t, path);
                    },
                    exit(path, state) {
                        for (let { module, exportedName } of shared_internals_1.templateCompilationModules) {
                            state.adder.removeImport(module, exportedName);
                        }
                        let counter = 0;
                        for (let dep of state.dependencies.values()) {
                            path.node.body.unshift(amdDefine(dep.runtimeName, counter, t));
                            path.node.body.unshift(t.importDeclaration([t.importDefaultSpecifier(t.identifier(`a${counter++}`))], t.stringLiteral(dep.path)));
                        }
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
        let { compiled, dependencies } = compiler(state).precompile(template, { filename: state.file.opts.filename });
        for (let dep of dependencies) {
            state.dependencies.set(dep.runtimeName, dep);
        }
        path.replaceWith(t.callExpression(state.adder.import(path, '@ember/template-factory', 'createTemplateFactory'), [
            jsonLiteral(compiled, t),
        ]));
    }
    function handleCalled(path, state, t) {
        let { template, insertRuntimeErrors } = getCallArguments(path);
        let compilerInstance = compiler(state);
        let result;
        try {
            result = compilerInstance.precompile(template, { filename: state.file.opts.filename, insertRuntimeErrors });
        }
        catch (err) {
            if (insertRuntimeErrors) {
                path.replaceWith(t.callExpression(t.functionExpression(null, [], t.blockStatement([
                    t.throwStatement(t.newExpression(t.identifier('Error'), [t.stringLiteral(err.message)])),
                ])), []));
                return;
            }
            throw err;
        }
        let { compiled, dependencies } = result;
        for (let dep of dependencies) {
            state.dependencies.set(dep.runtimeName, dep);
        }
        path.replaceWith(t.callExpression(state.adder.import(path, '@ember/template-factory', 'createTemplateFactory'), [
            jsonLiteral(compiled, t),
        ]));
    }
    function jsonLiteral(value, t) {
        if (typeof value === 'undefined') {
            return t.identifier('undefined');
        }
        let ast = (0, core_1.parse)(`a(${value})`, {});
        let statement = ast.program.body[0];
        let expression = statement.expression;
        return expression.arguments[0];
    }
    function compiler(state) {
        if (!state.templateCompiler) {
            state.templateCompiler = getCompiler(state.opts);
        }
        return state.templateCompiler;
    }
    function amdDefine(runtimeName, importCounter, t) {
        return t.expressionStatement(t.callExpression(t.memberExpression(t.identifier('window'), t.identifier('define')), [
            t.stringLiteral(runtimeName),
            t.functionExpression(null, [], t.blockStatement([t.returnStatement(t.identifier(`a${importCounter}`))])),
        ]));
    }
    function getTemplateString(template, path) {
        if ((template === null || template === void 0 ? void 0 : template.type) === 'StringLiteral') {
            return template.value;
        }
        // treat inert TemplateLiteral (without subexpressions) like a StringLiteral
        if ((template === null || template === void 0 ? void 0 : template.type) === 'TemplateLiteral' && !template.expressions.length) {
            return template.quasis[0].value.cooked;
        }
        throw path.buildCodeFrameError('hbs accepts only a string literal argument');
    }
    function getCallArguments(path) {
        let [template, options] = path.node.arguments;
        let insertRuntimeErrors = (options === null || options === void 0 ? void 0 : options.type) === 'ObjectExpression' &&
            options.properties.some(prop => prop.type === 'ObjectProperty' &&
                prop.computed === false &&
                prop.key.type === 'Identifier' &&
                prop.key.name === 'insertRuntimeErrors' &&
                prop.value.type === 'BooleanLiteral' &&
                prop.value.value);
        return {
            template: getTemplateString(template, path),
            insertRuntimeErrors,
        };
    }
    return inlineHBSTransform;
}
exports.default = make;
//# sourceMappingURL=babel-plugin-inline-hbs.js.map