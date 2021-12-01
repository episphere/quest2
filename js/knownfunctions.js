console.log("in known functions")

import { lfInstance, previousResults } from "./quest.js";

export const knownFunctions = {
    and: function (x, y) {
        return x && y;
    },
    or: function (x, y) {
        return x || y;
    },
    isDefined: function (x, y) {
        let tmpVal = !x ? y : x;
        let isnum = /^[\d\.]+$/.test(tmpVal);
        if (isnum) {
            return tmpVal;
        }
        let tmpVal2 = document.getElementById(tmpVal);
        return tmpVal2 ? tmpVal2.value : y;   //used to be return tmpVal2 ? tmpVal2.value : tmpVal; but now it will return y if x is undefined
    },
    isNotDefined: function (x, y) {
        return !x;
    },
    min: function (x, y) {
        if (!x && !y) {
            return "";
        }
        x = !isNaN(x) ? x : Number.POSITIVE_INFINITY;
        y = !isNaN(y) ? y : Number.POSITIVE_INFINITY;
        return Math.min(parseFloat(x), parseFloat(y));
    },
    max: function (x, y) {
        if (!x && !y) {
            return "";
        }
        x = !isNaN(x) ? x : Number.NEGATIVE_INFINITY;
        y = !isNaN(y) ? y : Number.NEGATIVE_INFINITY;
        return Math.max(parseFloat(x), parseFloat(y));
    },
    equals: function (x, y) {
        if (x == undefined && y == "undefined") {
            return true;
        }
        y = y.replace(/\"/g, ""); //handle string comparison
        if (y === 'true') {    //handles truthy comparison
            y = true;
        }
        if (y === 'false') {
            y = false;
        }
        if (y === '_TODAY_') {
            var date = new Date();
            var dateString = new Date(date.getTime() - (date.getTimezoneOffset() * 60000))
                .toISOString()
                .split("T")[0];
            y = dateString;
        }
        return Array.isArray(x) ? x.includes(y) : x == y;
    },
    doesNotEqual: function (x, y) {
        if (x == undefined && y == "undefined") {
            return false;
        }
        y = y.replace(/\"/g, ""); //handle string comparison
        if (y === 'true') {    //handles truthy comparison
            y = true;
        }
        if (y === 'false') {
            y = false;
        }
        if (y === '_TODAY_') {
            var date = new Date();
            var dateString = new Date(date.getTime() - (date.getTimezoneOffset() * 60000))
                .toISOString()
                .split("T")[0];
            y = dateString;
        }
        return Array.isArray(x) ? !x.includes(y) : x != y;
    },
    lessThan: function (x, y) {
        return parseFloat(x) < parseFloat(y);
    },
    lessThanOrEqual: function (x, y) {
        return parseFloat(x) <= parseFloat(y);
    },
    greaterThan: function (x, y) {
        return parseFloat(x) > parseFloat(y);
    },
    greaterThanOrEqual: function (x, y) {
        return parseFloat(x) >= parseFloat(y);
    },
    setFalse: function (x, y) {
        return false;
    },
    difference: function (x, y) {
        if (typeof y == "string" && document.getElementById(y)) {
            y = document.getElementById(y).value;
        }
        return parseInt(x) - parseInt(y);
    },
    sum: function (x, y) {
        if (typeof y == "string" && document.getElementById(y)) {
            y = document.getElementById(y).value;
        }
        return parseInt(x) + parseInt(y);
    },
    percentDiff: function (x, y) {
        if (x == "" || y == "") {
            return false;
        }
        if (typeof y == "string" && document.getElementById(y)) {
            y = document.getElementById(y).value;
        }
        return knownFunctions.difference(x, y) / x;
    },
    numberOfChoicesSelected: function (x) {
        return x == undefined ? 0 : x.length;
    },
};


export const myFunctions = {
    exists: async function (x) {
        return (!!(await lfInstance.getItem(x)) || !!previousResults[x])
    },
    doesNotExist: async function (x) {
        return (!(await lfInstance.getItem(x)) && !previousResults[x])
    },
    noneExist: function (...ids) {
        // if you give me no ids, none of them exist therefore true...
        // loop through all the ids of any exists then return false...
        return ids.every(id => math.doesNotExist(id))
    },
    someExist: function (...ids) {
        return ids.some(id => math.exists(id))
    },
    allExist: function (...ids) {
        return ids.every(id => math.exists(id))
    },
    _value: function (x) {
        if (!math.exists(x)) return null
        let element = document.getElementById(x);
        return (element) ? element.value : moduleParams.previousResults[x]
    },
    valueEquals: function (id, value) {
        // if id is not passed in return FALSE
        if (math.doesNotExist(id)) return false;
        let element_value = math._value(id);
        // if the element does not exist return FALSE
        return (element_value == value)
    },
    valueIsOneOf: function (id, ...values) {
        if (myFunctions.doesNotExist(id)) return false;
        // compare as strings so "1" == 1
        values = values.map(v => v.toString())

        let test_values = math._value(id);
        if (Array.isArray(test_values)) {
            return (test_values.some(v => values.includes(v)))
        }
        return values.includes(test_values)
    },
    isSelected: function (id) {
        // if the id doesnt exist, the ?.checked returns undefined.
        // !!undefined == false.
        return (!!document.getElementById(id)?.checked)
    },
    someSelected: function (...ids) {
        return (ids.some(id => math.isSelected(id)))
    },
}
window.addEventListener("load", (event) => {
    math.import({
        myFunctions
    })
})
