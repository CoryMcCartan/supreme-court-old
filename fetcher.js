/*
 * SUPREME COURT ORAL ARGUMENT FETCHER
 *
 * Fetches new oral argument transcripts from the Supreme Court website and 
 * parses them.
 *
 * © 2016 Cory McCartan.
 */

let args = require("yargs")
    .demand("case").alias("c", "case")
    .default("argument_dir", "arguments")
    .help("h").alias("h", "help")
    .argv;
let fs = require("mz/fs");
let fetch = require("node-fetch");
let cheerio = require("cheerio");
let parser = require("./parser.js")

fetch("https://www.supremecourt.gov/oral_arguments/argument_transcript.aspx")
    .then(r => r.text())
    .then(html => {
        let $ = cheerio.load(html);

        let cases = $("table.datatables td:first-child").not("[scope]");
        let match = cases.filter(function() {
            return $(this).find("a").text().trim() === args.case + ".";
        });
        if (!match) {
            console.log(`Case No. ${args.case} not found.`);
            return;
        }
        let url = match.find("a").attr("href");
        url = "https://www.supremecourt.gov/oral_arguments/" + url;

        parser.loadArgument(url).then(argument => {
            console.log(`Parsed case No. ${argument.caseNumber} successfully.`);
            fs.writeFile(`${args.argument_dir}/${argument.caseNumber}.json`, JSON.stringify(argument));
        });
    })
    .catch(e => console.log(e));

