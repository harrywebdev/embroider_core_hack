"use strict";
/*
  This babel plugins is responsible for running custom AST transform in inline
  templates. It doesn't compile to wire format, because it runs at stage1.
*/
Object.defineProperty(exports, "__esModule", { value: true });
const path_1 = require("path");
const shared_internals_1 = require("@embroider/shared-internals");
function make(getCompiler) {
    function stage1InlineHBSTransform(babel) {
        let t = babel.types;
        return {
            visitor: {
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
    stage1InlineHBSTransform._parallelBabel = {
        requireFile: __filename,
    };
    stage1InlineHBSTransform.baseDir = function () {
        return (0, path_1.join)(__dirname, '..');
    };
    function handleTagged(path, state, t) {
        if (path.node.quasi.expressions.length) {
            throw path.buildCodeFrameError('placeholders inside a tagged template string are not supported');
        }
        let template = path.node.quasi.quasis.map(quasi => quasi.value.cooked).join('');
        let compiled = compiler(state).applyTransforms(state.file.opts.filename, template);
        path.get('quasi').replaceWith(t.templateLiteral([t.templateElement({ raw: compiled, cooked: compiled })], []));
    }
    function handleCalled(path, state, t) {
        let { template, insertRuntimeErrors } = getCallArguments(path);
        let compilerInstance = compiler(state);
        let compiled;
        try {
            compiled = compilerInstance.applyTransforms(state.file.opts.filename, template);
        }
        catch (err) {
            if (insertRuntimeErrors) {
                // in stage 1 we just leave the bad template in place (we were only
                // trying to run transforms and re-emit hbs), so that it will be handled
                // at stage3 instead.
                return;
            }
            throw err;
        }
        path.get('arguments')[0].replaceWith(t.stringLiteral(compiled));
    }
    function compiler(state) {
        if (!state.templateCompiler) {
            state.templateCompiler = getCompiler(state.opts);
        }
        return state.templateCompiler;
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
    return stage1InlineHBSTransform;
}
exports.default = make;
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
//# sourceMappingURL=babel-plugin-stage1-inline-hbs.js.map