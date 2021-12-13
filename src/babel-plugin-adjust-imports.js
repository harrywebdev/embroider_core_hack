"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isDefineExpression = exports.isDynamicImportExpression = exports.isImportSyncExpression = void 0;
const shared_internals_1 = require("@embroider/shared-internals");
const path_1 = require("path");
const shared_internals_2 = require("@embroider/shared-internals");
const fs_extra_1 = require("fs-extra");
const typescript_memoize_1 = require("typescript-memoize");
const js_handlebars_1 = require("./js-handlebars");
const mini_modules_polyfill_1 = require("./mini-modules-polyfill");
const babel_import_util_1 = require("babel-import-util");
const packageCache = shared_internals_2.PackageCache.shared('embroider-stage3');
function isImportSyncExpression(t, path) {
    if (!path ||
        !path.isCallExpression() ||
        path.node.callee.type !== 'Identifier' ||
        !path.get('callee').referencesImport('@embroider/macros', 'importSync')) {
        return false;
    }
    const args = path.node.arguments;
    return Array.isArray(args) && args.length === 1 && t.isStringLiteral(args[0]);
}
exports.isImportSyncExpression = isImportSyncExpression;
function isDynamicImportExpression(t, path) {
    if (!path || !path.isCallExpression() || path.node.callee.type !== 'Import') {
        return false;
    }
    const args = path.node.arguments;
    return Array.isArray(args) && args.length === 1 && t.isStringLiteral(args[0]);
}
exports.isDynamicImportExpression = isDynamicImportExpression;
function isDefineExpression(t, path) {
    // should we allow nested defines, or stop at the top level?
    if (!path.isCallExpression() || path.node.callee.type !== 'Identifier' || path.node.callee.name !== 'define') {
        return false;
    }
    const args = path.node.arguments;
    // only match define with 3 arguments define(name: string, deps: string[], cb: Function);
    return (Array.isArray(args) &&
        args.length === 3 &&
        t.isStringLiteral(args[0]) &&
        t.isArrayExpression(args[1]) &&
        t.isFunction(args[2]));
}
exports.isDefineExpression = isDefineExpression;
function adjustSpecifier(specifier, file, opts, isDynamic) {
    if (specifier === '@embroider/macros') {
        // the macros package is always handled directly within babel (not
        // necessarily as a real resolvable package), so we should not mess with it.
        // It might not get compiled away until *after* our plugin has run, which is
        // why we need to know about it.
        return specifier;
    }
    specifier = handleRenaming(specifier, file, opts);
    specifier = handleExternal(specifier, file, opts, isDynamic);
    return specifier;
}
function handleRenaming(specifier, sourceFile, opts) {
    let packageName = (0, shared_internals_1.packageName)(specifier);
    if (!packageName) {
        return specifier;
    }
    for (let [candidate, replacement] of Object.entries(opts.renameModules)) {
        if (candidate === specifier) {
            return replacement;
        }
        for (let extension of opts.resolvableExtensions) {
            if (candidate === specifier + '/index' + extension) {
                return replacement;
            }
            if (candidate === specifier + extension) {
                return replacement;
            }
        }
    }
    if (opts.renamePackages[packageName]) {
        return specifier.replace(packageName, opts.renamePackages[packageName]);
    }
    let pkg = sourceFile.owningPackage();
    if (!pkg || !pkg.isV2Ember()) {
        return specifier;
    }
    if (pkg.meta['auto-upgraded'] && pkg.name === packageName) {
        // we found a self-import, make it relative. Only auto-upgraded packages get
        // this help, v2 packages are natively supposed to use relative imports for
        // their own modules, and we want to push them all to do that correctly.
        let fullPath = specifier.replace(packageName, pkg.root);
        return (0, shared_internals_2.explicitRelative)((0, path_1.dirname)(sourceFile.name), fullPath);
    }
    let relocatedIntoPkg = sourceFile.relocatedIntoPackage();
    if (relocatedIntoPkg && pkg.meta['auto-upgraded'] && relocatedIntoPkg.name === packageName) {
        // a file that was relocated into a package does a self-import of that
        // package's name. This can happen when an addon (like ember-cli-mirage)
        // emits files from its own treeForApp that contain imports of the app's own
        // fully qualified name.
        let fullPath = specifier.replace(packageName, relocatedIntoPkg.root);
        return (0, shared_internals_2.explicitRelative)((0, path_1.dirname)(sourceFile.name), fullPath);
    }
    return specifier;
}
function isExplicitlyExternal(specifier, fromPkg) {
    return Boolean(fromPkg.isV2Addon() && fromPkg.meta['externals'] && fromPkg.meta['externals'].includes(specifier));
}
function isResolvable(packageName, fromPkg) {
    try {
        let dep = packageCache.resolve(packageName, fromPkg);
        if (!dep.isEmberPackage() && !fromPkg.hasDependency('ember-auto-import')) {
            return false;
        }
        return dep;
    }
    catch (err) {
        if (err.code !== 'MODULE_NOT_FOUND') {
            throw err;
        }
        return false;
    }
}
const dynamicMissingModule = (0, js_handlebars_1.compile)(`
  throw new Error('Could not find module \`{{{js-string-escape moduleName}}}\`');
`);
const externalTemplate = (0, js_handlebars_1.compile)(`
{{#if (eq runtimeName "require")}}
const m = window.requirejs;
{{else}}
const m = window.require("{{{js-string-escape runtimeName}}}");
{{/if}}
{{!-
  There are plenty of hand-written AMD defines floating around
  that lack this, and they will break when other build systems
  encounter them.

  As far as I can tell, Ember's loader was already treating this
  case as a module, so in theory we aren't breaking anything by
  marking it as such when other packagers come looking.

  todo: get review on this part.
-}}
if (m.default && !m.__esModule) {
  m.__esModule = true;
}
module.exports = m;
`);
function handleExternal(specifier, sourceFile, opts, isDynamic) {
    let pkg = sourceFile.owningPackage();
    if (!pkg || !pkg.isV2Ember()) {
        return specifier;
    }
    let packageName = (0, shared_internals_1.packageName)(specifier);
    if (!packageName) {
        // This is a relative import. We don't automatically externalize those
        // because it's rare, and by keeping them static we give better errors. But
        // we do allow them to be explicitly externalized by the package author (or
        // a compat adapter). In the metadata, they would be listed in
        // package-relative form, so we need to convert this specifier to that.
        let absoluteSpecifier = (0, path_1.resolve)((0, path_1.dirname)(sourceFile.name), specifier);
        let packageRelativeSpecifier = (0, shared_internals_2.explicitRelative)(pkg.root, absoluteSpecifier);
        if (isExplicitlyExternal(packageRelativeSpecifier, pkg)) {
            let publicSpecifier = absoluteSpecifier.replace(pkg.root, pkg.name);
            return makeExternal(publicSpecifier, sourceFile, opts);
        }
        else {
            return specifier;
        }
    }
    // absolute package imports can also be explicitly external based on their
    // full specifier name
    if (isExplicitlyExternal(specifier, pkg)) {
        return makeExternal(specifier, sourceFile, opts);
    }
    let relocatedPkg = sourceFile.relocatedIntoPackage();
    if (relocatedPkg) {
        // this file has been moved into another package (presumably the app).
        // self-imports are legal in the app tree, even for v2 packages
        if (packageName === pkg.name) {
            return specifier;
        }
        // first try to resolve from the destination package
        if (isResolvable(packageName, relocatedPkg)) {
            if (!pkg.meta['auto-upgraded']) {
                throw new Error(`${pkg.name} is trying to import ${packageName} from within its app tree. This is unsafe, because ${pkg.name} can't control which dependencies are resolvable from the app`);
            }
            return specifier;
        }
        else {
            // second try to resolve from the source package
            let targetPkg = isResolvable(packageName, pkg);
            if (targetPkg) {
                if (!pkg.meta['auto-upgraded']) {
                    throw new Error(`${pkg.name} is trying to import ${packageName} from within its app tree. This is unsafe, because ${pkg.name} can't control which dependencies are resolvable from the app`);
                }
                // we found it, but we need to rewrite it because it's not really going to
                // resolve from where its sitting
                return (0, shared_internals_2.explicitRelative)((0, path_1.dirname)(sourceFile.name), specifier.replace(packageName, targetPkg.root));
            }
        }
    }
    else {
        if (isResolvable(packageName, pkg)) {
            if (!pkg.meta['auto-upgraded'] && !reliablyResolvable(pkg, packageName)) {
                throw new Error(`${pkg.name} is trying to import from ${packageName} but that is not one of its explicit dependencies`);
            }
            return specifier;
        }
    }
    // auto-upgraded packages can fall back to the set of known active addons
    if (pkg.meta['auto-upgraded'] && opts.activeAddons[packageName]) {
        return (0, shared_internals_2.explicitRelative)((0, path_1.dirname)(sourceFile.name), specifier.replace(packageName, opts.activeAddons[packageName]));
    }
    // auto-upgraded packages can fall back to attmpeting to find dependencies at
    // runtime. Native v2 packages can only get this behavior in the
    // isExplicitlyExternal case above because they need to explicitly ask for
    // externals.
    if (pkg.meta['auto-upgraded']) {
        return makeExternal(specifier, sourceFile, opts);
    }
    if (pkg.isV2Ember()) {
        // native v2 packages don't automatically externalize *everything* the way
        // auto-upgraded packages do, but they still externalize known and approved
        // ember virtual packages (like @ember/component)
        if (shared_internals_1.emberVirtualPackages.has(packageName)) {
            return makeExternal(specifier, sourceFile, opts);
        }
        // native v2 packages don't automatically get to use every other addon as a
        // peerDep, but they do get the known and approved ember virtual peer deps,
        // like @glimmer/component
        if (shared_internals_1.emberVirtualPeerDeps.has(packageName)) {
            if (!opts.activeAddons[packageName]) {
                throw new Error(`${pkg.name} is trying to import from ${packageName}, which is supposed to be present in all ember apps but seems to be missing`);
            }
            return (0, shared_internals_2.explicitRelative)((0, path_1.dirname)(sourceFile.name), specifier.replace(packageName, opts.activeAddons[packageName]));
        }
    }
    // non-resolvable imports in dynamic positions become runtime errors, not
    // build-time errors, so we emit the runtime error module here before the
    // stage3 packager has a chance to see the missing module. (Maybe some stage3
    // packagers will have this behavior by default, because it would make sense,
    // but webpack at least does not.)
    if (isDynamic) {
        return makeMissingModule(specifier, sourceFile, opts);
    }
    // this is falling through with the original specifier which was
    // non-resolvable, which will presumably cause a static build error in stage3.
    return specifier;
}
function makeMissingModule(specifier, sourceFile, opts) {
    let target = (0, path_1.join)(opts.externalsDir, specifier + '.js');
    (0, fs_extra_1.outputFileSync)(target, dynamicMissingModule({
        moduleName: specifier,
    }));
    return (0, shared_internals_2.explicitRelative)((0, path_1.dirname)(sourceFile.name), target.slice(0, -3));
}
function makeExternal(specifier, sourceFile, opts) {
    let target = (0, path_1.join)(opts.externalsDir, specifier + '.js');
    (0, fs_extra_1.outputFileSync)(target, externalTemplate({
        runtimeName: specifier,
    }));
    return (0, shared_internals_2.explicitRelative)((0, path_1.dirname)(sourceFile.name), target.slice(0, -3));
}
function main(babel) {
    let t = babel.types;
    return {
        visitor: {
            Program: {
                enter(path, state) {
                    let opts = ensureOpts(state);
                    state.adjustFile = new AdjustFile(path.hub.file.opts.filename, opts.relocatedFiles);
                    let adder = new babel_import_util_1.ImportUtil(t, path);
                    addExtraImports(adder, t, path, opts.extraImports);
                },
                exit(path, state) {
                    for (let child of path.get('body')) {
                        if (child.isImportDeclaration() || child.isExportNamedDeclaration() || child.isExportAllDeclaration()) {
                            rewriteTopLevelImport(t, child, state);
                        }
                    }
                },
            },
            CallExpression(path, state) {
                if (isImportSyncExpression(t, path) || isDynamicImportExpression(t, path)) {
                    const [source] = path.get('arguments');
                    let opts = ensureOpts(state);
                    let specifier = adjustSpecifier(source.node.value, state.adjustFile, opts, true);
                    source.replaceWith(t.stringLiteral(specifier));
                    return;
                }
                // Should/can we make this early exit when the first define was found?
                if (!isDefineExpression(t, path)) {
                    return;
                }
                let pkg = state.adjustFile.owningPackage();
                if (pkg && pkg.isV2Ember() && !pkg.meta['auto-upgraded']) {
                    throw new Error(`The file ${state.adjustFile.originalFile} in package ${pkg.name} tried to use AMD define. Native V2 Ember addons are forbidden from using AMD define, they must use ECMA export only.`);
                }
                let opts = ensureOpts(state);
                const dependencies = path.node.arguments[1];
                const specifiers = dependencies.elements.slice();
                specifiers.push(path.node.arguments[0]);
                for (let source of specifiers) {
                    if (!source) {
                        continue;
                    }
                    if (source.type !== 'StringLiteral') {
                        throw path.buildCodeFrameError(`expected only string literal arguments`);
                    }
                    if (source.value === 'exports' || source.value === 'require') {
                        // skip "special" AMD dependencies
                        continue;
                    }
                    let specifier = adjustSpecifier(source.value, state.adjustFile, opts, false);
                    if (specifier !== source.value) {
                        source.value = specifier;
                    }
                }
            },
        },
    };
}
exports.default = main;
function rewriteTopLevelImport(t, path, state) {
    let opts = ensureOpts(state);
    const { source } = path.node;
    if (source === null || source === undefined) {
        return;
    }
    if (opts.emberNeedsModulesPolyfill && path.isImportDeclaration()) {
        let replacement = (0, mini_modules_polyfill_1.handleImportDeclaration)(t, path);
        if (replacement) {
            path.replaceWith(replacement);
            return;
        }
    }
    let specifier = adjustSpecifier(source.value, state.adjustFile, opts, false);
    if (specifier !== source.value) {
        source.value = specifier;
    }
}
main.baseDir = function () {
    return (0, path_1.join)(__dirname, '..');
};
function addExtraImports(adder, t, path, extraImports) {
    for (let { absPath, target, runtimeName } of extraImports) {
        if (absPath === path.hub.file.opts.filename) {
            if (runtimeName) {
                path.node.body.unshift(amdDefine(t, adder, path, target, runtimeName));
            }
            else {
                adder.importForSideEffect(target);
            }
        }
    }
}
function amdDefine(t, adder, path, target, runtimeName) {
    let value = t.callExpression(adder.import(path, '@embroider/macros', 'importSync'), [t.stringLiteral(target)]);
    return t.expressionStatement(t.callExpression(t.memberExpression(t.identifier('window'), t.identifier('define')), [
        t.stringLiteral(runtimeName),
        t.functionExpression(null, [], t.blockStatement([t.returnStatement(value)])),
    ]));
}
class AdjustFile {
    constructor(name, relocatedFiles) {
        this.name = name;
        if (!name) {
            throw new Error(`bug: adjust-imports plugin was run without a filename`);
        }
        this.originalFile = relocatedFiles[name] || name;
    }
    get isRelocated() {
        return this.originalFile !== this.name;
    }
    owningPackage() {
        return packageCache.ownerOfFile(this.originalFile);
    }
    relocatedIntoPackage() {
        if (this.isRelocated) {
            return packageCache.ownerOfFile(this.name);
        }
    }
}
__decorate([
    (0, typescript_memoize_1.Memoize)()
], AdjustFile.prototype, "owningPackage", null);
__decorate([
    (0, typescript_memoize_1.Memoize)()
], AdjustFile.prototype, "relocatedIntoPackage", null);
function ensureOpts(state) {
    let { opts } = state;
    if ('adjustImportsOptionsPath' in opts) {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        return (state.opts = Object.assign(Object.assign({}, require(opts.adjustImportsOptionsPath)), require(opts.relocatedFilesPath)));
    }
    return opts;
}
// we don't want to allow things that resolve only by accident that are likely
// to break in other setups. For example: import your dependencies'
// dependencies, or importing your own name from within a monorepo (which will
// work because of the symlinking) without setting up "exports" (which makes
// your own name reliably resolvable)
function reliablyResolvable(pkg, packageName) {
    if (pkg.hasDependency(packageName)) {
        return true;
    }
    if (pkg.name === packageName && pkg.packageJSON.exports) {
        return true;
    }
    if (shared_internals_1.emberVirtualPeerDeps.has(packageName)) {
        return true;
    }
    return false;
}
//# sourceMappingURL=babel-plugin-adjust-imports.js.map