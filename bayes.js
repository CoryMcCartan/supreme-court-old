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
    .default("outcomes_file", "data/outcomes.csv")
    .default("threshold_file", "data/thresholds.csv")
    .default("all", false)
    .help("h").alias("h", "help")
    .argv;
let util = require("./util.js");

function * main() {
    let data = yield util.loadCSV(args.feature_file);
    let outcomes = yield util.loadCSV(args.outcomes_file);
    let _thresholds = yield util.loadCSV(args.threshold_file);

    data = util.prepData(data, outcomes);
    let prior = +_thresholds[0].likelihood;
    let thresholds = _thresholds.slice(1);

    // split train/test
    let amount = Math.ceil(0.1 * data.length);
    if (args.all) amount = data.length;
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
}

function evaluate(prior, thresholds, data) {
    let accuracy = 0;
    let positive_rate = 0;
    let precision = 0;
    let precision_n = 0;
    let recall = 0;
    let recall_n = 0;

    for (let entry of data) {
        let prob = predict(entry, prior, thresholds);
        let predicted = Math.round(prob);
        // close 8-justice cases => split court means affirm
        if (Math.abs(0.5 - prob) < 0.05 && entry.j_num === 8 && predicted === 1) {
            predicted = 0;
        }

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
        if (entry[variable.key] <= variable.threshold)
            prob *= (1 - variable.likelihood) / (1 - variable.evidence);
        else
            prob *= variable.likelihood / variable.evidence;
    }

    if (prob > 1) prob = 1;
    if (prob < 0) prob = 0;

    return prob;
}

function predict(entry, prior, thresholds) {
    let prob_pet = prior;
    let prob_resp = 1 - prior;

    for (let variable of thresholds) {
        let value = entry[variable.key];
        prob_pet *= util.norm(value, variable.mean_pet, variable.var_pet);
        prob_resp *= util.norm(value, variable.mean_resp, variable.var_resp);
    }

    return prob_pet / (prob_pet + prob_resp); // normalize
}

if (require.main === module) { // called directly as a script
    util.runAsyncFunction(main);
}
else
    module.exports = {
        evaluate,
        predict_boolean,
        predict,
    };
