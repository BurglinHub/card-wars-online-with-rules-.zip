import catalogData from '../data/catalog.json' with { type: 'json' };

const $ = (s) => document.querySelector(s);
const byId = (id) => document.getElementById(id);
const COLORS = ['#4e8177','#cb815f','#708bb0','#9a77a2','#a18b52','#668a58'];
const game = { players:{}, board:[], discard:[], logs:[], turn:0, room:'', hostId:'', catalog:catalogData.collections };
let peer = null, hostConn = null, isHost = false, myId = null, connections = new Set(), toastTimer = null;
const collectionById = new Map(game.catalog.map(c => [c.id,c]));

function escapeHtml(value='') { return String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function randomCode(){ return Math.random().toString(36).slice(2,8).toUpperCase().padEnd(6,'7'); }
function randomId(){ return `${Date.now().toString(36)}${Math.random().toString(36).slice(2,7)}`; }
function notify(message){ const el=byId('toast'); el.textContent=message; el.classList.add('show'); clearTimeout(toastTimer); toastTimer=setTimeout(()=>el.classList.remove('show'),2800); }
function setError(message=''){ const el=byId('lobby-error'); el.textContent=message; el.hidden=!message; }
function setConnection(connected,label){ document.body.classList.toggle('is-connected',connected); byId('connection-label').textContent=label; }
function currentPlayer(){ return game.players[myId]; }
function log(message){ game.logs.unshift({id:randomId(),message,time:new Date().toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'})}); game.logs=game.logs.slice(0,32); }
function shuffled(items){ const copy=items.map(x=>({...x})); for(let i=copy.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[copy[i],copy[j]]=[copy[j],copy[i]];} return copy; }
function cardIndexStyle(card){ const x=Math.max(0,Math.min(9,Number(card.col)||0)); const y=Math.max(0,Math.min(6,Number(card.row)||0)); return `background-image:url('${escapeHtml(card.sheet)}');background-position:${x*100/9}% ${y*100/6}%;`; }
function backStyle(card){ return card?.back ? `background-image:url('${escapeHtml(card.back)}')` : ''; }
function cardFace(card, classes='') { return `<div class="card-face ${classes}" style="${cardIndexStyle(card)}" role="img" aria-label="${escapeHtml(card.title||'Карта')}"></div>`; }
function cardBack(card, classes='') { return `<div class="card-back ${classes}" style="${backStyle(card)}" role="img" aria-label="Карта рубашкой вверх"></div>`; }
function stateFor(viewerId){
 const players=Object.entries(game.players).map(([id,p])=>({id,name:p.name,color:p.color,score:p.score||0,deckName:p.deckName||'',deckCount:p.deck?.length||0,handCount:p.hand?.length||0,hand:id===viewerId?(p.hand||[]):[]}));
 const board=game.board.map(item=> item.faceDown && item.ownerId!==viewerId ? ({...item,card:null,hidden:true}) : ({...item,hidden:false}));
 return {players,board,discard:game.discard,logs:game.logs,turn:game.turn,room:game.room,hostId:game.hostId};
}
function render(){
 byId('lobby').hidden=true; byId('game').hidden=false;
 const p=currentPlayer();
 byId('room-code-display').textContent=game.room||'------';
 byId('player-count').textContent=String(Object.keys(game.players).length);
 byId('players-list').innerHTML=Object.entries(game.players).map(([id,pl],i)=>`<div class="player-chip"><span class="player-avatar" style="background:${pl.color||COLORS[i%COLORS.length]}">${escapeHtml((pl.name||'?').slice(0,1).toUpperCase())}</span><span class="player-name">${escapeHtml(pl.name)}${id===myId?' (ты)':''}</span><span class="player-meta">${id===myId?(pl.hand?.length||0):(pl.handCount??pl.hand?.length??0)} в руке · ${pl.score||0}</span></div>`).join('');
 const ownDeckCount=isHost?(p?.deck?.length||0):(p?.deckCount||0);
 byId('my-deck-count').textContent=ownDeckCount?`${ownDeckCount} карт в колоде`:(p?.deckName?'Колода пуста':'Колода не выбрана');
 byId('my-deck-name').textContent=p?.deckName||'Выбери пачку выше';
 byId('draw-card').disabled=!(ownDeckCount);
 byId('my-score').textContent=String(p?.score||0);
 const turnPlayer=game.players[Object.keys(game.players)[game.turn%Math.max(1,Object.keys(game.players).length)]];
 byId('turn-player').textContent=turnPlayer?.name||'—';
 byId('table-count').textContent=`${game.board.length} ${plural(game.board.length,'карта','карты','карт')} на поле`;
 byId('empty-board').style.display=game.board.length?'none':'flex';
 byId('board-cards').innerHTML=game.board.map((item,index)=>{
   let art=item.hidden?cardBack({},'table-card'):item.faceDown?cardBack(item.card,'table-card'):item.card?cardFace(item.card,'table-card'):cardBack({},'table-card');
   return `<article class="board-item" data-board-index="${index}">${art}<span class="board-caption">${escapeHtml(item.ownerName||'Игрок')} · ${escapeHtml(item.card?.title||'закрытая карта')}</span><div class="board-actions"><button class="mini-action" data-action="flip" data-index="${index}" aria-label="Перевернуть карту">${item.faceDown?'Открыть':'Закрыть'}</button><button class="mini-action" data-action="discard-board" data-index="${index}">В сброс</button></div></article>`;
 }).join('');
 byId('discard-count').textContent=`${game.discard.length} ${plural(game.discard.length,'карта','карты','карт')}`;
 byId('discard-pile').innerHTML=game.discard.length?game.discard.slice(-12).reverse().map(card=>`<div class="card-face discard-thumb" style="${cardIndexStyle(card)}" title="${escapeHtml(card.title||'Карта')}" data-card-view="${escapeHtml(card.id)}"></div>`).join(''):'<span class="discard-empty">Сброшенные карты появятся здесь</span>';
 const hand=p?.hand||[]; byId('hand-count').textContent=String(hand.length);
 byId('hand-cards').innerHTML=hand.length?hand.map((card,i)=>`<article class="hand-item" draggable="true" data-hand-index="${i}">${cardFace(card,'hand-card')}<span class="hand-card-title" title="${escapeHtml(card.title||'Карта')} ">${escapeHtml(card.title||`Карта ${i+1}`)}</span><div class="hand-controls"><button data-action="play" data-index="${i}">Сыграть</button><button data-action="discard-hand" data-index="${i}" aria-label="Сбросить карту">Сброс</button></div></article>`).join(''):'<div class="hand-empty">Возьми колоду и добери карту, чтобы начать.</div>';
 byId('activity-log').innerHTML=game.logs.map(x=>`<li><time>${escapeHtml(x.time)}</time> — ${escapeHtml(x.message)}</li>`).join('');
 byId('log-count').textContent=String(game.logs.length);
 byId('reset-game').hidden=!isHost;
}
function plural(n,one,few,many){const a=n%10,b=n%100;return b>=11&&b<=14?many:a===1?one:a>=2&&a<=4?few:many;}
function sync(){ if(!isHost)return; render(); for(const conn of connections){ if(conn.open&&conn.playerId) conn.send({type:'state',state:stateFor(conn.playerId)}); } }
function execute(command,actorId){
 const p=game.players[actorId]; if(!p)return;
 switch(command.type){
  case 'chooseDeck': {
   const deck=collectionById.get(command.collectionId); if(!deck)return;
   p.deck=shuffled(deck.cards.map((c,i)=>({...c,title:`Карта ${String(i+1).padStart(2,'0')}`}))); p.hand=[];p.deckName=deck.name;
   log(`${p.name} перемешал(а) колоду «${deck.name}»`);break;
  }
  case 'draw': if(p.deck?.length){const card=p.deck.pop();p.hand.push(card);log(`${p.name} взял(а) карту`);}else notify('В этой колоде больше нет карт.'); break;
  case 'play': {const i=Number(command.index);if(!Number.isInteger(i)||!p.hand?.[i])return;const [card]=p.hand.splice(i,1);game.board.push({card,ownerId:actorId,ownerName:p.name,faceDown:false});log(`${p.name} сыграл(а) карту на стол`);break;}
  case 'discardHand': {const i=Number(command.index);if(!Number.isInteger(i)||!p.hand?.[i])return;const [card]=p.hand.splice(i,1);game.discard.push(card);log(`${p.name} сбросил(а) карту`);break;}
  case 'discardBoard': {const i=Number(command.index);if(!game.board[i])return;const [item]=game.board.splice(i,1);game.discard.push(item.card);log(`${p.name} отправил(а) карту в сброс`);break;}
  case 'flip': {const i=Number(command.index);if(!game.board[i])return;game.board[i].faceDown=!game.board[i].faceDown;log(`${p.name} ${game.board[i].faceDown?'закрыл(а)':'открыл(а)'} карту`);break;}
  case 'score': p.score=Math.max(0,(p.score||0)+Number(command.delta||0));log(`${p.name} изменил(а) счёт`);break;
  case 'endTurn': game.turn=(game.turn+1)%Math.max(1,Object.keys(game.players).length);log(`${p.name} передал(а) ход`);break;
  case 'reset': if(actorId!==game.hostId)return;game.board=[];game.discard=[];game.turn=0;for(const player of Object.values(game.players)){player.hand=[];player.deck=[];player.deckName='';player.score=0;}game.logs=[];log('Хост сбросил стол');break;
  default:return;
 }
 sync();
}
function command(type,extra={}){ if(isHost) execute({type,...extra},myId); else if(hostConn?.open)hostConn.send({type:'command',command:{type,...extra}}); else notify('Нет соединения с ведущим комнаты.'); }
function makeHost(){
 setError('');
 if(!window.Peer){setError('Не удалось загрузить PeerJS. Проверь подключение к интернету и обнови страницу.');return;}
 const name=byId('host-name').value.trim()||'Игрок 1', code=randomCode(); isHost=true; myId=randomId(); game.room=code;game.hostId=myId; game.players={[myId]:{name,color:COLORS[0],score:0,hand:[],deck:[],deckName:''}};
 setConnection(false,'Создаём комнату…');
 try{peer=new window.Peer(`atcw-${code.toLowerCase()}`);}catch(e){setError('Не получилось создать соединение. Попробуй ещё раз.');return;}
 peer.on('open',()=>{setConnection(true,'Комната открыта');byId('room-code').value=code;render();notify('Комната готова — отправь друзьям код.');});
 peer.on('connection',conn=>{connections.add(conn);conn.on('data',msg=>{if(msg?.type==='join'){if(Object.keys(game.players).length>=8){conn.send({type:'error',message:'В комнате максимум 8 игроков.'});return;}const id=randomId();conn.playerId=id;const ci=Object.keys(game.players).length%COLORS.length;game.players[id]={name:String(msg.name||'Игрок').slice(0,20),color:COLORS[ci],score:0,hand:[],deck:[],deckName:''};conn.send({type:'welcome',playerId:id,state:stateFor(id)});log(`${game.players[id].name} присоединился(ась) к столу`);sync();}else if(msg?.type==='command'&&conn.playerId){execute(msg.command,conn.playerId);}});conn.on('close',()=>{if(conn.playerId&&game.players[conn.playerId]){const n=game.players[conn.playerId].name;delete game.players[conn.playerId];connections.delete(conn);game.turn=game.turn%Math.max(1,Object.keys(game.players).length);log(`${n} покинул(а) стол`);sync();}});});
 peer.on('error',err=>{if(err.type==='unavailable-id'){setError('Этот код комнаты уже занят. Нажми «Создать» ещё раз.');}else{setError('Не удалось связаться с сервером соединения. Попробуй обновить страницу или другую сеть.');}setConnection(false,'Ошибка соединения');});
 }
function joinRoom(){
 setError('');if(!window.Peer){setError('Не удалось загрузить PeerJS. Проверь подключение к интернету и обнови страницу.');return;}
 const code=byId('room-code').value.trim().toUpperCase().replace(/[^A-Z0-9]/g,'');if(code.length<5){setError('Введи код комнаты из сообщения друга.');return;}
 const name=byId('join-name').value.trim()||'Игрок';isHost=false;game.room=code;setConnection(false,'Подключаемся…');
 try{peer=new window.Peer();}catch(e){setError('Не получилось запустить соединение.');return;}
 peer.on('open',()=>{hostConn=peer.connect(`atcw-${code.toLowerCase()}`,{reliable:true});hostConn.on('open',()=>hostConn.send({type:'join',name}));hostConn.on('data',msg=>{if(msg?.type==='welcome'){myId=msg.playerId;applySnapshot(msg.state);setConnection(true,'Подключено');render();notify('Ты за столом.');}else if(msg?.type==='state'){applySnapshot(msg.state);render();}else if(msg?.type==='error'){setError(msg.message);setConnection(false,'Не подключено');}});hostConn.on('error',()=>{setError('Не удалось подключиться. Проверь код и убедись, что комната всё ещё открыта.');setConnection(false,'Не подключено');});hostConn.on('close',()=>{setConnection(false,'Связь потеряна');notify('Соединение с комнатой закрыто.');});});
 peer.on('error',()=>{setError('Не удалось подключиться к комнате. Проверь код и попробуй другую сеть.');setConnection(false,'Не подключено');});
 }
function applySnapshot(s){game.players={};for(const pl of s.players||[])game.players[pl.id]={...pl,deck:[],hand:pl.hand||[]};game.board=s.board||[];game.discard=s.discard||[];game.logs=s.logs||[];game.turn=s.turn||0;game.room=s.room||game.room;game.hostId=s.hostId;}
function leave(){try{hostConn?.close();peer?.destroy();}catch{}peer=null;hostConn=null;connections.clear();isHost=false;myId=null;game.players={};game.board=[];game.discard=[];game.logs=[];game.turn=0;game.room='';setConnection(false,'Не в комнате');byId('game').hidden=true;byId('lobby').hidden=false;setError('');}
function populateCatalog(){
 const groups=new Map();for(const c of game.catalog){if(!groups.has(c.group))groups.set(c.group,[]);groups.get(c.group).push(c);}
 byId('deck-select').innerHTML=[...groups].map(([group,decks])=>`<optgroup label="${escapeHtml(group)}">${decks.map(d=>`<option value="${escapeHtml(d.id)}">${escapeHtml(d.name)}</option>`).join('')}</optgroup>`).join('');
 byId('collection-count').textContent=`${game.catalog.length} колод · ${game.catalog.reduce((n,c)=>n+c.cards.length,0)} карт`;
}
function showCard(card){const dialog=byId('card-dialog');byId('dialog-card-art').style.backgroundImage=`url("${card.sheet}")`;byId('dialog-card-art').style.backgroundSize='1000% 700%';byId('dialog-card-art').style.backgroundPosition=`${card.col*100/9}% ${card.row*100/6}%`;byId('dialog-card-title').textContent=card.title||'Карта из набора';dialog.showModal();}
byId('create-room').addEventListener('click',makeHost);
byId('join-room').addEventListener('click',joinRoom);
byId('room-code').addEventListener('keydown',e=>{if(e.key==='Enter')joinRoom();});
byId('room-code').addEventListener('input',e=>e.target.value=e.target.value.toUpperCase());
byId('use-deck').addEventListener('click',()=>{const id=byId('deck-select').value;if(id)command('chooseDeck',{collectionId:id});});
byId('draw-card').addEventListener('click',()=>command('draw'));
byId('end-turn').addEventListener('click',()=>command('endTurn'));
byId('score-plus').addEventListener('click',()=>command('score',{delta:1}));
byId('score-minus').addEventListener('click',()=>command('score',{delta:-1}));
byId('reset-game').addEventListener('click',()=>{if(confirm('Сбросить поле, руки, колоды и счёт у всех игроков?'))command('reset');});
byId('leave-room').addEventListener('click',leave);
byId('copy-code').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(game.room);notify('Код комнаты скопирован.');}catch{notify(`Код комнаты: ${game.room}`);}});
byId('close-card').addEventListener('click',()=>byId('card-dialog').close());
byId('hand-cards').addEventListener('click',e=>{const action=e.target.closest('[data-action]');if(action){const i=Number(action.dataset.index);if(action.dataset.action==='play')command('play',{index:i});if(action.dataset.action==='discard-hand')command('discardHand',{index:i});return;}const art=e.target.closest('.card-face');if(art){const index=Number(art.closest('[data-hand-index]')?.dataset.handIndex);const card=currentPlayer()?.hand?.[index];if(card)showCard(card);}});
byId('board-cards').addEventListener('click',e=>{const action=e.target.closest('[data-action]');if(action){command(action.dataset.action==='flip'?'flip':'discardBoard',{index:Number(action.dataset.index)});return;}const item=e.target.closest('.board-item');if(item){const card=game.board[Number(item.dataset.boardIndex)]?.card;if(card)showCard(card);}});
byId('discard-pile').addEventListener('click',e=>{const el=e.target.closest('[data-card-view]');if(el){const card=game.discard.find(c=>c.id===el.dataset.cardView);if(card)showCard(card);}});
byId('play-area').addEventListener('dragover',e=>{e.preventDefault();});
byId('play-area').addEventListener('drop',e=>{e.preventDefault();const i=Number(e.dataTransfer.getData('text/plain'));if(Number.isInteger(i))command('play',{index:i});});
byId('hand-cards').addEventListener('dragstart',e=>{const item=e.target.closest('[data-hand-index]');if(item)e.dataTransfer.setData('text/plain',item.dataset.handIndex);});
window.addEventListener('beforeunload',()=>{try{peer?.destroy();}catch{}});
populateCatalog();
