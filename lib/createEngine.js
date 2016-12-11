
const fs= require('fs');

const compile= require('./compile');


/**
 * Creates an engine
 * 
 * @param  {Object}   config  Pass in all the configuration
 * @return {Function}         The express templating engine 
 */
function createEngine(config) {
	
	return function render(filename, options, callback) {
		console.log(filename);

		try {

			fs.readFile(filename, (err, data) => {

				if(err)
					throw err;

				let markup= data.toString();

				markup= compile(markup, config)(options);

				callback(null, markup);
			});

		} catch(e) { console.error(e); }
	};
}

// const app= require('express')();

// app.set('views', require('path').resolve('../'));
// app.set('view engine', 'ejs');
// app.engine('ejs', createEngine({}));

// app.get('/', (req, res) => {
// 	res.render("index", {
// 		title: "Awesomeness",
// 		name: "World"
// 	});
// });

// app.listen(8080, () => console.log("listening"));


module.exports= createEngine;