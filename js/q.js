import { parseModule, nextQuestion, lastQuestion, isLastQuestion, isFirstQuestion, clearLocalForage, render_question, renderCurrentQuestion } from "./quest.js"

const markdown_element = document.getElementById("markdown_textarea")
const rendered_text_element = document.getElementById("renderedMarkdown")
const statusElement = document.getElementById("status")
const backButton = document.getElementById("backButton")
const nextButton = document.getElementById("nextButton")
let previousResults = {}
statusElement.innerText = "ready"
backButton.addEventListener("click", backOrNext)
nextButton.addEventListener("click", backOrNext)
console.log('abcabcefg')
function throttle_parsing(fun, timeout = 100) {
    if (throttle_parsing.last) {
        clearTimeout(throttle_parsing.last)
    }
    throttle_parsing.last = setTimeout(fun, timeout)
}

async function tempFun() {
    statusElement.innerText = "parsing markdown"
    
    let curserLocation = markdown_element.selectionStart
    questions = await parseModule(markdown_element.value, rendered_text_element, previousResults);
    console.log('-----questions------')
    console.log(markdown_element.selectionStart)
    console.log(questions[0])
    console.log(questions)
    if (questions.length > 0) {
        let current_question = questions.find(element => {
            //console.log(element)
            //console.log(element.markdown_start);
            //console.log(element.markdown_end);
            //console.log(curserLocation)
            return (curserLocation >= element.markdown_start) && (curserLocation < element.markdown_end)
        })
        //console.log('Current Question!')
        //console.log(current_question)
        if (!current_question) current_question = questions[0]
        current_question = questions[0]
        //console.log(current_question)

        //current_question = questions[0];
        //console.log(current_question)
        render_question(current_question)
    }
    //console.log(questions)
    window.questions = questions;
    showButtons();
    statusElement.innerText = "ready"
}
// update the markdown element when the Markdown is updated
function updateRenderedText(event) {
    statusElement.innerText = "rendering"
    throttle_parsing(tempFun, 500)
    //    
    statusElement.innerText = "ready"
}


markdown_element.addEventListener("keyup", updateRenderedText)
markdown_element.addEventListener("paste", updateRenderedText)
markdown_element.addEventListener("click", updateRenderedText)

//load url...
document.getElementById("uploadURL").addEventListener("click", (event) => {
    location.hash = document.getElementById("url").value
})
window.addEventListener("hashchange", () => {
    console.log('testing efg')
    if (location.hash.length > 2) {
        let hashurl = location.hash.substr(1)
        let txt = fetch(hashurl)
            .then(x => x.text())
            .then(x => markdown_element.value = x)
            .then(x => parseMarkdown())
    }
    history.pushState("", document.title, window.location.pathname + window.location.search)
})

async function parseMarkdown() {
    statusElement.innerText = "parsing markdown";
    console.log('efgefg')
    await parseModule(markdown_element.value, rendered_text_element, previousResults);
    showButtons();
    statusElement.innerText = "ready";
}

function showButtons() {
    if (isLastQuestion()) {
        nextButton.classList.add("invisible")
    } else {
        nextButton.classList.remove("invisible")
    }
    if (isFirstQuestion()) {
        backButton.classList.add("invisible")
    } else {
        backButton.classList.remove("invisible")
    }
}

function backOrNext(event) {
    if (event.target.id == "nextButton") {
        nextQuestion()
    } else {
        lastQuestion()
    }
    showButtons()
}

/*
function backOrNext(event) {
    let nextQID = (event.target.id == "nextButton") ? current_question.next : current_question.last;
    let nextIndx = current_question.index + ((event.target.id == "nextButton") ? 1 : -1);
    if (nextQID) {
        if ((event.target.id == "nextButton")) nextQuestion(current_question, questions)
        current_question = questions[nextIndx]
        render_question(current_question, { div: rendered_text_element, "back": backButton, 'next': nextButton })
    } else {
        if (submitFunction) {
            submitFunction()
        } else {
            console.log(".... no submit function ...")
        }
    }
}
*/

//handle the style change...
Array.from(document.querySelectorAll("input[name=setStyle]")).forEach(element => {
    element.addEventListener("change", event => {
        console.log(event.target.value)
        document.getElementById("pagestyle").setAttribute("href", event.target.value);
    })
})

//add to memory
async function addToMemory() {
    let txt = document.getElementById("previousResultsTextArea").value
    try {
        if (txt.length > 0) {
            previousResults = JSON.parse(txt)
            console.log(previousResults)
            console.log('abcabc')
            statusElement.innerText = "Parsing Markdown"
            await parseModule(markdown_element.value, rendered_text_element, previousResults);
            statusElement.innerText = "Ready"
        }
    } catch (e) {
        statusElement.innerText = e
    }
}
document.getElementById("addJSONButton").addEventListener("click", addToMemory)


function clearMemory() {
    previousResults = {}
    clearLocalForage()
}
document.getElementById("clearLFButton").addEventListener("click", clearMemory)