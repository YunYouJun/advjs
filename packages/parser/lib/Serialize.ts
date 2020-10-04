import { Tokens } from 'marked';

export type AdvItem =
  | Unknown
  | Paragraph
  | Line
  | Narration
  | Character
  | Words;

export interface Unknown {
  type: 'unknown';
}

export interface Paragraph {
  type: 'paragraph';
  children: Line[];
}

export interface Line {
  type: 'line';
  character: Character;
  words: Words;
}

/**
 * 旁白
 */
export interface Narration {
  type: 'narration';
  text: string;
}

/**
 * 人物信息
 */
export interface Character {
  type: 'character';
  name: string;
  status: string;
}

/**
 * 人物对话
 */
export interface Words {
  type: 'words';
  text: string;
}

/**
 * 序列化
 */
export default class Serialize {
  /**
   * 处理标题
   * @param text
   */
  heading(token: Tokens.Heading) {
    const info = {
      type: 'heading',
      depth: token['depth'],
      text: token['text'],
    };
    return info;
  }

  /**
   * 处理引用块
   * @param text
   */
  blockquote(text: string) {
    const info: Narration = {
      type: 'narration',
      text,
    };
    return info;
  }

  /**
   * 处理段落
   * @param text
   */
  paragraph(text: string) {
    const info: Paragraph = {
      type: 'paragraph',
      children: [],
    };
    const lines = text.split('\n');
    if (Array.isArray(lines)) {
      lines.forEach(line => {
        if (line) {
          info.children.push(this.line(line));
        }
      });
    }
    return info;
  }

  /**
   * 处理单行文本
   * @param text
   */
  line(text: string) {
    const info: Line = {
      type: 'line',
      character: {
        type: 'character',
        name: '',
        status: '',
      },
      words: {
        type: 'words',
        text: '',
      },
    };
    const delimiters = [':', '：'];
    let pos = 0;
    delimiters.some(delimiter => {
      pos = text.indexOf(delimiter);
      if (pos > -1) {
        return true;
      }
    });

    const characterInfo = text.slice(0, pos);
    info.character = this.character(characterInfo);

    const words = text.slice(pos + 1);
    info.words = this.words(words);

    return info;
  }

  // special for advjs

  /**
   * 人物信息
   */
  character(text: string) {
    const leftBracket = ['(', '（'];
    const rightBracket = [')', '）'];

    const info: Character = {
      type: 'character',
      name: '',
      status: '',
    };

    for (let i = 0; i < leftBracket.length; i++) {
      if (text.indexOf(leftBracket[i]) === -1) {
        continue;
      }

      const re = new RegExp(`(.*)${leftBracket[i]}(.*?)${rightBracket[i]}`);
      const r = text.match(re);

      if (r) {
        info.name = r[1];
        info.status = r[2];
      }
    }

    if (!info.name) info.name = text;

    return info;
  }

  /**
   * 话语
   * @param words
   */
  words(text: string) {
    const info: Words = {
      type: 'words',
      text,
    };
    return info;
  }
}
