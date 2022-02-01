import { simpleLoopObject, questionStartRegex } from "./loop.js";
import { } from "./knownfunctions.js"
import { argparser, safe } from "./utils.js";
import { Tree } from './tree.js'


console.log("...in quest.js")

export let questionQueue = null;
export let previousResults = {};
let questions = null;
let rootElement = null;
let moduleParams = {}

export let lfInstance = {};
let lfTreeInstance = {}


export function simple_question_reduce(previous, current, indx, array) {
    if (indx % 2 == 1) previous.push(current + array[indx + 1])
    return previous
}

function grid_loop_reducer(startSign, stopSign) {
    return (previous, current) => {
        // the first question, just add...
        
        if (previous.length == 0) {
            previous.push(current)
            return previous
        }
        // if we are in a loop/grid, combine with the last...
        let last = previous.pop()
        if (last.startsWith(startSign) && !last.trim().endsWith(stopSign)) {
            last = last + current
            previous.push(last)
            return previous
        }
        // add the last back to the array
        previous.push(last)
        // and add the current to the array...
        previous.push(current)

        return previous

    }
}

export function makeSimpleQuestion(markdown) {
    /*  There are 6 (or 9) parts to the regex...
    1) \[  the opening bracket
    2) ([A-Z_]\w*) -- capture group 1 The questionId
    3) ([?!])?  -- optional capture group 2 hard/soft 
    4) \s*(?:[|,]\s*([^\]]+?))?\]([\s\S])+ == handle the arguments
        4a) \s* eat up white space
        4b) [|,]\s* - if you have arguments, a required | or , 
        4c) ([^\]]+?) -- the arguments -- any character except a ]  -- capure group 3
    5) \] a required closing bracket
    6) ([\s\S]+) -- the rest of the question... capture group 4
    */
    let simpleQuestionRegex = /\[([A-Z_]\w*)([?!])?\s*(?:[|,]\s*([^\]]+?))?\]([\s\S]*)/
    let q = markdown.match(simpleQuestionRegex)
    if (!q || q.length == 0) {
        return { error: "bad parse", markdown: markdown }
    }
    let obj = {}
    obj.id = q[1]
    if (q[2]) {
        obj.edit = (q[2] == "!") ? "hard" : "soft"
    }
    obj.args = argparser(q[3])
    obj.markdown = safe(q[4], "")
    obj.orig = markdown
    obj.type = "question"
    return obj
}

function makeGridQuestion(markdown) {
    const gridRegex = /\|grid([\?\!])?\|([^|]+)\|([^|]+)\|([^\|]+)\|([^\|]+)\|/
    let gq = markdown.match(gridRegex)
    if (!gq) {
        return ({ markdown: markdown, error: "Grid Syntax Error", type: "grid" })
    }
    // gq[0]=complete match...      gq[1]=soft/hard edit
    // gq[2]=args                   gq[3]=title
    // gq[4]=questions              gq[5]=responses
    let obj = {
        edit: gq[1],
        args: argparser(gq[2]),
        title: gq[3],
        questions: gq[4],
        responses: gq[5]
    }
    return (obj)
}

// this reducer function converts an array of markdown to
// and array of questions...
function convertMarkdownToQuestionObjects(previousValue, currentValue, indx) {
    // really ugly still
    if (currentValue.startsWith("[")) {
        previousValue.push(makeSimpleQuestion(currentValue))
    } else if (currentValue.startsWith("<loop")) {
        previousValue.push(simpleLoopObject(currentValue, indx))
        console.log('---------abcabc-------------')
        console.log(previousValue)

        previousValue = previousValue.flat()
        console.log(previousValue)
    } else {
        previousValue.push(makeGridQuestion(currentValue))
    }

    return previousValue
}


function extract_module_name(markdown, otherParams) {
    // look for the module name in either otherParams or the markdown
    if (otherParams.hasOwnProperty("name")) {
        moduleParams.name = otherParams.name;
    } else {
        let found = markdown.match(/\"?name\"?\s*:[\s\"]*(\w+)[\s"]*[,}]/)
        moduleParams.name = (found) ? found[1] : "quest_module"
    }
    console.log("extracted module name: ", moduleParams.name)
}

async function create_local_forage_instance() {
    lfInstance = localforage.createInstance({
        'name': "quest",
        'storeName': moduleParams.name
    })
    lfTreeInstance = localforage.createInstance({
        'name': "quest",
        'storeName': moduleParams.name + "_tree"
    })
}

