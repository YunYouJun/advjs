import MarkdownIt from 'markdown-it';

const toc = require('markdown-it-table-of-contents');

export interface MarkdownOptions extends MarkdownIt.Options {}

export const createMarkdownRenderer = (options: MarkdownOptions = {}) => {
  const md = MarkdownIt({});

  // custom plugins
  md.use(toc);

  return md;
};
