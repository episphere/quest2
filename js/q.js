import { parseModule, nextQuestion, lastQuestion, isLastQuestion, isFirstQuestion, clearLocalForage } from "./quest.js"

const markdown_element = document.getElementById("markdown_textarea")
const rendered_text_element = document.getElementById("renderedMarkdown")
const statusElement = document.getElementById("status")
const backButton = document.getElementById("backButton")
const nextButton = document.getElementById("nextButton")
let previousResults = {}
statusElement.innerText = "ready"
backButton.addEventListener("click", backOrNext)
nextButton.addEventListener("click", backOrNext)

function throttle_parsing(fun, timeout = 100) {
    if (throttle_parsing.last) {
        clearTimeout(throttle_parsing.last)
    }
    throttle_parsing.last = setTimeout(fun, timeout)
}

function tempFun() {
    statusElement.innerText = "parsing markdown"
    let curserLocation = markdown_element.selectionStart
    questions = parseModule(markdown_element.value)
    if (questions.length > 0) {
        let cq = questions.find(element => {
            return (curserLocation >= element.markdown_start) && (curserLocation < element.markdown_end)
        })
        if (!cq) cq = questions[questions.length - 1]
        current_question = cq
        render_question(current_question, { div: rendered_text_element, "back": backButton, 'next': nextButton })
    }
    window.questions = questions;
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
    if (location.hash.length > 2) {
        let hashurl = location.hash.substr(1)
        let txt = fetch(hashurl)
            .then(x => x.text())
            .then(x => markdown_element.value = x)
            .then(x => parseMarkdown())
    }
    history.pushState("", document.title, window.location.pathname + window.location.search)
})

function parseMarkdown() {
    statusElement.innerText = "parsing markdown"
    parseModule(markdown_element.value, rendered_text_element, previousResults)
    document.getElementById("nextButton").click()
    //    if (questions.length > 0) {
    //        current_question = questions[0]
    //        render_question(current_question, { div: rendered_text_element, "back": backButton, 'next': nextButton })
    //    }
    statusElement.innerText = "ready"
}

function backOrNext(event) {
    if (event.target.id == "nextButton") {
        nextQuestion()
    } else {
        lastQuestion()
    }
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
function addToMemory() {
    let txt = document.getElementById("previousResultsTextArea").value
    try {
        if (txt.length > 0) {
            previousResults = JSON.parse(txt)
            console.log(previousResults)
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