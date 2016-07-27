let fs = require("mz/fs");
require("pdfjs-dist/build/pdf.combined");

function main() {
    getArgumentText("transcript.pdf").then(pages => {
        let argument = parseTranscript(pages);
    });
}

function parseTranscript(pages) {
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
    let id_ctr = 0;

    // parse first page(s) for basic information
    let tocPage = pages.findIndex(page => page.includes("C O N T E N T S"));
    let infoPage = pages.slice(0, tocPage).join("");

    let box = infoPage 
        .split(/\s+(?:- )+x\s+/g)[1] // get box on page
        .split(/\s+:\s+/); // split by line, approximately
    if (box[1].toLowerCase().includes("petitioner")) { // if petitioner is listed first
        argument.petitioner.name = box[0].trim().slice(0, -1); // remove extra space and trailing comma
        argument.respondent.name = box[3].trim().slice(0, -1); // remove extra space and trailing comma
    } else {
        argument.petitioner.name = box[3].trim().slice(0, -1); // remove extra space and trailing comma
        argument.respondent.name = box[0].trim().slice(0, -1); // remove extra space and trailing comma
    }

    argument.caseNumber = box[2].match(/No\.\s+(\d\d-\d\d\d)/)[1];

    let dateStr = infoPage.split("Washington, D.C.")[1].trim().split("\n")[0];
    argument.date = new Date(dateStr);

    // get names of lawyers
    let appearances = infoPage.split("APPEARANCES:")[1].trim(); // second half of info page
    let list = appearances.split(".\n");
    for (let entry of list) {
        let name = entry.match(/^(?:\w+\. )?(\w+) (?:\w\. )?(\w+),/m);
        let side = entry.split(";")[1].toLowerCase().includes("petitioner") ? "petitioner" : "respondent";
        argument[side].counsel.push({
            fullName: name[0].slice(0, -1), // remove trailing comma
            firstName: name[1],
            lastName: name[2],
            id: id_ctr++,
        });
    }

    let argumentsPage = pages.findIndex(page => page.includes("P R O C E E D I N G S"));
    let lastPage = pages.findIndex(page => page.includes("The case is submitted."));
    argument.text = pages.slice(argumentsPage, lastPage + 1).join("");

    return argument;
}

function getArgumentText(filename) {
return new Promise(resolve => {
    fs.readFile(filename)
    .then(data => PDFJS.getDocument(data))
    .then(pdf => {
        let promises = [];
        for (let pg = 1; pg <= pdf.numPages; pg++) {
            promises.push(
                pdf.getPage(pg).then(processPage.bind(this, pg))
            );
        }

        Promise.all(promises).then(resolve);
    });
});
}

function processPage(num, page) {
return new Promise(resolve => {
    page.getTextContent().then(textContent => {
        let text_array = textContent.items.map(item => item.str);

        text_array = text_array.filter(item => item.trim() !== ""); // remove whitespace
        text_array = text_array.slice(2, -1); // remove page number, header, and footer
        // remove line numbers
        let counter = 1;
        let hyphen_char = String.fromCharCode(173);
        text_array = text_array.map(item => {
            if (+item === counter) {
                counter++;
                return "\n"; // replace line numbers with new lines
            } else {
                return item.replace(new RegExp(hyphen_char, "g"), "-"); // hyphens not working for some reason
            }
        });

        resolve(text_array.join(" ").replace(/ \n /g, "\n")); // remove extra spaces around newlines
    });
});
}


main();
