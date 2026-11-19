import {createHmac,randomBytes} from 'node:crypto';
// Best effort per warm instance. Never represent these counts as a global budget.
export function makeLightLimit(){
  const salt=randomBytes(32);let date,visitors,seen,totals;
  return (day,ip,action,id,limits)=>{
    if(day!==date){date=day;visitors=new Map();seen=new Set();totals=[0,0];}
    const who=createHmac('sha256',salt).update(ip).digest('hex');
    const own=visitors.get(who)||[0,0], j=action==='image'?1:0;
    let result=0;
    if(action){const key=who+':'+action+':'+id;
      if(seen.has(key))result=2;
      else if(own[j]>=limits[j*2]||totals[j]>=limits[j*2+1]||seen.size>=4096)result=1;
      else{own[j]++;totals[j]++;visitors.set(who,own);seen.add(key);}
    }
    return [result,own[0],totals[0],own[1],totals[1]];
  };
}
export const lightLimit=makeLightLimit();
