#!/usr/env/node
const convert = require("./lib/convert");

if (process.argv.length < 3) {
	console.log("Usage: wdy-convert [directory]");
	process.exit(1);
}

(async() => {
	const core = new convert(process.argv[process.argv.length -1]);
	await core.process();
})();
