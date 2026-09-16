/* CAGE messenger presentation. Keeps existing send, access and receipt paths. */
(function(){
'use strict';
const $=id=>document.getElementById(id), workspace=document.querySelector('.chat-workspace'), form=$('chat-form'), input=$('chat-input');
const icons={plus:'<path d="M12 5v14M5 12h14"/>',search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/>',send:'<path d="m4 4 17 8-17 8 3-8-3-8Zm3 8h14"/>',mic:'<rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3m-4 0h8"/>',more:'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',sun:'<circle cx="12" cy="12" r="4"/><path d="M12 1v3m0 16v3M1 12h3m16 0h3M4 4l2 2m12 12 2 2M4 20l2-2M18 6l2-2"/>',star:'<path d="m12 3 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1 3-6Z"/>'};
const svg=name=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]}</svg>`;
const key=()=>`cage-messenger:${window.CAGE_BACKEND?.currentProfile?.()?.id||'local'}`;
let prefs={favourites:[],theme:'dark'},currentThread='',matches=[],hit=0;
function load(){try{prefs={favourites:[],theme:'dark',...JSON.parse(localStorage.getItem(key())||'{}')};}catch{}if(!Array.isArray(prefs.favourites))prefs.favourites=[];applyTheme();}
function save(){try{localStorage.setItem(key(),JSON.stringify(prefs));}catch{}}
function isFavourite(id){return prefs.favourites.includes(id);}
function applyTheme(){workspace.dataset.messengerTheme=prefs.theme==='light'?'light':'dark';$('chat-theme-toggle')?.setAttribute('aria-label',prefs.theme==='light'?'Use dark chat appearance':'Use light chat appearance');}
const channels=document.querySelector('.chat-channels');
channels.insertAdjacentHTML('afterbegin',`<div class="messenger-heading"><h2>Chats</h2><div><button type="button" class="messenger-icon" id="chat-theme-toggle" title="Change chat appearance">${svg('sun')}</button><button type="button" class="messenger-icon messenger-new" id="chat-new-toggle" aria-label="New conversation" aria-expanded="false" aria-controls="chat-create-menu">${svg('plus')}</button></div></div>`);
const create=document.querySelector('.chat-create-actions');create.id='chat-create-menu';create.hidden=true;
$('new-direct-chat').textContent='New direct message';$('new-group-chat').textContent='New group';
const tools=document.querySelector('.chat-compose-tools');tools.id='chat-extra-tools';tools.hidden=true;
const voice=$('record-voice');if(voice){form.classList.add('has-voice');form.append(voice);voice.className='messenger-icon messenger-voice';voice.innerHTML=svg('mic');voice.title='Record a voice message';}
$('chat-attach').innerHTML=svg('plus');$('chat-attach').title='Attach a file';
form.querySelector('.chat-send').innerHTML=svg('send');form.querySelector('.chat-send').setAttribute('aria-label','Send message');form.querySelector('.chat-send').title='Send message';
$('chat-attach').insertAdjacentHTML('afterend',`<button type="button" class="messenger-icon" id="chat-tools-toggle" aria-label="Message options and mentions" aria-controls="chat-extra-tools" aria-expanded="false" title="Message options and mentions">${svg('more')}</button>`);
$('chat-header').insertAdjacentHTML('afterend','<div class="messenger-find" id="messenger-find" hidden><input type="search" id="message-find-input" aria-label="Search this conversation" placeholder="Search this conversation"><span id="message-find-count" role="status"></span><button type="button" id="message-find-prev" aria-label="Previous match">↑</button><button type="button" id="message-find-next" aria-label="Next match">↓</button><button type="button" id="message-find-close" aria-label="Close conversation search">×</button></div>');
function closeMenus(){create.hidden=true;tools.hidden=true;$('chat-new-toggle').setAttribute('aria-expanded','false');$('chat-tools-toggle').setAttribute('aria-expanded','false');$('chat-header-menu')?.setAttribute('hidden','');document.querySelector('[data-chat-menu-toggle]')?.setAttribute('aria-expanded','false');}
$('chat-new-toggle').onclick=()=>{const open=create.hidden;closeMenus();create.hidden=!open;$('chat-new-toggle').setAttribute('aria-expanded',String(open));if(open)$('new-direct-chat').focus();};
create.addEventListener('click',()=>closeMenus());
$('chat-tools-toggle').onclick=()=>{const open=tools.hidden;closeMenus();tools.hidden=!open;$('chat-tools-toggle').setAttribute('aria-expanded',String(open));};
$('chat-mention').addEventListener('click',()=>{tools.hidden=true;$('chat-tools-toggle').setAttribute('aria-expanded','false');});
$('chat-theme-toggle').onclick=()=>{prefs.theme=prefs.theme==='dark'?'light':'dark';save();applyTheme();};
function composer(){form.classList.toggle('has-text',Boolean(input.value.trim()));$('chat-tools-toggle').classList.toggle('has-message-type',$('chat-message-type').value!=='Update');input.style.height='auto';input.style.height=input.value?Math.min(input.scrollHeight,matchMedia('(max-width:680px)').matches?110:150)+'px':'42px';}
input.addEventListener('input',composer);window.addEventListener('resize',composer);$('chat-message-type').addEventListener('change',()=>{composer();tools.hidden=true;$('chat-tools-toggle').setAttribute('aria-expanded','false');input.focus({preventScroll:true});});
function updateMatches(scroll=false){
 const query=$('message-find-input').value.trim().toLocaleLowerCase();matches=[];
 document.querySelectorAll('#chat-messages .message-row').forEach(row=>{const matched=Boolean(query)&&row.querySelector('.message-bubble').textContent.toLocaleLowerCase().includes(query);row.classList.toggle('chat-search-hit',matched);row.classList.remove('chat-search-current');if(matched)matches.push(row);});
 hit=Math.min(hit,Math.max(0,matches.length-1));$('message-find-count').textContent=query?(matches.length?`${hit+1} of ${matches.length}`:'No matches'):'';
 if(matches[hit]){matches[hit].classList.add('chat-search-current');if(scroll)matches[hit].scrollIntoView({block:'center',behavior:'auto'});}
 $('message-find-prev').disabled=$('message-find-next').disabled=!matches.length;
}
$('message-find-input').addEventListener('input',()=>{hit=0;updateMatches(true);});
$('message-find-prev').onclick=()=>{hit=(hit-1+matches.length)%matches.length;updateMatches(true);};$('message-find-next').onclick=()=>{hit=(hit+1)%matches.length;updateMatches(true);};
function closeSearch(){ $('messenger-find').hidden=true;$('message-find-input').value='';updateMatches();}
$('message-find-close').onclick=()=>{closeSearch();document.querySelector('[data-conversation-search]')?.focus();};
function decorate(){
 if(currentThread!==activeChatThread){currentThread=activeChatThread;closeMenus();closeSearch();$('chat-context').classList.remove('expanded');}
 const head=$('chat-header');
 if(!head.querySelector('[data-conversation-search]')){
  const actions=head.querySelector('.chat-header-actions');if(actions){
   const existing=[...actions.children];
   actions.innerHTML=`<button type="button" class="messenger-icon" data-conversation-search aria-label="Search this conversation" title="Search this conversation">${svg('search')}</button><button type="button" class="messenger-icon" data-chat-menu-toggle aria-label="Conversation options" title="Conversation options" aria-expanded="false" aria-controls="chat-header-menu">${svg('more')}</button><div id="chat-header-menu" class="messenger-menu" hidden><button type="button" data-chat-favourite></button></div>`;
   const menu=$('chat-header-menu');existing.forEach(node=>{if(node.matches('button'))menu.append(node);});
  }
 }
 const favourite=head.querySelector('[data-chat-favourite]');if(favourite){favourite.textContent=isFavourite(activeChatThread)?'Remove from favourites':'Add to favourites';favourite.setAttribute('aria-pressed',String(isFavourite(activeChatThread)));}
 const title=head.querySelector('.chat-header-main strong');const avatar=head.querySelector('.chat-header-main .chat-channel-icon');if(title&&avatar)avatar.textContent=title.textContent.trim().split(/\s+/).slice(0,2).map(w=>w[0]).join('').toUpperCase();
 const thread=threadById(activeChatThread);workspace.classList.toggle('is-direct-chat',Boolean(thread?.direct));
 input.placeholder='Type a message';composer();updateMatches();
 document.querySelectorAll('[data-chat-filter]').forEach(button=>{button.setAttribute('aria-pressed',String(button.dataset.chatFilter===chatFilter));if(button.dataset.chatFilter==='unread'){const count=workThreads().reduce((n,t)=>n+chatUnreadCount(t.id),0);button.textContent=count?`Unread ${count}`:'Unread';}});
}
document.addEventListener('click',event=>{
 const b=event.target.closest('button');if(b?.hasAttribute('data-conversation-search')){closeMenus();$('messenger-find').hidden=false;$('message-find-input').focus();}
 else if(b?.hasAttribute('data-chat-menu-toggle')){const open=$('chat-header-menu').hidden;closeMenus();$('chat-header-menu').hidden=!open;b.setAttribute('aria-expanded',String(open));}
 else if(b?.hasAttribute('data-chat-favourite')){prefs.favourites=isFavourite(activeChatThread)?prefs.favourites.filter(id=>id!==activeChatThread):[...prefs.favourites,activeChatThread];save();closeMenus();renderChat();}
 else if(b?.matches('[data-chat-info],[data-chat-mute],[data-thread-open-view]'))closeMenus();
 else if(!event.target.closest('#chat-create-menu,#chat-new-toggle,#chat-extra-tools,#chat-tools-toggle,#chat-header-menu'))closeMenus();
});
document.addEventListener('keydown',event=>{if(activeView!=='chat'||event.key!=='Escape')return;const focus= !tools.hidden?$('chat-tools-toggle'):!create.hidden?$('chat-new-toggle'):null;closeMenus();closeSearch();focus?.focus();});
const back=document.querySelector('.mobile-chat-back');if(back){back.textContent='‹';back.title='Back to chats';}
const rendered=window.CAGE_CHAT.rendered;window.CAGE_CHAT.rendered=function(...args){rendered.apply(this,args);decorate();};
const sent=window.CAGE_CHAT.sent;window.CAGE_CHAT.sent=function(...args){sent?.apply(this,args);composer();closeMenus();};
// Compact the app rail only while in chat; all navigation remains labelled.
document.querySelectorAll('.side-nav .nav-item').forEach(button=>{button.title=button.querySelector('span:not(.nav-icon)')?.textContent||button.textContent;button.setAttribute('aria-label',button.title);});
window.CAGE_MESSENGER={isFavourite};window.addEventListener('cage:session-ready',()=>{load();if(activeView==='chat')renderChat();});
load();if(activeView==='chat')decorate();
})();
