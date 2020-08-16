const css = require("css");

const EOF = Symbol("EOF"); // EOF: End of File

let currentToken = null;
let currentAttribute = null;
let currentTextNode = null;
let stack = [
    {
        type: "document",
        children: []
    }
];

let rules = [];
function addCSSRules(text) {
    var ast = css.parse(text);
    console.log(JSON.stringify(ast), null, "    ");
    rules.push(...ast.stylesheet.rules);
}

// 假设 selector 是简单选择器: .a  #a  div
function match(element, selector) {
    if (!selector || !element.attributes) {
        return false;
    }

    if (selector.charAt(0) === "#") { // id 选择器
        let attr = element.attributes.filter(attr => attr.name === "id")[0];
        if (attr && attr.value === selector.replace("#", "")) {
            return true;
        }
    } else if (selector.charAt(0) === ".") { // class 选择器
        let attrs = element.attributes.filter(attr => attr.name === "class");
        if (attrs && attr.value === selector.replace('.', '')) {
            return true;
        }
    } else {
        if (element.tagName === selector) {
            return true;
        }
    }

    return false;
}

function computeSpecifity(selector) {
    let p = [0, 0, 0, 0]; // [inline, ID, class, tagName]
    let selectorParts = selector.split(' ');
    for (let part of selectorParts) {
        if (part.charAt(0) === "#") {
            p[1]++;
        } else if (part.charAt(0) === ".") {
            p[2]++;
        } else {
            p[3]++;
        }
    }
    return p;
}

function compare(sp1, sp2) {
    for (let i = 0; i < 4; i++) {
        if (sp1[i] - sp2[i]) {
            return sp1[i] - sp2[i];
        }
    }
    return 0;
}

function computeCSS(element) {
    let elements = stack.slice().reverse(); // slice 来复制，reverse 用来反转父元素序列，标签匹配会从当前元素开始逐级的往外匹配

    if (!element.computedStyle) {
        element.computedStyle = {};
    }

    elements = elements.slice(0, elements.length - 1);

    for (let rule of rules) {
        let selectorParts = rule.selectors[0].split(" ").reverse();

        // 老师的
        if (!match(element, selectorParts[0])) {
            continue;
        }

        let matched = false;

        let j = 1; // 当前选择器的位置
        for (let i = 0; i < elements.length; i++) {
            if (match(elements[i], selectorParts[j])) {
                j++;
            }
        }

        if (j >= selectorParts.length) {
            matched = true;
        }

        if (matched) {
            let sp = computeSpecifity(rule.selectors[0]);
            let computedStyle = element.computedStyle;
            for (let declaration of rule.declarations) {
                if (!computedStyle[declaration.property]) {
                    computedStyle[declaration.property] = {};
                }
                if(!computedStyle[declaration.property].specificity) {
                    computedStyle[declaration.property].value = declaration.value;
                    computedStyle[declaration.property].specificity = sp;
                } else if (compare(computedStyle[declaration.property].specificity, sp) < 0 ){
                    computedStyle[declaration.property].value = declaration.value;
                    computedStyle[declaration.property].specificity = sp;
                }
            }
            console.log('Element', element, 'matched rule', rule)
        }
    }
}

function emit(token) {
    let top = stack[stack.length - 1]; // 用数组来表示 stack，栈顶是最后一个元素
    if (token.type === "startTag") { // 入栈，不会直接把 token 入栈，会入栈一个 element；tag 是书写时的东西，element 是 DOM 中的概念
        let element = {
            type: "element",
            tagName: token.tagName,
            children: [],
            attributes: []
        }

        for (let p in token) {
            if (p !== "type" && p !== "tagName") {
                element.attributes.push({
                    name: p,
                    value: token[p]
                });
            }
        }

        top.children.push(element);
        // element.parent = top; // 添加这个属性后，JSON.stringify 会报错


        stack.push(element);

        computeCSS(element); // 注意时机，是在 startTag 这里

        if (token.isSelfClosing) {
            stack.pop(element);
        }

        currentTextNode = null;
    } else if (token.type === 'endTag') {
        if (top.tagName !== token.tagName) {
            throw new Error("not matched!");
        } else {
            // 遇到 style 标签时，执行添加 CSS 规则的操作
            if (top.tagName === "style") {
                addCSSRules(top.children[0].content);
            }

            stack.pop();
        }
    } else if (token.type === "text") {
        if (currentTextNode === null) {
            currentTextNode = {
                "type": "text",
                "content": ""
            }
            top.children.push(currentTextNode);
        }
        currentTextNode.content += token.content;
    }
    if (token.type !== "text") {
        // console.log(token);
    }
}

// tag 有三种：开始标签；结束标签；自封闭标签
// data 是初始状态
function data(c) {
    if (c === "<") {
        return tagOpen;
    } else if (c === EOF) {
        emit({type: "EOF"});
        return;
    } else {
        emit({type: "text", content: c});
        return data;
    }
}

// 从 < 过来的
function tagOpen(c) {
    if (c === "/") { // 结束标签
        return endTagOpen;
    } else if (c.match(/^[A-Za-z]$/)) { // 开始标签或自封闭标签
        currentToken = {
            type: "startTag",
            tagName: ""
        }
        return tagName(c);
    } else {
        return;
    }
}

