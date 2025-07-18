import { CodeJar } from 'codejar';

import hljs from "highlight.js/lib/core";
import ruby from "highlight.js/lib/languages/ruby";
hljs.registerLanguage('ruby', ruby);


document.addEventListener("DOMContentLoaded", () => {
  const editors = document.querySelectorAll("[data-editor='external']");
  editors.forEach((editor) => {
    const highlight = (editor) => {
      delete editor.dataset.highlighted;
      editor.textContent = editor.textContent;
      hljs.highlightElement(editor);
    }

    const jar = CodeJar(editor, highlight);
    currentCode = editor.textContent;
    jar.updateCode(currentCode);
  })
  window.dispatchEvent(new Event("jar-ready"));
});
