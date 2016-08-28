/*
 * NELDER MEAD OPTIMIZER
 *
 * Optimizes an objective function R_n -> R using the Nelder-Mead method.
 *
 * © 2016 Cory McCartan
 */

let centroid = function(simplex) {
    let k = simplex[0].length;    
    let n = simplex.length;    

    let result = new Array(k);

    for (let i = 0; i < k; i++) {
        // mean for each dimension
        result[i] = simplex.reduce((p, c) => p + c[i] / n, 0); 
    }

    return result;
};

exports.NM = function(func, init, bounds, iter) {
    const alpha = 1; // relfection
    const gamma = 2; // expansion
    const rho = 1/2; // contraction
    const sigma = 1/2; // shrink

    // initialize simplex
    let n = init.length;
    let simplex = [];
    simplex.push(init.slice(0));
    for (let k = 0; k < n; k++) {
        let point = init.slice(0);
        point[k] += 0.20 * (bounds[k][1] - bounds[k][0]); // covers x percent of dimension
        simplex.push(point);
    }

    // perform the optimiation
    simplex = simplex.map(x => [x, func(x)]);
    for (let i = 0; i < iter; i++) {
        simplex.sort((a, b) => a[1] - b[1]); // increasing order by func. value

        let center = centroid(simplex.slice(0, -1).map(x => x[0]));  // don't include worst point
        let worst = simplex[n][0];
        let best_value = simplex[0][1];
        let second_worst = simplex[n-1][1];

        let reflected = center.map((pt, i) => pt + alpha * (pt - worst[i])); 
        let r_value = func(reflected);

        if (r_value >= best_value && r_value < second_worst) { 
            simplex[n] = [reflected, r_value];
            continue;
        } else if (r_value < best_value) {
            let expanded = center.map((pt, i) => pt + gamma * (reflected[i] - pt)); 
            let e_value = func(expanded);

            if (e_value < r_value) {
                simplex[n] = [expanded, e_value];
                continue;
            } else {
                simplex[n] = [reflected, r_value];
                continue;
            }
        } else {
            let contracted = center.map((pt, i) => pt + rho * (worst[i] - pt)); 
            let c_value = func(contracted);
            
            if (c_value < simplex[n][1]) {
                simplex[n] = [contracted, c_value]; 
            } else {
                let best = simplex[0][0];
                for (let j = 1; j < n+1; j++) {
                    simplex[j][0] = best.map((pt, i) => pt + sigma * (simplex[j][i] - pt));
                    simplex[j][1] = func(simplex[j][0]);
                }

                continue;
            }
        }
    }

    simplex.sort((a, b) => a[0] - b[0]);

    return {
        x: simplex[0][0],
        value: simplex[0][1],
    };
};
