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
})

// html = '<input type=text value="hi you">'
```

## Why another EJS implementation?
This module is inspired by [EJS](http://ejs.co/), and is a subset of its syntax, focused on giving HTML first-class support. That is, not all EJS are valid EJS-HTML. Most features listed bellow are possible only with an HTML-aware parser.

Check their excellent site for EJS-specific docs and tutorials.

Strictly speaking, this *is not* even EJS (details bellow).

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

### Boolean attributes
Attributes like `disabled` and `checked` are recognized as boolean. So one may write `disabled=<%=disabled%>` instead of `<%if(disabled){%>disabled<%}%>`, as they must in plain EJS.

This is one point that makes this not EJS compliant. In EJS, any literal text is outputed as is. In the example above this is not what happens: the text `disabled=` is not outputed if the local value `disabled` is falsy, since ejs-html knows this is a boolean attribute.

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

## Missing features
The following list of features are support other EJS implementations, but not by this one (at least, yet):

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

This will return a compiled render function that can then be called like: `render(locals[, customRender])`. `locals` is the data object used to fill the template. `customRender` is an optional function used to render custom elements, see [custom-els.md](https://github.com/sitegui/ejs-html/blob/master/custom-els.md) for more info about it.

### compile.standAlone(source[, options])
Like `compile()`, but returns the function body code as a string, so that it can be exported somewhere else. A use case for this is compile the EJS template in the server, export the function to the client and render in the browser:

```js
// On the server
let functionBody = ejs.compile.standAlone('<p>Hi <%=name%></p>')

// On the client
var render = new Function('locals, customRender', functionBody)
render({name: 'you'}) // <p>Hi you</p>
```

### render(source[, locals[, options]])
Just a convinience for `compile(source, options)(locals)`.

### parse(source)
Parse the given EJS-HTML source into a array of tokens. Use for low-level, crazy thinks (like some internal tooling).

### reduce(tokens[, compileDebug])
Remove comments, transform fixed tokens back to text and apply HTML minification. Use for low-level, crazy things.

### escape.html(str)
Return a HTML-safe version of `str`, escaping &, <, >, " and '

### escape.js(str)
Escape as to make safe to put inside double quotes: `x = "..."`, escaping \, \n, \r and "

### escape.getSnippet(source, lineStart, lineEnd)
Extract the code snippet in the given region (used internally to create error messages)