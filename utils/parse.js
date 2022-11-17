import fs from 'fs';

let currentArticleURL
const replacer = (
  match,
  p1,
) => {
  return match
    .replace("#" + p1, currentArticleURL + "#" + p1)
    .replace('<a', '<a target="_blank"');
}

export const parseHTML = (content, title, url) => {
  currentArticleURL = url
  const find = '<a href="/wiki';
  const re = new RegExp(find, 'g');
  const replace = '<a target="_blank" href="https://wikipedia.org/wiki';
  let finalHtml = content.replace(re, replace);

  const find2 = '<a href="#cite_note';
  const re2 = new RegExp(find2, 'g');
  const replace2 = '<a target="_blank" href="' + url + '#cite_note';
  finalHtml = finalHtml.replace(re2, replace2);

  const find3 = '<a href="#cite_ref';
  const re3 = new RegExp(find3, 'g');
  const replace3 = '<a target="_blank" href="' + url + '#cite_ref';
  finalHtml = finalHtml.replace(re3, replace3);

  let head = '<html><head><link rel="stylesheet" href="https://arweave.net/zeD-oNKfwNXE4k4-QeCAR3UZIfLXA7ettyi8qGZqd7g"><title>' + title + '</title><meta charset="UTF-8"><meta name="description" content="' + title + ' Permaweb Page"></head><body>';
  finalHtml = head + finalHtml;
  finalHtml = finalHtml + "</body></html>";

  let tocReg = new RegExp('<a href="#' + '(.*)' + '"><span class="tocnumber">', 'g');
  finalHtml = finalHtml.replace(tocReg, replacer);

  let regEditElement = new RegExp('<span class="mw-editsection">' + '(.*)' + '</span>', 'g');
  finalHtml = finalHtml.replace(regEditElement, '');

  return finalHtml;
}