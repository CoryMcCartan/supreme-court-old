function main() {
    loadCases();
    setupScrolling();
}

function loadCases() {
    const recentCases = innerWidth > 800 ? 8 : innerWidth > 460 ? 6 : 4;

    Promise.all([
        fetch("data/predictions.csv").then(r => r.text()),
        fetch("data/features.csv").then(r => r.text()),
    ])
    .then(([p_text, f_text]) => {
        let predictions = d3.csvParse(p_text, row => {
            let obj = {
                caseNumber: row.caseNumber,
                date: new Date(row.date),
                petitioner: row.petitioner,
                respondent: row.respondent,
                prob: +row.prob,
                correct: +row.correct,
            };

            if (isNaN(obj.date))
                obj.date = new Date("1/1/2000");

            obj.petitioner = obj.petitioner.replace(", ET AL.", " et al. ");
            obj.respondent = obj.respondent.replace(", ET AL.", " et al. ");
            obj.petitioner = obj.petitioner.split(",")[0];
            obj.respondent = obj.respondent.split(",")[0];
            if (obj.respondent.endsWith("."))
                obj.respondent = obj.respondent.slice(0, -1);


            return obj;
        });

        let features = d3.csvParse(f_text);

        window.predict = predict.bind(window, predictions, features);

        if (location.search.length)
            predict(location.search.slice(1));

        let predictInput = function() {
            predict(this.value);
        };
        $("#case-select").addEventListener("input", predictInput);
        $("#case-select").addEventListener("change", predictInput);

        // newest to oldest
        predictions.sort((a, b) => b.date - a.date); 

        let recent = predictions.slice(0, recentCases);
        initRecent(recent);

        setupAutocomplete(predictions);
    });
}

function predict(predictions, features, caseNumber) {
    caseNumber = caseNumber.split(/ +/)[0];
    smoothScroll($("#predict").getBoundingClientRect().top);

    let case_features = features.find(f => f.caseNumber === caseNumber);
        if (!case_features) return;
    let prediction = predictions.find(p => p.caseNumber === caseNumber);

    $("#caseNo").innerHTML = "dkt. " + caseNumber;
    $("#p_name").innerHTML = prediction.petitioner + ", Petitioner";
    $("#r_name").innerHTML = prediction.respondent + ", Respondent";
    $("#p_prob").innerHTML = 10 * Math.round(10 * prediction.prob) + "%";
    $("#r_prob").innerHTML = 10 * Math.round(10 - 10 * prediction.prob) + "%";

    let predicted = Math.round(prediction.prob) ? "#p_actual" : "#r_actual"
    let other = Math.round(prediction.prob) ? "#r_actual" : "#p_actual"
    if (prediction.correct === 0) {
       $(other).innerHTML = "<b>&times;</b>"
       $(predicted).innerHTML = "";
    }
    else if (prediction.correct === 1) {
       $(predicted).innerHTML = "<b>&times;</b>"
       $(other).innerHTML = "";
    }
}

function initRecent(recent) {
    let list = d3.select("ul.case-list")
        .selectAll("li")
        .data(recent)
        .enter()
        .append("li");

    list.on("click", d => predict(d.caseNumber));

    list
        .append("h2")
        .text(d => "dkt. " + d.caseNumber);
    list
        .append("div")
        .classed("winning", d => Math.round(d.prob))
        .classed("right", d => d.correct === 1)
        .classed("wrong", d => d.correct === 0)
        .classed("party", true)
        .text(d => d.petitioner);
    list
        .append("div")
        .attr("class", "vs")
        .text("v.");
    list
        .append("div")
        .classed("winning", d => Math.round(1 - d.prob))
        .classed("right", d => d.correct === 1)
        .classed("wrong", d => d.correct === 0)
        .classed("party", true)
        .text(d => d.respondent);
}

function setupAutocomplete(cases) {
    cases = cases.map(c => `${pad(c.caseNumber, 10)} ${c.petitioner} v. ${c.respondent}`.trim());
    new autoComplete({
        selector: "input#case-select",
        minChars: 2,
        source: (term, suggest) => {
            term = term.toLowerCase();
            suggest(cases.filter(c => c.toLowerCase().includes(term)));
        },
        onSelect: (e, term) => predict(term),
    });
}

function setupScrolling() {
    let links = $$("nav a");
    for (let link of links) {
        link.addEventListener("click", function() {
            let el_y = $(link.hash).getBoundingClientRect().top;
            smoothScroll(el_y);
        });
    }

    let button = $("button.nav")
    button.style.color = "rgba(255, 255, 255, 0.5)";
    setTimeout(() => button.style.transition = "color 250ms", 1200);
    button.addEventListener("click", function(e) {
        smoothScroll(innerHeight + 10); // scroll whole page 
        button.style.color = "transparent";
        setTimeout(() => button.remove(), 250);
    });
}

function smoothScroll(target) {
    const current = window.scrollY;
    let maxScroll = Math.ceil($("html").getBoundingClientRect().height - innerHeight);
    target = Math.min(target, maxScroll);
    const distance = Math.abs(target - current);
    const direction = Math.sign(target - current);
    const time = Math.sqrt(distance) * 5; // in ms

    const factor = time / 2*Math.PI;

    let start;
    let update = function(now) {
        if (!start) start = now;
        let progress = now - start;

        let y = current + direction * distance * (1 - Math.cos(progress / factor))/2;
        if (y - target > -2) return;

        window.scrollTo(0, y|0);

        requestAnimationFrame(update);
    };

    requestAnimationFrame(update);
}

window.$ = s => document.querySelector(s);
window.$$ = s => document.querySelectorAll(s);

function pad(str, n) {
    return (str + new Array(n).fill(" ").join("")).slice(0, n);
}

if (navigator.serviceWorker) {
    navigator.serviceWorker.register("service-worker.js", {
        scope: location.pathname.replace("index.html", "")
    }).then(() => {
        console.log("Service Worker Registered.");
    })
}

document.addEventListener("readystatechange", function(e) {
    if (document.readyState === "complete")
        main();
});
