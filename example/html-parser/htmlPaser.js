const ncname = '[a-zA-Z_][\\w\\-\\.]*'
const qnameCapture = `((?:${ncname}\\:)?${ncname})`
const startTagOpen = new RegExp(`^<${qnameCapture}`)
const endTag = new RegExp(`^<\\/${qnameCapture}[^>]*>`)
// Regular Expressions for parsing tags and attributes
const attribute = /^\s*([^\s"'<>\/=]+)(?:\s*(=)\s*(?:"([^"]*)"+|'([^']*)'+|([^\s"'=<>`]+)))?/
const startTagClose = /^\s*(\/?)>/
const isPlainTextElement = makeMap('script,style,textarea', true)
const isIgnoreNewlineTag = makeMap('pre,textarea', true)
const shouldIgnoreFirstNewline = (tag, html) => tag && isIgnoreNewlineTag(tag) && html[0] === '\n'

function makeMap (
  str,
  expectsLowerCase
) {
  const map = Object.create(null)
  const list = str.split(',')
  for (let i = 0; i < list.length; i++) {
    map[list[i]] = true
  }
  return expectsLowerCase
    ? val => map[val.toLowerCase()]
    : val => map[val]
}

function makeAttrsMap (attrs) {
  const map = {}
  for (let i = 0, l = attrs.length; i < l; i++) {
    map[attrs[i].name] = attrs[i].value
  }
  return map
}

function createASTElement(tag, attrs, parent) {
  return {
    type: 1,
    tag,
    attrsList: attrs,
    parent,
    attrsMap: makeAttrsMap(attrs),
    children: []
  }
}

window.parseHTML = function (html, options) {
  const stack = []
  let index = 0;
  let last, lastTag
  let unary = false
  while (html) {
    last = html
    // Make sure we're not in a plaintext content element like script/style
    if (!lastTag || !isPlainTextElement(lastTag)) {
      let textEnd = html.indexOf('<')
      if (textEnd === 0) {
        // End tag:
        const endTagMatch = html.match(endTag)
        if (endTagMatch) {
          const curIndex = index
          advance(endTagMatch[0].length)
          parseEndTag(endTagMatch[1], curIndex, index)
          continue
        }

        const startTagMatch = parseStartTag();
        if (startTagMatch) {
          handleStartTag(startTagMatch)
          if (shouldIgnoreFirstNewline(startTagMatch.tagName, html)) {
            advance(1)
          }
          continue
        }
      }

      let text, rest, next
      if (textEnd >= 0) {
        rest = html.slice(textEnd)
        // TODO
        while (
          !endTag.test(rest) &&
          !startTagOpen.test(rest) &&
          !comment.test(rest) &&
          !conditionalComment.test(rest)
        ) {
          // < in plain text, be forgiving and treat it as text
          next = rest.indexOf('<', 1)
          if (next < 0) break
          textEnd += next
          rest = html.slice(textEnd)
        }
        text = html.substring(0, textEnd)
        advance(textEnd)
      }

      if (textEnd < 0) {
        text = html
        html = ''
      }

      if (options.chars && text) {
        options.chars(text)
      }
    } else {
      debugger
    }

    if (html === last) {
      options.chars && options.chars(html)
      break
    }
  }

  function parseStartTag() {
    const start = html.match(startTagOpen)
    if (start) {
      const match = {
        tagName: start[1],
        attrs: [],
        start: index
      }
      advance(start[0].length)
      let end, attr
      while (!(end = html.match(startTagClose)) && (attr = html.match(attribute))) {
        advance(attr[0].length)
        match.attrs.push(attr)
      }
      if (end) {
        match.unarySlash = end[1]
        advance(end[0].length)
        match.end = index
        return match
      }
    }
  }

  function parseEndTag(tagName, start, end) {
    let pos, lowerCasedTagName
    if (start == null) start = index
    if (end == null) end = index

    // Find the closest opened tag of the same type
    if (tagName) {
      lowerCasedTagName = tagName.toLowerCase()
      for (pos = stack.length - 1; pos >= 0; pos--) {
        if (stack[pos].lowerCasedTag === lowerCasedTagName) {
          break
        }
      }
    } else {
      // If no tag name is provided, clean shop
      pos = 0
    }

    if (pos >= 0) {
      // Close all the open elements, up the stack
      for (let i = stack.length - 1; i >= pos; i--) {
        // if (process.env.NODE_ENV !== 'production' &&
        //   (i > pos || !tagName) &&
        //   options.warn
        // ) {
        //   options.warn(
        //     `tag <${stack[i].tag}> has no matching end tag.`
        //   )
        // }
        if (options.end) {
          options.end(stack[i].tag, start, end)
        }
      }

      // Remove the open elements from the stack
      stack.length = pos
      lastTag = pos && stack[pos - 1].tag
    } else if (lowerCasedTagName === 'br') {
      if (options.start) {
        options.start(tagName, [], true, start, end)
      }
    } else if (lowerCasedTagName === 'p') {
      if (options.start) {
        options.start(tagName, [], false, start, end)
      }
      if (options.end) {
        options.end(tagName, start, end)
      }
    }
  }

  function handleStartTag(match) {
    const tagName = match.tagName;
    const l = match.attrs.length;
    const attrs = new Array(l);

    for (let i = 0; i < l; i++) {
      const args = match.attrs[i];
      const value = args[3] || args[4] || args[5] || ''
      attrs[i] = {
        name: args[1],
        value: value
      }
    }

    stack.push({ tag: tagName, lowerCasedTag: tagName.toLowerCase(), attrs: attrs });
    lastTag = tagName;
    

    if (options.start) {
      options.start(tagName, attrs, unary, match.start, match.end)
    }
  }

  function advance(n) {
    index += n
    html = html.substring(n)
  }
}

function parseText(text) {
  const tagRE = /\{\{((?:.|\r?\n)+?)\}\}/g;
  let tokens = [],
      rawTokens = [];
  let lastIndex = tagRE.lastIndex = 0
  let match, index
  while((match = tagRE.exec(text))) {
    index = match.index

    if (index > lastIndex) {
      tokenValue = text.slice(lastIndex, index);
      tokens.push(JSON.stringify(tokenValue));
      rawTokens.push(tokenValue);
    }
    const exp = match[1].trim();
    tokens.push(`_s(${exp})`)
    rawTokens.push({ '@binding': exp })
    lastIndex = index + match[0].length

    if (lastIndex < text.length) {
      rawTokens.push(tokenValue = text.slice(lastIndex))
      tokens.push(JSON.stringify(tokenValue))
    }
    
  }

  return {
    expression: tokens.join('+'),
    tokens: rawTokens
  } 
}

window.parse = function(template, options) {

  let root
  let currentParent
  let stack = [];

  function closeElement (element) {
    // apply post-transforms
    // for (let i = 0; i < postTransforms.length; i++) {
    //   postTransforms[i](element, options)
    // }
  }

  parseHTML(template,{
    start(tag, attrs, unary) {
      const element = createASTElement(tag, attrs, currentParent);

      if (!root) {
        root = element;
      } else if (!stack.length) {
        // allow root elements with v-if, v-else-if and v-else
      }

      if (currentParent && !element.forbidden) {
        currentParent.children.push(element)
        element.parent = currentParent
      }

      if (!unary) {
        currentParent = element;
        stack.push(element);
      } else {
        closeElement(element)
      }
    },
    end() {
      const element = stack[stack.length - 1];
      stack.length -= 1;
      currentParent = stack[stack.length - 1];
      closeElement(element);
    },
    chars(text) {
      const trimText = text.trim();
      const children = currentParent.children
      let res;
      if (trimText) {
        if (trimText !== ' ' && (res = parseText(trimText))) {
          children.push({
            type:2,
            expression: res.expression,
            text,
            tokens: res.tokens
          })
        } else if (trimText !== ' ') {
          children.push({
            type: 2,
            text
          })
        }
      }
    },
    comment() {

    }
  })

  return root
}