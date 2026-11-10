(function () {
  'use strict';
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  function html(value) {
    const text=String(value ?? '');let result='',offset=0;
    const pattern=/(?:https?:\/\/|www\.)[^\s<>"']+/gi;
    for(const match of text.matchAll(pattern)) {
      let link=match[0];
      if(match.index>0&&/[\w/:]/.test(text[match.index-1]))continue;
      link=link.replace(/[.,!?:;]+$/g,'');
      for(const [open,close] of [['(',')'],['[',']'],['{','}']])while(link.endsWith(close)&&link.split(close).length>link.split(open).length)link=link.slice(0,-1);
      try {
        const url=new URL(/^www\./i.test(link)?'https://'+link:link);
        if(!['http:','https:'].includes(url.protocol)||!url.hostname)continue;
        result+=escape(text.slice(offset,match.index))+`<a class="message-link" href="${escape(url.href)}" target="_blank" rel="noopener noreferrer">${escape(link)}</a>`;
        offset=match.index+link.length;
      } catch { /* Invalid addresses remain ordinary escaped text. */ }
    }
    return result+escape(text.slice(offset));
  }
  function enhance() {
    const root=document.getElementById('chat-messages');if(!root)return;
    for(const paragraph of root.querySelectorAll('.message-bubble > p')) {
      if(paragraph.querySelector('a.message-link'))continue;
      const value=paragraph.textContent,markup=html(value);
      if(markup!==escape(value))paragraph.innerHTML=markup;
    }
    for(const system of root.querySelectorAll('.message-system'))for(const node of [...system.childNodes]) {
      if(node.nodeType!==3)continue;
      const markup=html(node.textContent);if(markup===escape(node.textContent))continue;
      const template=document.createElement('template');template.innerHTML=markup;node.replaceWith(template.content);
    }
  }
  if(typeof document!=='undefined') {
    const root=document.getElementById('chat-messages');
    if(root){let queued=false;new MutationObserver(()=>{if(queued)return;queued=true;queueMicrotask(()=>{queued=false;enhance();});}).observe(root,{childList:true,subtree:true,characterData:true});enhance();}
  }
  window.CAGE_LINKS={html,enhance};
})();