// 从 / 过来
function endTagOpen(c) {
    if (c.match(/^[A-Za-z]$/)) { // like: </div>
        currentToken = {
            type: "endTag",
            tagName: ""
        }
        return tagName(c);
    } else if (c === ">") { // </>
        // throw exception
    } else if (c === EOF) { // </EOF
        // throw exception
    } else {
        // throw exception
    }
}

// from: like <d
function tagName(c) {
    if (c.match(/^[\t\n\f ]$/)) { // tab/line feed(换行)/prohibited/space，like: <div class..
        return beforeAttributeName;
    } else if (c === "/") { // like <img/>
        return selfClosingStartTag;
    } else if (c.match(/^[a-zA-Z]$/)) {
        currentToken.tagName += c;
        return tagName;
    } else if (c === ">") { // like <div>...
        emit(currentToken);
        return data;
    } else {
        return tagName;
    }
}

// like <div class..
function beforeAttributeName(c) {
    if (c.match(/^[\t\n\f ]$/)) {
        return beforeAttributeName;
    } else if (c === ">" || c === "/" || c === EOF) {
        return afterAttributeName(c); // <div>
    } else if (c === "=") {
        // throw error
    } else {
        currentAttribute = {
            name: "",
            value: ""
        }
        return attributeName(c);
    }
}

function attributeName(c) {
    if (c.match(/^[\t\n\f ]$/) || c === ">" || c === "/" || c === EOF) { // 表示属性已经结束了，接下来是空格或者别的了
        return afterAttributeName(c);
    } else if (c === "=") {
        return beforeAttributeValue;
    } else if (c === "\u0000") { //\u0000?
    } else if (c === '"' || c === "'" || c === "<") {}
    {
        currentAttribute.name += c;
        return attributeName;
    }
}

function beforeAttributeValue(c) {
    if (c.match(/^[\t\n\f ]$/)) {
        return beforeAttributeValue;
    } else if (c === "\"") {
        return doubleQuotedAttributeValue;
    } else if (c === "\'") {
        return singleQuotedAttributeValue;
    } else if (c === ">") {
        // 老师这里什么也没做
    } else {
        return unquotedAttributeValue(c);
    }
}

function doubleQuotedAttributeValue(c) {
    if (c === "\"") {
        currentToken[currentAttribute.name] = currentAttribute.value;
        return afterQuotedAttributeValue;
    } else if (c === "\u0000") {} else if (c === EOF) {} else {
        currentAttribute.value += c;
        return doubleQuotedAttributeValue;
    }
}

function singleQuotedAttributeValue(c) {
    if (c === "\'") {
        currentToken[currentAttribute.name] = currentAttribute.value;
        return afterQuotedAttributeValue;
    } else if (c === "\u0000") {} else if (c === EOF) {} else {
        currentAttribute.value += c;
        return singleQuotedAttributeValue;
    }
}

function afterQuotedAttributeValue(c) {
    if (c.match(/^[\t\n\f ]$/)) {
        return beforeAttributeName;
    } else if (c === "/") {
        return selfClosingStartTag;
    } else if (c === ">") {
        currentToken[currentAttribute.name] = currentAttribute.value;
        emit(currentToken);
        return data;
    } else {
        return beforeAttributeName(c);
    }
}

function unquotedAttributeValue(c) { // <html maaa=a >
    if (c.match(/^[\t\n\f ]$/)) {
        currentToken[currentAttribute.name] = currentAttribute.value;
        return beforeAttributeName;
    } else if (c === "/") {
        currentToken[currentAttribute.name] = currentAttribute.value;
        return selfClosingStartTag;
    } else if (c === ">") {
        currentToken[currentAttribute.name] = currentAttribute.value;
        emit(currentToken);
        return data;
    } else if (c === "\u0000") {

    } else if (c === EOF) {

    } else {
        currentAttribute.value += c;
        return unquotedAttributeValue;
    }
}

function afterAttributeName(c) {
    if (c.match(/^[\t\n\f ]$/)) {
        return afterAttributeName;
    } else if (c === "/") {
        return selfClosingStartTag;
    } else if (c === "=") {
        return beforeAttributeValue;
    } else if (c === ">") {
        currentToken[currentAttribute.name] = currentAttribute.value;
        emit(currentToken);
        return data;
    } else if (c === EOF) {} else {
        currentAttribute = {
            name: "",
            value: ""
        }
        return attributeName(c);
    }
}

// <img/>
function selfClosingStartTag(c) {
    if (c === ">") {
        currentToken.isSelfClosing = true;
        emit(currentToken);
        return data;
    } else if (c === EOF) {
        // throw exception
    } else {
        // throw exception
    }
}

// 接受 HTML 文本作为参数，返回一颗 DOM 树
module.exports.parseHTML = function parseHTML(html) {
    // 利用状态机（FSM）来实现 HTML 的分析
    let state = data; // 初始状态
    for (let c of html) {
        state = state(c);
    }
    state(EOF);
    return stack[0];
}
