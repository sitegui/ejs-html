# 4.0.3
* Fixed: bug in minifier with spaces around some EJS tags

# 4.0.2
* Fixed: compiling custom elements inside custom elements with `compileDebug` set to `false` would crash on runtime. The fix on 4.0.1 did not covered the recursive case.

# 4.0.1
* Fixed: compiling custom elements with `compileDebug` set to `false` would crash on runtime

# 4.0.0

## Breaking Changes
* Removed: `compile.both()`, since it was not as useful as it has appeared at first and it would make the other improvents in this release harder to implement.
* Removed: compile `debug` option, since it was not useful to be present in the public API

## Other changes
* Added: compile option `compileDebug` (defaults to `true`) to indicate whether to add extended context to exceptions

# 3.1.1
* Fixed: white-space-only content for custom element is considered empty and the default placeholder is used

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