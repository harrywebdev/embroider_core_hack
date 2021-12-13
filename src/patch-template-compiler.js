"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.patch = void 0;
const core_1 = require("@babel/core");
function parseVersion(templateCompilerPath, source) {
    // ember-template-compiler.js contains a comment that indicates what version it is for
    // that looks like:
    /*!
     * @overview  Ember - JavaScript Application Framework
     * @copyright Copyright 2011-2020 Tilde Inc. and contributors
     *            Portions Copyright 2006-2011 Strobe Inc.
     *            Portions Copyright 2008-2011 Apple Inc. All rights reserved.
     * @license   Licensed under MIT license
     *            See https://raw.github.com/emberjs/ember.js/master/LICENSE
     * @version   3.25.1
     */
    let version = source.match(/@version\s+([\d\.]+)/);
    if (!version || !version[1]) {
        throw new Error(`Could not find version string in \`${templateCompilerPath}\`. Maybe we don't support your ember-source version?`);
    }
    let numbers = version[1].split('.');
    let major = parseInt(numbers[0], 10);
    let minor = parseInt(numbers[1], 10);
    let patch = parseInt(numbers[2], 10);
    return { major, minor, patch };
}
function emberVersionGte(templateCompilerPath, source, major, minor) {
    let actual = parseVersion(templateCompilerPath, source);
    return actual.major > major || (actual.major === major && actual.minor >= minor);
}
function patch(source, templateCompilerPath) {
    let version = parseVersion(templateCompilerPath, source);
    if (emberVersionGte(templateCompilerPath, source, 3, 26) ||
        (version.major === 3 && version.minor === 25 && version.patch >= 2) ||
        (version.major === 3 && version.minor === 24 && version.patch >= 3)) {
        // no modifications are needed after
        // https://github.com/emberjs/ember.js/pull/19426 and backported to
        // 3.26.0-beta.3, 3.25.2, 3.24.3
        return source;
    }
    let replacedVar = false;
    let patchedSource;
    let needsAngleBracketPrinterFix = emberVersionGte(templateCompilerPath, source, 3, 12) && !emberVersionGte(templateCompilerPath, source, 3, 17);
    if (needsAngleBracketPrinterFix) {
        // here we are stripping off the first `var Ember;`. That one small change
        // lets us crack open the file and get access to its internal loader, because
        // we can give it our own predefined `Ember` variable instead, which it will
        // use and put `Ember.__loader` onto.
        //
        // on ember 3.12 through 3.16 (which use variants of glimmer-vm 0.38.5) we
        // also apply a patch to the printer in @glimmer/syntax to fix
        // https://github.com/glimmerjs/glimmer-vm/pull/941/files because it can
        // really bork apps under embroider, and we'd like to support at least all
        // active LTS versions of ember.
        patchedSource = (0, core_1.transform)(source, {
            plugins: [
                function () {
                    return {
                        visitor: {
                            VariableDeclarator(path) {
                                let id = path.node.id;
                                if (id.type === 'Identifier' && id.name === 'Ember' && !replacedVar) {
                                    replacedVar = true;
                                    path.remove();
                                }
                            },
                            CallExpression: {
                                enter(path, state) {
                                    let callee = path.get('callee');
                                    if (!callee.isIdentifier() || callee.node.name !== 'define') {
                                        return;
                                    }
                                    let firstArg = path.get('arguments')[0];
                                    if (!firstArg.isStringLiteral() || firstArg.node.value !== '@glimmer/syntax') {
                                        return;
                                    }
                                    state.definingGlimmerSyntax = path;
                                },
                                exit(path, state) {
                                    if (state.definingGlimmerSyntax === path) {
                                        state.definingGlimmerSyntax = false;
                                    }
                                },
                            },
                            FunctionDeclaration: {
                                enter(path, state) {
                                    if (!state.definingGlimmerSyntax) {
                                        return;
                                    }
                                    let id = path.get('id');
                                    if (id.isIdentifier() && id.node.name === 'build') {
                                        state.declaringBuildFunction = path;
                                    }
                                },
                                exit(path, state) {
                                    if (state.declaringBuildFunction === path) {
                                        state.declaringBuildFunction = false;
                                    }
                                },
                            },
                            SwitchCase: {
                                enter(path, state) {
                                    if (!state.definingGlimmerSyntax) {
                                        return;
                                    }
                                    let test = path.get('test');
                                    if (test.isStringLiteral() && test.node.value === 'ElementNode') {
                                        state.caseElementNode = path;
                                    }
                                },
                                exit(path, state) {
                                    if (state.caseElementNode === path) {
                                        state.caseElementNode = false;
                                    }
                                },
                            },
                            IfStatement(path, state) {
                                if (!state.caseElementNode) {
                                    return;
                                }
                                let test = path.get('test');
                                // the place we want is the only if with a computed member
                                // expression predicate.
                                if (test.isMemberExpression() && test.node.computed) {
                                    path.node.alternate = core_1.types.ifStatement(core_1.types.memberExpression(core_1.types.identifier('ast'), core_1.types.identifier('selfClosing')), core_1.types.blockStatement([
                                        core_1.types.expressionStatement(core_1.types.callExpression(core_1.types.memberExpression(core_1.types.identifier('output'), core_1.types.identifier('push')), [
                                            core_1.types.stringLiteral(' />'),
                                        ])),
                                    ]), path.node.alternate);
                                }
                            },
                        },
                    };
                },
            ],
        }).code;
    }
    else {
        // applies to < 3.12 and >= 3.17
        //
        // here we are stripping off the first `var Ember;`. That one small change
        // lets us crack open the file and get access to its internal loader, because
        // we can give it our own predefined `Ember` variable instead, which it will
        // use and put `Ember.__loader` onto.
        patchedSource = (0, core_1.transform)(source, {
            generatorOpts: {
                compact: true,
            },
            plugins: [
                function () {
                    return {
                        visitor: {
                            VariableDeclarator(path) {
                                let id = path.node.id;
                                if (id.type === 'Identifier' && id.name === 'Ember' && !replacedVar) {
                                    replacedVar = true;
                                    path.remove();
                                }
                            },
                        },
                    };
                },
            ],
        }).code;
    }
    if (!replacedVar) {
        throw new Error(`didn't find expected source in ${templateCompilerPath}. Maybe we don't support your ember-source version?`);
    }
    return `
      let Ember = {};
      ${patchedSource};
      module.exports.Ember = Ember;
  `;
}
exports.patch = patch;
//# sourceMappingURL=patch-template-compiler.js.map