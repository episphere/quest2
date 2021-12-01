

const html_escape = (txt) => {
    let map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;'
    }
    return txt.replace(/[&<>]/g, (c) => map[c] || c)
}


// given a string "id=id_value name=name_value highlight"
// returns {id:id_value, name:name_value, highlight:true}
export function argparser(txt) {
    let obj = {
        has: function (key) {
            return this.hasOwnProperty(key)
        },
        get: function (key) {
            return (this.has(key)) ? this[key] : undefined
        },
        asText: txt
    }
    if (txt) {
        // split txt by white-space
        txt = txt.replace(/\s*=\s*/g, "=").trim()
        let parts = txt.split(' ')
        obj = parts.reduce((prev, curr) => {
            let arr = curr.split('=')
            prev[arr[0]] = (arr.length == 1) ? true : arr[1]
            return prev
        }, obj)
    }
    return obj
}

export function safe(x, defaultValue = "") {
    return typeof (x) == 'undefined' ? defaultValue : x
}