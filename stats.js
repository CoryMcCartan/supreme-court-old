/*
 * SUPREME COURT NAIVE BAYES THRESHOLD FINDER
 *
 * For every feature in a data file, computes and outputs the optimal threshold
 * for splitting the data for a Naive Bayes classifier.
 *
 * © 2016 Cory McCartan.
 */

let args = require("yargs")
    .default("n", 150).alias("n", "num_steps")
    .default("o", 3).alias("o", "optimize_steps")
    .default("feature_file", "data/features.csv")
    .default("out_file", "data/thresholds.csv")
    .help("h").alias("h", "help")
    .argv;
let csv = require("fast-csv");
let bayes = require("./bayes.js")

const PETITIONER = 1;
const RESPONDENT = 0;

function main() {
    loadCSV(args.feature_file).then(data => {
        prepData(data);

        // split train/test
        let amount = Math.ceil(0.1 * data.length);
        let test_data = data.slice(0, amount);
        let train_data = data.slice(amount);

        let thresholds = findThresholds(train_data);      

        console.log("");
        for (let item of thresholds) 
            console.log(`KEY: ${pad(item.key, 20)}  THRESHOLD: ${item.threshold}`);

        let [
            accuracy,
            precision,
            recall,
            positive_rate
        ] = bayes.evaluate(thresholds[0].likelihood, thresholds.slice(1), test_data);

        console.log("");
        console.log(`ACCURACY: ${(100 * accuracy).toFixed(2)}%`);
        console.log(`PRECISION: ${(100 * precision).toFixed(2)}%`);
        console.log(`RECALL: ${(100 * recall).toFixed(2)}%`);
        console.log(`POSITIVE RATE: ${(100 * positive_rate).toFixed(2)}%`);

        csv.writeToPath(args.out_file, thresholds, {headers: true});
    });
}

function prepData(data) {
    for (let entry of data) {
        entry.votes = entry.side === PETITIONER ? 
            entry.margin : entry.j_num - entry.margin;
    }
}

function findThresholds(data) {
    let x_keys = [
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

    let thresholds = [];
    let prior = mean(data, "side");
    for (let key of x_keys) {
        let [
            threshold,
            likelihood,
            evidence,
            mean_pet,
            var_pet,
            mean_resp,
            var_resp,
        ] = baselineThreshold(data, key);

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


    console.log(`PRIOR ACCURACY ${bayes.evaluate(prior, thresholds, data)[0]}`);
    for (let i = 0; i < args.optimize_steps; i++) { // several passes through data
        console.log(`\nOPTIMIZING STEP ${i+1}`);
        for (let variable of thresholds) {
            variable = optimizeThreshold(data, variable, thresholds, prior);
        }
        console.log(`ACCURACY ${bayes.evaluate(prior, thresholds, data)[0]}`);
    }

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

function baselineThreshold(data, key) {
    let wins_only = data.filter(x => +x.side === PETITIONER);
    let threshold = mean(data, key);

    let likelihood = mean(wins_only.map(x => +x[key] > threshold ? 1 : 0));
    let evidence = mean(data.map(x => +x[key] > threshold ? 1 : 0));
    let mean_pet = mean(wins_only, key);
    let var_pet = variance(wins_only, key);
    let mean_resp = mean(data, key, x => +x.side === RESPONDENT);
    let var_resp = variance(data, key, x => +x.side === RESPONDENT);

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

function findThreshold(data, key) {
    let [min, max] = range(data, key);

    let bestThreshold;
    let bestPower = -Infinity;
    let wins_only = data.filter(x => +x.side === PETITIONER);
    for (let threshold of steps(min, max)) {
        let likelihood = mean(wins_only.map(x => +x[key] > threshold));
        let evidence = mean(data.map(x => +x[key] > threshold));

        let power = Math.abs(likelihood / evidence);

        if (power > bestPower) {
            bestPower = power;
            bestThreshold = threshold;
        }
    } 

    let likelihood = mean(wins_only.map(x => +x[key] > bestThreshold ? 1 : 0));
    let evidence = mean(data.map(x => +x[key] > bestThreshold ? 1 : 0));
    let mean_pet = mean(wins_only, key);
    let var_pet = variance(wins_only, key);
    let mean_resp = mean(data, key, x => +x.side === RESPONDENT);
    let var_resp = variance(data, key, x => +x.side === RESPONDENT);

    return [
        bestThreshold,
        bestPower,
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
    let [min, max] = range(data, key);

    let bestThreshold;
    let bestAccuracy = 0;
    let wins_only = data.filter(x => +x.side === PETITIONER);
    for (let threshold of steps(min, max)) {
        variable.likelihood = mean(wins_only.map(x => +x[key] > threshold));
        variable.evidence = mean(data.map(x => +x[key] > threshold));
        variable.threshold = threshold;

        let [accuracy, precision, recall] = bayes.evaluate(prior, thresholds, data);

        if (accuracy > bestAccuracy) {
            bestAccuracy = accuracy;
            bestThreshold = threshold;
        }
    } 

    variable.likelihood = mean(wins_only.map(x => +x[key] > bestThreshold ? 1 : 0));
    variable.evidence = mean(data.map(x => +x[key] > bestThreshold ? 1 : 0));
    variable.threshold = bestThreshold;

    return variable;
}

function mean(data, key, criteria) {
    let array = extract(data, key, criteria);
    
    let sum = 0;
    let length = array.length;
    for (let i = 0; i < length; i++) {
        sum += array[i];
    }

    return sum / length;
}

function variance(data, key, criteria, sample=true, _mean) {
    let array = extract(data, key, criteria);

    if (!_mean)
        _mean = mean(array);

    array = array.map(x => Math.pow(x - _mean, 2)); // squared differences

    return mean(array);
}

function range(data, key) {
    let array = extract(data, key);

    let min = Infinity;
    let max = -Infinity;
    let length = array.length;
    for (let i = 0; i < length; i++) {
        if (array[i] < min)
            min = array[i];
        if (array[i] > max)
            max = array[i];
    }

    return [min, max];
}

function * steps(min, max) {
    let stepSize = (max - min) / args.num_steps;

    for (let value = min; value <= max; value += stepSize) {
        yield value;
    }
}

function extract(data, key, criteria) {
    // isolate feature of interest
    let array;
    if (key) {
        if (criteria)
            data = data.filter(criteria);
        array = data.map(entry => +entry[key]); 
    } else {
        array = data;
    }


    return array;
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


main();
