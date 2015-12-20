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