import fs from 'node:fs';
export const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
export const city = { id: id(90), code: '32.73', name: 'Kota Bandung', provinceName: 'Jawa Barat' };
export const user = { id: id(1), displayName: 'Nadia Pratama', email: 'nadia@valora.test', city, role: 'USER', status: 'ACTIVE', emailVerifiedAt: '2026-10-01T01:00:00Z', profilePhotoProvider: null, profilePhotoUrl: null, profilePhotoMigrationAvailable: false };
const date = '2026-10-01T03:00:00Z';
export const items = ['Keyboard mekanis', 'Kursi ruang kerja', 'Buku untuk sore hari', 'Keyboard cadangan', 'Kursi baca', 'Koleksi buku', 'Keyboard nirkabel', 'Kursi tamu'].map((title, index) => ({ id: id(100+index), title, categoryCode: ['electronics', 'furniture', 'books'][index%3], subcategoryCode: null, description: 'Fixture inspeksi: barang yang digunakan sehari-hari, dirawat dan dicatat kondisinya sebelum ditawarkan kembali.', functionSummary: 'Berfungsi dengan baik', conditionSummary: 'Bekas pakai ringan', completenessSummary: 'Lengkap', issueSummary: null, purchaseYear: 2024, originalPriceIdr: 450000, estimatedWeightGrams: 800, reservedByTransactionId: null, itemRevision: 1, version: 2, createdAt: date, updatedAt: date, media: [{id:id(200+index), mime:'image/webp',bytes:10000,orderIndex:0,processedAt:date}, ...(index===0 ? [{id:id(220),mime:'image/webp',bytes:10000,orderIndex:1,processedAt:date}] : [])] }));
export const rubric = { id: id(300), rubricKey: 'electronics', ruleVersion: 'score-v1', policyVersion: 'policy-v1', recommendationVersion: 'recommend-v1', effectiveAt: date, questions: ['function','physical','completeness','repairMethod','repairSupport','reuse'].map((key) => ({key,prompt:{function:'Bagaimana fungsi utama barang?',physical:'Bagaimana kondisi fisiknya?',completeness:'Apakah perlengkapannya lengkap?',repairMethod:'Bagaimana barang bisa diperbaiki?',repairSupport:'Apakah dukungan perbaikan tersedia?',reuse:'Apakah masih dapat digunakan kembali?'}[key], choices:[{code:'HIGH',label:'Baik',value:100},{code:'MEDIUM',label:'Cukup',value:60},{code:'LOW',label:'Perlu diperbaiki',value:20}]})), safetyQuestions:[{code:'unsafe',prompt:'Apakah terdapat kerusakan yang berisiko?',effectOnYes:'SPECIAL_REVIEW'}], contextPrompt:null };
export const assessment = { id:id(310),itemId:items[0].id,itemRevision:1,rubricVersionId:rubric.id,ruleVersion:'score-v1',policyVersion:'policy-v1',recommendationVersion:'recommend-v1',rubric,status:'COMPLETE',condition:85,repairability:80,repairabilityReason:null,economicValue:75,reusePotential:90,score:83,label:'Potensi sirkular tinggi',missingFields:[],safetyFlags:[],recommendations:['REPAIR','RESELL','EXCHANGE','DONATE'].map(action=>({action,status:'ELIGIBLE',reasons:['THRESHOLD_MET']})),answers:null,economicSources:{estimatedResaleValue:{amountIdr:250000,sourceType:'USER_ESTIMATE',sourceNote:'Perkiraan pemilik',referenceDate:'2026-10-01',reportedBy:user.id}},createdAt:date,isCurrent:true,origin:'USER_REPORTED' };
const publicFixture = JSON.parse(fs.readFileSync('.impeccable/review/market-detail/public-fixture.json','utf8'));
export const listing = {id:id(400),itemId:items[0].id,type:'RESELL',status:'ACTIVE',version:4,createdAt:date,updatedAt:date,currentRevision:{...publicFixture.listing.revision,id:id(410),itemId:items[0].id,assessmentId:assessment.id,title:items[0].title,description:items[0].description,categoryCode:'electronics',categoryName:'Elektronik',subcategoryCode:null,media:items[0].media.map(m=>({...m,url:'/images/keyboard.webp'})),city,condition:85,score:83,scoreLabel:assessment.label,conditionDisclosure:'Bekas pakai ringan, fungsi tetap baik.',askingPriceIdr:250000,handoverMethods:['MEETUP']}};
export const offer = {id:id(500),listingId:listing.id,listingRevisionId:listing.currentRevision.id,bidderId:id(2),exchangeItemId:null,exchangeSnapshot:null,transactionId:null,status:'PENDING',endReason:null,expiresAt:'2027-01-01T00:00:00Z',version:1,currentRevision:{id:id(510),revisionNo:1,priceIdr:225000,message:'Apakah bisa bertemu di Bandung akhir pekan ini?',proposedById:id(2),respondsById:user.id,createdAt:date,expiresAt:'2027-01-01T00:00:00Z'},createdAt:date,listing:{title:items[0].title,type:'RESELL'}};
export const transaction = {id:id(600),listingId:listing.id,offerId:offer.id,type:'RESELL',status:'AWAITING_HANDOVER',sellerOrDonorId:user.id,buyerOrRecipientId:id(2),finalPriceIdr:225000,snapshot:{items:[{id:items[0].id,title:items[0].title,description:items[0].description,conditionSummary:'Bekas pakai ringan',mediaIds:[id(200)],fromUserId:user.id,toUserId:id(2)}],parties:[{id:user.id,displayName:user.displayName},{id:id(2),displayName:'Raka Putra'}],handoverMethods:['MEETUP']},acceptedAt:date,targetHandoverAt:'2026-10-10T04:00:00Z',overdueAt:null,completedAt:null,cancelledAt:null,resolutionOrigin:null,correctedAt:null,version:1,confirmations:[],cancellations:[],disputes:[],corrections:[],conversationId:id(700),requiredConfirmations:[{actorId:user.id,itemId:items[0].id,kind:'HANDED_OVER'},{actorId:id(2),itemId:items[0].id,kind:'RECEIVED'}]};
export const conversation={id:id(700),listingId:listing.id,listingTitle:items[0].title,transactionId:transaction.id,participant:{id:id(2),displayName:'Raka Putra',profilePhotoUrl:null},lastMessage:{id:id(710),conversationId:id(700),senderId:id(2),body:'Terima kasih. Bisa saya lihat foto bagian belakangnya?',clientMessageId:id(711),sentAt:date},unreadCount:2,updatedAt:date};
export const messageRows=Array.from({length:12},(_,index)=>({...conversation.lastMessage,id:id(710+index),senderId:index%2 ? user.id : id(2),body:index===11 ? conversation.lastMessage.body : index%2 ? 'Bisa, saya tambahkan fotonya. Barang masih berfungsi dengan baik.' : 'Halo, apakah barang ini masih tersedia?',sentAt:new Date(Date.parse(date)+index*60000).toISOString()}));
export const notification={id:id(800),type:'HANDOVER_REMINDER',payload:{transactionId:transaction.id,title:items[0].title,day:3},createdAt:date,readAt:null};
export const repair={id:id(900),itemId:items[0].id,performedAt:date,actionSummary:'Membersihkan tombol dan mengganti stabilizer',privateNotes:'Dilakukan di rumah, tanpa mengganti komponen utama.',costIdr:35000,costKind:'ACTUAL',outcome:'SUCCEEDED',afterCondition:'Tombol kembali nyaman digunakan',status:'VALID',shareSummaryPublic:true,shareDetailsWithFutureOwner:false,evidence:[],version:1,createdAt:date,origin:'USER_REPORTED'};
export const passport={itemId:items[0].id,categoryCode:'electronics',visibility:'PUBLIC',version:1,projection:'OWNER',title:items[0].title,description:items[0].description,media:[{id:id(200),url:'/images/keyboard.webp'}],timeline:[{id:id(901),type:'ASSESSMENT',origin:'USER_REPORTED',occurredAt:date,recordedAt:date,summary:'Penilaian kondisi dicatat',correctionOfId:null,assessment:{status:'COMPLETE',score:83,label:assessment.label,ruleVersion:'score-v1',historical:false,valid:true}},{id:id(902),type:'REPAIR',origin:'USER_REPORTED',occurredAt:date,recordedAt:date,summary:repair.actionSummary,correctionOfId:null,repair:{summary:repair.actionSummary,afterCondition:repair.afterCondition,status:'VALID',outcome:'SUCCEEDED'}}]};
export const impact={from:null,to:null,metrics:[{metric:'ITEMS_REVALUED',value:'8',unit:'ITEM'},{metric:'REPAIRS_RECORDED',value:'2',unit:'ITEM'},{metric:'COMPLETED_TRANSFERS',value:'3',unit:'ITEM'},{metric:'ESTIMATED_TRANSFER_WEIGHT',value:'18000',unit:'GRAM'},{metric:'CONFIRMED_SALE_VALUE',value:'875000',unit:'IDR'}],weightCoverage:{known:'2',total:'3'},notes:['Aktivitas berasal dari catatan pengguna di Valora.','Nilai Resell adalah nominal kesepakatan; bukan bukti pembayaran.','Berat transfer merupakan estimasi untuk barang yang memiliki data berat.']};
export const correction={id:id(950),transactionId:transaction.id,status:'OPEN',assignedAdminId:null,version:1,resolution:null,createdAt:date,resolvedAt:null,reason:'Catatan serah terima perlu ditinjau kembali.',resolutionReason:null,transaction:{id:transaction.id,version:1,type:'RESELL',correctedAt:null,finalPriceIdr:'225000',items:[{id:items[0].id,title:items[0].title,estimatedWeightGrams:800,assessmentId:assessment.id}]},evidence:[{id:id(951),note:'Barang belum diterima sesuai catatan awal.',messageSnapshot:null,createdAt:date,purgedAt:null,media:[]}],sources:{assessments:[],repairs:[]},passports:[]};
export async function mock(page, config={}) {
 const writes=[]; const mutable={item:structuredClone(items[0]),listing:structuredClone(listing),notification:structuredClone(notification),transaction:structuredClone(transaction),messages:structuredClone(messageRows),user:{...user,...config.user}};
 await page.route('**/api/v1/**',async route=>{
  const req=route.request(),u=new URL(req.url()),p=u.pathname.replace('/api/v1',''),method=req.method();
  if(p==='/conversations/stream')return route.fulfill({status:204,body:''});
  if(config.delay && config.delay(p))await new Promise(r=>setTimeout(r,1000));
  if(config.fail && config.fail(p,u,method))return route.fulfill({status:503,json:{error:{code:'DEPENDENCY_UNAVAILABLE',message:'Data gagal dimuat. Coba lagi.',requestId:'mock'}}});
  if(config.conflict && method!=='GET' && p!=='/auth/csrf')return route.fulfill({status:409,json:{error:{code:'STATE_CONFLICT',message:'Data telah berubah. Muat ulang detail.',requestId:'mock'}}});
  let data=[],meta;
  if(method!=='GET'){let body;try{body=req.postDataJSON()}catch{body={}}writes.push({path:p,method,body,headers:req.headers()});
   if(p==='/auth/logout'){config.guest=true;data={};}
   else if(p.endsWith('/read')){mutable.notification.readAt=date;data={};}
   else if(p.endsWith('/messages')){const entry={...conversation.lastMessage,id:id(799),senderId:user.id,body:body.body,clientMessageId:body.clientMessageId};mutable.messages.push(entry);data=entry;}
   else if(p.endsWith('/confirmations')){mutable.transaction.confirmations.push({...body,id:id(650),actorId:user.id,confirmedAt:date});data=mutable.transaction;}
   else if(p==='/me'){mutable.user={...mutable.user,...body};data=mutable.user;}
   else if(p.endsWith('/media/tickets')){data={ticketId:id(982),uploadUrl:`/api/v1/media/uploads/${id(982)}`};}
   else if(p.endsWith('/media/finalize')){data=mutable.item;}
   else if(p==='/items'){data={...mutable.item,...body};}
   else if(p.includes('/items/') && method==='PATCH'){mutable.item={...mutable.item,...body};data=mutable.item;}
   else if(p.includes('/media/') && method==='DELETE'){mutable.item.media=mutable.item.media.filter(m=>m.id!==p.split('/').at(-1));data=mutable.item;}
   else if(p.endsWith('/explain')){data={summary:'Penjelasan fixture sesuai rubrik yang tersimpan.',strengths:['Fungsi barang masih baik.'],limitations:['Berdasarkan laporan pemilik.'],nextSteps:['Periksa kondisi secara langsung.'],templateVersion:'template-v1'};}
   else if(p.endsWith('/assessments')){data=assessment;}
   else if(p.endsWith('/accept')){data=transaction;}
   else if(p.endsWith('/repairs')){data=repair;}
   else if(p.endsWith('/listings')){data=listing;}
   else if(p.endsWith('/counter')){data=offer;}
   else if(p.includes('/listings/')){data=mutable.listing;}
   else data={};
  }else if(p==='/auth/session'){data={state:config.guest?'GUEST':'AUTHENTICATED',user:config.guest?null:mutable.user,reason:null,sessionId:config.guest?null:'fixture-session',serverTime:date,expiresAt:'2027-01-01T00:00:00Z',reauthenticatedUntil:'2027-01-01T00:00:00Z'};}
  else if(p==='/auth/csrf')data={token:'fixture-csrf'};
  else if(p==='/me')data=mutable.user;
  else if(p==='/items'){data=config.empty?[]:items.slice(0, Number(u.searchParams.get('limit')??20));if(config.nextItems)meta={nextCursor:'next'};}
  else if(/^\/items\/[^/]+$/.test(p))data={...mutable.item,...(config.reserved?{reservedByTransactionId:transaction.id}:{})};
  else if(p.endsWith('/assessments'))data=config.empty?[]:[assessment];
  else if(p.endsWith('/repairs'))data=config.empty?[]:[repair];
  else if(p.endsWith('/passport')||p.startsWith('/passport/'))data=passport;
  else if(p.startsWith('/assessments/'))data=assessment;
  else if(p.endsWith('/rubric'))data=rubric;
  else if(p.endsWith('/economic-references'))data=[];
  else if(p==='/categories')data=[{code:'electronics',name:'Elektronik',subcategories:[]},{code:'furniture',name:'Furnitur',subcategories:[]},{code:'books',name:'Buku',subcategories:[]}];
  else if(p==='/cities')data=[city];
  else if(p==='/listings/mine')data=config.empty?[]:[listing,{...listing,id:id(401),status:'PENDING_REVIEW',currentRevision:{...listing.currentRevision,title:'Kursi ruang kerja'}},{...listing,id:id(402),status:'DRAFT',currentRevision:{...listing.currentRevision,title:'Buku untuk sore hari'}}];
  else if(p.startsWith('/listings/'))data=mutable.listing;
  else if(p==='/offers/mine')data=config.empty?[]:[offer,{...offer,id:id(501),status:'ACCEPTED',transactionId:transaction.id}];
  else if(p==='/notifications')data=config.empty?[]:[mutable.notification];
  else if(p==='/conversations')data=config.empty?[]:[conversation,{...conversation,id:id(701),listingTitle:'Buku untuk sore hari',participant:{...conversation.participant,displayName:'Alya Rahma'},unreadCount:0}];
  else if(p.endsWith('/messages')){data=u.searchParams.has('before')?[{...messageRows[0],id:id(709),body:'Pesan sebelumnya'}]:mutable.messages;if(!u.searchParams.has('before'))meta={nextCursor:'history'};}
  else if(p==='/me/transactions'){data=config.empty?[]:[transaction,{...transaction,id:id(601),status:'COMPLETED',completedAt:date}];if(config.nextTransactions)meta={nextCursor:'next'};}
  else if(p.startsWith('/transactions/'))data=mutable.transaction;
  else if(p.startsWith('/correction-cases/'))data=correction;
  else if(p.endsWith('/impact'))data=impact;
  else if(p==='/me/sessions')data=[{id:id(990),createdAt:date,lastSeenAt:date,expiresAt:'2027-01-01T00:00:00Z',current:true}];
  else if(p.endsWith('/access') && p.startsWith('/media/')){const n=Number(p.split('/')[2].slice(-12));data={url:'/images/'+(n%3===2?'keyboard':n%3===0?'chair':'books')+'.webp'};}
  else if(p.startsWith('/market/'))data=publicFixture.listing;
  else if(p==='/market')data=publicFixture.rows;
  return route.fulfill({json:{data,...(meta?{meta}:{})}});
 });
 return {writes,mutable,config};
}
