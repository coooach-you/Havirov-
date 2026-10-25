import { getStore } from '@netlify/blobs';
const base=[{id:'2026-11-21',label:'21.–22. listopadu 2026'},{id:'2026-11-28',label:'28.–29. listopadu 2026'},{id:'2026-12-05',label:'5.–6. prosince 2026'}];
const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'};
const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers});
const store=()=>getStore('morava-voting-2026');
const validDate=x=>/^2026-(11|12)-\d\d$/.test(x)&&!Number.isNaN(Date.parse(x+'T12:00:00Z'))&&new Date(x+'T12:00:00Z').toISOString().slice(0,10)===x;
export default async function(req){
 try{
  const s=store();
  if(req.method==='GET'){
   const listing=await s.list();
   const all=await Promise.all(listing.blobs.filter(x=>x.key.startsWith('vote-')||x.key.startsWith('date-')).slice(0,250).map(async x=>({key:x.key,value:await s.get(x.key,{type:'json'})})));
   const dates=[...base,...all.filter(x=>x.key.startsWith('date-')&&x.value?.id&&validDate(x.value.id)).map(x=>x.value).filter(x=>!base.some(b=>b.id===x.id))].sort((a,b)=>a.id.localeCompare(b.id));
   const votes=all.filter(x=>x.key.startsWith('vote-')&&x.value?.name).map(x=>x.value).sort((a,b)=>a.name.localeCompare(b.name,'cs'));
   return json({dates,votes});
  }
  if(req.method!=='POST')return json({error:'Nepodporovaná metoda'},405);
  const b=await req.json();
  if(b.action==='addDate'){
   if(typeof b.date!=='string'||!validDate(b.date))return json({error:'Zadej platné datum v listopadu nebo prosinci 2026.'},400);
   const id=b.date;
   if(base.some(x=>x.id===id))return json({ok:true});
   const label=new Intl.DateTimeFormat('cs-CZ',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(id+'T12:00:00Z'));
   await s.setJSON('date-'+id,{id,label});return json({ok:true});
  }
  if(b.action==='vote'){
   if(typeof b.id!=='string'||!/^[0-9a-f-]{36}$/i.test(b.id)||typeof b.name!=='string'||!b.name.trim()||b.name.length>60||typeof b.comment!=='string'||b.comment.length>500||!Array.isArray(b.dates)||b.dates.length>100||b.dates.some(x=>typeof x!=='string'||!validDate(x)))return json({error:'Zkontroluj zadané údaje.'},400);
   const listing=await s.list();const available=new Set([...base.map(x=>x.id),...listing.blobs.filter(x=>x.key.startsWith('date-')).map(x=>x.key.slice(5))]);
   if(b.dates.some(x=>!available.has(x)))return json({error:'Neznámý termín. Obnov stránku.'},400);
   await s.setJSON('vote-'+b.id,{id:b.id,name:b.name.trim(),comment:b.comment.trim(),dates:[...new Set(b.dates)],updatedAt:new Date().toISOString()});return json({ok:true});
  }
  return json({error:'Neznámá akce'},400);
 }catch(e){console.error('Voting function error',e);return json({error:'Serverová chyba. Zkontroluj Functions logs v Netlify.'},500)}
}
