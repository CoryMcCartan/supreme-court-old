/*
 * Utility functions
 */

let csv = require("fast-csv");
let fs = require("mz/fs");

const PETITIONER = 1;
const RESPONDENT = 0;

function loadCSV(path) {
   let data = [];

   return new Promise((resolve, reject) => {
       fs.exists(path).then(exists => {
           if (!exists) {
               resolve([]);
               return;
           }

           csv.fromPath(path, {headers: true})
           .on("data", d => {
               for (let key in d) {
                   if (!isNaN(+d[key]) && d[key].trim() !== "") {
                       d[key] = +d[key];
                   } else if (d[key] === "true") {
                       d[key] = true;
                   } else if (d[key] === "false") {
                       d[key] = false;
                   }
               }
               data.push(d);
           })
           .on("end", () => {
               resolve(data);
           })
           .on("error", e => {
               reject(e);
           });
       })
   });
}

function writeCSV(path, data) {
    return csv.writeToPath(path, data, {headers: true});
}

function pad(str, n) {
    return (str + new Array(n).fill(" ").join("")).slice(0, n);
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

function norm(value, mean, variance) { 
    let normalizing = Math.pow(2 * Math.PI * variance, -0.5); 
    let exponential = Math.exp(-Math.pow(value - mean, 2) / (2 * variance));

    return normalizing * exponential;
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

function prepData(data) {
    for (let entry of data) {
        entry.votes = entry.side === PETITIONER ? 
            entry.margin : entry.j_num - entry.margin;
        entry.p_minus_r = +entry.p_interruptions - +entry.r_interruptions;
    }
}

function * crossValidate(data, k=10) {
    let amount = ~~(data.length / k);

    for (let i = 0; i < k; i++) {
        let start = i * amount;
        let stop = (i+1) * amount;

        let leftSlice = data.slice(0, start);
        let testData = data.slice(start, stop);
        let rightSlice = data.slice(stop);
        let trainData = leftSlice.concat(rightSlice);

        yield [trainData, testData];
    }
}

function runAsyncFunction(generator) {
    var iterator = generator();
    var result;

    var iterate = function(value) {
        result = iterator.next(value); 

        if (!result.done) {
            // continue immediately, avoiding synchronous recursion
            if ("then" in result.value) { // is a promise
                result.value.then(iterate); // continue when done
            } else {
                setTimeout(iterate.bind(this, result.value), 0); 
            }
        }
    };

    iterate();
}

function extract(data, key, criteria) {
    // isolate feature of interest
    let array;
    if (key) {
        if (criteria)
            data = data.filter(criteria);
        array = data.map(entry => entry[key]); 
    } else {
        array = data;
    }


    return array;
}

module.exports = {
    loadCSV,
    writeCSV,
    pad,
    mean,
    variance,
    norm,
    range,
    prepData,
    runAsyncFunction,
    crossValidate,
};