// take a module and create an array of questions...
// parentRootElement is the element where we will put the results..
// oldResults is where we place the results we need to pass in...
export async function parseModule(markdown, parentRootElement, previousResults = {}, otherParams = {}) {
    extract_module_name(markdown, otherParams);
    await create_local_forage_instance()
    await getTreeFromLocalForage()
    
    // place some stuff in the DOM so that we can debug it...
    // remove in the final release...
    window.questionQueue = questionQueue
    window.previousResults = previousResults

    rootElement = parentRootElement;
    let origMarkdown = markdown;
    markdown = removeComments(markdown)
    
    let questionRegex = /(\[[A-Z_]|\|grid\||<(?:\/)?loop)/g;
    questions = markdown.split(questionRegex)
    // the question/grid/loop markers are split so put them back together...
    questions = questions.reduce(simple_question_reduce, [])
    // are the questions in a grid/loop
    // first deal with the loops (note: grid_loop_reducer return a function)
    questions = questions.reduce(grid_loop_reducer("<loop", "</loop>"), [])
    // now deal with the grids...
    questions = questions.reduce(grid_loop_reducer("|grid", "|"), [])
    // make the question objects...
    questions = questions.reduce(convertMarkdownToQuestionObjects, [])
    
    questions = questions.map((q, indx, array) => {
        q.index = indx
        q.last = (indx > 0) ? array[indx - 1].id : null;
        q.next = ((indx + 1) < array.length) ? array[indx + 1].id : null;
        // loop ends dont keep the original markdown...
        if (q.orig) {
            q.markdown_start = origMarkdown.indexOf(q.orig)
            q.markdown_end = q.markdown_start + q.orig.length
        }
        return q;
    })
    console.log('================dsbsdbsd=================')
    console.log(questions)
    questions.forEach((q, indx) => questions[q.id] = indx);

    nextQuestion()
    window.questions = questions;

    // we need this for the dev tool.
    // however actual users of the tool should
    // ignore the return value.
    return questions;
}

function removeComments(markdown){
    markdown = markdown.replace(/\/\*.*\*\//g, "");
    markdown = markdown.replaceAll(/\/\/.*\n/g,"")
    return markdown;
}
export function isLastQuestion() {
    return (questionQueue.currentNode.value == questions.length - 1)
}
export function isFirstQuestion() {
    return (questionQueue.isFirst())
}

export function render_question(question) {

    let htmlElement = null
    switch (question.type) {
        case "grid":
            render_grid(question)
            break;
        case "loop_start":
        case "loop_end":
            render_loop(question);
            break;
        case "loop_question":
        case "question":
            htmlElement = render_simple_question(question);
            break;
        default:
            render_error()
    }
}

function render_simple_question(question) {
    return render(question)
}
function render_grid(question) {
    let gridElement = document.createElement("div")
    gridElement.classList.add("grid")
    gridElement.innerText = `md: ${question.markdown}`
}
function render_loop(question) {
    let loopElement = document.createElement("div")
    loopElement.classList.add("loop")
    loopElement.innerText = `id: ${question.id} md: ${question.markdown}`
}
function render_error(question) {
    let error_div = document.createElement("div");
    error_div.classList.add('error')
    error_div.innerHTML = `error: ${question.error} md: ${question.markdown}`
}



function render(question) {
    console.log(`rendering ${question.id} in element `, rootElement)
    rootElement.innerText = ""
    let infoElement = document.createElement("div")
    infoElement.innerText = `id: ${question.id}  question: ${question.index}`;
    infoElement.classList.add("info")
    rootElement.insertAdjacentElement("beforeEnd", infoElement)

    let questionElement = document.createElement("div")
    questionElement.classList.add('question')

    // replace #currentYear...
    let questText = question.markdown.replace(/#currentYear/g, new Date().getFullYear());

    //replace comments
    //console.log('replace comments!!!')
    //console.log(questText)
    questText = questText.replace(/\/\*[\s\S]+\*\//g, "");
    questText = questText.replace(/\/\/.*\n/g, "");
    //console.log(questText)

    // replace previous results $u
    // replace user profile variables...
    questText = questText.replace(/\{\$u:(\w+)}/g, (all, varid) => {
        return `<span name='${varid}'>${previousResults[varid]}</span>`;
    });
    // replace {$id} with span tag
    questText = questText.replace(/\{\$(\w+):?([a-zA-Z0-9 ,.!?"-]*)\}/g, fID);
    function fID(fullmatch, forId, optional) {
        if (optional == undefined) {
            optional = "";
        } else {
            optional = optional;
        }
        return `<span forId='${forId}' optional='${optional}'>${forId}</span>`;
    }
    //adding displayif with nested questions. nested display if uses !| to |!
    questText = questText.replace(/!\|(displayif=.+?)\|(.*?)\|!/g, fDisplayIf);
    function fDisplayIf(containsGroup, condition, text) {
        text = text.replace(/\|(?:__\|){2,}(?:([^\|\<]+[^\|]+)\|)?/g, fNum);
        text = text.replace(/\|popup\|([\S][^|]+[\S])\|(?:([\S][^|]+[\S])\|)?([\S][^|]+[\S])\|/g, fPopover);
        text = text.replace(/\|@\|(?:([^\|\<]+[^\|]+)\|)?/g, fEmail);
        text = text.replace(/\|date\|(?:([^\|\<]+[^\|]+)\|)?/g, fDate);
        text = text.replace(/\|tel\|(?:([^\|\<]+[^\|]+)\|)?/g, fPhone);
        text = text.replace(/\|SSN\|(?:([^\|\<]+[^\|]+)\|)?/g, fSSN);
        text = text.replace(/\|state\|(?:([^\|\<]+[^\|]+)\|)?/g, fState);
        text = text.replace(/\((\d*)(?:\:(\w+))?(?:\|(\w+))?(?:,(displayif=.+\))?)?\)(.*?)(?=(?:\(\d)|\n|<br>|$)/g, fRadio);
        text = text.replace(/\[(\d*)(\*)?(?:\:(\w+))?(?:\|(\w+))?(?:,(displayif=.+?\))?)?\]\s*(.*?)\s*(?=(?:\[\d)|\n|<br>|$)/g, fCheck);
        text = text.replace(/\[text\s?box(?:\s*:\s*(\w+))?\]/g, fTextBox);
        text = text.replace(/\|(?:__\|)(?:([^\s<][^|<]+[^\s<])\|)?\s*(.*?)/g, fText);
        text = text.replace(/\|___\|((\w+)\|)?/g, fTextArea);
        text = text.replace(/\|time\|(?:([^\|\<]+[^\|]+)\|)?/g, fTime);
        text = text.replace(
            /#YNP/g,
            `(1) Yes
         (0) No
         (99) Prefer not to answer`
        );
        text = questText.replace(
            /#YN/g,
            `(1) Yes
         (0) No`
        );
        return `<span class='displayif' ${condition}>${text}</span>`;
    }

    //replace |popup|buttonText|Title|text| with a popover
    questText = questText.replace(
        /\|popup\|([\S][^|]+[\S])\|(?:([\S][^|]+[\S])\|)?([\S][^|]+[\S])\|/g,
        fPopover
    );
    function fPopover(fullmatch, buttonText, title, popText) {
        title = title ? title : "";
        popText = popText.replace(/"/g, "&quot;")
        return `<a tabindex="0" class="popover-dismiss btn btn" role="button" data-toggle="popover" data-trigger="focus" title="${title}" data-content="${popText}">${buttonText}</a>`;
    }

    // replace |@| with an email input
    questText = questText.replace(/\|@\|(?:([^\|\<]+[^\|]+)\|)?/g, fEmail);
    function fEmail(fullmatch, opts) {
        const { options, elementId } = guaranteeIdSet(opts, "email");
        return `<input type='email' ${options} placeholder="user@example.com"></input>`;
    }

    // replace |date| with a date input
    questText = questText.replace(/\|date\|(?:([^\|\<]+[^\|]+)\|)?/g, fDate);
    function fDate(fullmatch, opts) {
        const { options, elementId } = guaranteeIdSet(opts, "date");
        return `<input type='date' ${options}></input>`;
    }

    // replace |tel| with phone input

    questText = questText.replace(/\|tel\|(?:([^\|\<]+[^\|]+)\|)?/g, fPhone);
    function fPhone(fullmatch, opts) {
        const { options, elementId } = guaranteeIdSet(opts, "tel");
        return `<input type='tel' ${options} pattern="[0-9]{3}-?[0-9]{3}-?[0-9]{4}" maxlength="12" placeholder='###-###-####'></input>`;
    }

    // replace |SSN| with SSN input
    questText = questText.replace(/\|SSN\|(?:([^\|\<]+[^\|]+)\|)?/g, fSSN);
    function fSSN(fullmatch, opts) {
        const { options, elementId } = guaranteeIdSet(opts, "SSN");
        return `<input type='text' ${options} id="SSN" class="SSN" inputmode="numeric" maxlength="11" pattern="[0-9]{3}-?[0-9]{2}-?[0-9]{4}"   placeholder="_ _ _-_ _-_ _ _ _"></input>`;
    }



    // replace |SSNsm| with SSN input
    questText = questText.replace(/\|SSNsm\|(?:([^\|\<]+[^\|]+)\|)?/g, fSSNsm);
    function fSSNsm(fullmatch, opts) {
        const { options, elementId } = guaranteeIdSet(opts, "SSNsm");
        return `<input type='text' ${options} class="SSNsm" inputmode="numeric" maxlength="4" pattern='[0-9]{4}'placeholder="_ _ _ _"></input>`;
    }

    // replace |state| with state dropdown
    questText = questText.replace(/\|state\|(?:([^\|\<]+[^\|]+)\|)?/g, fState);
    function fState(fullmatch, opts) {
        const { options, elementId } = guaranteeIdSet(opts, "state");
        return `<select ${options}>
        <option value='' disabled selected>Choose a state: </option>
        <option value='AL'>Alabama</option>
        <option value='AK'>Alaska</option>
        <option value='AZ'>Arizona</option>
        <option value='AR'>Arkansas</option>
        <option value='CA'>California</option>
        <option value='CO'>Colorado</option>
        <option value='CT'>Connecticut</option>
        <option value='DE'>Delaware</option>
        <option value='DC'>District Of Columbia</option>
        <option value='FL'>Florida</option>
        <option value='GA'>Georgia</option>
        <option value='HI'>Hawaii</option>
        <option value='ID'>Idaho</option>
        <option value='IL'>Illinois</option>
        <option value='IN'>Indiana</option>
        <option value='IA'>Iowa</option>
        <option value='KS'>Kansas</option>
        <option value='KY'>Kentucky</option>
        <option value='LA'>Louisiana</option>
        <option value='ME'>Maine</option>
        <option value='MD'>Maryland</option>
        <option value='MA'>Massachusetts</option>
        <option value='MI'>Michigan</option>
        <option value='MN'>Minnesota</option>
        <option value='MS'>Mississippi</option>
        <option value='MO'>Missouri</option>
        <option value='MT'>Montana</option>
        <option value='NE'>Nebraska</option>
        <option value='NV'>Nevada</option>
        <option value='NH'>New Hampshire</option>
        <option value='NJ'>New Jersey</option>
        <option value='NM'>New Mexico</option>
        <option value='NY'>New York</option>
        <option value='NC'>North Carolina</option>
        <option value='ND'>North Dakota</option>
        <option value='OH'>Ohio</option>
        <option value='OK'>Oklahoma</option>
        <option value='OR'>Oregon</option>
        <option value='PA'>Pennsylvania</option>
        <option value='RI'>Rhode Island</option>
        <option value='SC'>South Carolina</option>
        <option value='SD'>South Dakota</option>
        <option value='TN'>Tennessee</option>
        <option value='TX'>Texas</option>
        <option value='UT'>Utah</option>
        <option value='VT'>Vermont</option>
        <option value='VA'>Virginia</option>
        <option value='WA'>Washington</option>
        <option value='WV'>West Virginia</option>
        <option value='WI'>Wisconsin</option>
        <option value='WY'>Wyoming</option>
      </select>`;
    }


    function guaranteeIdSet(options, inputType = "inp") {
        if (options == undefined) {
            options = "";
        }
        options = options.trim();
        let elementId = options.match(/id=([^\s]+)/);
        if (!elementId) {
            elementId = `${question.id}_${inputType}`;
            options = `${options} id=${elementId}`;
        } else {
            elementId = elementId[1];
        }
        return { options: options, elementId: elementId };
    }

    // replace |image|URL|height,width| with a html img tag...
    questText = questText.replace(
        /\|image\|(.*?)\|(?:([0-9]+),([0-9]+)\|)?/g,
        "<img src=https://$1 height=$2 width=$3>"
    );

    //regex to test if there are input as a part of radio or checkboxes
    //    /(\[|\()(\d*)(?:\:(\w+))?(?:\|(\w+))?(?:,(displayif=.+?\))?)?(\)|\])\s*(.*?\|_.*?\|)\s*(?=(?:\[\d)|\n|<br>|$)/g
    var radioCheckboxAndInput = false;
    if (questText.match(/(\[|\()(\d*)(?:\:(\w+))?(?:\|(\w+))?(?:,(displayif=.+?\))?)?(\)|\])\s*(.*?\|_.*?\|)/g)) {
        radioCheckboxAndInput = true;
        question.args.asText = question.args.asText + " radioCheckboxAndInput";
    }
    // replace (XX) with a radio button...
    questText = questText.replace(/<br>/g, "<br>\n");
    questText = questText.replace(
        /\((\d*)(?:\:(\w+))?(?:\|(\w+))?(?:,(displayif=.+\))?)?\)(.*?)(?=(?:\(\d*)\)|\n|<br>|$)/g,
        fRadio
    );
    function fRadio(containsGroup, value, name, labelID, condition, label) {
        let displayIf = "";
        if (condition == undefined) {
            displayIf = "";
        } else {
            displayIf = `${condition}`;
        }
        let elVar = "";
        if (name == undefined) {
            elVar = question.id;
        } else {
            elVar = name;
        }
        if (labelID == undefined) {
            labelID = `${elVar}_${value}_label`;
        }
        return `<div class='response' style='margin-top:15px' ${displayIf}><input type='radio' name='${elVar}' value='${value}' id='${elVar}_${value}'></input><label id='${labelID}' style='font-weight: normal; padding-left:5px;' for='${elVar}_${value}'>${label}</label></div>`;
    }


    // replace [XX] with checkbox
    questText = questText.replace(
        /\[(\d*)(\*)?(?:\:(\w+))?(?:\|(\w+))?(?:,(displayif=.+?\))?)?\]\s*(.*?)\s*(?=(?:\[\d)|\n|<br>|$)/g,
        fCheck
    );
    function fCheck(containsGroup, value, noneOfTheOthers, name, labelID, condition, label) {
        let displayIf = "";
        let clearValues = noneOfTheOthers ? "data-reset=true" : "";
        if (condition == undefined) {
            displayIf = "";
        } else {
            displayIf = `${condition}`;
        }
        let elVar = "";
        if (name == undefined) {
            elVar = question.id;
        } else {
            elVar = name;
        }
        if (labelID == undefined) {
            labelID = `${elVar}_${value}_label`;
        }
        return `<div class='response' style='margin-top:15px' ${displayIf}><input type='checkbox' name='${elVar}' value='${value}' id='${elVar}_${value}' ${clearValues}></input><label id='${labelID}' style='font-weight: normal; padding-left:5px;' for='${elVar}_${value}'>${label}</label></div>`;
    }

    // replace |time| with a time input
    questText = questText.replace(/\|time\|(?:([^\|\<]+[^\|]+)\|)?/g, fTime);
    function fTime(x, opts) {
        const { options, elementId } = guaranteeIdSet(opts, "time");
        return `<input type='time' ${options}>`;
    }

    // replace |__|__|  with a number box...
    questText = questText.replace(
        /\|(?:__\|){2,}(?:([^\|\<]+[^\|]+)\|)?/g,
        fNum
    );
    function fNum(fullmatch, opts) {

        let value = questText.startsWith('<br>') ? questText.split('<br>')[0] : ''

        // make sure that the element id is set...
        let { options, elementId } = guaranteeIdSet(opts, "num");
        let maxRegex = /max(?![(a-z])/g;
        let minRegex = /min(?![(a-z])/g;

        //let maxReplace = evalueateCondition("isDefined(AGE,5)");
        //instead of replacing max and min with data-min and data-max, they need to be added, as the up down buttons are needed for input type number
        let optionList = options.split(" ");
        for (let i = 0; i < optionList.length; i++) {
            let o = optionList[i];
            if (minRegex.test(o)) {

                // let minReplace = o.replace("min=", "");
                // let existingVal = o;
                // if (isNaN(parseInt(minReplace))){   //if the max min values are a method then evaluate it 
                //   let renderedVal = "min="+evaluateCondition(minReplace);
                //   options = options.replace(existingVal, renderedVal);
                //   o=renderedVal;
                // }
                o = o.replace(minRegex, "data-min");
                options = options + " " + o;
            }
            if (maxRegex.test(o)) {
                // let maxReplace = o.replace("max=", "");
                // let existingVal = o;
                // if (isNaN(parseInt(maxReplace))){ //if the max min values are a method then evaluate it 
                //   let renderedVal = "max="+evaluateCondition(maxReplace);
                //   options = options.replace(existingVal, renderedVal);
                //   o=renderedVal;
                // }

                o = o.replace(maxRegex, "data-max");
                options = options + " " + o;
            }
        }
        if (radioCheckboxAndInput) {
            options = options + " disabled ";
        }
        //onkeypress forces whole numbers
        return `<input type='number' aria-label='${value}' step='any' onkeypress='return (event.charCode == 8 || event.charCode == 0 || event.charCode == 13) ? null : event.charCode >= 48 && event.charCode <= 57' name='${question.id}' ${options} ></input>`;
    }

    // replace |__| or [text box:xxx] with an input box...
    questText = questText.replace(/\[text\s?box(?:\s*:\s*(\w+))?\]/g, fTextBox);
    function fTextBox(fullmatch, options) {
        let id = options ? options : `${question.id}_text`;
        return `|__|id=${id} name=${question.id}|`;
    }


    questText = questText.replace(
        // /\|(?:__\|)(?:([^\s<][^|<]+[^\s<])\|)?\s*(.*)?/g,
        /(.*)?\|(?:__\|)(?:([^\s<][^|<]+[^\s<])\|)?(.*)?/g,
        fText
    );

    function fText(fullmatch, value1, opts, value2) {
        let { options, elementId } = guaranteeIdSet(opts, "txt");

        if (radioCheckboxAndInput) {
            options = options + " disabled ";
        }

        if (value1 && value1.includes('div')) return `${value1}<input type='text' aria-label='${value1.split('>').pop()}'name='${question.id}' ${options}></input>${value2}`

        if (value1 && value2) return `<span>${value1}</span><input type='text' aria-label='${value1} ${value2}' name='${question.id}' ${options}></input><span>${value2}</span>`;
        if (value1) return `<span>${value1}</span><input type='text' aria-label='${value1}' name='${question.id}' ${options}></input>`;
        if (value2) return `<input type='text' aria-label='${value2}' name='${question.id}' ${options}></input><span>${value2}</span>`;

        return `<input type='text' aria-label='${questText.split('<br>')[0]}' name='${question.id}' ${options}></input>`;
    }

    // replace |___| with a textarea...
    questText = questText.replace(/\|___\|((\w+)\|)?/g, fTextArea);
    function fTextArea(x1, y1, z1) {
        let elId = "";
        if (z1 == undefined) {
            elId = question.id + "_ta";
        } else {
            elId = z1;
        }
        let options = "";
        if (radioCheckboxAndInput) {
            options = options + " disabled ";
        }
        return `<textarea id='${elId}' ${options} style="resize:auto;"></textarea>`;
    }

    // replace #YNP with Yes No input
    questText = questText.replace(
        /#YNP/g, `<div class='response' style='margin-top:15px'><input type='radio' id="${question.id}_1" name="${question.id}" value="yes"></input><label for='${question.id}_1'>Yes</label></div><div class='response' style='margin-top:15px'><input type='radio' id="${question.id}_0" name="${question.id}" value="no"></input><label for='${question.id}_0'>No</label></div><div class='response' style='margin-top:15px'><input type='radio' id="${question.id}_99" name="${question.id}" value="prefer not to answer"></input><label for='${question.id}_99'>Prefer not to answer</label></div>`
        // `(1) Yes
        //  (0) No
        //  (99) Prefer not to answer`
    );

    // replace #YN with Yes No input
    questText = questText.replace(
        /#YN/g, `<div class='response' style='margin-top:15px'><input type='radio' id="${question.id}_1" name="${question.id}" value="yes"></input><label for='${question.id}_1'>Yes</label></div><div class='response' style='margin-top:15px'><input type='radio' id="${question.id}_0" name="${question.id}" value="no"></input><label for='${question.id}_0'>No</label></div>`
        // `(1) Yes
        //  (0) No`
    );
    // replace [a-zXX] with a checkbox box...
    // handle CB/radio + TEXT + TEXTBOX + ARROW + Text...
    questText = questText.replace(
        /([\[\(])(\w+)(?::(\w+))?(?:\|([^\|]+?))?[\]\)]([^<\n]+)?(<(?:input|textarea).*?<\/(?:input|textarea)>)(?:\s*->\s*(\w+))/g,
        cb1
    );
    function cb1(
        completeMatch,
        bracket,
        cbValue,
        cbName,
        cbArgs,
        labelText,
        textBox,
        skipToId
    ) {
        let inputType = bracket == "[" ? "checkbox" : "radio";
        cbArgs = cbArgs ? cbArgs : "";

        // first look in the args for the name [v|name=lala], if not there,
        // look for cbName [v:name], otherwise use the question id.
        let name = cbArgs.match(/name=['"]?(\w+)['"]?/);
        if (!name) {
            name = cbName ? `name="${cbName}"` : `name="${question.id}"`;
        }

        let id = cbArgs.match(/id=['"]?(\w+)/);
        // if the user does supply the id in the cbArgs, we add it to.
        // otherwise it is in the cbArgs...
        let forceId = "";
        if (id) {
            id = id[1];
        } else {
            id = cbName ? cbName : `${question.id}_${cbValue}`;
            forceId = `id=${id}`;
        }

        let skipTo = skipToId ? `skipTo=${skipToId}` : "";
        let value = cbValue ? `value=${cbValue}` : "";
        let rv = `<div class='response' style='margin-top:15px'><input type='${inputType}' ${forceId} ${name} ${value} ${cbArgs} ${skipTo}></input><label for='${id}'>${labelText}${textBox}</label></div>`;
        return rv;
    }
    // SAME thing but this time with a textarea...


    //displayif with just texts
    questText = questText.replace(/\|(displayif=.+?)\|(.*?)\|/g, fDisplayIf);
    function fDisplayIf(containsGroup, condition, text) {
        return `<span class='displayif' ${condition}>${text}</span>`;
    }

    // replace next question  < -> > with hidden...
    questText = questText.replace(
        /<\s*(?:\|if\s*=\s*([^|]+)\|)?\s*->\s*([A-Z_][A-Z0-9_#]*)\s*>/g,
        fHidden
    );
    function fHidden(containsGroup, ifArgs, skipTo) {
        ifArgs = ifArgs == undefined ? "" : ` if=${ifArgs}`;
        return `<input type='hidden'${ifArgs} id='${question.id}_skipto_${skipTo}' name='${question.id}' skipTo=${skipTo} checked>`;
    }

    // replace next question  < #NR -> > with hidden...
    questText = questText.replace(
        /<\s*#NR\s*->\s*([A-Z_][A-Z0-9_#]*)\s*>/g,
        "<input type='hidden' class='noresponse' id='" +
        question.id +
        "_NR' name='" +
        question.id +
        "' skipTo=$1 checked>"
    );

    // handle skips
    questText = questText.replace(
        /<input ([^>]*?)><\/input><label([^>]*?)>(.*?)\s*->\s*([^>]*?)<\/label>/g,
        "<input $1 skipTo='$4'></input><label $2>$3</label>"
    );
    questText = questText.replace(
        /<textarea ([^>]*)><\/textarea>\s*->\s*([^\s<]+)/g,
        "<textarea $1 skipTo=$2></textarea>"
    );
    questText = questText.replace(/<\/div><br>/g, "</div>");

    questText = questText.replace(/\r?\n/g, "<br>")
    questionElement.innerHTML = questText;
    //    questionElement.innerHTML = `last ${ question.last } <br> next ${question.next}<br>
    //    type ${question.type} <br>md: ${question.markdown}<br>`
    //    if (question.type == "loop_question") {
    //        questionElement.insertAdjacentHTML("beforeend", `iteration: ${question.iteration}<br>`)
    //    }
    rootElement.insertAdjacentElement("beforeEnd", questionElement)


    questionElement.querySelectorAll("[xor]").forEach(element => addXORHandler(element))
    questionElement.querySelectorAll("[data-reset]").forEach(element => addResetHandler(element))
}

export function nextQuestion() {
    // handle the first question differently...
    if (questionQueue.isEmpty()) {
        questionQueue.add(questions[0].id);
        questionQueue.next();
        render_question(questions[questions[questionQueue.currentNode.value]])
        return;
    }
    console.log('QUEUEUE')
    console.log(questionQueue)
    saveResultsToLocalForage();
    updateTree();
    renderNextQuestion();
}

export function lastQuestion() {
    if (questionQueue.isEmpty() || questionQueue.isFirst()) {
        return;
    }

    // if this is not the last question, the clear the results of 
    // of the next question.  Logic: I have not yet answered the 
    // current question.  When I go back, I cannot delete this 
    // answer (it does not exist).  But if I already went back
    // one question.  I need to remove any value that was set.
    questionQueue.previous();
    render_question(questions[questions[questionQueue.currentNode.value]])

}

function updateTree() {
    const renderedElement = document.getElementById("renderedMarkdown");
    /* check to see if anything was selected ... */
    const responseElements = Array.from(renderedElement.querySelectorAll("input,textarea"));
    let anyResponse = responseElements.some(element => {
        if (element.tagName == "TEXTAREA") return element.value.length > 0
        switch (element.type) {
            case "checkbox":
            case "radio":
                return element.checked;
            case "hidden":
                return false
            default:
                return element.value.length > 0
        }
    })

    // by default we go to the following question in the array of questions...
    let goToNextQuestion = true;

    // find all "skipTo"
    const potentialNext = renderedElement.querySelectorAll("[skipTo]")
    potentialNext.forEach(element => {
        switch (element.type) {
            case "checkbox":
            case "radio":
                if (element.checked) {
                    questionQueue.add(element.getAttribute("skipTo"))
                    goToNextQuestion = false;
                }
                break;
            case 'hidden':
                if (!element.classList.contains("noresponse") || !anyResponse) {
                    questionQueue.add(element.getAttribute("skipTo"))
                    goToNextQuestion = false
                }
                break;
            default:
                console.log(`cant handle type element`, element.type)
        }
    })

    // before we just add the next question to the queue,
    // make sure we dont have questions remaining in the queue..
    if (goToNextQuestion && !questionQueue.hasNext()) {
        let nextIndex = parseInt(questions[questionQueue.currentNode.value]) + 1
        if(nextIndex >= questions.length){
            nextIndex = questions.length - 1;
        }
        if(questions[nextIndex].type == 'loop_end'){
            //skip past loop_end
            nextIndex += 1;
        }
        if(questions[nextIndex].type == 'loop_start'){
            let numIters = questions[nextIndex].args.max
            nextIndex += 1;
            let nextArray = []

            while(nextIndex < questions.length && questions[nextIndex].type !== "loop_end"){
                
                nextArray.push(questions[nextIndex].id)
                nextIndex+=1;
            }
            
            console.log(questions[nextIndex])
            console.log('beginning loop!')
            console.log(nextArray)
            /*
            let nIters = lfInstance.getItem(numIters).then((value)=>{
                if(value == null){
                    console.log(numIters)
                    questionQueue.addLoop(nextArray, numIters)
                }
                else{
                    console.log('ubsdlvisbdlvsdjvbs')
                    console.log(nIters)
                    questionQueue.addLoop(nextArray, nIters)
                }
            })
            */
           questionQueue.addLoop(nextArray, numIters)

        }
        else{
            
            questionQueue.add(questions[nextIndex].id)
        }
    }

    updateTreeInLocalForage()
}

function renderNextQuestion() {
    // get next item from the tree...
    console.log('Next!')
    console.log(questionQueue)
    questionQueue.next()
    let questionToRender = questions[questions[questionQueue.currentNode.value]]

    // check for a displayif...
    
    // render it with the render function...
    render_question(questionToRender)
}

export function renderCurrentQuestion() {
    if (questionQueue?.currentNode.value) {
        let questionToRender = questions[questions[questionQueue.currentNode.value]]
        render_question(questionToRender)
    }

}


HTMLElement.prototype.clearValue = function () {
    if (!['input', 'textarea'].includes(this.tagName.toLowerCase())) {
        return false;
    }

    if (['radio', 'checkbox'].includes(this.type)) {
        this.checked = false;
    } else {
        this.value = "";
    }
}

// attach the xor handler...
function addXORHandler(element) {
    if (!element.hasAttribute("xor")) return;

    // attach the callback function to the correct event.
    // either a click (if it is a radio/checkbox)
    // or a keypress otherwise.
    let listenerType = (["radio", 'checkbox'].includes(element.type)) ? "click" : 'keyup';

    let xorValue = element.getAttribute("xor")
    const xorSiblings = Array.from(document.querySelectorAll(`[xor=${xorValue}]`));
    element.addEventListener(listenerType, () => {
        xorSiblings.forEach(el => {
            // clear all other values...
            if (el != element) el.clearValue()
            // check if the element as other inputs...
            el.querySelectorAll('input, textarea').forEach(child => child.clearValue())
        })
    })
}

function addResetHandler(element) {
    // must have data-refresh and an element name!!
    if (!element.dataset.reset || !element.name) {
        return;
    }

    const resetSiblings = Array.from(document.querySelectorAll(`[name=${element.name}]`));
    // if I am clicked, clear all of my siblings.
    // also if my sibling as children, clear them too...
    element.addEventListener("click", () => {
        resetSiblings.forEach(sibling => {
            if (sibling != element) {
                sibling.clearValue()
                sibling.querySelectorAll('input, textarea').forEach(child => child.clearValue())
            }
        })
    })
    // if my sibling is clicked, deselect me
    // I should not have children.  If this changes, may
    // need to add a call to clear all my children...
    resetSiblings.forEach(sibling => {
        if (sibling != element) {
            sibling.addEventListener("click", () => element.clearValue())
        }
    })
}

export async function clearLocalForage() {
    if(Object.keys(lfInstance).length == 0){
        await create_local_forage_instance();
    }
    console.log(lfInstance)
    lfInstance.clear()
    lfTreeInstance.clear()
}

async function getTreeFromLocalForage() {
    questionQueue = new Tree();
    let tree = await lfTreeInstance.getItem(moduleParams.name)
    if (tree) {
        questionQueue.loadFromVanillaObject(tree)
    } else {
        await updateTreeInLocalForage()
    }
}

async function updateTreeInLocalForage() {
    await lfTreeInstance.setItem(moduleParams.name, questionQueue)
}

async function saveResultsToLocalForage() {
    console.log(' ---------- SAVE RESULTS TO LF ----------')
    let questionId = questionQueue.currentNode.value
    let questionType = questions[questions[questionQueue.currentNode.value]].type
    console.log(`write results from question:  ${questionId} to local forage`)

    let savedObj = {}

    switch (questionType) {
        case "question":
            save_question()
            break;
        default:
            console.warn("CANNOT SAVE QUESTION TYPE: ", questionType)
    }
}

function save_question() {

    let obj = {}
    let questionId = questionQueue.currentNode.value

    let radioInputs = Array.from(rootElement.querySelectorAll('input[type=radio]'))
    obj = radioInputs.reduce((old, element) => {
        if (element.checked) {
            old[element.name] = element.value
        } else if (!old.hasOwnProperty(element.name)) {
            old[element.name] = ""
        }
        return old;
    }, obj)
    let numRadios = Object.getOwnPropertyNames(obj).length;

    // handle check boxes...
    let checkbox_inputs = Array.from(rootElement.querySelectorAll('input[type=checkbox]'))
    obj = checkbox_inputs.reduce((old, element) => {
        // make sure the element name is in the results,
        // even if it unchecked..
        if (!old.hasOwnProperty(element.name)) {
            old[element.name] = []
        }
        if (!element.checked) return old;

        old[element.name] = old[element.name].concat(element.value)
        return old;
    }, obj)

    //handle inputs that are not radio/checkboxes...
    let other_inputs = Array.from(rootElement.querySelectorAll('textarea,input:not([type=radio]):not([type=checkbox]):not([type=hidden])'))
    obj = other_inputs.reduce((old, element) => {
        console.log(`element id: ${element.id}  value: ${element.value} old: ${old}`)
        if (element.value?.length > 0) {
            old[element.id] = element.value
        }
        return old;
    }, obj)
    let numOther = other_inputs.length;




    let simplify = (numRadios + numOther <= 1) && (checkbox_inputs.length == 0)
    if (simplify) {
        let keys = Object.getOwnPropertyNames(obj)
        obj = (keys.length == 1) ? obj[keys[0]] : ""
    }
    console.log('c/r =======> ', obj)
    console.log(questionId)
    lfInstance.setItem(questionId, obj)

}