/*
 * SUPREME COURT NAIVE BAYES THRESHOLD FINDER
 *
 * For every feature in a data file, computes and outputs the optimal threshold
 * for splitting the data for a Naive Bayes classifier.
 *
 * © 2016 Cory McCartan.
 */

let args = require("yargs")
    .default("k", 10)
    .default("n", 150).alias("n", "num_steps")
    .default("o", 100).alias("o", "optimize_steps")
    .default("feature_file", "data/features.csv")
    .default("out_file", "data/thresholds.csv")
    .help("h").alias("h", "help")
    .argv;
let bayes = require("./bayes.js");
let util = require("./util.js");
let optimizer = require("./lib/nelder-mead.js");

const PETITIONER = 1;
const RESPONDENT = 0;

function * main() {
    let data = yield util.loadCSV(args.feature_file);

    util.prepData(data);

    let accuracy = 0;
    let precision = 0;
    let recall = 0;
    let positive_rate = 0;
    let thresholds = [];

    for (let [train_data, test_data] of util.crossValidate(data, args.k)) {
        thresholds = findThresholds(train_data, thresholds.slice(1));
        //thresholds = findThresholds(train_data);

        let [
            t_accuracy,
            t_precision,
            t_recall,
            t_positive_rate
        ] = bayes.evaluate(thresholds[0].likelihood, thresholds.slice(1), test_data);

        console.log(`TEST ${Math.round(100 * t_accuracy)}%`);
        accuracy += t_accuracy / args.k;
        precision += t_precision / args.k;
        recall += t_recall / args.k;
        positive_rate += t_positive_rate / args.k;

        console.log("");
    }

    console.log("");
    console.log(`ACCURACY: ${(100 * accuracy).toFixed(2)}%`);
    console.log(`PRECISION: ${(100 * precision).toFixed(2)}%`);
    console.log(`RECALL: ${(100 * recall).toFixed(2)}%`);
    console.log(`POSITIVE RATE: ${(100 * positive_rate).toFixed(2)}%`);

    util.writeCSV(args.out_file, thresholds);
}

function findThresholds(data, _thresholds = []) {
    let x_keys = [
        "p_minus_r",
        "counsel_difference",
        "p_interruptions",
        "p_words",
        "p_times",
        "p_laughter",
        "p_num_counsel",
        "p_num_int_by",
        "r_interruptions",
        "r_words",
        "r_times",
        "r_laughter",
        "r_num_counsel",
        "r_num_int_by",
        "j_interruptions",
        "j_words",
        "j_times",
        "j_laughter",
        "j_num",
        "j_num_int_by",
    ];

    let force_thresholds = {
        "j_num": 8.5,
    };

    let thresholds = [];
    let prior = util.mean(data, "side");
    if (_thresholds.length) {
       thresholds = _thresholds; 
    } else {
        for (let key of x_keys) {
            let [
                threshold,
                likelihood,
                evidence,
                mean_pet,
                var_pet,
                mean_resp,
                var_resp,
            ] = baselineThreshold(data, key, force_thresholds[key]);

            thresholds.push({
                key,
                threshold,
                likelihood,
                evidence,
                mean_pet,
                var_pet,
                mean_resp,
                var_resp,
            });
        }
    }

    console.log(`PRIOR ACCURACY ${Math.round(100 * bayes.evaluate(prior, thresholds, data)[0])}%`);

    for (let variable of thresholds) {
        if (variable.key in force_thresholds)
            continue;
        variable = optimizeThreshold(data, variable, thresholds, prior);
    }

    let n = thresholds.length;
    let func = thresh => {
        for (let i = 0; i < n; i++) {
            if (thresholds[i].key in force_thresholds)
                continue;
            thresholds[i].threshold = thresh[i]; 
        }

        let [accuracy, , , positive_rate] = bayes.evaluate(prior, thresholds, data);
        return -accuracy - 0.1*Math.abs(prior - positive_rate);    
    };
    let bounds = x_keys.map(key => util.range(data, key))

    let results = optimizer.NM(func, thresholds.map(t => t.threshold), 
                               bounds, args.optimize_steps);
    for (let i = 0; i < n; i++) {
        if (thresholds[i].key in force_thresholds)
            continue;
        thresholds[i].threshold = results.x[i]; 
    }
    console.log(`ACCURACY ${Math.round(100 * bayes.evaluate(prior, thresholds, data)[0])}%`);

    thresholds.unshift({
        key: "prior",
        threshold: 0,
        likelihood: prior,
        evidence: 0,
        mean_pet: 0,
        var_pet: 0,
        mean_resp: 0,
        var_resp: 0, 
    });

    return thresholds;
}

function baselineThreshold(data, key, override) {
    let wins_only = data.filter(x => x.side === PETITIONER);
    let threshold =  util.mean(data, key);
    if (override !== undefined)
        threshold = override;

    let likelihood = util.mean(wins_only.map(x => x[key] > threshold ? 1 : 0));
    let evidence = util.mean(data.map(x => x[key] > threshold ? 1 : 0));
    let mean_pet = util.mean(wins_only, key);
    let var_pet = util.variance(wins_only, key);
    let mean_resp = util.mean(data, key, x => x.side === RESPONDENT);
    let var_resp = util.variance(data, key, x => x.side === RESPONDENT);

    return [
        threshold,
        likelihood,
        evidence,
        mean_pet,
        var_pet,
        mean_resp,
        var_resp,
    ];
} 

function optimizeThreshold(data, variable, thresholds, prior) {
    let key = variable.key
    let [min, max] = util.range(data, key);

    let bestThreshold;
    let bestAccuracy = 0;
    let wins_only = data.filter(x => x.side === PETITIONER);
    for (let threshold of steps(min, max)) {
        variable.likelihood = util.mean(wins_only.map(x => x[key] > threshold));
        variable.evidence = util.mean(data.map(x => x[key] > threshold));
        variable.threshold = threshold;

        let [accuracy, precision, recall] = bayes.evaluate(prior, thresholds, data);

        if (accuracy > bestAccuracy) {
            bestAccuracy = accuracy;
            bestThreshold = threshold;
        }
    } 

    variable.likelihood = util.mean(wins_only.map(x => x[key] > bestThreshold ? 1 : 0));
    variable.evidence = util.mean(data.map(x => x[key] > bestThreshold ? 1 : 0));
    variable.threshold = bestThreshold;

    return variable;
}

function * steps(min, max) {
    let stepSize = (max - min) / args.num_steps;

    for (let value = min; value <= max; value += stepSize) {
        yield value;
    }
}


util.runAsyncFunction(main);
