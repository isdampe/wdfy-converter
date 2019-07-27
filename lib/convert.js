const fs = require("fs");
const cheerio = require("cheerio");
const wget = require("node-wget-promise");
const url = require("url");
const mkdirp = require("mkdirp");

const ASSET_MATCH_URI = ["cdn.multiscreensite.com"];
const ASSET_MATCH_TAGS = ["href", "content", "data-background-image", "src",
	"data-dm-image-path"];

class Converter
{
	constructor(directory) {
		this.baseDir = directory;
		this.sourceFiles = [];
		this.directory = directory;
		this.jobs = [];
	}

	async process() {
		console.log(`Finding source files...`);
		this.findFiles();
		console.log(`Done. Found ${this.sourceFiles.length} files to scan.`);
		console.log(`Scanning files...`);
		this.findAssets();
		console.log(`Done. Found ${this.jobs.length} files that need to be downloaded.`);
		await this.fetchFiles();		
		console.log(`Done. Updating links...`);
		this.updateLinks();
	}

	findFiles() {
		const files = fs.readdirSync(this.directory);
		for (let file of files) {
			if (file.indexOf(".") < 0)
				continue;

			let ext = file.substr(file.lastIndexOf("."));
			if (ext == ".html")
				this.sourceFiles.push(`${this.directory}/${file}`);
		}
	}

	findAssets() {
		for (let fp of this.sourceFiles) {
			let buffer = fs.readFileSync(fp, {"encoding": "utf-8"});
			this.parseBuffer(buffer);
		}
	}

	parseBuffer(buffer) {
		const $ = cheerio.load(buffer);
		const _this = this;

		for (let tag of ASSET_MATCH_TAGS) {
			let selector = `[${tag}]`;
			$(selector).each(function() {
				let val = $(this).attr(tag);

				for (let m of ASSET_MATCH_URI) {
					if (val.indexOf(m) > -1) {
						_this.jobs.push({
							source: _this.stripUrl(val),
							dest: null
						});
					}
				}
			});
		}
	}

	stripUrl(buffer) {
		let urls = buffer.match(/(?:ht|f)tps?:\/\/[-a-zA-Z0-9.]+\.[a-zA-Z]{2,3}(\/[^"<]*)?/g);
		if (urls.length < 1)
			return buffer;
		return urls[0].replace(/\)/g, "");
	}

	getOutDir(uri) {
		const pieces = url.parse(uri);
		let dir = pieces.pathname.substr(pieces.pathname.indexOf("/") +1, pieces.pathname.lastIndexOf("/"));
		let file = pieces.pathname.substr(pieces.pathname.lastIndexOf("/") + 1);
		let fp = `${dir}/${file}`;
		return {
			dir: dir,
			file: file,
			fp: fp
		};
	}

	async fetchFiles() {
		for (let job of this.jobs) {
			let outputDir = this.getOutDir(job.source);
			console.log(`Downloading ${job.source} to ${this.baseDir}/${outputDir.fp}`);
			mkdirp.sync(`${this.baseDir}/${outputDir.dir}`);
			await wget(job.source, {
				output: `${this.baseDir}/${outputDir.fp}`
			});
		}
	}

	updateLinks() {
		for (let fp of this.sourceFiles) {
			console.log(`Writing link changes to ${fp}`);
			let buffer = fs.readFileSync(fp, {"encoding": "utf-8"});
			let html = this.relinkBuffer(buffer);
			fs.copyFileSync(fp, `${fp}.orig`);
			fs.writeFileSync(fp, html, {"encoding": "utf-8"});
		}
	}

	relinkBuffer(buffer) {
		const $ = cheerio.load(buffer);
		const _this = this;

		for (let tag of ASSET_MATCH_TAGS) {
			let selector = `[${tag}]`;
			$(selector).each(function() {
				let val = $(this).attr(tag);

				for (let m of ASSET_MATCH_URI) {
					if (val.indexOf(m) > -1) {
						let uri = _this.stripUrl(val);
						let pieces = url.parse(uri);
						let file = pieces.pathname;
						if (file.substr(0, 1) == "/")
							file = file.substr(1);

						$(this).attr(tag, file);

					}
				}
			});
		}

		return $("html").html();
	}
}

module.exports = Converter;
