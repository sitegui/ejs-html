# 3.1.0
* Added: `compile.both(source[, option])`

# 3.0.1
* Fixed: npm.js does not render tabs on README correctly

# 3.0.0

## Breaking Changes
* Changed: EJS eval tags `<% %>` are no longer allowed in attribute values, for safety and simplicity, use escaped tags `<%= %>`
* Removed: `standAlone` option to `compile()`. Use new function `compile.standAlone()` for similar effect
* Added: `compile.standAlone()`. It returns the JS render function body as a string. The string can be trasmitted to a client and then the render function reconstructed with `new Function('locals, customRender', code)`

# 2.1.0
* Added: exposed `getSnippet()`

# 2.0.1
* Fixed: detect and throw syntax error on repeated attributes
* Fixed: boolean and case attributes handling in custom tags
* Fixed: show line numbers in render-time errors and fix line mapping for custom tags

# 2.0.0
* Changed: `<eh-placeholder>` is no longer a void element, its content indicates the default value if no content for it is provided

# 1.2.0
* Added: support for custom elements

# 1.1.0
* Added: parse HTML as tree of elements
* Added: check element tree is well balanced (no implicit end-tags)
* Added: `transformer` option to extend semantics
* Fixed: whitespace collapsing inside pre, script, style and textarea tags
* Fixed: parsing of script and style tags

# 1.0.0
* Started