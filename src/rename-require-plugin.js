"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function inlineHBSTransform() {
    return {
        visitor: {
            ImportDefaultSpecifier(path) {
                if (path.node.local.name === 'require') {
                    path.scope.rename('require');
                }
            },
        },
    };
}
exports.default = inlineHBSTransform;
//# sourceMappingURL=rename-require-plugin.js.map