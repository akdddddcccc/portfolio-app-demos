import { chatWorkTarget } from "./target.js";


export default {
  name: "ContactView", props: ["lang"],
  data(){return {messages:[],draft:"",busy:false,error:"",mode:"loading",remaining:null,imageLive:false,imageRemaining:0,imageId:null,controller:new AbortController()};},
  computed:{
    zh(){return this.lang==="zh";},
    seeds(){return this.zh?["看看陈沐阳的作品","介绍一下陈沐阳的设计经历","陈沐阳平时喜欢做什么？"]:["Show me Chen Muyang’s work","Tell me about Chen Muyang’s design background","What does Chen Muyang enjoy outside design?"];},
    ready(){return this.mode==="demo" || this.mode==="live" && this.remaining!==0;}
  },
  mounted(){this.status();}, beforeUnmount(){this.controller.abort();},
  methods:{
    canSend(text){return !this.busy && !!text.trim() && (this.ready || !!chatWorkTarget(text,this.lang));},
    async status(){try{const r=await fetch("/api/avatar/status",{cache:"no-store",signal:this.controller.signal});const v=await r.json();if(!r.ok||typeof v.live?.chat!=="boolean")throw Error(); this.mode=v.live.chat?"live":"demo";this.remaining=v.quota.chat.remaining;this.imageLive=v.live.image;this.imageRemaining=Math.min(v.quota.image.remaining,v.quota.image.globalRemaining);}catch{this.mode="offline";}},
    scroll(){this.$nextTick(()=>{const n=this.$refs.log;if(n)n.scrollTop=n.scrollHeight;});},
    async draw(id,prompt){
      const msg=this.messages.find(m=>m.id===id);
      try{const r=await fetch("/api/avatar/image",{method:"POST",headers:{"Content-Type":"application/json"},signal:this.controller.signal,body:JSON.stringify({requestId:id,confirm:true,prompt,lang:this.lang})});
        const v=await r.json();if(!r.ok||!v.image?.startsWith("data:image/jpeg;base64,"))throw Error(v.error||(this.zh?"未收到 JPG 图片。":"No JPEG was returned."));
        msg.image=v.image;msg.state="done";
      }catch(e){msg.state="failed";msg.problem=e.message;}
      // Refresh only the image counter. A late image must not change a newer chat turn.
      if(!this.controller.signal.aborted)try{const r=await fetch("/api/avatar/status",{cache:"no-store",signal:this.controller.signal});const v=await r.json();this.imageRemaining=Math.min(v.quota.image.remaining,v.quota.image.globalRemaining);}catch{}
    },
    async send(seed){const text=(seed??this.draft).trim();if(!text||text.length>1000||this.busy)return;
      const target=chatWorkTarget(text,this.lang);
      if(target){
        const tab=window.open('about:blank','_blank');
        if(tab){tab.opener=null;tab.location.replace(new URL(target.href,location.href).href);}
        this.error="";this.draft="";this.messages.push({role:"user",content:text},{role:"assistant",content:tab?(this.zh?'已在新标签页打开：':'Opened in a new tab:'):(this.zh?'浏览器未能打开新标签页，请点这里：':'Open this link in a new tab:'),target});this.scroll();return;
      }
      if(!this.ready)return;
      const history=this.messages.slice(-6).map(({role,content})=>({role,content:content.slice(0,1500)}));
      if(this.imageId?.prompt!==text)this.imageId={prompt:text,id:crypto.randomUUID()};
      this.error="";this.draft="";this.busy=true;this.messages.push({role:"user",content:text});this.scroll();
      try{const r=await fetch("/api/avatar/chat",{method:"POST",headers:{"Content-Type":"application/json"},signal:this.controller.signal,body:JSON.stringify({message:text,lang:this.lang,history,requestId:this.imageId.id})});
        const v=await r.json();if(v.quota){this.remaining=v.quota.chat.remaining;this.imageRemaining=Math.min(v.quota.image.remaining,v.quota.image.globalRemaining);}if(!r.ok||(!v.text&&!v.imagePrompt)){if(v.code)this.imageId=null;throw Error(v.error||"");}
        if(v.imagePrompt){const id=this.imageId.id;this.messages.push({id,role:"assistant",provider:"OpenAI",content:v.imagePrompt,state:"drawing"});this.imageRemaining=Math.max(0,this.imageRemaining-1);void this.draw(id,v.imagePrompt);}
        else this.messages.push({role:"assistant",provider:v.provider,content:v.text,links:(v.links||[]).filter(l=>/^[a-z0-9-]+$/.test(l.slug))});
        this.imageId=null;}
      catch(e){this.messages.pop();if(!this.draft)this.draft=text;this.error=e.message|| (this.zh?"没有收到回答，请稍后再试。":"No reply. Please try again.");}
      finally{this.busy=false;this.scroll();}}
  },
  template:`
    <section class="contact-dialogue">
      <section class="cc-chat" :aria-label="zh?'沐阳的 AI 分身':'Muyang’s AI guide'">
        <header><strong>{{zh?'沐阳的 AI 分身':'Muyang’s AI guide'}}</strong><small role="status">{{mode==='demo'?(zh?'作品资料导览':'Portfolio notes'):mode==='live'?(zh?'在线对话':'Live chat'):mode==='loading'?'…':(zh?'服务未连接':'Disconnected')}}</small><button v-if="mode==='offline'" @click="status">{{zh?'重连':'Reconnect'}}</button></header>
        <div ref="log" class="cc-log" role="log" aria-live="polite">
          <div v-if="!messages.length" class="cc-start"><h2>{{zh?'想从哪里开始？':'What would you like to know about Chen Muyang?'}}</h2><p>{{zh?'可以让我带你看作品，或聊聊沐阳的设计经历。':'I’m Chen Muyang’s AI guide. I can show you his work or tell you about his design background and interests.'}}</p>
            <div><button v-for="s in seeds" :key="s" :disabled="!canSend(s)" @click="send(s)">{{s}}</button></div></div>
          <article v-for="(m,i) in messages" :key="m.id||i" :class="'cc-'+m.role"><small>{{m.role==='user'?(zh?'你':'You'):(zh?'沐阳的 AI 分身':'AI guide')}} {{m.provider}}</small>
            <figure v-if="m.state" class="cc-image-slot" :class="'cc-slot-'+m.state">
              <img v-if="m.image" :src="m.image" :alt="m.content">
              <figcaption v-else role="status"><span v-if="m.state==='drawing'" class="cc-aster" aria-hidden="true">✳</span><strong>{{m.state==='drawing'?(zh?'正在画…':'Drawing…'):(zh?'图片未生成':'Image unavailable')}}</strong><small>{{m.state==='drawing'?(zh?'可以继续聊，画好会出现在这里。':'Keep chatting. Your image will appear here.') : m.problem}}</small></figcaption>
            </figure><p v-else>{{m.content}}</p><a v-if="m.target" :href="m.target.href" target="_blank" rel="noopener">{{m.target.title}}</a><a v-if="m.image" :href="m.image" download="muyang-image.jpg">{{zh?'保存 JPG':'Save JPG'}}</a><a v-for="l in m.links" :key="l.slug" :href="'https://muyang23333.top/#/'+lang+'/project/'+l.slug" target="_blank" rel="noopener">{{l.title}}</a></article>
          <p v-if="busy" role="status">{{zh?'正在整理回答…':'Preparing a reply…'}}</p>
        </div>
        <p v-if="error" role="alert">{{error}}</p>
        <small>{{imageLive?(zh?'找作品直接问；想画什么也可以直接说。':'Ask for existing work, or describe a new image.'):(zh?'可以问公开的设计经历和作品。':'Ask about published projects and design experience.')}} </small>
        <form @submit.prevent="send()"><textarea v-model="draft" rows="1" maxlength="1000" :placeholder="zh?'聊聊作品，或描述想画的东西…':'Ask a question or describe an image…'" :aria-label="zh?'输入消息':'Message'" @keydown.enter="e=>{if(!e.shiftKey&&!e.isComposing&&e.keyCode!==229){e.preventDefault();send();}}"></textarea><button :disabled="!canSend(draft)">{{zh?'发送':'Send'}}</button></form>
      </section>
    </section>`
};
