/*
 * SUPREME COURT NAIVE BAYES CLASSIFIER
 *
 * Predicts the outcome of U.S. Supreme Court cases using a Naive Bayes
 * classifier.
 *
 * © 2016 Cory McCartan.
 */

let args = require("yargs")
    .demand("case").alias("c", "case")
    .default("n", 9).alias("n", "num_justices")
    .default("threshold_file", "data/thresholds.csv")
    .default("arguments_dir", "arguments/")
    .help("h").alias("h", "help")
    .argv;
let fs = require("mz/fs");
let bayes = require("./bayes.js");
let util = require("./util.js");
let parser = require("./parser.js");

function * main() {
    let _thresholds = yield util.loadCSV(args.threshold_file);
    let argument = yield loadArgument(args.case, args.arguments_dir);

    let prior = +_thresholds[0].likelihood;
    let thresholds = _thresholds.slice(1);

    let x = parser.createFeatures(argument);
    x.j_num = args.num_justices;

    let prob = bayes.predict_boolean(x, prior, thresholds);

    console.log("==========================================");
    console.log(`Case No. ${argument.caseNumber}`);
    console.log(`${argument.petitioner.name} v. ${argument.respondent.name}`);
    console.log("");
    console.log("Chance of favorable ruling:");
    console.log(`${argument.petitioner.name} (Petitioner):   ${Math.round(100 * prob)}%`);
    console.log(`${argument.respondent.name} (Respondent):   ${Math.round(100 - 100 * prob)}%`);
    console.log("=========================================");
}

function loadArgument(case_no, arg_dir) {
    let filename = arg_dir + case_no + ".json";

    return new Promise(resolve => {
        fs.readFile(filename, "utf-8").then(text => {
            resolve(JSON.parse(text));
        });
    });
}

if (require.main === module) { // called directly as a script
    util.runAsyncFunction(main); 
} else {
    module.exports = {
        evaluate,
    };
}
