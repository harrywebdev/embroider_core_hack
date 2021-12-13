"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const template_compiler_node_1 = require("./template-compiler-node");
const babel_plugin_stage1_inline_hbs_1 = __importDefault(require("./babel-plugin-stage1-inline-hbs"));
exports.default = (0, babel_plugin_stage1_inline_hbs_1.default)((opts) => new template_compiler_node_1.NodeTemplateCompiler(opts.templateCompiler));
//# sourceMappingURL=babel-plugin-stage1-inline-hbs-node.js.map