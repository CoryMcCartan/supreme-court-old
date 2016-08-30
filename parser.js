/*
 * SUPREME COURT ORAL ARGUMENT PARSER
 *
 * Reads list of oral argument URLs from text file, then fetches them, extracts
 * the text, and parses them.  Information such as the names of the counsel,
 * case number, date, and various text metrics (such as words spoken or the
 * number of times interrupted) are collected.  Individual parsed arguments are 
 * outputted to JSON files in a separate folder, while the text metrics are also
 * aggregated and stored in a CSV file for analysis.
 *
 * © 2016 Cory McCartan.
 */

let args = require("yargs")
    .default("s", 0).alias("s", "start")
    .default("l", 4).alias("l", "length")
    .default("url_list", "data/train_urls.txt")
    .default("feature_file", "data/features.csv")
    .default("outcomes_file", "data/outcomes.csv")
    .default("argument_dir", "arguments")
    .help("h").alias("h", "help")
    .argv;
let fs = require("mz/fs");
let csv = require("fast-csv");
let util = require("./util.js");
try {
    require("pdfjs-dist/build/pdf.combined"); // will throw an error about 'fake workers' b/c of node
} catch(e) { console.log(e); }

// To reduce complexity, the parser always refers to parties as either
// petitioners or respondents.  But in real life they are called different
// things depending on the exact nature of the case. 
const PET_RESP = {petitioner: "petitioner", respondent: "respondent"}, 
      APPEL = {petitioner: "appellant", respondent: "appellee"};

function * main() {
    let outcomes = yield util.loadCSV(args.outcomes_file); 
    let featureSummary = yield util.loadCSV(args.feature_file); 
    yield* loadArguments(outcomes, featureSummary); // load and parse the argument PDFs
}

function * loadArguments(outcomes, featureSummary) {
    let text = yield fs.readFile(args.url_list, "utf-8");
    // process a subset of URLs, if specified
    let startIndex = args.start;
    let stopIndex = startIndex + args.length;
    let urls = text.split("\n").slice(startIndex, stopIndex);

    let count = 0; // keep track of how many PDFs we have parsed
    for (let url of urls) {
        let idx = startIndex++; // and which index we are on (so the user knows where to restart after stopping)

        let pages = yield getArgumentText(url);
        if (!pages.length) {
            console.log(`${++count}  ${idx}   Not loaded`);
            continue;
        }
        let argument;
        // PDFs are so inconsistent that it's much safer to wrap in try...catch
        try {
            argument = parseTranscript(pages); // do basic parsing
            argument = extractFeatures(argument); // calculate text metrics
        } catch (e) {
            console.log(e);
            console.log(`${++count}  ${idx}   Skipping case`);
            continue;
        }
        if (!("caseNumber" in argument)) { // Something has gone horribly wrong
            console.log(`${++count}  ${idx}   Skipping case`);
            continue;
        }


        // find the matching entry in our historical list of cases
        let outcome = outcomes.find(o => o.docket === argument.caseNumber); 
        if (!outcome) { // for some reason, the list is partially incomplete
            console.log(`${++count}  ${idx}   Outcome not found: ${argument.caseNumber}`);
            continue;
        }

        argument.outcome = { // we really only care about who wins and by how much
            side: +outcome.partyWinning ? "petitioner" : "respondent",
            margin: +outcome.majVotes - +outcome.minVotes
        };

        if (argument.text.trim() === "") {// couldn't read text properly
            console.log(`${++count}  ${idx}   No argument text parsed: ${argument.caseNumber}.`);
            continue;
        }
        delete argument.text

        argument = condenseText(argument);

        // helper variables
        let pet = argument.side_summaries.find(s => s.side === "petitioner");
        let resp = argument.side_summaries.find(s => s.side === "respondent");
        // some problem in matching counsel names to their words,
        // usually. (If the court reporter mispelled the name, for example)
        if (pet.words_spoken === 0 || resp.words_spoken === 0) {
            console.log(`${++count}  ${idx}   Argument text not parsed correctly: ${argument.caseNumber}`);
            continue;
        }

        let features = createFeatures(argument);
        features.side = argument.outcome.side === "petitioner" ? 1 : 0;
        features.margin = argument.outcome.margin;
        features.j_num = +outcome.majVotes + +outcome.minVotes;
        argument.num_jusitces = features.j_num;
        featureSummary.unshift(features);

        console.log(`${++count}  ${idx}   Parsed case No. ${argument.caseNumber} successfully.`);
        fs.writeFile(`${args.argument_dir}/${argument.caseNumber}.json`, JSON.stringify(argument));
    }
    
    // remove duplicates
    featureSummary = featureSummary.filter((f, i, fs) => {
        return fs.findIndex(x => x.caseNumber === f.caseNumber) === i;
    });
    util.writeCSV(args.feature_file, featureSummary);
    console.log("DONE.");
}

