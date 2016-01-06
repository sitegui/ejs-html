# Custom Elements

## Introduction
Custom HTML elements is a greater replacement for `include`. It delegates a portion of the rendering to another EJS template.

The basic example bellow defines a custom text input element, that has its input inside an label element and has a text title in front of it:
```html
<label>
	<span class="field-title"><%= title %></span>: <input name="<%=name%>">
</label>
```

Another EJS template file may "instantiate" this element:
```html
<custom-text-input title="Room Number" name="room"></custom-text-input>
```

The final rendering result is shown bellow:
```html
<label>
	<span class="field-title">Room Number</span>: <input name="room">
</label>
```

## Concepts
As of this writting, the W3C is currently working in custom elements for the Web, under the [Web Components](https://developer.mozilla.org/en-US/docs/Web/Web_Components) umbrella. But we are *not* talking about that here, this is a completely different beast (inspired by the rising standard, but yet not the same thing). EJS-HTML custom elements are resolved at render time, before the browser get to the HTML.

Any element that have a dash (`-`) on its name will be treated as custom (this follows the W3C standard). At compile time, they will be identified and compiled to a `customRender` call. At rendering time, the `customRender` will be called in order to render the custom element and return the HTML result. So it works conceptually like a super-powered include, because it accepts dynamic attributes and complex HTML content.

## Attributes
Attributes in the custom element's open tag will be passed as the `locals` for it.

The attribute name will be transformed from dashed-separated to camel-case notation, for example, the attribute `'my-own-attr'` will be passed as `'myOwnAttr'` local data. The rule is: any dash (U+002D) followed by an ASCII lowercase letter a to z will be removed and the letter will be transformed into its uppercase counterpart.

There are three distinct notations for attributes, depicted bellow. 

* boolean/true: `<my-tag avoid-goats></my-tag>` will produce the following locals object: `{avoidGoats: true}`, much like native HTML boolean attributes. `false` should be represented by its absence.
* string: `<my-tag avoid="goats" keep="all <%=animal%>s"></my-tag>` will produce: `{avoid: 'goats', keep: 'all ' + animal + 's'}`
* JavaScript value: `<my-tag avoid="<%= ['goats', 'more goats'] %>"></my-tag>` will produce: `{avoid: ['goats', 'more goats']}`. This allows complex data to be passed as part of the `locals`, not only strings. Note that the syntax is `attr="<%= ... %>"`, with the quotes right next to the EJS escaped tag. Any character between them (including spaces), would concatenate them and result in a string.

## Content Placeholder
The `<eh-placeholder>` tag in a custom element definition will be replaced by the content inside the custom element (`eh` stands for `ejs-html`).

The example bellow shows a basic usage. The declaration and usage are represented in the same code block for brevity, but they are usually written separately.
```html
<!-- declaration -->
<button style="color:red"><eh-placeholder></eh-placeholder></button>

<!-- usage -->
<my-button><b>Hi</b> you</my-button>

<!-- result -->
<button style="color:red"><b>Hi</b> you</button>
```

Use content placeholders to pass arbitrary HTML content and attributes to anything else.

## Multiple Content Areas
Sometimes it is useful to have multiple placeholder areas. If this is the case, you may name each one with `<eh-placeholder name="...">` in the definition and mark each type with `<eh-content name="...">` on usage.

Example:
```html
<!-- declaration -->
<h1><eh-placeholder name="title"></eh-placeholder></h1>
<p><eh-placeholder></eh-placeholder></p>

<!-- usage -->
<my-tag>
	<eh-content name="title">T<i>i</i>tle</eh-content>
	<b>B</b>ody
</my-tag>

<!-- result -->
<h1>T<i>i</i>tle</h1>
<p><b>B</b>ody</p>
```

Note that an empty-named content markup (`<eh-content name="">`) is implied for any content not inside a `eh-content` tag. In the example above, `<b>B</b>ody` is treated as if it was written as `<eh-content name=""><b>B</b>ody</eh-content>`

## Default Placeholder Content
A `eh-placeholder` element will be replaced by the content provided for it. If no content is given, you can provide a fallback.

One practical application of this feature is to allow both simple and complex content, from both attribute and HTML content. Like this:
```html
<!-- declaration -->
<h1>
	<eh-placeholder name="title">
		<%= title %>
	</eh-placeholder>
</h1>
<p><eh-placeholder></eh-placeholder></p>

<!-- usage -->
<my-tag title="Simple Title">One</my-tag>
<my-tag>
	<eh-content name="title">
		<span style="color:red">Complex Title</span>
	</eh-content>
	Two
</my-tag>

<!-- result -->
<h1>Simple Title</h1>
<p>One</p>
<h1><span style="color:red">Complex Title</span></h1>
<p>Two</p>
```

Note how the default content for the title is a read from the `title` attribute, but if a HTML content for it is provided, it's used instead.

## Divergence From W3C's Web Components
In the current spec, the W3C declares a `<content>` tag to act as ejs-html's `<eh-placeholder>`. The spec is not followed by this lib because (a) its mechanism based on CSS selectors to solve multiple content areas is too complex (b) its usage is hard to optimize on compile time (c) there is no support for default content.

## The CustomRender Callback
Currently, this lib does not attempt to detect which EJS template to use to render a given custom element. You must implement that yourself and provide when rendering each template. For example, if your custom element definitions are in a folder, you are responsible to handle the routing.

A full example bellow, for the given folder structure:
```
-- elements
   |
   +- my-input.ejs
   +- my-dialog.ejs
   +- my-header.ejs
-- views
   |
   +- home.ejs
```

And the following content for `home.ejs`:
```html
<my-header></my-header>
<my-dialog>
	<form>
		<my-input title="Your name" name="name"></my-input>
	</form>
</my-dialog>
```

To render the home page:
```js
let ejs = require('ejs-html'),
	fs = require('fs'),
	cache = new Map

// Simple caching logic
function compile(path) {
	if (!cache.has(path)) {
		cache.set(path, ejs.compile(fs.readFileSync(path, 'utf8'), {
			filename: path
		}))
	}
	return cache.get(path)
}

compile('views/home.ejs')({}, function customRender(name, locals) {
	// We are responsible to translate the element name (like 'my-header') to file path
	// Note that `customRender` is passed as argument again, enabling custom elements to
	// also use others
	return compile('elements/' + name + '.ejs')(locals, customRender)
})
```
