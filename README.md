# EJS HTML
[![Build Status](https://travis-ci.org/sitegui/ejs-html.svg?branch=master)](https://travis-ci.org/sitegui/ejs-html)
[![Inline docs](https://inch-ci.org/github/sitegui/ejs-html.svg?branch=master)](https://inch-ci.org/github/sitegui/ejs-html)
[![Dependency Status](https://david-dm.org/sitegui/ejs-html.svg)](https://david-dm.org/sitegui/ejs-html)

Embedded JavaScript HTML templates. Another implementation of EJS, focused on run-time performance, HTML syntax checking and outputting minified HTML.

## Usage
`npm install ejs-html --save`

```js
let ejs = require('ejs-html')

let html = ejs.render('<input type="text" disabled="<%=disabled%>" value="<%=value%>">', {
	disabled: false,
	value = 'hi you'
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

* Collapse text whitespace: `<b>Hello    you</b>` is transformed to `<b>Hello you</b>`
* Remove attribute quotes: `<div class="alert">` -> `<div class=alert>`
* Normalize attributes spaces: `<input   required>` -> `<input required>`
* Normalize class spaces: `<div class="  a   b">` -> `<div class="a b">`
* Simplify boolean attributes: `<input required="oh-yeah!">` -> `<input required>`

### Render-time error mapping
Errors during render-time are mapped back to their original source location (that is, we keep an internal source map)

### Boolean attributes
Attributes like `disabled` and `checked` are recognized as boolean. So one may write `disabled=<%=disabled%>` instead of `<%if(disabled){%>disabled<%}%>`, as they must in plain EJS.

This is one point that makes this not EJS compliant. In EJS, anything literal text is outputed as is. In the example above this is not happens: the text `disabled=` is not outputed if the local value `disabled` is falsy, since ejs-html knows this is a boolean attribute.

### Server-side compiled, client-side rendered
Compile the template server-side and export a function to render it in the client-side.

### Extensible semantics
Transformers may be registered to change the parsed token list and implement custom semantics.

For example:
```js
// change B tags for STRONG

var render = ejs.compile('<b>Hi</b>', {
	transformers: [function (tokens) {
		tokens.forEach(function (token) {
			if ((token.type === 'tag-open' || token.type === 'tag-close') &&
				token.name.toLowerCase() === 'b') {
				token.name = 'strong'
			}
		})
		return tokens
	}]
})

render() // '<strong>Hi</strong>'
```

## Missing features
The following list of features are support other EJS implementations, but not by this one (at least, yet):

* No support for custom delimiters
* No caching
* No includes
* No built-in express support

## Syntax