function createFeatures(argument) {
    // helper variables
    let pet = argument.side_summaries.find(s => s.side === "petitioner");
    let resp = argument.side_summaries.find(s => s.side === "respondent");
    let jus = argument.side_summaries.find(s => s.side === "justices");

    // pick which data points we want to have in our aggregated list
    return {
        caseNumber: argument.caseNumber,
        p_minus_r: (pet.interruptions - resp.interruptions)/pet.words_spoken,
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
        j_num_int_by: jus.num_int_by,
    };
}

function loadArgument(url) {
return new Promise((resolve, reject) => {
    getArgumentText(url).then(pages => {
        let argument;
        // PDFs are so inconsistent that it's much safer to wrap in try...catch
        try {
            argument = parseTranscript(pages); // do basic parsing
            argument = extractFeatures(argument); // calculate text metrics
        } catch (e) {
            reject(e);
            return;
        }
        if (!("caseNumber" in argument)) { // Something has gone horribly wrong
            reject("Skipping case");
            return;
        }

        if (argument.text.trim() === "") {// couldn't read text properly
            reject(`No argument text parsed: ${argument.caseNumber}.`);
            return;
        }
        delete argument.text

        argument = condenseText(argument);

        resolve(argument)
    }).catch(e => {
        resolve(e);
    });
});
}

