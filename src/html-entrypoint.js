"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HTMLEntrypoint = void 0;
const shared_internals_1 = require("@embroider/shared-internals");
const fs_extra_1 = require("fs-extra");
const path_1 = require("path");
const jsdom_1 = require("jsdom");
const partition_1 = __importDefault(require("lodash/partition"));
const zip_1 = __importDefault(require("lodash/zip"));
const html_placeholder_1 = __importDefault(require("./html-placeholder"));
class HTMLEntrypoint {
    constructor(pathToVanillaApp, rootURL, publicAssetURL, filename) {
        this.pathToVanillaApp = pathToVanillaApp;
        this.rootURL = rootURL;
        this.publicAssetURL = publicAssetURL;
        this.filename = filename;
        this.placeholders = new Map();
        this.modules = [];
        this.scripts = [];
        this.styles = [];
        this.dom = new jsdom_1.JSDOM((0, fs_extra_1.readFileSync)((0, path_1.join)(this.pathToVanillaApp, this.filename), 'utf8'));
        for (let tag of this.handledStyles()) {
            let styleTag = tag;
            let href = styleTag.href;
            if (!isAbsoluteURL(href)) {
                let url = this.relativeToApp(href);
                this.styles.push(url);
                let placeholder = new html_placeholder_1.default(styleTag);
                let list = (0, shared_internals_1.getOrCreate)(this.placeholders, url, () => []);
                list.push(placeholder);
            }
        }
        for (let scriptTag of this.handledScripts()) {
            // scriptTag.src include rootURL. Convert it to be relative to the app.
            let src = this.relativeToApp(scriptTag.src);
            if (scriptTag.type === 'module') {
                this.modules.push(src);
            }
            else {
                this.scripts.push(src);
            }
            let placeholder = new html_placeholder_1.default(scriptTag);
            let list = (0, shared_internals_1.getOrCreate)(this.placeholders, src, () => []);
            list.push(placeholder);
        }
    }
    relativeToApp(rootRelativeURL) {
        return rootRelativeURL.replace(this.rootURL, '');
    }
    handledScripts() {
        let scriptTags = [...this.dom.window.document.querySelectorAll('script')];
        let [ignoredScriptTags, handledScriptTags] = (0, partition_1.default)(scriptTags, scriptTag => {
            return !scriptTag.src || scriptTag.hasAttribute('data-embroider-ignore') || isAbsoluteURL(scriptTag.src);
        });
        for (let scriptTag of ignoredScriptTags) {
            scriptTag.removeAttribute('data-embroider-ignore');
        }
        return handledScriptTags;
    }
    handledStyles() {
        let styleTags = [...this.dom.window.document.querySelectorAll('link[rel="stylesheet"]')];
        let [ignoredStyleTags, handledStyleTags] = (0, partition_1.default)(styleTags, styleTag => {
            return !styleTag.href || styleTag.hasAttribute('data-embroider-ignore') || isAbsoluteURL(styleTag.href);
        });
        for (let styleTag of ignoredStyleTags) {
            styleTag.removeAttribute('data-embroider-ignore');
        }
        return handledStyleTags;
    }
    // bundles maps from input asset to a per-variant map of output assets
    render(stats) {
        let insertedLazy = false;
        let fastbootVariant = stats.variants.findIndex(v => Boolean(v.runtime === 'fastboot'));
        let supportsFastboot = stats.variants.some(v => v.runtime === 'fastboot' || v.runtime === 'all');
        for (let [src, placeholders] of this.placeholders) {
            let match = stats.entrypoints.get(src);
            if (match) {
                let firstVariant = stats.variants.findIndex((_, index) => Boolean(match.get(index)));
                let matchingBundles = match.get(firstVariant);
                let matchingFastbootBundles = fastbootVariant >= 0 ? match.get(fastbootVariant) || [] : [];
                for (let placeholder of placeholders) {
                    if (supportsFastboot) {
                        // if there is any fastboot involved, we will emit the lazy bundles
                        // right before our first script.
                        insertedLazy = maybeInsertLazyBundles(insertedLazy, stats.lazyBundles, placeholder, this.publicAssetURL, this.rootURL);
                    }
                    for (let [base, fastboot] of (0, zip_1.default)(matchingBundles, matchingFastbootBundles)) {
                        if (!base) {
                            // this bundle only exists in the fastboot variant
                            let element = placeholder.start.ownerDocument.createElement('fastboot-script');
                            // HACK: actual URL in `publicAssetURL` breaks fastboot loading; only absolute path works
                            let src = this.publicAssetURL.match(/^http/) ? this.rootURL : this.publicAssetURL;
                            element.setAttribute('src', src + fastboot);
                            placeholder.insert(element);
                            placeholder.insertNewline();
                        }
                        else if (!fastboot || base === fastboot) {
                            // no specialized fastboot variant
                            let src = this.publicAssetURL + base;
                            // HACK: actually, URL in `publicAssetURL` breaks fastboot loading; only absolute path works
                            // so even if there is not specialized fastboot variant, we need to add one without the URL
                            let element = placeholder.insertURL(src);
                            if (element && this.publicAssetURL.match(/^http/)) {
                                element.setAttribute('data-fastboot-src', this.rootURL + base);
                            }
                        }
                        else {
                            // we have both and they differ
                            let src = this.publicAssetURL + base;
                            let element = placeholder.insertURL(src);
                            if (element) {
                                // HACK: actual URL in `publicAssetURL` breaks fastboot loading; only absolute path works
                                let src = this.publicAssetURL.match(/^http/) ? this.rootURL : this.publicAssetURL;
                                element.setAttribute('data-fastboot-src', src + fastboot);
                            }
                        }
                    }
                }
            }
            else {
                // no match means keep the original HTML content for this placeholder.
                // (If we really wanted it empty instead, there would be matchingBundles
                // and it would be an empty list.)
                for (let placeholder of placeholders) {
                    placeholder.reset();
                }
            }
        }
        return this.dom.serialize();
    }
}
exports.HTMLEntrypoint = HTMLEntrypoint;
function isAbsoluteURL(url) {
    return /^(?:[a-z]+:)?\/\//i.test(url);
}
// we (somewhat arbitrarily) decide to put the lazy bundles before the very
// first <script> that we have rewritten
function maybeInsertLazyBundles(insertedLazy, lazyBundles, placeholder, publicAssetURL, rootURL) {
    if (!insertedLazy && placeholder.isScript()) {
        for (let bundle of lazyBundles) {
            let element = placeholder.start.ownerDocument.createElement('fastboot-script');
            // HACK: actual URL in `publicAssetURL` breaks fastboot loading; only absolute path works
            let src = publicAssetURL.match(/^http/) ? rootURL : publicAssetURL;
            element.setAttribute('src', src + bundle);
            placeholder.insert(element);
            placeholder.insertNewline();
        }
        return true;
    }
    return insertedLazy;
}
//# sourceMappingURL=html-entrypoint.js.map