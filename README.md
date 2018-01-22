# EJS HTML
[![Build Status](https://travis-ci.org/sitegui/ejs-html.svg?branch=master)](https://travis-ci.org/sitegui/ejs-html)
[![Inline docs](https://inch-ci.org/github/sitegui/ejs-html.svg?branch=master)](https://inch-ci.org/github/sitegui/ejs-html)
[![Dependency Status](https://david-dm.org/sitegui/ejs-html.svg)](https://david-dm.org/sitegui/ejs-html)

Embedded JavaScript HTML templates. An implementation of EJS focused on run-time performance, HTML syntax checking, minified HTML output and custom HTML elements.

## Usage
`npm install ejs-html --save`

```js
let ejs = require('ejs-html')

let html = ejs.render('<input type="text" disabled="<%=disabled%>" value="<%=value%>" />', {
    disabled: false,
    value: 'hi you'
}, {
    vars: ['disabled', 'value']
})

// html = '<input type=text value="hi you">'
```

## Why another EJS implementation?
This module is inspired by [EJS](http://ejs.co/), and is a subset of its syntax, focused on giving HTML first-class support. That is, not all EJS are valid EJS-HTML. Most features listed bellow are possible only with an HTML-aware parser.

Check their excellent site for EJS-specific docs and tutorials.

Strictly speaking, this *is not* even EJS (details bellow).

## Breaking changes in v5
Old versions compiled to sloppy mode and used the `with(locals)` block by default.
That allowed one to write `<%= a %>` instead of `<%= locals.a %>` but had more unwanted consequences.
Read more about what changed and how to opt-out from the change in [HISTORY.md](https://github.com/sitegui/ejs-html/blob/master/HISTORY.md).

## Features

### Compile-time HTML minification
The template source is parsed and minified on compile time, so there is no impact on render-time. The minification applies these rules:

* Collapse text whitespace: `<b>Hello\n\t you</b>` is transformed to `<b>Hello\nyou</b>`
* Remove attribute quotes: `<div class="alert">` → `<div class=alert>`
* Normalize attributes spaces: `<input \n required>` → `<input required>`
* Normalize class spaces: `<div class="  a   b ">` → `<div class="a b">`
* Simplify boolean attributes: `<input required="oh-yeah!">` → `<input required>`
* Remove self-close slash: `<br />` → `<br>`

### Render-time error mapping
Errors during render-time are mapped back to their original source location (that is, we keep an internal source map)

```js
ejs.render(`<select>
<% for (let option of locals.options) { %>
    <option value="<%= option.value %>">
      <%= option.text %>
    </option>
<% } %>
</select>`, {
    options: [null]
})
```

```
TypeError: ejs:3
 1    | <select>
 2    | <% for (let option of options) { %>
 3 >> |         <option value="<%= option.value %>">
 4    |                 <%= option.text %>
 5    |         </option>

Cannot read property 'value' of null
    at eval (eval at module.exports (D:\Programs\ejs-html\lib\compile.js:45:20), <anonymous>:4:51)
    at D:\Programs\ejs-html\lib\compile.js:64:11
    at Object.module.exports.render (D:\Programs\ejs-html\index.js:12:48)
```

### Boolean attributes
Attributes like `disabled` and `checked` are recognized as boolean. So one may write `disabled=<%=disabled%>` instead of `<%if(disabled){%>disabled<%}%>`, as one must in plain EJS.

This is one point that makes EJS-HTML not EJS-compliant. In EJS, any literal text is outputed as is. In the example above this is not what happens: the text `disabled=` is not outputed if the local value `disabled` is falsy, since ejs-html knows this is a boolean attribute.

### Server-side compiled, client-side rendered
Compile the template server-side and export a function to render it in the client-side.

### Extensible semantics
Transformers may be registered to change the parsed elements tree and implement custom semantics.

For example:
```js
// change I elements for EM

var render = ejs.compile('<i>Hi</i> <p><i>Deep</i></p>', {
    transformer: function translate(tokens) {
        tokens.forEach(token => {
            if (token.type === 'element') {
                if (token.name === 'i') {
                    token.name = 'em'
                }
                translate(token.children)
            }
        })
    }
})

render() // '<em>Hi</em> <p><em>Deep</em></p>'
```

### Custom elements
Unleash the semantic power of HTML with custom elements. To use custom elements you must first define one:

For example, define your own confirm dialog (in `dialog.ejs`):
```html
<div class="dialog">
    <div class="dialog-title">
        <%= title %>
        <% if (closable) { %>
            <div class="dialog-close">X</div>
        <% } %>
    </div>
    <eh-placeholder>
        <!-- dialog content goes here -->
    </eh-placeholder>
    <div class="dialog-buttons">
        <button class="dialog-yes">Yes</button>
        <button class="dialog-no">No</button>
    </div>
</div>
```

And then use it, like:
```html
<custom-dialog title="Wanna Know?" closable>
    <em>HTML</em> Content
</custom-dialog>
```

The attributes on the `custom-dialog` tag is passed as locals to `dialog.ejs` and its content replaces the `<eh-placeholder></eh-placeholder>` tag.

Custom elements is a more powerful replacement for ejs' include feature.

This is the most basic usage of this feature. For more (like passing JS values and multiple content areas), see [custom-els.md](https://github.com/sitegui/ejs-html/blob/master/custom-els.md)

## Source maps
Compile with support for source map generation (requires node >= v8, since `source-map` has dropped support for older versions)
```js
let fn = ejs.compile('Hello <%= locals.world %>', {sourceMap: true})
// The actual result may vary
fn.code // "use strict";locals=locals||{};let __c=locals.__contents||{};return "Hello "+(__l.s=__l.e=1,__e(locals.world));
fn.map // {"version":3,"sources":["ejs"],"names":[],"mappings":"gGAAU,Y","file":"ejs.js"}
fn.mapWithCode // {"version":3,"sources":["ejs"],"names":[],"mappings":"gGAAU,Y","file":"ejs.js","sourcesContent":["Hello <%= locals.world %>"]}
```

## Missing features
The following list of features are supported in other EJS implementations, but not by this one (at least, yet):

* No support for custom delimiters
* No caching
* No built-in express support
* No include: use custom elements instead

## API

The main API is the `compile` function. Everything else is auxiliary.

### compile(source[, options])
Compile the given EJS-HTML source into a render function. `options` is an optional object, with the following optional keys:

* `compileDebug`: if `false`, no extended context will be added to exceptions thrown at runtime (defaults to `true`). If `true`, the compiled code will be larger and will include the original EJS source
* `filename`: used to name the file in render-time error's stack trace
* `transformer`: a function that can transform the parsed HTML element tree, before the minification and compilation. This should return a new array of tokens or `undefined` to use the same (in case of in-place changes). Consult the definition of a `Token` in the [parse.js](https://github.com/sitegui/ejs-html/blob/master/lib/parse.js) file.
* `strictMode`: if `false`, use sloppy mode and wrap the code in a `with(locals) {}` block (defaults to `true`).
* `vars`: an array of var names that will be exposed from `locals` (defaults to `[]`).
* `sourceMap`: if `true`, create and return the source map

This will return a compiled render function that can then be called like: `render(locals[, renderCustom])`. `locals` is the data object used to fill the template. `renderCustom` is an optional function used to render custom elements, see [custom-els.md](https://github.com/sitegui/ejs-html/blob/master/custom-els.md) for more info about it.

The returned function has three extra properties if `sourceMap` is active:
* `fn.code`: compiled JS code
* `fn.map`: source map without the source code
* `fn.mapWithCode`: source map with the source code

### compile.standAlone(source[, options])
Like `compile()`, but returns the function body code as a string, so that it can be exported somewhere else. A use case for this is compile the EJS template in the server, export the function to the client and render in the browser:

```js
// On the server
let functionBody = ejs.compile.standAlone('<p>Hi <%=name%></p>', {vars: ['name']})

// On the client
var render = new Function('locals, renderCustom', functionBody)
render({name: 'you'}) // <p>Hi you</p>
```

### compile.standAloneAsObject(source[, options])
Like `compile.standAlone()`, but returns an object with three properties:
* `obj.code`: the compiled code, the same value returned by `compile.standAlone()`
* `obj.map` and `obj.mapWithCode`: extra properties when `sourceMap` option is active

### render(source[, locals[, options]])
Just a convinience for `compile(source, options)(locals)`.

### parse(source)
Parse the given EJS-HTML source into a array of tokens. Use for low-level, crazy thinks (like some internal tooling).

### reduce(tokens[, options])
Remove comments, transform fixed tokens back to text and apply HTML minification. Use for low-level, crazy things.

### escape.html(str)
Return a HTML-safe version of `str`, escaping &, <, >, " and '

### escape.js(str)
Escape as to make safe to put inside double quotes: `x = "..."`, escaping \, \n, \r and "

### escape.getSnippet(source, lineStart, lineEnd)
Extract the code snippet in the given region (used internally to create error messages)