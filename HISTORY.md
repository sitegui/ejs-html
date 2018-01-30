# 5.1.5
* Fixed: compiler emitted wrong JS code when dealing with placeholders or boolean attributes

# 5.1.4
* Fixed: missing \n

# 5.1.3
* Fixed: fix weird source map when an EJS tag spans multiple lines

# 5.1.2
* Fixed: `stricMode` not working for `compile.standAlone`

# 5.1.1
* Fixed: bug with empty EJS eval tags (`<% %>`)
* Fixed: bug with text after EJS tag inside custom tag (`<my-tag><%= a %> text</my-tag>`)

# 5.1.0
* Added: `sourceMap` option to create source maps

# 5.0.0

## Breaking changes
* Removed: support for node 4
* Changed: from `reduce(tokens[, compileDebug])` to `reduce(tokens[, options])`
* Changed: use strict mode and do not wrap code in `with(locals)` by default.

The old version (v4) compiled templates to sloppy JS mode and used the long-deprecated `with()` structure.
The new (v5) version changes that, but allows one to opt-out.

We used `with(locals)` to allow one to write `<%= x %>` instead of `<%= locals.x %>`, but employing `with()` forced
the lib to compile to sloppy mode since this construct isn't allowed in strict mode.

In this new version, we revisited that decision and prefered to drop `with` in favor of strict mode.
To ease transition, you can opt-out and keep using the old behavior with the option `strictMode: false`.
On the other hand, if don't want to keep writing `locals.` all the time, you can list which variables should be made
available with the option `vars: ['someVar', 'anotherOne']`. See the examples below

```js
/**
 * Old (v4)
 */

// Variables could be accessed directly, unless there were absent in the locals parameter
ejs.render('<%= a %>', {a: 2}) // '2'
ejs.render('<%= b %>', {a: 2}) // ReferenceError: b is not defined

// In sloppy mode, weird things happen, like leaking to global context
ejs.render('<% x = 17 %>') // ''
x // 17

/**
 * New (v5)
 */

// Direct access does not work out of the box
ejs.render('<%= a %>', {a: 2}) // ReferenceError: a is not defined

// You have to be explicit. Either use the locals object or list variables to be made available
ejs.render('<%= locals.a %>', {a: 2}) // '2'
ejs.render('<%= a %>', {a: 2}, {vars: ['a']}) // '2'
ejs.render('<%= b %>', {a: 2}, {vars: ['b']}) // ''

// Code is executed in strict mode
ejs.render('<% x = 17 %>') // ReferenceError: x is not defined

// If you REALLY want to use old behavior
ejs.render('<%= a %>', {a: 2}, {strictMode: false}) // '2'
```

## Other changes
* Added: option `strictMode` (defaults to `true`)
* Added: option `vars` (defaults to `[]`)

# 4.0.3
* Fixed: bug in minifier with spaces around some EJS tags

# 4.0.2
* Fixed: compiling custom elements inside custom elements with `compileDebug` set to `false` would crash on runtime. The fix on 4.0.1 did not covered the recursive case.

# 4.0.1
* Fixed: compiling custom elements with `compileDebug` set to `false` would crash on runtime

# 4.0.0

## Breaking changes
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