import { argparser } from "./utils.js"
import { simple_question_reduce, makeSimpleQuestion } from "./quest.js"

console.log("...in loop.js")

export const loopRegex = /<loop([^>]*?)>([\S\s]+?)<\/loop(.*)>/g
export const questionStartRegex = /(\[[A-Z_])/g;

export function findLoops(txt) {
    write_out("... looking for loops ...")
    code_out(txt)

    // get everything in the loop tags...

    let loops = Array.from(txt.matchAll(loopRegex))

    // lets look at each loop...
    let loopObj = loops.map((loop, indx) => {
        // loop[0] is the entire match <loop>...</loop>
        // loop[1] is the arguments in the loop tag
        // loop[2] is the inner text of the loop tag
        let args = argparser(loop[1])
        let argsEnd = argparser(loop[3])
        if (!args.has("id")) args.id = `_loop_${indx}`
        // each element of the returned array is an object
        // with the args (including the id), where the loop
        // is in the markdown, and the markdown inside the loop 

    })
}

export function simpleLoopObject(markdown, indx) {
    
    let loopMatch = Array.from(markdown.matchAll(loopRegex))[0]
    // loopMatch[0] is the entire match <loop>...</loop>
    // loopMatch[1] is the arguments in the loop tag
    // loopMatch[2] is the inner text of the loop tag    
    let args = argparser(loopMatch[1])
    let argsEnd = argparser(loopMatch[3])
    // I really hope you passed in an ID....
    if (!args.has("id")) args.id = `_loop_${indx}`
    let loopMarkdown = loopMatch[2]

    // create a loopStartQuestion + ends
    let loopStartQuestion = { id: args.id + "_start", args: args, markdown: loopMarkdown, orig: markdown, type: 'loop_start' }
    let loopEndQuestion = { id: args.id + "_end", args: argsEnd, markdown: loopMarkdown, orig: markdown, type: 'loop_end' }

    // parse the loop markdown...
    let loopQuestions = loopMarkdown.split(questionStartRegex)
    loopQuestions = loopQuestions.reduce(simple_question_reduce, [])

    // make "simple questions"
    loopQuestions = loopQuestions.map(makeSimpleQuestion)
    loopQuestions = loopQuestions.map(q => {
        q.type = "loop_question";
        q.iteration = 0;
        return q
    })

    loopQuestions.unshift(loopStartQuestion)
    loopQuestions.push(loopEndQuestion)
    console.log('------------------loop----------------------------------')
    console.log(args)
    console.log(loopQuestions)


    // look for questions in
    return (loopQuestions)
}

