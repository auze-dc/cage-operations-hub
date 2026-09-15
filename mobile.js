(function(){
'use strict';
const phone=window.matchMedia('(max-width:680px)'),drawer=window.matchMedia('(max-width:900px)');
const sidebar=document.querySelector('.sidebar'),chat=document.querySelector('.chat-workspace');
const back=document.createElement('button');back.type='button';back.dataset.view='chat';back.className='mobile-chat-back';back.textContent='‹ Conversations';back.setAttribute('aria-label','Back to conversation list');document.querySelector('.chat-main').prepend(back);
back.addEventListener('click',()=>{chat.classList.remove('mobile-conversation-open');document.querySelector('.chat-channel.active')?.focus();});
const choose=window.selectChatThread;window.selectChatThread=function(...args){const result=choose.apply(this,args);if(phone.matches)chat.classList.add('mobile-conversation-open');return result;};
const changeView=window.setView;window.setView=function(view,...args){const result=changeView.call(this,view,...args);if(phone.matches&&view==='chat')chat.classList.remove('mobile-conversation-open');return result;};
function viewport(){const height=window.visualViewport?.height||window.innerHeight;document.documentElement.style.setProperty('--cage-visible-height',height+'px');document.body.classList.toggle('mobile-keyboard-open',phone.matches && window.innerHeight-height>140);if(!drawer.matches)document.body.classList.remove('mobile-nav-open');}
window.visualViewport?.addEventListener('resize',viewport);window.addEventListener('resize',viewport);viewport();
let returnFocus;
new MutationObserver(()=>{const open=drawer.matches&&sidebar.classList.contains('open');document.body.classList.toggle('mobile-nav-open',open);if(open){returnFocus=document.activeElement;document.getElementById('close-sidebar')?.focus();}else if(returnFocus){returnFocus?.focus?.();returnFocus=null;}}).observe(sidebar,{attributes:true,attributeFilter:['class']});
document.addEventListener('keydown',event=>{if(!drawer.matches||!sidebar.classList.contains('open'))return;if(event.key==='Escape'){closeSidebar();return;}if(event.key!=='Tab')return;const list=[...sidebar.querySelectorAll('button,a,input,select,[tabindex="0"]')].filter(el=>!el.hidden&&!el.disabled&&el.getClientRects().length);const first=list[0],last=list[list.length-1];if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}});
const prepared=new WeakSet();
function tables(){document.querySelectorAll('.view-panel table,.app-dialog table').forEach(table=>{if(prepared.has(table))return;prepared.add(table);let wrapper=table.parentElement;if(!wrapper.matches('.table-wrap,.opportunity-table-wrap,.mobile-table-scroll')){wrapper=document.createElement('div');table.before(wrapper);wrapper.append(table);}wrapper.classList.add('mobile-table-scroll');wrapper.tabIndex=0;wrapper.setAttribute('role','region');wrapper.setAttribute('aria-label','Scrollable table. Swipe sideways to see more columns.');});}
let queued=false;new MutationObserver(()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;tables();});}).observe(document.body,{childList:true,subtree:true});tables();
})();
