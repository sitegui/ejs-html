'use strict'

let ejsHtml = require('../'),
	ejs = require('ejs')

let source = `<!DOCTYPE html>
<html lang="<%=locals.lang%>">
<head>
<title><%=locals.title%></title>
</head>
<body>
	
	<!-- A form -->
	<form action="<%=locals.action%>">
		<label>
		<input type="text" value="<%=locals.value%>" disabled="<%=locals.disabled%>"><br />
		</label>

		<!-- A select -->
		<select>
		<% locals.items.forEach(function (item, i) { %>
			<option value="<%=item.value%>" selected="<%=locals.selectedIndex===i%>"><%=item.text%></option>
		<% }) %>
		</select>
	</form>

</body>
</html>`

source = source + source + source + source + source

let renderEjs = time('compile-ejs', () => ejs.compile(source))

let renderEjsHtml = time('compile-ejs-html', () => ejsHtml.compile(source, {
	collapseText: true,
	collapseAttribute: true,
	boolAttribute: true,
	standAlone: true
}))

let data = {
	lang: 'en-us',
	title: 'My <<<<<<<<<<<< title >>>>>>>>>>>',
	action: '/send-it',
	value: 'initial value',
	disabled: false,
	selectedIndex: 2,
	items: [{
		value: '2',
		text: 'two'
	}, {
		value: '3',
		text: 'three'
	}, {
		value: '5',
		text: 'five'
	}, {
		value: '7',
		text: 'seven'
	}, {
		value: '11',
		text: 'eleven'
	}, {
		value: '13',
		text: 'thirdteen'
	}, {
		value: '17',
		text: 'seventeen'
	}]
}

time('render-ejs', () => renderEjs(data))

time('render-ejs-html', () => renderEjsHtml(data))

function time(name, fn) {
	for (let i = 0; i < 1e3; i++) {
		fn()
	}
	let start = Date.now(),
		n = 1e3,
		result
	for (let i = 0; i < n; i++) {
		result = fn()
	}
	let dt = (Date.now() - start) / n
	// eslint-disable-next-line no-console
	console.log(`${name}: ${dt.toFixed(2)}ms`)
	return result
}