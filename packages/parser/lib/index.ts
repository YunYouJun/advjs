import { TokensList } from 'marked';
import Serialize from './Serialize';

/**
 * 基于 Markdown 解析
 * @param {*} lexer
 */
function parse(tokensList: TokensList) {
  const advTokens = [];
  const serialize = new Serialize();
  for (let i = 0; i < tokensList.length; i++) {
    const token = tokensList[i] as any;
    if (token.text) {
      token['text'] = token['text'].trim();
    }
    let advObject = {};
    switch (token['type']) {
      case 'blockquote':
        advObject = serialize.blockquote(token['text']);
        break;
      case 'heading':
        advObject = serialize.heading(token);
        break;
      case 'paragraph':
        advObject = serialize.paragraph(token['text']);
        break;

      default:
        advObject = token;
        break;
    }
    advTokens.push(advObject);
  }

  return advTokens;
}

export default {
  parse,
};
