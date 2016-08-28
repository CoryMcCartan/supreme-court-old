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
    .default("n", 9).alias("n", "num_justices")
    .default("argument_dir", "arguments")
    .help("h").alias("h", "help")
    .argv;
let fs = require("mz/fs");
let fetch = require("node-fetch");
let cheerio = require("cheerio");
let parser = require("./parser.js")
let util = require("./util.js");


function * main() {
    let make_url = yr => "https://www.supremecourt.gov/oral_arguments/argument_transcript/20" + ("0" + yr).slice(-2);

    let case_year = +args.case.split("-")[0];
    let current_year = new Date().getYear() - 100;
    for (let yr = case_year; yr <= current_year; yr++) {
        let resp = yield fetch(make_url(yr));
        let html = yield resp.text();

        let $ = cheerio.load(html);

        let cases = $("table.datatables td:first-child").not("[scope]");
        let match = cases.filter(function() {
            return $(this).find("a").text().trim().includes(args.case);
        });
        if (!match.length) {
            console.log(`Case No. ${args.case} not found.`);
            continue;
        }
        let url = match.find("a").attr("href");
        url = "https://www.supremecourt.gov/oral_arguments/argument_transcript/" + url;

        let argument = yield parser.loadArgument(url);
        argument.num_justices = args.num_justices;
        if (argument instanceof Error) continue;
        console.log(`Parsed case No. ${argument.caseNumber} successfully.`);
        fs.writeFile(`${args.argument_dir}/${argument.caseNumber}.json`, JSON.stringify(argument));
        break;
    }
}

util.runAsyncFunction(main);