function parseTranscript(pages) {
    mode = PET_RESP; // names wil be 'petitioner' and 'respondent'
    let argument = {
        petitioner: {
            name: "",
            counsel: [],
        },
        respondent: {
            name: "",
            counsel: [],
        },
    };
    let id_ctr = -1; // unique IDs for every person who speaks
    let people = []; // list of people

    // parse first page(s) for basic information
    let tocPage = pages.findIndex(page => page.includes("C O N T E N T S")); // identify end of starting pages
    if (tocPage < 0) tocPage = 1;
    let infoPage = pages.slice(0, tocPage).join("");

    let box = infoPage 
    .split(/\s+-?(?: -)+ ?x\s+/gi)[1] // get box on page
    .split(/\s+:\s+/); // split by line, approximately
    let inx_p = box.findIndex(t => t.toLowerCase().includes(mode.petitioner)); // find where petitioner is mentioned
    let inx_r = box.findIndex(t => t.toLowerCase().includes(mode.respondent)); //  ''   ''   responent  ''  ''
    if (inx_p < 0 && inx_r < 0) { // if not found, try using appellant/appellee
        mode = APPEL;
        inx_p = box.findIndex(t => t.toLowerCase().includes(mode.petitioner)); // and do the same thing
        inx_r = box.findIndex(t => t.toLowerCase().includes(mode.respondent));
    }
    // last-ditch
    if (inx_p < 0) inx_p = box.findIndex(t => t.includes("No. ")) - 1; // assume petitioner named first
    if (inx_r < 0) inx_r = box.length; // and respondent named last
    // extract names & remove trailing comma
    inx_no = box.findIndex(t => t.includes("No. "));
    inx_vs = box.findIndex(t => t.toLowerCase().includes("v."));
    argument.petitioner.name = box.slice(0, inx_p).join(" ").trim().slice(0, -1); 
    if (inx_no > inx_vs) {
        argument.respondent.name = box.slice(inx_no, inx_r).join(" ").split("\n").slice(1).join(" ").trim().slice(0, -1);
    } else {
        argument.respondent.name = box.slice(inx_no + 1, inx_r).join(" ").trim().slice(0, -1);
    }

    // extract case number
    matches = box.join("").match(/No\.\s+(\d\d-\d+)/);
    if (!matches) return {};
    argument.caseNumber = matches[1];

    // extract date
    let dateStr = infoPage.split("Washington, D.C.")[1].trim().split("\n")[0];
    argument.date = new Date(dateStr);

    // get names of counsel
    let appearances = infoPage.split("APPEARANCES:")[1].trim(); // second half of info page is list of counsel
    let list = appearances.split(".\n"); // split by each counsel's entry
    for (let entry of list) {
        // regex for names:      prefix     first name  M.I. (s)      last name
        let name = entry.match(/^(?:\w+\. )?([A-Z\-]+) (?:(?:\w\.?)+ )?([A-Z\-' ]+),/mi);
        if (!name) continue;
        // figure out who they are arguing for
        let side;
        let elc = entry.toLowerCase();
        if (elc.includes(mode.petitioner)) {
            side = "petitioner";
        } else if (elc.includes(mode.respondent) || elc.includes("private parties")) {
            side = "respondent";
        } else if (elc.includes("reversal") || elc.includes("vacatur")) {
            side = "petitioner"; 
        } else if (elc.match(/judge?ments? below/)) {
            side = "respondent";
        } else if (elc.includes("federal government") || elc.includes("united states")) {
            let pet_name = argument.petitioner.name.toLowerCase();
            let resp_name = argument.respondent.name.toLowerCase();
            if (pet_name.includes("secretary of") || pet_name.includes("united states")) { side = "petitioner";
            } else if (resp_name.includes("secretary of") || resp_name.includes("united states")) {
                side = "respondent";
            } else {
                console.log("SIDE? " + entry);
                side = "";
            } 
        } else {
            console.log("SIDE? " + entry);
            side = "";
        }

        if (side.length) // not blank
            argument[side].counsel.push(++id_ctr); // store their ID 
        // and create a new entry for them in the list of people
        people.push({
            id: id_ctr,
            fullName: name[0].slice(0, -1), // remove trailing comma after name
            firstName: name[1],
            lastName: name[2],
            counsel: true,
            justice: false,
            side,
        }); 
    }

    // find pages in PDF where the argument occurs
    let argumentsPage = pages.findIndex(page => page.includes("P R O C E E D I N G S"));
    let lastPage = pages.findIndex(page => page.match(/[(\[]Whereupon,? at \d/i));
    // extract those pages and combine into text
    let text = pages.slice(argumentsPage, lastPage + 1).join("");
    text = text.split("P R O C E E D I N G S")[1];
    text = text.split(/\(Whereupon,? at \d/i)[0];
                      // refine text
                      argument.text = text;
                      // break text into list of speakers
                      //                                    name, then :             make newlines spaces and get rid of timestamp
                      let raw_speakers = text.split(/\n([\.A-Z]+ [ A-Za-z\-']+):\s+/).map(t => t.replace(/\n/g, " ").trim()).slice(1);
                      let speakers = new Array(raw_speakers.length / 2);
                      // parse speaker list. the regex split means that names of people alternate with what they say
                      let last = -1
                      speakers = raw_speakers.reduce((p, c, i) => {
                          if (i % 2 === 0) { // even numbers: speaker name
                              p[i/2] = {
                                  name: c,
                              };
                              let name = c.split(" "); // split name up into pieces
                              let lastName = name.slice(-1)[0];
                              let index = people.findIndex(p => c.includes(p.lastName)) // find matching person entry
                              if (index < 0) // new person
                                  index = people.push({
                                      id: ++id_ctr,
                                      fullName: c, // remove trailing comma
                                      lastName,
                                      counsel: false,
                                      justice: c.includes("JUSTICE"),
                                      side: c.includes("JUSTICE") ? "justices" : "",
                                  }) - 1; 

                                  p[i/2].id = index;
                                  p[i/2].spokeBefore = last;
                                  if (last >= 0)
                                      p[i/2].sideBefore = people[last].side;
                                  else 
                                      p[i/2].sideBefore = "none";
                                  last = p[i/2].id;
                          } else { // odd numbers: text
                              // sometimes text inclues heading information about oral arguments
                              p[(i-1)/2].text = c.split(/ORAL ARGUMENT OF|REBUTTAL ARGUMENT OF/)[0]; 
                          }

                          return p;
                      }, speakers);
                      argument.speakers = speakers;

                      argument.people = people;


                      return argument;
}

function extractFeatures(argument) { 
    // helper function
    let blankArray = () => new Array(argument.people.length).fill(0);

    // count various features
    let interruptions = blankArray();
    let words_spoken = blankArray();
    let times_spoken = blankArray();
    let laughter = blankArray();
    let interruptedBy = blankArray().map(() => new Set())
    let i = 0; // counter variable
    for (let speaker of argument.speakers) {
        if (speaker.text.endsWith("--") || speaker.text.endsWith("- -")) {
            interruptions[speaker.id]++;
            let interruptor = argument.speakers[i + 1].id; // who interrupted the speaker
            interruptedBy[speaker.id].add(interruptor);
        }
        words_spoken[speaker.id] += speaker.text.split(/\s+/).length;
        times_spoken[speaker.id]++;
        if (speaker.text.match(/(laughter.?)/i))
            laughter[speaker.id]++;

        i++;
    }

    // add text information to list of people
    argument.people = argument.people.map((p, i) => {
        p.words_spoken = words_spoken[i];
        p.interruptions = interruptions[i];
        p.times_spoken = times_spoken[i];
        p.laughter = laughter[i];
        p.num_int_by = interruptedBy[i].size;

        return p;
    });

    // consolidate sides--if two counsel argue for petitioner, combine their metrics into one
    let getValue = (side, key) => argument.people.reduce((p, c) => c.side === side ? p + c[key] : p, 0); // helper func.
    let sides = ["petitioner", "respondent", "justices"];
    argument.side_summaries = sides.map(side => ({
        side,
        interruptions: getValue(side, "interruptions"),
        words_spoken: getValue(side, "words_spoken"),
        times_spoken: getValue(side, "times_spoken"),
        laughter: getValue(side, "laughter"),
        // combine list of people who interrupted the speakers, remove duplicates, and count the total length (messy)
        num_int_by: new Set(argument.people.reduce((p, c, i) => c.side === side 
            ? p.concat(Array.from(interruptedBy[i])) : p, [])).size,
    }));

    return argument;
}

/*
 * Create a text list for justices only
 */
function condenseText(argument) {
    argument.speakers = argument.speakers.filter(s => argument.people[s.id].justice);
    return argument;
}

/*
 * Fetch PDFs from the internet and extract raw text information
 */
function getArgumentText(url) {
return new Promise((resolve, reject) => {
    try {
        PDFJS.getDocument(url)
        .then(pdf => {
            let promises = [];
            let caseyr = +url.split("argument_transcripts/")[1].slice(0, 2);
            for (let pg = 1; pg <= pdf.numPages; pg++) {
                promises.push(
                    pdf.getPage(pg).then(processPage.bind(this, caseyr))
                );
            }

            Promise.all(promises).then(resolve);
        }).catch(reject);
    } catch(e) {
        reject(e);
    }
});
}

/*
 * Turn raw PDF text information into actual string.
 */
function processPage(num, page) {
return new Promise(resolve => {
    page.getTextContent().then(textContent => {
        let text_array = textContent.items.map(item => item.str.trim()); // list of all bits of text

        let hyphen_char = String.fromCharCode(173); // sometimes hyphens use an alternate character
        let nbsp_char = String.fromCharCode(160); // sometimes a non-breaking space is used

        text_array = text_array.filter(item => item !== ""); // ensure adequate whitespace
        let startIndex = text_array.findIndex(t => t.startsWith("Official")) + 1; // filter out header
        let stopIndex = text_array.findIndex(t => t === "Alderson Reporting Company"); // filter out footer
        if (stopIndex - startIndex < 5) stopIndex = text_array.length; // sometimes footer comes first
        text_array = text_array.slice(startIndex, stopIndex); // remove page number, header, and footer

        text_array = text_array.map(item => item
                    .replace(new RegExp(nbsp_char, "g"), " ") // non-breaking space replace
                    .replace(new RegExp(hyphen_char, "g"), "-")); // hyphens not working for some reason
                    
        // remove line and pagenumbers
        text_array = text_array.map(item => {
            let split = item.split("   ");
            let years = [2000 + num, 2001 + num, 2002 + num, 2003 + num];
            if (+item === parseInt(item) && !isNaN(+item) 
                && !years.includes(+item))
                return "\n"; // replace numbers with new lines
            else if (+split[0] && !years.includes(+split[0]))
                return item.split("   ")[1] || ""; // line number embedeed at beginning
            else
                return item;
        });

        let join_char = " ";
        let avg_txt_item_length = text_array.reduce((p, c) => p + c.length, 0) / text_array.length; 
        if (avg_txt_item_length > 10) // by sentence instead of by word
            join_char = "\n";

        resolve(text_array.join(join_char).replace(/\s*(\n)+\s*/g, "\n")); // remove extra spaces around newlines
    });
});
}


if (require.main === module) { // called directly as a script
    util.runAsyncFunction(main); 
    (function wait () { // so that we don't exit before callback
        setTimeout(wait, 1000);
    })();
}
else
    module.exports = {
        createFeatures,
        loadArguments,
        loadArgument,
    };
