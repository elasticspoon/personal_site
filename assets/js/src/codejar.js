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

document.addEventListener("DOMContentLoaded", () => {
  const snippets = document.querySelectorAll("codapi-snippet");
  snippets.forEach((snippet) => {

    // Create version selector
    if (snippet.versions && snippet.editor == 'external' && snippet.selector) {
      const editor = document.querySelector(snippet.selector);
      const label = document.createElement('label');
      label.className = 'sr-only';
      label.textContent = 'Select version';
      label.htmlFor = `select-${editor.id}`;

      const select = document.createElement('select');
      select.className = 'playground__version-selector';
      select.id = label.htmlFor;

      snippet.versions.forEach(version => {
        const option = document.createElement('option');
        option.value = version;
        option.textContent = version;
        select.appendChild(option);
      });


      const version = snippet.sandbox.split(':')[1] || 'head';
      select.value = version;

      // Handle version changes
      select.addEventListener('change', () => {
        snippet.setVersion(select.value);
      });

      snippet.style.position = 'relative';
      const playground = editor.closest('.playground');
      playground.appendChild(select);
      playground.appendChild(label);
    }
  })
});
