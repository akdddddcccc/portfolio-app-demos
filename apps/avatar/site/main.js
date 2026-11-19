import {createApp,h} from './vue.js';
import Chat from './chat.js';
const q=new URLSearchParams(location.search), lang=q.get('lang')==='en'?'en':'zh';
document.documentElement.lang=lang;
document.body.classList.toggle('embedded',q.get('embed')==='portfolio');
createApp({render:()=>h(Chat,{lang})}).mount('#app');
if(window.parent!==window && document.body.classList.contains('embedded')){
 const report=()=>window.parent.postMessage({type:'avatar:height',height:Math.ceil(document.getElementById('app').getBoundingClientRect().height)},'*');
 new ResizeObserver(report).observe(document.getElementById('app'));report();
}
