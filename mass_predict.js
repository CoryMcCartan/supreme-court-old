/*
 * SUPREME COURT NAIVE BAYES CLASSIFIER
 *
 * Predicts the outcome of U.S. Supreme Court cases using a Naive Bayes
 * classifier.
 *
 * © 2016 Cory McCartan.
 */

let args = require("yargs")
    .default("threshold_file", "data/thresholds.csv")
    .default("predictions_file", "data/predictions.csv")
    .default("arguments_dir", "arguments/")
    .help("h").alias("h", "help")
    .argv;
let fs = require("mz/fs");
let bayes = require("./bayes.js");
let util = require("./util.js");
let parser = require("./parser.js");

function * main() {
    // get all json files in arguments directory
    let files = (yield fs.readdir(args.arguments_dir)).filter(f => f.endsWith(".json"));
    let predictions = yield util.loadCSV(args.predictions_file);

    let _thresholds = yield util.loadCSV(args.threshold_file);
    let prior = +_thresholds[0].likelihood;
    let thresholds = _thresholds.slice(1);

    for (let file of files) {
        let filename = args.arguments_dir + file;
        let argument;
        try {
            argument = JSON.parse(yield fs.readFile(filename, "utf-8"));
        } catch(e) {
            console.log(e);
            console.log(file);
            continue;
        }

        let x = parser.createFeatures(argument);
        x.j_num = argument.num_justices || 9;

        let prob = bayes.predict_boolean(x, prior, thresholds);

        argument.prediction = {
            petitioner: prob,
            respondent: 1 - prob,
            date: Date.now(),
        };

        let side = argument.outcome ? argument.outcome.side === "petitioner" : -1;
        predictions.unshift({
            caseNumber: argument.caseNumber,
            petitioner: argument.petitioner.name.replace(/\n/g, " ").trim(),
            respondent: argument.respondent.name.replace(/\n/g, " ").trim(),
            prob,
            correct: side !== -1 ? +side === Math.round(prob) : undefined,
        });

        fs.writeFile(filename, JSON.stringify(argument));
    }
    
    // remove duplicates
    predictions = predictions.filter((f, i, pr) => {
        return pr.findIndex(x => x.caseNumber === f.caseNumber) === i;
    });
    util.writeCSV(args.predictions_file, predictions);
    console.log("DONE.");
}

util.runAsyncFunction(main); 