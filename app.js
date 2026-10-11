(() => {
  "use strict";
  const SAVE_KEY = "neon-requiem-save-v1";
  const $ = (id) => document.getElementById(id);
  const state = {
    meta: { runs: 0, echo: 0, gifts: [], records: [] },
    run: null,
    selectedOrigin: "slum",
    selectedGifts: [],
    pendingEvent: null,
    log: []
  };
  const origins = {
    slum: { label: "下層区育ち", tech: 8, int: 0, credits: 20, humanity: 0, stress: 0, note: "街の裏側を知っている。まともな入口は、最初から閉じていた。" },
    corp: { label: "企業区育ち", tech: 0, int: 8, credits: 0, humanity: 0, stress: 10, note: "整った教育と、消えない監視記録を与えられた。" },
    clinic: { label: "研究施設出身", tech: 3, int: 5, credits: 0, humanity: -3, stress: 4, note: "あなたの出生記録には、ひとつだけ黒塗りの項目がある。" }
  };
  const giftDefs = [
    { id:"echo_memory", name:"前世の残響", desc:"開始時の知性 +5。過去の夢を見る。", effect:r=>{r.int+=5;} },
    { id:"soft_shell", name:"義体適応", desc:"技術 +5。探索時の負傷を少し軽減。", effect:r=>{r.tech+=5;r.cyberAdapt=true;} },
    { id:"last_promise", name:"死者の記録", desc:"ナオとの信頼 +10。再会の記憶が残る。", effect:r=>{r.trust+=10;} },
    { id:"lucky_glitch", name:"偶然の改変", desc:"探索の報酬増加。危険な事件も起きやすい。", effect:r=>{r.lucky=true;} },
    { id:"corp_shadow", name:"企業の影", desc:"開始資金 +80。監視レベルも上昇。", effect:r=>{r.credits+=80;r.stress+=8;} },
    { id:"human_echo", name:"人間の名残", desc:"人間性 +12。", effect:r=>{r.humanity=Math.min(100,r.humanity+12);} }
  ];
  const events = {
    clinic: { id:"clinic", tag:"身体改造", title:"身体を売れば、明日が買える。", text:"地下クリニックが格安の義体改造を持ちかけてきた。成功すれば生き延びやすくなる。だが、代金の一部はあなたの神経系だ。", choices:[
      {label:"改造を受ける", run:()=>{state.run.tech+=8;state.run.health-=8;state.run.cyber+=15;log("地下クリニックで義体を換装した。痛みは、請求書より正直だった。");}},
      {label:"断って、仕事を探す", run:()=>{state.run.credits+=25;state.run.stress+=5;log("改造を断った。代わりに危険な短期仕事を引き受けた。");}},
      {label:"医療記録を盗む", run:()=>{state.run.int+=5;state.run.stress+=12;state.run.flags.add("clinic_secret");log("医療記録を盗み出した。あなたのファイルにも、同じ識別番号があった。");}}
    ]},
    nao: { id:"nao", tag:"関係分岐", title:"ナオからの深夜通信", text:"「企業が私の記憶を買いたがってる。断れば、仕事も住む場所もなくなる」ナオは笑おうとした。あなたは、その笑い方を知っている。", choices:[
      {label:"一緒に逃げる計画を立てる", run:()=>{state.run.trust+=15;state.run.affection+=10;state.run.credits-=15;state.run.flags.add("promise");log("ナオと逃走計画を立てた。約束は、ふたりぶんの危険になった。");}},
      {label:"企業の契約書を調べる", run:()=>{state.run.int+=5;state.run.tech+=4;state.run.trust+=5;state.run.flags.add("nao_research");log("契約書の裏に、記憶の削除条項を見つけた。ナオにはまだ伝えていない。");}},
      {label:"巻き込まれないよう距離を置く", run:()=>{state.run.trust-=12;state.run.stress-=5;state.run.flags.add("nao_distance");log("通信を切った。ナオは引き止めなかった。そこが一番痛かった。");}}
    ]},
    job: { id:"job", tag:"企業契約", title:"署名欄には、あなたの名前がある。", text:"巨大企業ヘリックスから高額契約が届いた。仕事は簡単だ。事故の記録を消すだけ。被害者の名前は、ナオと同じ姓だった。", choices:[
      {label:"契約を受ける", run:()=>{state.run.credits+=100;state.run.stress+=15;state.run.humanity-=8;state.run.flags.add("corp_contract");log("事故記録を消した。口座残高は増え、眠りは浅くなった。");}},
      {label:"被害記録を外部に流す", run:()=>{state.run.trust+=8;state.run.stress+=18;state.run.credits-=20;state.run.flags.add("leak");log("被害記録を流出させた。都市のニュースは三分で次の話題に移った。");}},
      {label:"契約を破棄する", run:()=>{state.run.stress+=3;state.run.flags.add("refused_contract");log("契約を破棄した。ヘリックスは、拒絶を記録した。");}}
    ]}
  };
  function clamp(n,min=0,max=100){return Math.max(min,Math.min(max,n));}
  function save(){try{const payload={meta:state.meta,run:state.run?{...state.run,flags:[...state.run.flags]}:null,log:state.log,pendingEvent:state.pendingEvent};localStorage.setItem(SAVE_KEY,JSON.stringify(payload));}catch(e){toast("保存できません。ブラウザの空き容量を確認してください。");}}
  function load(){try{const raw=localStorage.getItem(SAVE_KEY);if(!raw)return false;const d=JSON.parse(raw);if(!d||!d.meta)return false;state.meta=d.meta;state.run=d.run;state.log=d.log||[];state.pendingEvent=d.pendingEvent||null;return true;}catch(e){return false;}}
  function toast(message){const el=$("toast");el.textContent=message;el.classList.add("show");window.clearTimeout(toast.timer);toast.timer=window.setTimeout(()=>el.classList.remove("show"),2400);}
  function log(text){const r=state.run;if(!r)return;state.log.unshift({month:r.month,text});state.log=state.log.slice(0,30);renderLog();save();}
  function startLife(name){state.meta.runs++;const o=origins[state.selectedOrigin];const r={id:state.meta.runs,name:name.trim()||"名無しの市民",origin:state.selectedOrigin,age:18,month:0,health:100,stress:clamp(12+o.stress),humanity:clamp(80+o.humanity),int:35+o.int,tech:35+o.tech,physical:40,credits:120+o.credits,cyber:0,trust:20,affection:15,alive:true,flags:new Set(),gear:[],cause:"",cyberAdapt:false,lucky:false};state.run=r;state.log=[];state.pendingEvent=null;
    for(const id of state.meta.gifts){const gift=giftDefs.find(g=>g.id===id);if(gift)gift.effect(r);}
    $("startScreen").hidden=true;$("deathScreen").hidden=true;$("gameScreen").hidden=false;
    log("あなたは"+o.label+"として生まれた。都市は歓迎しなかったが、出生届は受理された。");
    log(o.note);render();save();
  }
  function render(){const r=state.run;if(!r)return;const o=origins[r.origin];$("runNumber").textContent="#"+String(r.id).padStart(3,"0");$("characterName").textContent=r.name;$("characterBio").textContent=o.label+" · "+(r.cyber>0?"義体化 "+r.cyber+"%":"無所属");$("ageValue").textContent=r.age;$("dateValue").textContent="YEAR "+String(Math.floor(r.month/12)+1).padStart(2,"0")+" / M"+String(r.month%12+1).padStart(2,"0");
    setMeter("health",r.health);setMeter("stress",r.stress);setMeter("humanity",r.humanity);$("creditsValue").textContent=Math.floor(r.credits);$("techValue").textContent=r.tech;$("intValue").textContent=r.int;$("echoValue").textContent=state.meta.echo;$("trustValue").textContent=r.trust;$("trustBar").style.width=r.trust+"%";$("affectionValue").textContent=r.affection;$("affectionBar").style.width=r.affection+"%";
    $("personNote").textContent=r.flags.has("promise")?"「約束、忘れてないよ」ナオは逃走計画の進捗を待っている。":r.flags.has("nao_distance")?"ナオからの通信は途絶えた。連絡先はまだ消せない。":"「いつか、この街を出よう」ナオはその約束を覚えている。";
    $("eventPanel").hidden=!state.pendingEvent;$("advanceButton").disabled=!!state.pendingEvent;$("autoButton").disabled=!!state.pendingEvent;renderLog();if(state.pendingEvent)renderEvent();
  }
  function setMeter(name,value){$(name+"Text").textContent=Math.round(value)+" / 100";$(name+"Bar").style.width=clamp(value)+"%";}
  function renderLog(){$("lifeLog").innerHTML="";state.log.slice(0,12).forEach(entry=>{const li=document.createElement("li");const date=document.createElement("span");date.className="log-date";date.textContent=entry.month===0?"BIRTH":"Y"+String(Math.floor(entry.month/12)+1).padStart(2,"0")+" M"+String(entry.month%12+1).padStart(2,"0");const text=document.createElement("span");text.className="log-text";text.textContent=entry.text;li.append(date,text);$("lifeLog").append(li);});$("logCount").textContent=state.log.length+" FRAGMENTS";}
  function renderEvent(){const e=state.pendingEvent;if(!e)return;$("eventTag").textContent=e.tag;$("eventTitle").textContent=e.title;$("eventText").textContent=e.text;$("eventChoices").innerHTML="";e.choices.forEach((c,i)=>{const b=document.createElement("button");b.className="choice-button";const n=document.createElement("span");n.textContent=String(i+1).padStart(2,"0");const label=document.createElement("b");label.textContent=c.label;b.append(n,label);b.addEventListener("click",()=>{c.run();state.pendingEvent=null;checkLife();render();save();});$("eventChoices").append(b);});}
  function monthTick(){const r=state.run;if(!r||!r.alive||state.pendingEvent)return;r.month++;r.age=18+Math.floor(r.month/12);r.stress=clamp(r.stress+2);r.credits-=35;if(r.credits<0){r.health-=3;r.stress+=4;log("家賃を払えなかった。都市は遅延に利息をつける。");}if(r.month%3===0){r.health=clamp(r.health-1+(r.stress<35?2:0));r.stress=clamp(r.stress-2);}
    if(r.month%4===0&&r.trust<90&&!r.flags.has("nao_distance")){r.trust=clamp(r.trust+1);r.affection=clamp(r.affection+1);}
    if(r.month===2&&!r.flags.has("first_event")){r.flags.add("first_event");state.pendingEvent=events.nao;}
    else if(r.month>2&&r.month%7===0&&!r.flags.has("clinic_seen")){r.flags.add("clinic_seen");state.pendingEvent=events.clinic;}
    else if(r.month>4&&r.month%9===0&&!r.flags.has("contract_seen")){r.flags.add("contract_seen");state.pendingEvent=events.job;}
    else if(r.month%12===0)log("誕生日を迎えた。"+r.age+"歳。都市は何も覚えていない。");
    else if(Math.random()<.22)log(["電車で誰かが泣いていた。誰も顔を上げなかった。","街頭広告が、あなたの古い夢を正確に言い当てた。","ナオから短いメッセージが届いた。返事はあとでいい。","雨に混じって、焼けた回路の匂いがした。"][Math.floor(Math.random()*4)]);
    checkLife();render();save();}
  function act(type){const r=state.run;if(!r||state.pendingEvent||!r.alive)return;
    if(type==="work"){r.credits+=65+Math.floor(r.tech/5);r.stress=clamp(r.stress+8);r.health=clamp(r.health-2);log("危険手当のつく仕事を終えた。給料は入ったが、身体が軋む。");}
    if(type==="explore"){const risk=Math.random();if(risk<.28){const damage=Math.max(4,Math.floor(16-r.physical/10-(r.cyberAdapt?4:0)));r.health=clamp(r.health-damage);r.stress=clamp(r.stress+12);log("廃棄区画で待ち伏せに遭った。"+damage+"の負傷。だが、使えそうな部品を回収した。");r.credits+=25;if(risk<.1){r.gear.push("遺物");state.meta.records.push("初回探索の遺物");log("奇妙な遺物を拾った。死んでも、これは記録に残るかもしれない。");}}else{r.credits+=r.lucky?75:45;r.tech=clamp(r.tech+2,1,100);log("放棄された施設を探索した。使える部品と、古い誰かの記録を見つけた。");if(Math.random()<.25){r.gear.push("即席スマートピストル");log("装備を入手：即席スマートピストル。");}}}
    if(type==="talk"){if(r.flags.has("nao_distance")){r.stress=clamp(r.stress+4);log("ナオに連絡したが、既読はつかなかった。");}else{r.trust=clamp(r.trust+8);r.affection=clamp(r.affection+6);r.stress=clamp(r.stress-8);log("ナオと安い屋台で食事をした。短い時間だけ、街が遠くなった。");}}
    if(type==="rest"){r.credits-=15;r.health=clamp(r.health+18);r.stress=clamp(r.stress-18);log("安宿で休んだ。壁の向こうから、誰かの人生が聞こえた。");}
    monthTick();}
  function checkLife(){const r=state.run;if(!r||!r.alive)return;if(r.health<=0){endLife("身体機能の停止");return;}if(r.age>=80){endLife("寿命");return;}if(r.stress>=100){r.health-=10;r.stress=75;log("精神負荷が限界に達した。身体が先に悲鳴を上げた。");if(r.health<=0)endLife("精神負荷による身体機能停止");}}
  function endLife(cause){const r=state.run;if(!r||!r.alive)return;r.alive=false;r.cause=cause;state.pendingEvent=null;const years=Math.max(0,r.age-18);const story=(r.flags.has("promise")?10:0)+(r.flags.has("leak")?8:0)+(r.flags.has("corp_contract")?5:0)+(r.trust>60?5:0);const earned=Math.max(3,Math.floor(years/3)+Math.floor(r.tech/20)+story+Math.floor(r.gear.length/2));state.meta.echo+=earned;state.meta.records.push({name:r.name,age:r.age,cause,month:r.month,trust:r.trust,flags:[...r.flags],earned});state.meta.records=state.meta.records.slice(-50);$("gameScreen").hidden=true;$("deathScreen").hidden=false;$("deathSummary").textContent=r.name+"、"+r.age+"歳。"+cause+"。この人生は"+state.log.length+"件の記録とともに封印された。";$("earnedEcho").textContent="+"+earned+" ECHO";$("deathCause").textContent="到達年齢 "+r.age+"歳 · 信頼 "+r.trust+" · 今回の残響を獲得";renderGifts();save();}
  function renderGifts(){$("giftChoices").innerHTML="";state.selectedGifts=[];const unlocked=giftDefs.filter(g=>state.meta.gifts.includes(g.id));const candidates=unlocked.length?unlocked:giftDefs.slice(0,3);candidates.forEach(g=>{const label=document.createElement("label");label.className="gift-card";const input=document.createElement("input");input.type="checkbox";input.value=g.id;input.addEventListener("change",()=>{state.selectedGifts=[...$("giftChoices").querySelectorAll("input:checked")].map(x=>x.value);if(state.selectedGifts.length>2){input.checked=false;state.selectedGifts=state.selectedGifts.filter(id=>id!==g.id);toast("次の人生に持ち越せるギフトは2つまで。");}});const wrap=document.createElement("span");const title=document.createElement("b");title.textContent=g.name;const desc=document.createElement("small");desc.textContent=g.desc;wrap.append(title,desc);label.append(input,wrap);$("giftChoices").append(label);});if(!unlocked.length){$("giftChoices").insertAdjacentHTML("beforebegin",'<p class="muted" style="font-size:11px">初回昇天：次の人生に持ち越すギフトを最大2つ選ぶ。選択したギフトは恒久解禁されます。</p>');}}
  function ascend(){const chosen=state.selectedGifts.slice();chosen.forEach(id=>{if(!state.meta.gifts.includes(id))state.meta.gifts.push(id);});state.run=null;state.pendingEvent=null;save();$("deathScreen").hidden=true;$("startScreen").hidden=false;$("gameScreen").hidden=true;$("nameInput").value="";toast("残響を保存しました。次の人生を起動できます。");}
  function reset(){if(!confirm("現在の人生とこのブラウザ内の記録をすべて消去します。元に戻せません。続行しますか？"))return;localStorage.removeItem(SAVE_KEY);state.meta={runs:0,echo:0,gifts:[],records:[]};state.run=null;state.log=[];state.pendingEvent=null;$("gameScreen").hidden=true;$("deathScreen").hidden=true;$("startScreen").hidden=false;toast("ローカルデータを消去しました。");}
  function exportSave(){const data={meta:state.meta,run:state.run?{...state.run,flags:[...state.run.flags]}:null,log:state.log,version:1};const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download="neon-requiem-record.json";a.click();URL.revokeObjectURL(url);toast("記録ファイルを作成しました。");}
  document.querySelectorAll(".origin-card").forEach(b=>b.addEventListener("click",()=>{document.querySelectorAll(".origin-card").forEach(x=>x.classList.remove("selected"));b.classList.add("selected");state.selectedOrigin=b.dataset.origin;}));
  $("startButton").addEventListener("click",()=>startLife($("nameInput").value));
  document.querySelectorAll("[data-action]").forEach(b=>b.addEventListener("click",()=>act(b.dataset.action)));
  $("advanceButton").addEventListener("click",monthTick);
  $("autoButton").addEventListener("click",()=>{for(let i=0;i<6;i++){if(state.pendingEvent||!state.run?.alive)break;monthTick();}});
  $("ascendButton").addEventListener("click",ascend);$("resetButton").addEventListener("click",reset);$("saveExportButton").addEventListener("click",exportSave);
  $("soundToggle").addEventListener("click",()=>toast("演出設定は今後追加予定です。"));
  if(load()){if(state.run?.alive){state.run.flags=new Set(state.run.flags||[]);$("startScreen").hidden=true;$("gameScreen").hidden=false;$("deathScreen").hidden=true;render();}else if(state.run&&!state.run.alive){$("startScreen").hidden=true;$("gameScreen").hidden=true;$("deathScreen").hidden=false;renderGifts();$("deathSummary").textContent=state.run.name+"、"+state.run.age+"歳。"+state.run.cause+"。";$("earnedEcho").textContent="残響 "+state.meta.echo;$("deathCause").textContent="記録は保存されています。";}else{state.run=null;}}
  if("serviceWorker" in navigator && location.protocol.startsWith("http"))window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js").catch(()=>{}));
})();