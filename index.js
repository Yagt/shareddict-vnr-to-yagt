let fs = require("fs");
let xml2js = require("xml2js");

let DEFAULT_OUTPUT_PATH = "shareddict.json";

function main() {
  let args = process.argv;
  let options = parseArgs(args);
  checkOptions(options);

  loadUserDict(options.source, object => {
    let yagtObject = VnrToYagtFormat(object);
    saveUserDict(yagtObject, options.output);
  });
}

/**
 * Parse Arguments
 * @param {string[]} args process arguments
 * @returns {{source: string, output: string}} options
 */
function parseArgs(args) {
  if (args.length < 3 || args[2] === "-h" || args[2] === "--help") {
    printHelp();
    process.exit(0);
  }
  let options = [];
  for (let i in args) {
    i = parseInt(i);
    if (args[i] === "-s" && args.length >= i + 2) {
      options["source"] = args[i + 1];
    } else if (args[i].startsWith("--source=")) {
      options["source"] = args[i].substring(9);
    }
    if (args[i] === "-o" && args.length >= i + 2) {
      options["output"] = args[i + 1];
    } else if (args[i].startsWith("--output=")) {
      options["output"] = args[i].substring(9);
    }
  }
  return options;
}

/**
 * Print Help Page
 */
function printHelp() {
  console.log("Shared Dict VNR to Yagt v1.0.0");
  console.log("Convert VNR shared dict to Yagt format");
  console.log("USAGE: ");
  console.log("  -h  --help                    print this help page and exit");
  console.log(
    "  -s  --source=<SOURCE_PATH>    source file path (often named gamedic.xml)"
  );
  console.log(
    "  -o  --output=<OUTPUT_PATH>    output file path (default " +
      DEFAULT_OUTPUT_PATH +
      ")"
  );
}

/**
 * Check if options are legal.
 *
 * If not, print help page and exit
 * @param {{source: string, output: string}} options
 */
function checkOptions(options) {
  if (!options.source) {
    printPromptAndHelpAndExit("need to specify source file path");
  }
  if (!options.source.endsWith(".xml")) {
    printPromptAndHelpAndExit("source file needs to be a XML file");
  }
  if (!options.output) {
    options.output = DEFAULT_OUTPUT_PATH;
  }
  if (!options.output.endsWith(".json")) {
    printPromptAndHelpAndExit("output file needs to be a JSON file");
  }
}

/**
 * Print prompt and help page and then exit process
 * @param {string} prompt
 */
function printPromptAndHelpAndExit(prompt) {
  console.error(`ERROR: ${prompt}`);
  printHelp();
  process.exit(0);
}

/**
 * Load user dict from _path_
 * @param {string} path source file path
 * @param {(object: any) => void} callback callback
 * @returns {any} object
 */
function loadUserDict(path, callback) {
  let fileBuffer;
  try {
    fileBuffer = fs.readFileSync(path, { encoding: "utf8" });
  } catch (e) {
    printPromptAndExit(`file ${path} load failed`);
  }
  xml2js.parseString(fileBuffer, { explicitArray: false }, (err, result) => {
    if (err) {
      printPromptAndExit(err);
    }
    console.log(`loaded file ${path}`);
    callback(result);
  });
}

/**
 * Print prompt and then exit process
 * @param {string} prompt
 */
function printPromptAndExit(prompt) {
  console.error(`ERROR: ${prompt}`);
  process.exit(0);
}

/**
 * Save user dict to output _path_
 * @param {any} object user dict object
 * @param {string} path output file path
 */
function saveUserDict(object, path) {
  try {
    fs.writeFileSync(path, JSON.stringify(object, null, 2), {
      encoding: "utf8"
    });
    console.log(`saved to ${path}`);
  } catch (e) {
    printPromptAndExit(`file ${path} save failed`);
  }
}

/**
 * Convert VNR format to Yagt format
 * @param {any} object
 * @returns {any} object under Yagt format
 */
function VnrToYagtFormat(object) {
  let vnrFormat = object.grimoire.terms.term;
  let tempFormat = { terms: {} };
  let yagtFormat = { terms: [] };
  for (let i in vnrFormat) {
    if (
      !vnrFormat[i].sourceLanguage === "ja" ||
      !vnrFormat[i].$.type === "trans" ||
      !vnrFormat[i].text ||
      !vnrFormat[i].pattern ||
      !isNaN(vnrFormat[i].pattern) ||
      !(vnrFormat[i].pattern.length > 1)
    )
      continue; // Ignore not translation terms
    if (tempFormat.terms[vnrFormat[i].pattern]) {
      // Already has this pattern
      let existedTerm = tempFormat.terms[vnrFormat[i].pattern];
      if (existedTerm.sourceLanguage === vnrFormat[i].sourceLanguage) {
        // Same source language, do nothing
      } else if (existedTerm.multipleSourceLanguages) {
        // Already has multiple source languages
        if (
          !existedTerm.sourceLanguages.includes(vnrFormat[i].sourceLanguage)
        ) {
          existedTerm.sourceLanguages.push(vnrFormat[i].sourceLanguage);
        }
      } else {
        // First time to have multiple source languages
        existedTerm["multipleSourceLanguages"] = true;
        existedTerm["sourceLanguages"] = [];
        existedTerm.sourceLanguages.push(existedTerm.sourceLanguage);
        existedTerm.sourceLanguages.push(vnrFormat[i].sourceLanguage);
        delete existedTerm.sourceLanguage;
      }
      existedTerm[vnrFormat[i].language] = vnrFormat[i].text;
      continue;
    }

    let oneTerm = {};
    oneTerm["sourceLanguage"] = vnrFormat[i].sourceLanguage;
    oneTerm[vnrFormat[i].language] = vnrFormat[i].text;
    if (vnrFormat[i].comment) {
      oneTerm["comment"] = vnrFormat[i].comment;
    }

    if (vnrFormat[i]["regex"] === "true") {
      tempFormat.terms[`/${vnrFormat[i].pattern}/`] = oneTerm;
    } else {
      tempFormat.terms[vnrFormat[i].pattern] = oneTerm;
    }
  }

  // Convert dict to array
  for (let key in tempFormat.terms) {
    tempFormat.terms[key];
    yagtFormat.terms.push({ pattern: key, ...tempFormat.terms[key] });
  }

  return yagtFormat;
}

main();
