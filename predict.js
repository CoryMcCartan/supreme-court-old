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
    .default("num_justices", 9)
    .default("threshold_file", "data/thresholds.csv")
    .default("arguments_dir", "arguments/")
    .help("h").alias("h", "help")
    .argv;
let fs = require("mz/fs");
let csv = require("fast-csv");

function main() {
    Promise.all([
        loadCSV(args.threshold_file),
        loadArgument(args.case, args.arguments_dir)
    ]).then(([_thresholds, argument]) => {
        let prior = +_thresholds[0].likelihood;
        let thresholds = _thresholds.slice(1);

        // process data
        let pet = argument.side_summaries.find(s => s.side === "petitioner");
        let resp = argument.side_summaries.find(s => s.side === "respondent");
        let jus = argument.side_summaries.find(s => s.side === "justices");

        let x = {
            p_interruptions: pet.interruptions/pet.words_spoken,
            p_words: pet.words_spoken/pet.times_spoken,
            p_times: pet.times_spoken/pet.words_spoken,
            p_laughter: pet.laughter/pet.words_spoken,
            p_num_counsel: argument.petitioner.counsel.length,
            p_num_int_by: pet.num_int_by,
            r_interruptions: resp.interruptions/pet.words_spoken,
            r_words: resp.words_spoken/pet.times_spoken,
            r_times: resp.times_spoken/pet.words_spoken,
            r_laughter: resp.laughter/pet.words_spoken,
            r_num_counsel: argument.respondent.counsel.length,
            r_num_int_by: resp.num_int_by,
            j_interruptions: jus.interruptions/pet.words_spoken,
            j_words: jus.words_spoken/pet.times_spoken,
            j_times: jus.times_spoken/pet.words_spoken,
            j_laughter: jus.laughter/pet.words_spoken,
            j_num: args.num_justices,
            j_num_int_by: jus.num_int_by,
        };

        let prob = predict_boolean(x, prior, thresholds);

        console.log("==========================================");
        console.log(`Case No. ${argument.caseNumber}`);
        console.log(`${argument.petitioner.name} v. ${argument.respondent.name}`);
        console.log("");
        console.log("Chance of favorable ruling:");
        console.log(`${argument.petitioner.name} (Petitioner):   ${Math.round(100 * prob)}%`);
        console.log(`${argument.respondent.name} (Respondent):   ${Math.round(100 - 100 * prob)}%`);
        console.log("=========================================");
    });
}

function predict_boolean(entry, prior, thresholds) {
    let prob = prior;

    for (let variable of thresholds) {
        if (+entry[variable.key] <= +variable.threshold)
            prob *= (1 - +variable.likelihood) / (1 - +variable.evidence);
        else
            prob *= +variable.likelihood / +variable.evidence;
    }

    return prob;
}

function predict(entry, prior, thresholds) {
    let prob_pet = prior;
    let prob_resp = 1 - prior;

    for (let variable of thresholds) {
        let value = +entry[variable.key];
        prob_pet *= norm(value, +variable.mean_pet, +variable.var_pet);
        prob_resp *= norm(value, +variable.mean_resp, +variable.var_resp);
    }

    return prob_pet / (prob_pet + prob_resp); // normalize
}

function norm(value, mean, variance) { 
    let normalizing = Math.pow(2 * Math.PI * variance, -0.5); 
    let exponential = Math.exp(-Math.pow(value - mean, 2) / (2 * variance));

    return normalizing * exponential;
}

function loadCSV(path) {
   let data = [];

   return new Promise((resolve, reject) => {
       csv.fromPath(path, {headers: true})
       .on("data", d => data.push(d))
       .on("end", () => {
           resolve(data);
       })
       .on("error", e => {
           reject(e);
       });
   });
}

function loadArgument(case_no, arg_dir) {
    let filename = arg_dir + case_no + ".json";

    return new Promise(resolve => {
        fs.readFile(filename, "utf-8").then(text => {
            resolve(JSON.parse(text));
        });
    });
}

function pad(str, n) {
    return (str + new Array(n).fill(" ").join("")).slice(0, n);
}

if (require.main === module) { // called directly as a script
    main(); 
}
else
    module.exports = {
        evaluate,
    };
