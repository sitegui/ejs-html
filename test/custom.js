/*globals describe, it*/
'use strict'

let compile = require('..').compile
require('should')

describe('custom', function () {
	let renderDialog
	it('should compile custom tag definition', function () {
		renderDialog = compile(`<div class="dialog">
	<div class="dialog-title">
		<%= title %>
		<% if (closable) { %>
			<div class="dialog-close">X</div>
		<% } %>
	</div>
	<!-- dialog content goes here -->
	<eh-placeholder />
	<div class="dialog-buttons">
		<button class="dialog-yes">Yes</button>
		<button class="dialog-no">No</button>
	</div>
</div>`)
	})

	let renderView
	it('should compile custom tag usage', function () {
		renderView = compile(`<custom-dialog title="Wanna Know?" closable>
	<em>HTML</em> Content
</custom-dialog>`)
	})

	it('should render custom tags', function () {
		renderView({}, (name, locals) => {
			name.should.be.equal('custom-dialog')
			locals.should.be.eql({
				title: 'Wanna Know?',
				closable: true,
				__contents: {
					'': '\n<em>HTML</em> Content\n'
				}
			})
			return renderDialog(locals)
		}).should.be.equal(`<div class=dialog>
<div class=dialog-title>
Wanna Know?
<div class=dialog-close>X</div>
</div>

<em>HTML</em> Content

<div class=dialog-buttons>
<button class=dialog-yes>Yes</button>
<button class=dialog-no>No</button>
</div>
</div>`)
	})

	it('should support multiple and named placeholders', function () {
		let renderCustom = compile(`<eh-placeholder>
<eh-placeholder name="a">
<eh-placeholder>
<eh-placeholder name="a">`)

		compile(`<my-tag>
outside
<eh-content name="a">inside</eh-content>
</my-tag>`)({}, (_, locals) => renderCustom(locals)).should.be.equal(`
outside

inside
outside

inside`)
	})

	it('should allow passing complex JS values', function () {
		let myObj = {}
		compile('<my-tag ref="<%=someObj%>"></my-tag>')({
			someObj: myObj
		}, (_, locals) => {
			locals.ref.should.be.equal(myObj)
		})
	})
})