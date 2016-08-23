/*
 * SUPREME COURT NAIVE BAYES CLASSIFIER
 *
 * Predicts the outcome of U.S. Supreme Court cases using a Naive Bayes
 * classifier.
 *
 * © 2016 Cory McCartan.
 */

let args = require("yargs")
    .default("feature_file", "data/features.csv")
    .default("threshold_file", "data/thresholds.csv")
    .help("h").alias("h", "help")
    .argv;
let csv = require("fast-csv");

function main() {
    Promise.all([
        loadCSV(args.feature_file),
        loadCSV(args.threshold_file)
    ]).then(([data, _thresholds]) => {
        let prior = +_thresholds[0].likelihood;
        let thresholds = _thresholds.slice(1);

        // split train/test
        let amount = Math.ceil(0.1 * data.length);
        let test_data = data.slice(0, amount);
        let train_data = data.slice(amount);

        let [
            accuracy,
            precision,
            recall,
            positive_rate
        ] = evaluate(prior, thresholds, test_data);

        console.log(`ACCURACY: ${(100 * accuracy).toFixed(2)}%`);
        console.log(`PRECISION: ${(100 * precision).toFixed(2)}%`);
        console.log(`RECALL: ${(100 * recall).toFixed(2)}%`);
        console.log(`POSITIVE RATE: ${(100 * positive_rate).toFixed(2)}%`);
    });
}

function evaluate(prior, thresholds, data) {
    let accuracy = 0;
    let positive_rate = 0;
    let precision = 0;
    let precision_n = 0;
    let recall = 0;
    let recall_n = 0;
    for (let entry of data) {
        let predicted = Math.round(predict_boolean(entry, prior, thresholds));
        positive_rate += predicted;
        let actual = +entry.side;
        accuracy += predicted === actual ? 1 : 0;
        if (predicted === 1) {
            precision += predicted === actual ? 1 : 0;
            precision_n++;
        }
        if (actual === 1) {
            recall += predicted === actual ? 1 : 0;
            recall_n++;
        }
    }
    accuracy /= data.length;
    positive_rate /= data.length;
    precision /= precision_n;
    recall /= recall_n;

    return [accuracy, precision, recall, positive_rate];
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
